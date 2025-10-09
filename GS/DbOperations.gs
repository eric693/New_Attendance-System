// DbOperations.gs - 完整修正版（自動啟用所有使用者為管理員）

/**
 * 寫入員工資料
 * ⭐ 新增或更新時，自動設定為「管理員」和「啟用」狀態
 */
function writeEmployee_(profile) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_EMPLOYEES);
  const values = sheet.getDataRange().getValues();
  
  // 檢查使用者是否已存在
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === profile.userId) {
      // ⭐ 已存在的使用者：更新為啟用和管理員
      sheet.getRange(i + 1, 6).setValue("管理員");  // 第6欄：部門
      sheet.getRange(i + 1, 8).setValue("啟用");    // 第8欄：狀態
      
      Logger.log(`使用者 ${profile.userId} 已存在，更新為管理員（啟用）`);
      return values[i];
    }
  }
  
  // ⭐ 新使用者：直接建立為「管理員」和「啟用」
  const row = [ 
    profile.userId,              // LINE User ID
    profile.email || "",         // Email（可能為空）
    profile.displayName,         // 姓名
    profile.pictureUrl,          // 頭像 URL
    new Date(),                  // 建立時間
    "管理員",                     // 部門（自動設為管理員）
    "",                          // 保留欄位
    "啟用"                        // 狀態（自動啟用）
  ];
  
  sheet.appendRow(row);
  Logger.log(`新增使用者 ${profile.userId} 為管理員（啟用）`);
  return row;
}

/**
 * 根據 LINE User ID 查詢員工資料
 * ⭐ 移除狀態檢查，所有使用者都視為啟用的管理員
 */
function findEmployeeByLineUserId_(userId) {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_EMPLOYEES);
  const values = sh.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === userId) {
      // ⭐ 不檢查狀態，直接返回使用者資料
      // ⭐ 如果部門欄位為空，自動設為管理員
      const dept = values[i][5] || "管理員";
      
      // 如果資料庫中部門不是管理員，自動更新為管理員
      if (dept !== "管理員") {
        sh.getRange(i + 1, 6).setValue("管理員");
      }
      
      return {
        ok: true,
        userId: values[i][0],
        email: values[i][1] || "",
        name: values[i][2],
        picture: values[i][3],
        dept: "管理員",        // ⭐ 強制返回管理員
        status: "啟用"         // ⭐ 強制返回啟用狀態
      };
    }
  }
  
  return { ok: false, code: "ERR_NO_DATA" };
}

/**
 * 建立 Session
 */
function writeSession_(userId) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_SESSION);

  const oneTimeToken = Utilities.getUuid();
  const now          = new Date();
  const expiredAt    = new Date(now.getTime() + SESSION_TTL_MS);

  // 🔍 直接找 userId 在 B 欄
  const range = sheet.getRange("B:B").createTextFinder(userId).findNext();

  if (range) {
    const row = range.getRow();
    // ⚡ 一次寫入 (A, C, D)
    sheet.getRange(row, 1, 1, 4).setValues([[oneTimeToken, userId, now, expiredAt]]);
  } else {
    // 沒找到 → 新增一列
    sheet.appendRow([oneTimeToken, userId, now, expiredAt]);
  }
  return oneTimeToken;
}

/**
 * 兌換一次性 token
 */
function verifyOneTimeToken_(otoken) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_SESSION);

  // 🔍 直接找 token
  const range = sheet.getRange("A:A").createTextFinder(otoken).findNext();
  if (!range) return null;

  const row = range.getRow();
  const sessionToken = Utilities.getUuid();
  const now          = new Date();
  const expiredAt    = new Date(now.getTime() + SESSION_TTL_MS);

  // ⚡ 一次寫入三個欄位
  sheet.getRange(row, 1, 1, 3).setValues([[sessionToken, now, expiredAt]]);

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
    const [ token, userId, , expiredAt ] = values[i];
    if (token === sessionToken) {
      // 檢查是否過期
      if (expiredAt && new Date() > new Date(expiredAt)) {
        return { ok: false, code: "ERR_SESSION_EXPIRED" };
      }
      
      // ⭐ 自動延期 Session
      const newExpiredAt = new Date(new Date().getTime() + SESSION_TTL_MS);
      sh.getRange(i + 1, 4).setValue(newExpiredAt);
      
      // 取得員工資料
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

/**
 * 打卡功能
 */
function punch(sessionToken, type, lat, lng, note) {
  const employee = checkSession_(sessionToken);
  const user     = employee.user;
  if (!user) return { ok: false, code: "ERR_SESSION_INVALID" };

  // === 讀取打卡地點 ===
  const shLoc = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOCATIONS);
  const values = shLoc.getRange(2, 1, shLoc.getLastRow() - 1, 5).getValues();

  let locationName = null;
  for (let [ , name, locLat, locLng, radius ] of values) {
    const dist = getDistanceMeters_(lat, lng, Number(locLat), Number(locLng));
    if (dist <= Number(radius)) {
      locationName = name;
      break;
    }
  }

  if (!locationName) {
    return { ok: false, code: "ERR_OUT_OF_RANGE" };
  }

  // === 寫入打卡紀錄 ===
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
  const user     = employee.user;
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
    const d = new Date(row[0]);
    const yyyy_mm = d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0");
    const monthMatch = yyyy_mm === monthParam;
    const userMatch  = userIdParam ? row[1] === userIdParam : true;
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
 * 新增打卡地點
 */
function addLocation(name, lat, lng) {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_LOCATIONS);
  sh.appendRow([
    "",
    name,
    lat,
    lng,
    "100"
  ]);
  return { ok: true, code: `新增地點成功` };
}

/**
 * 取得所有打卡地點
 */
function getLocation() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOCATIONS);
  const values = sheet.getDataRange().getValues();
  const headers = values.shift();
  const locations = values.map(row => {
    return {
      id: row[headers.indexOf('ID')],
      name: row[headers.indexOf('地點名稱')],
      lat: row[headers.indexOf('GPS(緯度)')],
      lng: row[headers.indexOf('GPS(經度)')],
      scope: row[headers.indexOf('容許誤差(公尺)')]
    };
  });
  
  return { ok: true, locations: locations };
}

/**
 * 取得待審核請求
 */
function getReviewRequest() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ATTENDANCE);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];

  const reviewRequest = values.filter((row, index) => {
    if (index === 0) return false;

    const _remarkMatch = row[headers.indexOf('備註')] === "補打卡";
    const _administratorReviewIsPending = row[headers.indexOf('管理員審核')] === "?";
    
    return _remarkMatch && _administratorReviewIsPending;
  }).map(row => {
    const actualRowNumber = values.indexOf(row) + 1;
    return {
      id: actualRowNumber,
      name: row[headers.indexOf('打卡人員')],
      type: row[headers.indexOf('打卡類別')],
      remark: row[headers.indexOf('備註')],
      applicationPeriod: row[headers.indexOf('打卡時間')]
    };
  });
  
  Logger.log("getReviewRequest: " + JSON.stringify(reviewRequest));
  return { ok: true, reviewRequest: reviewRequest };
}

/**
 * 更新審核狀態
 */
function updateReviewStatus(rowNumber, status, note) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ATTENDANCE);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const reviewStatusCol = headers.indexOf('管理員審核') + 1;

    if (reviewStatusCol === 0) {
      return { ok: false, msg: "試算表缺少必要欄位：'管理員審核'" };
    }

    sheet.getRange(rowNumber, reviewStatusCol).setValue(status);

    return { ok: true, msg: "審核成功" };
  } catch (err) {
    return { ok: false, msg: `審核失敗：${err.message}` };
  }
}