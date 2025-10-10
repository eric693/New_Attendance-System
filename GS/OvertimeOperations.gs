// OvertimeOperations.gs - 加班功能後端

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
  
  // 寫入資料
  const row = [
    requestId,              // 申請ID
    user.userId,           // 員工ID
    user.name,             // 員工姓名
    overtimeDate,          // 加班日期
    startTime,             // 開始時間
    endTime,               // 結束時間
    hours,                 // 加班時數
    reason,                // 申請原因
    new Date(),            // 申請時間
    "pending",             // 審核狀態
    "",                    // 審核人ID
    "",                    // 審核人姓名
    "",                    // 審核時間
    ""                     // 審核意見
  ];
  
  sheet.appendRow(row);
  
  return { 
    ok: true, 
    code: "OVERTIME_SUBMIT_SUCCESS",
    requestId: requestId
  };
}

/**
 * 查詢員工的加班申請記錄
 */
function getEmployeeOvertimeRequests(sessionToken) {
  const employee = checkSession_(sessionToken);
  const user = employee.user;
  if (!user) return { ok: false, code: "ERR_SESSION_INVALID" };
  
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_OVERTIME);
  if (!sheet) return { ok: true, requests: [] };
  
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  
  const requests = values.slice(1).filter(row => {
    return row[1] === user.userId; // 員工ID欄位
  }).map(row => ({
    requestId: row[0],
    overtimeDate: formatDate(row[3]),
    startTime: row[4],
    endTime: row[5],
    hours: row[6],
    reason: row[7],
    applyDate: formatDate(row[8]),
    status: row[9],
    reviewerName: row[11],
    reviewComment: row[13]
  }));
  
  return { ok: true, requests: requests };
}

/**
 * 取得所有待審核的加班申請（管理員用）
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
  
  const requests = values.slice(1).filter(row => {
    return row[9] === "pending"; // 審核狀態欄位
  }).map((row, index) => ({
    rowNumber: index + 2, // Excel 行號（從2開始，因為有表頭）
    requestId: row[0],
    employeeId: row[1],
    employeeName: row[2],
    overtimeDate: formatDate(row[3]),
    startTime: row[4],
    endTime: row[5],
    hours: row[6],
    reason: row[7],
    applyDate: formatDate(row[8])
  }));
  
  return { ok: true, requests: requests };
}

/**
 * 審核加班申請
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
  
  const status = action === "approve" ? "approved" : "rejected";
  const reviewTime = new Date();
  
  // 更新審核資訊
  sheet.getRange(rowNumber, 10).setValue(status);        // 審核狀態
  sheet.getRange(rowNumber, 11).setValue(user.userId);   // 審核人ID
  sheet.getRange(rowNumber, 12).setValue(user.name);     // 審核人姓名
  sheet.getRange(rowNumber, 13).setValue(reviewTime);    // 審核時間
  sheet.getRange(rowNumber, 14).setValue(comment || ""); // 審核意見
  
  return { 
    ok: true, 
    code: action === "approve" ? "OVERTIME_APPROVED" : "OVERTIME_REJECTED"
  };
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
  return getEmployeeOvertimeRequests(params.token);
}

function handleGetPendingOvertime(params) {
  return getPendingOvertimeRequests(params.token);
}

function handleReviewOvertime(params) {
  const { token, rowNumber, action, comment } = params;
  return reviewOvertimeRequest(
    token, 
    parseInt(rowNumber), 
    action, 
    comment
  );
}

// ==================== 加入 Main.gs 的 doGet 函式 ====================
// 在 switch (action) 中新增以下 case：

/*
case "submitOvertime":
  return respond1(handleSubmitOvertime(e.parameter));
case "getEmployeeOvertime":
  return respond1(handleGetEmployeeOvertime(e.parameter));
case "getPendingOvertime":
  return respond1(handleGetPendingOvertime(e.parameter));
case "reviewOvertime":
  return respond1(handleReviewOvertime(e.parameter));
*/