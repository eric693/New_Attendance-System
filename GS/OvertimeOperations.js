// OvertimeOperations.gs - 加班功能後端（完全修正版）

// ==================== 常數定義 ====================
const SHEET_OVERTIME = "加班申請";

// ==================== 資料庫操作 ====================

/**
 * 初始化加班申請工作表（如果不存在則建立）
 */
function initOvertimeSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_OVERTIME);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_OVERTIME);
    // 設定表頭
    const headers = [
      "申請ID", "員工ID", "員工姓名", "加班日期", 
      "開始時間", "結束時間", "加班時數", "申請原因",
      "申請時間", "審核狀態", "審核人ID", "審核人姓名",
      "審核時間", "審核意見"
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    Logger.log("✅ 加班申請工作表已建立");
  }
  
  return sheet;
}

/**
 * 提交加班申請
 * 🔧 修正：時間格式處理
 */
function submitOvertimeRequest(sessionToken, overtimeDate, startTime, endTime, hours, reason) {
  // 驗證 Session
  const employee = checkSession_(sessionToken);
  const user = employee.user;
  if (!user) return { ok: false, code: "ERR_SESSION_INVALID" };
  
  // 初始化工作表
  const sheet = initOvertimeSheet();
  
  // 生成申請ID
  const requestId = "OT" + new Date().getTime();
  
  // 🔧 組合完整的日期時間格式
  const startDateTime = new Date(`${overtimeDate}T${startTime}:00`);
  const endDateTime = new Date(`${overtimeDate}T${endTime}:00`);
  
  Logger.log(`📝 準備提交加班: 日期=${overtimeDate}, 開始=${startTime}, 結束=${endTime}, 時數=${hours}`);
  Logger.log(`📝 完整時間: 開始=${startDateTime}, 結束=${endDateTime}`);
  
  // 寫入資料
  const row = [
    requestId,              // 申請ID
    user.userId,           // 員工ID
    user.name,             // 員工姓名
    overtimeDate,          // 加班日期
    startDateTime,         // 🔧 開始時間（完整 datetime）
    endDateTime,           // 🔧 結束時間（完整 datetime）
    parseFloat(hours),     // 🔧 確保時數是數字
    reason,                // 申請原因
    new Date(),            // 申請時間
    "pending",             // 審核狀態
    "",                    // 審核人ID
    "",                    // 審核人姓名
    "",                    // 審核時間
    ""                     // 審核意見
  ];
  
  sheet.appendRow(row);
  
  Logger.log(`✅ 加班申請已提交: ${user.name}, 日期: ${overtimeDate}, 時數: ${hours}`);
  
  return { 
    ok: true, 
    code: "OVERTIME_SUBMIT_SUCCESS",
    requestId: requestId
  };
}

/**
 * 查詢員工的加班申請記錄
 * 🔧 修正：時間格式化
 */
function getEmployeeOvertimeRequests(sessionToken) {
  const employee = checkSession_(sessionToken);
  const user = employee.user;
  if (!user) return { ok: false, code: "ERR_SESSION_INVALID" };
  
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_OVERTIME);
  if (!sheet) return { ok: true, requests: [] };
  
  const values = sheet.getDataRange().getValues();
  
  // 🔧 格式化時間為 HH:mm
  const formatTime = (dateTime) => {
    if (!dateTime) return "";
    if (typeof dateTime === "string") {
      // 如果已經是字串格式，檢查是否包含時間部分
      if (dateTime.includes(':')) {
        return dateTime.substring(0, 5); // 取 HH:mm
      }
      return dateTime;
    }
    // 如果是 Date 物件，格式化為 HH:mm
    return Utilities.formatDate(dateTime, "Asia/Taipei", "HH:mm");
  };
  
  const requests = values.slice(1).filter(row => {
    return row[1] === user.userId; // 員工ID欄位
  }).map(row => {
    const status = String(row[9]).trim().toLowerCase(); // 🔧 統一轉為小寫
    const startTime = formatTime(row[4]);
    const endTime = formatTime(row[5]);
    const hours = parseFloat(row[6]) || 0;
    
    Logger.log(`📝 讀取加班記錄: 日期=${row[3]}, 開始=${startTime}, 結束=${endTime}, 時數=${hours}, 狀態=${status}`);
    
    return {
      requestId: row[0],
      overtimeDate: formatDate(row[3]),
      startTime: startTime,
      endTime: endTime,
      hours: hours,
      reason: row[7],
      applyDate: formatDate(row[8]),
      status: status,
      reviewerName: row[11] || "",
      reviewComment: row[13] || ""
    };
  });
  
  Logger.log(`👤 員工 ${user.name} 的加班記錄: ${requests.length} 筆`);
  return { ok: true, requests: requests };
}

/**
 * 取得所有待審核的加班申請（管理員用）
 * 🔧 修正：時間格式化
 */
function getPendingOvertimeRequests(sessionToken) {
  const employee = checkSession_(sessionToken);
  const user = employee.user;
  if (!user) return { ok: false, code: "ERR_SESSION_INVALID" };
  
  // 檢查是否為管理員
  if (user.dept !== "管理員") {
    return { ok: false, code: "ERR_NO_PERMISSION" };
  }
  
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_OVERTIME);
  if (!sheet) return { ok: true, requests: [] };
  
  const values = sheet.getDataRange().getValues();
  
  // 🔧 格式化時間為 HH:mm
  const formatTime = (dateTime) => {
    if (!dateTime) return "";
    if (typeof dateTime === "string") {
      if (dateTime.includes(':')) {
        return dateTime.substring(0, 5);
      }
      return dateTime;
    }
    return Utilities.formatDate(dateTime, "Asia/Taipei", "HH:mm");
  };
  
  const requests = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const status = String(row[9]).trim().toLowerCase(); // 🔧 統一轉為小寫
    
    if (status === "pending") {
      const startTime = formatTime(row[4]);
      const endTime = formatTime(row[5]);
      const hours = parseFloat(row[6]) || 0;
      
      requests.push({
        rowNumber: i + 1,
        requestId: row[0],
        employeeId: row[1],
        employeeName: row[2],
        overtimeDate: formatDate(row[3]),
        startTime: startTime,
        endTime: endTime,
        hours: hours,
        reason: row[7],
        applyDate: formatDate(row[8])
      });
      
      Logger.log(`📋 待審核: 行號=${i + 1}, 員工=${row[2]}, 時間=${startTime}-${endTime}, 時數=${hours}`);
    }
  }
  
  Logger.log(`📊 共 ${requests.length} 筆待審核加班申請`);
  return { ok: true, requests: requests };
}

/**
 * 審核加班申請
 * 🔧 加強狀態驗證和日誌
 */
function reviewOvertimeRequest(sessionToken, rowNumber, action, comment) {
  const employee = checkSession_(sessionToken);
  const user = employee.user;
  if (!user) return { ok: false, code: "ERR_SESSION_INVALID" };
  
  // 檢查是否為管理員
  if (user.dept !== "管理員") {
    return { ok: false, code: "ERR_NO_PERMISSION" };
  }
  
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_OVERTIME);
  if (!sheet) return { ok: false, msg: "找不到加班申請工作表" };
  
  // 🔧 嚴格處理 action 參數
  const actionLower = String(action).trim().toLowerCase();
  const status = (actionLower === "approve") ? "approved" : "rejected";
  const reviewTime = new Date();
  
  Logger.log(`📥 審核請求開始`);
  Logger.log(`   - 行號: ${rowNumber}`);
  Logger.log(`   - 原始action: "${action}"`);
  Logger.log(`   - 處理後action: "${actionLower}"`);
  Logger.log(`   - 目標狀態: "${status}"`);
  Logger.log(`   - 審核人: ${user.name}`);
  Logger.log(`   - 審核意見: "${comment || '無'}"`);
  
  try {
    // 先讀取該行資料確認
    const currentStatus = sheet.getRange(rowNumber, 10).getValue();
    const employeeName = sheet.getRange(rowNumber, 3).getValue();
    const employeeId = sheet.getRange(rowNumber, 2).getValue();
    const overtimeDate = sheet.getRange(rowNumber, 4).getValue();
    
    Logger.log(`📋 審核對象資訊:`);
    Logger.log(`   - 員工: ${employeeName} (ID: ${employeeId})`);
    Logger.log(`   - 日期: ${overtimeDate}`);
    Logger.log(`   - 當前狀態: "${currentStatus}"`);
    
    // 🔧 清除該儲存格的格式，確保是純文字
    const statusCell = sheet.getRange(rowNumber, 10);
    statusCell.clearFormat();
    statusCell.setNumberFormat('@'); // 設定為文字格式
    
    // 更新審核資訊
    sheet.getRange(rowNumber, 10).setValue(status);        // 審核狀態
    sheet.getRange(rowNumber, 11).setValue(user.userId);   // 審核人ID
    sheet.getRange(rowNumber, 12).setValue(user.name);     // 審核人姓名
    sheet.getRange(rowNumber, 13).setValue(reviewTime);    // 審核時間
    sheet.getRange(rowNumber, 14).setValue(comment || ""); // 審核意見
    
    // 強制刷新
    SpreadsheetApp.flush();
    
    // 🔧 多次驗證寫入結果
    Utilities.sleep(500); // 等待 500ms 確保寫入完成
    
    const actualStatus = String(sheet.getRange(rowNumber, 10).getValue()).trim().toLowerCase();
    const actualReviewer = sheet.getRange(rowNumber, 12).getValue();
    const actualComment = sheet.getRange(rowNumber, 14).getValue();
    
    Logger.log(`✅ 審核完成驗證:`);
    Logger.log(`   - 預期狀態: "${status}"`);
    Logger.log(`   - 實際狀態: "${actualStatus}"`);
    Logger.log(`   - 審核人: "${actualReviewer}"`);
    Logger.log(`   - 審核意見: "${actualComment}"`);
    
    // 🔧 嚴格驗證狀態
    if (actualStatus !== status) {
      Logger.log(`❌ 錯誤：狀態寫入失敗！`);
      Logger.log(`   預期: "${status}"`);
      Logger.log(`   實際: "${actualStatus}"`);
      
      // 🔧 嘗試再次寫入
      Logger.log(`🔄 嘗試重新寫入狀態...`);
      sheet.getRange(rowNumber, 10).setValue(status);
      SpreadsheetApp.flush();
      Utilities.sleep(300);
      
      const retryStatus = String(sheet.getRange(rowNumber, 10).getValue()).trim().toLowerCase();
      Logger.log(`🔄 重試後狀態: "${retryStatus}"`);
      
      if (retryStatus !== status) {
        return {
          ok: false,
          msg: `狀態寫入異常：預期 ${status}，實際 ${retryStatus}`
        };
      }
    }
    
    Logger.log(`✅ 審核成功完成！`);
    
    return { 
      ok: true, 
      code: (actionLower === "approve") ? "OVERTIME_APPROVED" : "OVERTIME_REJECTED"
    };
  } catch (error) {
    Logger.log(`❌ 審核失敗: ${error.message}`);
    Logger.log(`❌ 錯誤堆疊: ${error.stack}`);
    return { 
      ok: false, 
      msg: `審核失敗: ${error.message}` 
    };
  }
}

// ==================== 輔助函式 ====================

/**
 * 格式化日期
 */
function formatDate(date) {
  if (!date) return "";
  if (typeof date === "string") return date;
  return Utilities.formatDate(date, "Asia/Taipei", "yyyy-MM-dd");
}

// ==================== Handlers（加到 Handlers.gs） ====================

function handleSubmitOvertime(params) {
  const { token, overtimeDate, startTime, endTime, hours, reason } = params;
  Logger.log(`📥 收到加班申請: 日期=${overtimeDate}, 開始=${startTime}, 結束=${endTime}, 時數=${hours}`);
  return submitOvertimeRequest(
    token, 
    overtimeDate, 
    startTime, 
    endTime, 
    parseFloat(hours), 
    reason
  );
}

function handleGetEmployeeOvertime(params) {
  Logger.log(`📥 查詢員工加班記錄`);
  return getEmployeeOvertimeRequests(params.token);
}

function handleGetPendingOvertime(params) {
  Logger.log(`📥 查詢待審核加班申請`);
  return getPendingOvertimeRequests(params.token);
}

function handleReviewOvertime(params) {
  const { token, rowNumber, action, comment } = params;
  
  // 🔧 記錄原始參數
  Logger.log(`📥 handleReviewOvertime 收到參數: rowNumber=${rowNumber}, action="${action}", comment="${comment}"`);
  
  return reviewOvertimeRequest(
    token, 
    parseInt(rowNumber), 
    action,
    comment || ""
  );
}