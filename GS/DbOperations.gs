// DbOperations.gs - 完整優化版（精簡版）

// ==================== 員工相關功能 ====================

/**
 * ✅ 修正：寫入員工資料時，統一使用 LINE userId 作為員工ID
 */
function writeEmployee_(profile) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_EMPLOYEES);
  const values = sheet.getDataRange().getValues();
  
  // ✅ 關鍵：LINE userId 就是員工ID
  const employeeId = profile.userId;
  
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === employeeId) {
      // 更新現有員工資料
      sheet.getRange(i + 1, 2).setValue(profile.email || "");
      sheet.getRange(i + 1, 3).setValue(profile.displayName);
      sheet.getRange(i + 1, 4).setValue(profile.pictureUrl);
      sheet.getRange(i + 1, 6).setValue("管理員");
      sheet.getRange(i + 1, 8).setValue("啟用");
      Logger.log(`✅ 更新員工 ${employeeId}`);
      return values[i];
    }
  }
  
  // 新增員工
  const row = [ 
    employeeId,           // 🔑 關鍵：LINE userId 作為員工ID
    profile.email || "",
    profile.displayName,
    profile.pictureUrl,
    new Date(),
    "管理員",
    "",
    "啟用"
  ];
  
  sheet.appendRow(row);
  Logger.log(`✅ 新增員工 ${employeeId}`);
  return row;
}

/**
 * ✅ 修正：根據 LINE User ID 查詢員工資料
 */
function findEmployeeByLineUserId_(userId) {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_EMPLOYEES);
  const values = sh.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === userId) {
      return {
        ok: true,
        userId: values[i][0],        // ✅ LINE userId
        employeeId: values[i][0],    // ✅ 員工ID = LINE userId
        email: values[i][1] || "",
        name: values[i][2],
        picture: values[i][3],
        dept: values[i][5] || "管理員",
        status: values[i][7] || "啟用"
      };
    }
  }
  
  return { ok: false, code: "ERR_NO_DATA" };
}

// ==================== Session 管理 ====================

/**
 * ⭐ 驗證 Session Token（簡化版 - 只返回 true/false）
 */
function validateSession(sessionToken) {
  try {
    const result = checkSession_(sessionToken);
    return result.ok === true;
  } catch (error) {
    Logger.log('validateSession 錯誤: ' + error);
    return false;
  }
}

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
 * ✅ 檢查 Session（自動延期）- 修正版
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
      
      // 延長 Session
      const newExpiredAt = new Date(new Date().getTime() + SESSION_TTL_MS);
      sh.getRange(i + 1, 4).setValue(newExpiredAt);
      
      // 查詢員工資料
      const employee = findEmployeeByLineUserId_(userId);
      if (!employee.ok) {
        Logger.log("❌ Session 檢查失敗: " + JSON.stringify(employee));
        return { ok: false, code: employee.code };
      }
      
      // ⭐⭐⭐ 關鍵修正：不要返回整個 employee 物件，而是只返回純淨的 user 資料
      return { 
        ok: true, 
        user: {
          userId: employee.userId,
          employeeId: employee.employeeId,
          email: employee.email,
          name: employee.name,
          picture: employee.picture,
          dept: employee.dept,
          status: employee.status
        },
        code: "WELCOME_BACK",
        params: { name: employee.name }
      };
    }
  }
  return { ok: false, code: "ERR_SESSION_INVALID" };
}

/**
 * 🧪 測試 checkSession_
 */
function testCheckSession() {
  Logger.log('🧪 測試 checkSession_');
  Logger.log('');
  
  const token = '04fd1452-4aca-4b03-ad17-45f03144c6ff';
  
  Logger.log('📡 Token: ' + token.substring(0, 20) + '...');
  Logger.log('');
  
  const result = checkSession_(token);
  
  Logger.log('📤 checkSession_ 結果:');
  Logger.log(JSON.stringify(result, null, 2));
  Logger.log('');
  
  if (result.ok && result.user) {
    Logger.log('✅ Session 有效');
    Logger.log('');
    Logger.log('👤 User 資料:');
    Logger.log('   - userId: ' + result.user.userId);
    Logger.log('   - employeeId: ' + result.user.employeeId);
    Logger.log('   - name: ' + result.user.name);
    Logger.log('   - dept: ' + result.user.dept);
    Logger.log('   - email: ' + result.user.email);
    Logger.log('   - status: ' + result.user.status);
    Logger.log('');
    Logger.log('🔍 檢查 user 物件是否乾淨:');
    Logger.log('   - user.ok 存在嗎? ' + (result.user.ok !== undefined ? '❌ 是（有問題）' : '✅ 否（正常）'));
  } else {
    Logger.log('❌ Session 無效');
    Logger.log('   code: ' + result.code);
  }
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
 * 取得出勤詳細資料（用於報表匯出）
 */
function getAttendanceDetails(monthParam, userIdParam) {
  const records = getAttendanceRecords(monthParam, userIdParam);
  
  const dailyRecords = {};
  
  records.forEach(r => {
    const dateKey = formatDate(r.date);
    const userId = r.userId || 'unknown';
    const userName = r.name || '未知員工';
    const key = `${userId}_${dateKey}`;
    
    if (!dailyRecords[key]) {
      dailyRecords[key] = {
        date: dateKey,
        userId: userId,
        name: userName,
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

    const record = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];
    const userId = record[headers.indexOf('員工ID')];
    const employeeName = record[headers.indexOf('打卡人員')];
    const punchDate = formatDate(record[headers.indexOf('打卡時間')]);
    const punchTime = formatTime(record[headers.indexOf('打卡時間')]);
    const punchType = record[headers.indexOf('打卡類別')];

    sheet.getRange(rowNumber, reviewStatusCol).setValue(status);
    
    const isApproved = (status === "v");
    const reviewer = "系統管理員";
    
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


function debugCheckSession() {
  Logger.log('═══════════════════════════════════════');
  Logger.log('🔍 診斷 checkSession_');
  Logger.log('═══════════════════════════════════════');
  
  const token = '1fb23a74-f5ee-4d87-bcf7-2bcde4a13d17';  // 你的有效 token
  
  Logger.log('📡 Token: ' + token);
  Logger.log('');
  
  const session = checkSession_(token);
  
  Logger.log('📤 checkSession_ 返回結果:');
  Logger.log(JSON.stringify(session, null, 2));
  Logger.log('');
  
  Logger.log('🔍 詳細檢查:');
  Logger.log('   - session 存在: ' + (session ? '是' : '否'));
  Logger.log('   - session.ok: ' + session.ok);
  Logger.log('   - session.user 存在: ' + (session.user ? '是' : '否'));
  
  if (session.user) {
    Logger.log('');
    Logger.log('👤 User 物件內容:');
    Logger.log('   - userId: ' + session.user.userId);
    Logger.log('   - employeeId: ' + session.user.employeeId);
    Logger.log('   - name: ' + session.user.name);
    Logger.log('   - dept: ' + session.user.dept);
    Logger.log('   - email: ' + session.user.email);
    Logger.log('   - status: ' + session.user.status);
  } else {
    Logger.log('❌ session.user 是 null 或 undefined');
  }
  
  Logger.log('═══════════════════════════════════════');
}