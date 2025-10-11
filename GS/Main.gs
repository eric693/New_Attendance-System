// Main.gs - 完整版（含打卡、加班、請假系統）

// 從其他模組匯入函式
// 這裡沒有 ES6 模組匯入，但我們可以用註解來表示程式碼的來源
// 實際開發中，GAS 專案會自動將所有 .gs 檔視為同一專案
// doGet(e) 負責處理所有外部請求
function doGet(e) {
  const action       = e.parameter.action;
  const callback     = e.parameter.callback || "callback";
  const sessionToken = e.parameter.token;
  const code         = e.parameter.otoken;

  function respond(obj) {
    return ContentService.createTextOutput(
      `${callback}(${JSON.stringify(obj)})`
    ).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  
  function respond1(obj) {
    const output = ContentService.createTextOutput(JSON.stringify(obj));
    output.setMimeType(ContentService.MimeType.JSON);
    return output;
  }
  
  try {
    switch (action) {
      // ==================== 登入與 Session ====================
      case "getProfile":
        return respond1(handleGetProfile(code));
      case "getLoginUrl":
        return respond1(handleGetLoginUrl());
      case "checkSession":
        return respond1(handleCheckSession(sessionToken));
      case "exchangeToken":
        return respond1(handleExchangeToken(e.parameter.otoken));
      
      // ==================== 打卡系統 ====================
      case "punch":
        return respond1(handlePunch(e.parameter));
      case "adjustPunch":
        return respond1(handleAdjustPunch(e.parameter));
      case "getAbnormalRecords":
        return respond1(handleGetAbnormalRecords(e.parameter));
      case "getAttendanceDetails":
        return respond1(handleGetAttendanceDetails(e.parameter));
      
      // ==================== 地點管理 ====================
      case "addLocation":
        return respond1(handleAddLocation(e.parameter));
      case "getLocations":
        return respond1(handleGetLocation());
      
      // ==================== 補打卡審核 ====================
      case "getReviewRequest":
        return respond1(handleGetReviewRequest());
      case "approveReview":
        return respond1(handleApproveReview(e.parameter));
      case "rejectReview":
        return respond1(handleRejectReview(e.parameter));
      
      // ==================== 加班系統 ====================
      case "submitOvertime":
        return respond1(handleSubmitOvertime(e.parameter));
      case "getEmployeeOvertime":
        return respond1(handleGetEmployeeOvertime(e.parameter));
      case "getPendingOvertime":
        return respond1(handleGetPendingOvertime(e.parameter));
      case "reviewOvertime":
        return respond1(handleReviewOvertime(e.parameter));
      
      // ==================== 請假系統 ====================
      case "getLeaveBalance":
        return respond1(handleGetLeaveBalance(e.parameter));
      case "submitLeave":
        return respond1(handleSubmitLeave(e.parameter));
      case "getEmployeeLeaveRecords":
        return respond1(handleGetEmployeeLeaveRecords(e.parameter));
      case "getPendingLeaveRequests":
        return respond1(handleGetPendingLeaveRequests(e.parameter));
      case "reviewLeave":
        return respond1(handleReviewLeave(e.parameter));
      case "initializeEmployeeLeave":
        return respond1(handleInitializeEmployeeLeave(e.parameter));
      
      // ==================== 測試端點 ====================
      case "testEndpoint":
        return respond1({ ok: true, msg: "CORS 測試成功!" });
      
      // ==================== 預設：返回 HTML 頁面 ====================
      default:
        return HtmlService.createHtmlOutputFromFile('index')
               .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
  } catch (err) {
    return respond1({ ok: false, msg: err.message });
  }
}