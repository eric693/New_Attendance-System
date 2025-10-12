// DbOperations.gs - 完整優化版（精簡版 - 約 300 行）

// ==================== 員工相關功能 ====================

/**
 * 寫入員工資料
 * ⭐ 新增或更新時，自動設定為「管理員」和「啟用」狀態
 */
function writeEmployee_(profile) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_EMPLOYEES);
  const values = sheet.getDataRange().getValues();
  
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === profile.userId) {
      sheet.getRange(i + 1, 6).setValue("管理員");
      sheet.getRange(i + 1, 8).setValue("啟用");
      Logger.log(`使用者 ${profile.userId} 已存在，更新為管理員（啟用）`);
      return values[i];
    }
  }
  
  const row = [ 
    profile.userId,
    profile.email || "",
    profile.displayName,
    profile.pictureUrl,
    new Date(),
    "管理員",
    "",
    "啟用"
  ];
  
  sheet.appendRow(row);
  Logger.log(`新增使用者 ${profile.userId} 為管理員（啟用）`);
  return row;
}

/**
 * 根據 LINE User ID 查詢員工資料
 */
function findEmployeeByLineUserId_(userId) {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_EMPLOYEES);
  const values = sh.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === userId) {
      const dept = values[i][5] || "管理員";
      
      if (dept !== "管理員") {
        sh.getRange(i + 1, 6).setValue("管理員");
      }
      
      return {
        ok: true,
        userId: values[i][0],
        email: values[i][1] || "",
        name: values[i][2],
        picture: values[i][3],
        dept: "管理員",
        status: "啟用"
      };
    }
  }
  
  return { ok: false, code: "ERR_NO_DATA" };
}

// ==================== Session 管理 ====================

/**
 * 建立 Session
 */
function writeSession_(userId) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_SESSION);
  const oneTimeToken = Utilities.getUuid();
  const now = new Date();
  const expiredAt = new Date(now.getTime() + SESSION_TTL_MS);

  const range = sheet.getRange("B:B").createTextFinder(userId).findNext();

  if (range) {
    const row = range.getRow();
    sheet.getRange(row, 1, 1, 4).setValues([[oneTimeToken, userId, now, expiredAt]]);
  } else {
    sheet.appendRow([oneTimeToken, userId, now, expiredAt]);
  }
  return oneTimeToken;
}

/**
 * 兌換一次性 token
 */
function verifyOneTimeToken_(otoken) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_SESSION);
  const range = sheet.getRange("A:A").createTextFinder(otoken).findNext();
  if (!range) return null;

  const row = range.getRow();
  const sessionToken = Utilities.getUuid();
  const now = new Date();
  const expiredAt = new Date(now.getTime() + SESSION_TTL_MS);
  const userId = sheet.getRange(row, 2).getValue();

  sheet.getRange(row, 1, 1, 4).setValues([[sessionToken, userId, now, expiredAt]]);
  return sessionToken;
}

/**
 * 檢查 Session（自動延期）
 */
function checkSession_(sessionToken) {
  if (!sessionToken) return { ok: false, code: "MISSING_SESSION_TOKEN" };

  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_SESSION);
  if (!sh) return { ok: false, code: "SESSION_SHEET_NOT_FOUND" };

  const values = sh.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    const [token, userId, , expiredAt] = values[i];
    if (token === sessionToken) {
      if (expiredAt && new Date() > new Date(expiredAt)) {
        return { ok: false, code: "ERR_SESSION_EXPIRED" };
      }
      
      const newExpiredAt = new Date(new Date().getTime() + SESSION_TTL_MS);
      sh.getRange(i + 1, 4).setValue(newExpiredAt);
      
      const employee = findEmployeeByLineUserId_(userId);
      if (!employee.ok) {
        Logger.log("Session 檢查失敗: " + JSON.stringify(employee));
        return { ok: employee.ok, code: employee.code };
      }
      
      return { 
        ok: true, 
        user: employee,
        code: "WELCOME_BACK",
        params: { name: employee.name }
      };
    }
  }
  return { ok: false, code: "ERR_SESSION_INVALID" };
}

// ==================== 打卡功能 ====================

/**
 * 打卡功能
 */
function punch(sessionToken, type, lat, lng, note) {
  const employee = checkSession_(sessionToken);
  const user = employee.user;
  if (!user) return { ok: false, code: "ERR_SESSION_INVALID" };

  const shLoc = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOCATIONS);
  const lastRow = shLoc.getLastRow();
  
  if (lastRow < 2) {
    return { ok: false, code: "ERR_NO_LOCATIONS" };
  }
  
  const values = shLoc.getRange(2, 1, lastRow - 1, 5).getValues();
  let locationName = null;
  let minDistance = Infinity;
  
  for (let [, name, locLat, locLng, radius] of values) {
    if (!name || !locLat || !locLng) continue;
    
    const dist = getDistanceMeters_(lat, lng, Number(locLat), Number(locLng));
    
    if (dist <= Number(radius) && dist < minDistance) {
      locationName = name;
      minDistance = dist;
    }
  }

  if (!locationName) {
    return { ok: false, code: "ERR_OUT_OF_RANGE" };
  }

  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_ATTENDANCE);
  const row = [
    new Date(),
    user.userId,
    user.dept,
    user.name,
    type,
    `(${lat},${lng})`,
    locationName,
    "",
    "",
    note || ""
  ];
  sh.getRange(sh.getLastRow() + 1, 1, 1, row.length).setValues([row]);

  return { ok: true, code: `PUNCH_SUCCESS`, params: { type: type } };
}

/**
 * 補打卡功能
 */
function punchAdjusted(sessionToken, type, punchDate, lat, lng, note) {
  const employee = checkSession_(sessionToken);
  const user = employee.user;
  if (!user) return { ok: false, code: "ERR_SESSION_INVALID" };

  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_ATTENDANCE);
  sh.appendRow([
    punchDate,
    user.userId,
    user.dept,
    user.name,
    type,
    `(${lat},${lng})`,
    "",
    "補打卡",
    "?",
    note
  ]);

  return { ok: true, code: `ADJUST_PUNCH_SUCCESS`, params: { type: type } };
}

/**
 * 取得出勤紀錄
 */
function getAttendanceRecords(monthParam, userIdParam) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ATTENDANCE);
  const values = sheet.getDataRange().getValues().slice(1);
  
  return values.filter(row => {
    if (!row[0]) return false;
    
    const d = new Date(row[0]);
    const yyyy_mm = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    const monthMatch = yyyy_mm === monthParam;
    const userMatch = userIdParam ? row[1] === userIdParam : true;
    return monthMatch && userMatch;
  }).map(r => ({
    date: r[0],
    userId: r[1],
    salary: r[2],
    name: r[3],
    type: r[4],
    gps: r[5],
    location: r[6],
    note: r[7],
    audit: r[8],
    device: r[9]
  }));
}

/**
 * 👉 新增：取得出勤詳細資料（用於報表匯出）
 */
function getAttendanceDetails(monthParam, userIdParam) {
  const records = getAttendanceRecords(monthParam, userIdParam);
  
  // 按員工和日期分組
  const dailyRecords = {};
  
  records.forEach(r => {
    const dateKey = formatDate(r.date);
    const userId = r.userId || 'unknown';  // 👈 確保 userId 不為空
    const userName = r.name || '未知員工';   // 👈 確保 name 不為空
    const key = `${userId}_${dateKey}`;
    
    if (!dailyRecords[key]) {
      dailyRecords[key] = {
        date: dateKey,
        userId: userId,      // 👈 使用處理過的 userId
        name: userName,      // 👈 使用處理過的 userName
        record: [],
        reason: ""
      };
    }
    
    dailyRecords[key].record.push({
      time: formatTime(r.date),
      type: r.type,
      location: r.location,
      note: r.note || ""
    });
  });
  
  // 判斷每日狀態
  const result = Object.values(dailyRecords).map(day => {
    const hasIn = day.record.some(r => r.type === "上班");
    const hasOut = day.record.some(r => r.type === "下班");
    
    let reason = "";
    if (!hasIn && !hasOut) {
      reason = "STATUS_NO_RECORD";
    } else if (!hasIn) {
      reason = "STATUS_PUNCH_IN_MISSING";
    } else if (!hasOut) {
      reason = "STATUS_PUNCH_OUT_MISSING";
    } else {
      reason = "STATUS_PUNCH_NORMAL";
    }
    
    return {
      date: day.date,
      userId: day.userId,
      name: day.name,
      record: day.record,
      reason: reason
    };
  });
  
  Logger.log(`📊 getAttendanceDetails: 共 ${result.length} 筆記錄`);
  return { ok: true, records: result };
}

// ==================== 地點管理 ====================

/**
 * 新增打卡地點
 */
function addLocation(name, lat, lng) {
  if (!name || !lat || !lng) {
    return { ok: false, code: "ERR_INVALID_INPUT" };
  }
  
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_LOCATIONS);
  sh.appendRow(["", name, lat, lng, "100"]);
  return { ok: true, code: "LOCATION_ADD_SUCCESS" };
}

/**
 * 取得所有打卡地點
 */
function getLocation() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOCATIONS);
  const values = sheet.getDataRange().getValues();
  
  if (values.length === 0) {
    return { ok: true, locations: [] };
  }
  
  const headers = values.shift();
  const locations = values
    .filter(row => row[1])
    .map(row => ({
      id: row[headers.indexOf('ID')] || '',
      name: row[headers.indexOf('地點名稱')] || '',
      lat: row[headers.indexOf('GPS(緯度)')] || 0,
      lng: row[headers.indexOf('GPS(經度)')] || 0,
      scope: row[headers.indexOf('容許誤差(公尺)')] || 100
    }));
  
  return { ok: true, locations: locations };
}

// ==================== 審核功能 ====================

/**
 * 取得待審核請求（補打卡）
 */
function getReviewRequest() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ATTENDANCE);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];

  const reviewRequest = values.filter((row, index) => {
    if (index === 0 || !row[0]) return false;

    const remarkCol = headers.indexOf('備註');
    const auditCol = headers.indexOf('管理員審核');
    
    return row[remarkCol] === "補打卡" && row[auditCol] === "?";
  }).map(row => {
    const actualRowNumber = values.indexOf(row) + 1;
    return {
      id: actualRowNumber,
      name: row[headers.indexOf('打卡人員')],
      type: row[headers.indexOf('打卡類別')],
      remark: row[headers.indexOf('備註')],
      applicationPeriod: formatDateTime(row[headers.indexOf('打卡時間')])
    };
  });
  
  return { ok: true, reviewRequest: reviewRequest };
}

/**
 * 更新審核狀態（加入 LINE 通知）
 */
function updateReviewStatus(rowNumber, status, note) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ATTENDANCE);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const reviewStatusCol = headers.indexOf('管理員審核') + 1;

    if (reviewStatusCol === 0) {
      return { ok: false, msg: "試算表缺少必要欄位：'管理員審核'" };
    }

    // 👉 取得該筆打卡記錄的詳細資訊
    const record = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];
    const userId = record[headers.indexOf('員工ID')];
    const employeeName = record[headers.indexOf('打卡人員')];
    const punchDate = formatDate(record[headers.indexOf('打卡時間')]);
    const punchTime = formatTime(record[headers.indexOf('打卡時間')]);
    const punchType = record[headers.indexOf('打卡類別')];

    // 更新審核狀態
    sheet.getRange(rowNumber, reviewStatusCol).setValue(status);
    
    // 👉 發送 LINE 通知
    const isApproved = (status === "v");
    const reviewer = "系統管理員"; // 可以從 session 取得審核人姓名
    
    notifyPunchReview(
      userId,
      employeeName,
      punchDate,
      punchTime,
      punchType,
      reviewer,
      isApproved,
      note || ""
    );
    
    Logger.log(`📤 已發送補打卡審核通知給 ${employeeName}`);

    return { ok: true, msg: "審核成功" };
  } catch (err) {
    Logger.log("updateReviewStatus 錯誤: " + err.message);
    return { ok: false, msg: `審核失敗：${err.message}` };
  }
}

// ==================== 工具函數 ====================

/**
 * 計算兩點之間的距離（公尺）
 */
function getDistanceMeters_(lat1, lng1, lat2, lng2) {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * 格式化日期時間
 */
function formatDateTime(date) {
  if (!date) return '';
  try {
    return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  } catch (e) {
    return String(date);
  }
}

/**
 * 格式化日期
 */
function formatDate(date) {
  if (!date) return '';
  try {
    return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  } catch (e) {
    return String(date);
  }
}

/**
 * 格式化時間
 */
function formatTime(date) {
  if (!date) return '';
  try {
    return Utilities.formatDate(date, Session.getScriptTimeZone(), 'HH:mm:ss');
  } catch (e) {
    return String(date);
  }
}