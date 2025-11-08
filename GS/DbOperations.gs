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
 * 🧪 測試 getAllUsers 函式
 */
function testGetAllUsers() {
  Logger.log('🧪🧪🧪 測試 getAllUsers');
  Logger.log('═══════════════════════════════════════');
  Logger.log('');
  
  const result = getAllUsers();
  
  Logger.log('📤 測試結果:');
  Logger.log('   - ok: ' + result.ok);
  Logger.log('   - msg: ' + (result.msg || '無'));
  Logger.log('   - count: ' + (result.count || 0));
  Logger.log('   - users 數量: ' + (result.users ? result.users.length : 0));
  Logger.log('');
  
  if (result.ok && result.users && result.users.length > 0) {
    Logger.log('✅✅✅ 測試成功！');
    Logger.log('');
    Logger.log('👥 員工列表詳細資訊:');
    Logger.log('');
    
    result.users.forEach((user, index) => {
      Logger.log(`${index + 1}. ${user.name}`);
      Logger.log(`   - userId: ${user.userId}`);
      Logger.log(`   - email: ${user.email}`);
      Logger.log(`   - dept: ${user.dept}`);
      Logger.log(`   - status: ${user.status}`);
      Logger.log('');
    });
    
    Logger.log('═══════════════════════════════════════');
    Logger.log('🎉 可以使用了！');
    
  } else {
    Logger.log('❌ 測試失敗或沒有資料');
    if (!result.ok) {
      Logger.log('   錯誤原因: ' + result.msg);
      if (result.error) {
        Logger.log('   錯誤堆疊: ' + result.error);
      }
    } else {
      Logger.log('   可能原因: 員工資料表沒有資料，或所有員工都不是「啟用」狀態');
    }
    Logger.log('═══════════════════════════════════════');
  }
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

/**
 * ✅ 取得所有員工列表（根據實際資料表結構）
 * 
 * 資料表欄位:
 * A (0) - userId
 * B (1) - email
 * C (2) - displayName
 * D (3) - pictureUrl
 * E (4) - 建立時間
 * F (5) - 部門
 * G (6) - 到職日期
 * H (7) - 狀態
 */
function getAllUsers() {
  try {
    Logger.log('📋 開始取得員工列表');
    
    // 取得員工資料表
    const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_EMPLOYEES);
    
    if (!sheet) {
      Logger.log('❌ 找不到員工工作表: ' + SHEET_EMPLOYEES);
      return { 
        ok: false, 
        msg: "找不到員工工作表",
        users: []
      };
    }
    
    // 取得所有資料
    const data = sheet.getDataRange().getValues();
    
    // 檢查是否有資料
    if (data.length <= 1) {
      Logger.log('⚠️ 員工工作表只有標題，沒有資料');
      return {
        ok: true,
        users: [],
        count: 0,
        msg: "目前沒有員工資料"
      };
    }
    
    const users = [];
    
    Logger.log('📊 開始解析員工資料...');
    Logger.log('   總行數（含標題）: ' + data.length);
    Logger.log('');
    
    // 從第二行開始讀取（跳過標題）
    for (let i = 1; i < data.length; i++) {
      const row = data[i];  // ⭐⭐⭐ 定義 row 變數
      
      // 檢查員工ID是否存在（A欄 = row[0]）
      if (!row[0] || String(row[0]).trim() === '') {
        Logger.log(`   ⚠️ 第 ${i + 1} 行: 員工ID是空的，跳過`);
        continue;
      }
      
      // 檢查狀態（H欄 = row[7]）
      const status = row[7] ? String(row[7]).trim() : '';
      
      // 只加入「啟用」或空值的員工
      if (status !== '' && status !== '啟用') {
        Logger.log(`   ⏸️ 第 ${i + 1} 行: ${row[2]} - 狀態是「${status}」，跳過`);
        continue;
      }
      
      // 建立使用者物件
      const user = {
        userId: String(row[0]).trim(),                    // A欄: userId
        email: row[1] ? String(row[1]).trim() : '',       // B欄: email
        name: row[2] ? String(row[2]).trim() : '未命名',   // C欄: displayName
        picture: row[3] ? String(row[3]).trim() : '',     // D欄: pictureUrl
        joinDate: row[4] || '',                           // E欄: 建立時間
        dept: row[5] ? String(row[5]).trim() : '',        // F欄: 部門
        hireDate: row[6] || '',                           // G欄: 到職日期
        status: status || '啟用'                          // H欄: 狀態
      };
      
      users.push(user);
      Logger.log(`   ✅ 第 ${i + 1} 行: ${user.name} (${user.userId}) - ${user.dept}`);
    }
    
    Logger.log('');
    Logger.log('✅ 員工列表取得完成');
    Logger.log('   總筆數: ' + users.length);
    Logger.log('');
    
    return {
      ok: true,
      users: users,
      count: users.length,
      msg: `成功取得 ${users.length} 筆員工資料`
    };
    
  } catch (error) {
    Logger.log('❌ getAllUsers 錯誤: ' + error);
    Logger.log('   錯誤訊息: ' + error.message);
    Logger.log('   錯誤堆疊: ' + error.stack);
    
    return {
      ok: false,
      msg: error.message || '取得員工列表失敗',
      users: [],
      error: error.stack
    };
  }
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
 * 檢查 Session（自動延期）
 */
// function checkSession_(sessionToken) {
//   if (!sessionToken) return { ok: false, code: "MISSING_SESSION_TOKEN" };

//   const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_SESSION);
//   if (!sh) return { ok: false, code: "SESSION_SHEET_NOT_FOUND" };

//   const values = sh.getDataRange().getValues();
//   for (let i = 1; i < values.length; i++) {
//     const [token, userId, , expiredAt] = values[i];
//     if (token === sessionToken) {
//       if (expiredAt && new Date() > new Date(expiredAt)) {
//         return { ok: false, code: "ERR_SESSION_EXPIRED" };
//       }
      
//       const newExpiredAt = new Date(new Date().getTime() + SESSION_TTL_MS);
//       sh.getRange(i + 1, 4).setValue(newExpiredAt);
      
//       const employee = findEmployeeByLineUserId_(userId);
//       if (!employee.ok) {
//         Logger.log("Session 檢查失敗: " + JSON.stringify(employee));
//         return { ok: employee.ok, code: employee.code };
//       }
      
//       return { 
//         ok: true, 
//         user: employee,
//         code: "WELCOME_BACK",
//         params: { name: employee.name }
//       };
//     }
//   }
//   return { ok: false, code: "ERR_SESSION_INVALID" };
// }
// DbOperations.gs - 修正 checkSession_ 函數

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

/**
 * ✅ 更新審核狀態（完全修正版 v2.0）
 */
function updateReviewStatus(rowNumber, status, note) {
  try {
    Logger.log('═══════════════════════════════════════');
    Logger.log('🔍 開始處理補打卡審核');
    Logger.log('   rowNumber: ' + rowNumber);
    Logger.log('   status: ' + status);
    Logger.log('   note: ' + (note || '無'));
    Logger.log('');
    
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ATTENDANCE);
    
    if (!sheet) {
      Logger.log('❌ 找不到工作表: ' + SHEET_ATTENDANCE);
      return { ok: false, msg: "找不到出勤工作表" };
    }
    
    // 取得標題列
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    Logger.log('📋 工作表標題列:');
    headers.forEach((header, index) => {
      Logger.log(`   [${index}] ${header}`);
    });
    Logger.log('');
    
    // 找到「管理員審核」欄位
    const reviewStatusCol = headers.indexOf('管理員審核') + 1;
    
    if (reviewStatusCol === 0) {
      Logger.log('❌ 找不到「管理員審核」欄位');
      return { ok: false, msg: "試算表缺少必要欄位：'管理員審核'" };
    }
    
    Logger.log('✅ 管理員審核欄位位置: 第 ' + reviewStatusCol + ' 欄');
    Logger.log('');
    
    // 取得該列所有資料
    const record = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    Logger.log('📊 第 ' + rowNumber + ' 行的完整資料:');
    record.forEach((cell, index) => {
      Logger.log(`   [${index}] ${headers[index]}: ${cell}`);
    });
    Logger.log('');
    
    // ⭐ 根據實際欄位索引取值
    const punchTime = record[0];      // A欄: 打卡時間
    const userId = record[1];         // B欄: 員工ID
    const dept = record[2];           // C欄: 部門
    const employeeName = record[3];   // D欄: 打卡人員
    const punchType = record[4];      // E欄: 打卡類別
    
    Logger.log('🔍 解析後的關鍵欄位:');
    Logger.log('   - userId: ' + userId);
    Logger.log('   - employeeName: ' + employeeName);
    Logger.log('   - punchType: ' + punchType);
    Logger.log('   - punchTime: ' + punchTime);
    Logger.log('');
    
    // 檢查 userId 是否有效
    if (!userId || String(userId).trim() === '') {
      Logger.log('❌ userId 無效或為空');
      return { ok: false, msg: "無法取得員工ID" };
    }
    
    Logger.log('✅ userId 有效: ' + userId);
    Logger.log('');
    
    // 更新審核狀態
    sheet.getRange(rowNumber, reviewStatusCol).setValue(status);
    Logger.log('✅ 已將第 ' + rowNumber + ' 行第 ' + reviewStatusCol + ' 欄更新為: ' + status);
    Logger.log('');
    
    // 格式化日期和時間
    const punchDate = formatDate(punchTime);
    const punchTimeStr = formatTime(punchTime);
    
    Logger.log('📅 格式化後的時間:');
    Logger.log('   - punchDate: ' + punchDate);
    Logger.log('   - punchTimeStr: ' + punchTimeStr);
    Logger.log('');
    
    const isApproved = (status === "v");
    const reviewer = "系統管理員";
    
    Logger.log('📤 準備發送 LINE 通知');
    Logger.log('   參數清單:');
    Logger.log('   - userId: ' + userId);
    Logger.log('   - employeeName: ' + employeeName);
    Logger.log('   - punchDate: ' + punchDate);
    Logger.log('   - punchTimeStr: ' + punchTimeStr);
    Logger.log('   - punchType: ' + punchType);
    Logger.log('   - reviewer: ' + reviewer);
    Logger.log('   - isApproved: ' + isApproved);
    Logger.log('   - note: ' + (note || ""));
    Logger.log('');
    
    // 發送 LINE 通知
    try {
      const notifyResult = notifyPunchReview(
        userId,
        employeeName,
        punchDate,
        punchTimeStr,
        punchType,
        reviewer,
        isApproved,
        note || ""
      );
      
      if (notifyResult && notifyResult.ok) {
        Logger.log('✅ LINE 通知發送成功');
      } else {
        Logger.log('❌ LINE 通知發送失敗');
        Logger.log('   錯誤: ' + (notifyResult ? notifyResult.error : '未知錯誤'));
      }
    } catch (notifyError) {
      Logger.log('❌ 發送通知時發生錯誤: ' + notifyError.message);
      Logger.log('   堆疊: ' + notifyError.stack);
    }
    
    Logger.log('');
    Logger.log('═══════════════════════════════════════');
    
    return { ok: true, msg: "審核成功" };
    
  } catch (err) {
    Logger.log('');
    Logger.log('❌❌❌ updateReviewStatus 發生嚴重錯誤');
    Logger.log('錯誤訊息: ' + err.message);
    Logger.log('錯誤堆疊: ' + err.stack);
    Logger.log('═══════════════════════════════════════');
    
    return { ok: false, msg: `審核失敗：${err.message}` };
  }
}

/**
 * 🧪 測試補打卡審核通知（手動版）
 */
function testPunchReviewNotification() {
  Logger.log('🧪 測試補打卡審核通知');
  Logger.log('');
  
  // ⚠️ 請替換成實際的行號
  const testRowNumber = 10;  // 待審核記錄的行號
  
  Logger.log('📝 測試參數:');
  Logger.log('   rowNumber: ' + testRowNumber);
  Logger.log('   status: v (核准)');
  Logger.log('   note: 測試核准');
  Logger.log('');
  
  const result = updateReviewStatus(testRowNumber, 'v', '測試核准');
  
  Logger.log('');
  Logger.log('📤 測試結果:');
  Logger.log(JSON.stringify(result, null, 2));
  
  if (result.ok) {
    Logger.log('');
    Logger.log('✅✅✅ 測試成功！請檢查 LINE 是否收到通知');
  } else {
    Logger.log('');
    Logger.log('❌ 測試失敗: ' + result.msg);
  }
}
// function updateReviewStatus(rowNumber, status, note) {
//   try {
//     const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ATTENDANCE);
//     const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
//     const reviewStatusCol = headers.indexOf('管理員審核') + 1;

//     if (reviewStatusCol === 0) {
//       return { ok: false, msg: "試算表缺少必要欄位：'管理員審核'" };
//     }

//     const record = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];
//     const userId = record[headers.indexOf('員工ID')];
//     const employeeName = record[headers.indexOf('打卡人員')];
//     const punchDate = formatDate(record[headers.indexOf('打卡時間')]);
//     const punchTime = formatTime(record[headers.indexOf('打卡時間')]);
//     const punchType = record[headers.indexOf('打卡類別')];

//     sheet.getRange(rowNumber, reviewStatusCol).setValue(status);
    
//     const isApproved = (status === "v");
//     const reviewer = "系統管理員";
    
//     notifyPunchReview(
//       userId,
//       employeeName,
//       punchDate,
//       punchTime,
//       punchType,
//       reviewer,
//       isApproved,
//       note || ""
//     );
    
//     Logger.log(`📤 已發送補打卡審核通知給 ${employeeName}`);

//     return { ok: true, msg: "審核成功" };
//   } catch (err) {
//     Logger.log("updateReviewStatus 錯誤: " + err.message);
//     return { ok: false, msg: `審核失敗：${err.message}` };
//   }
// }

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