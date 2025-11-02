// Main.gs - 完整版（含打卡、加班、請假、排班系統）

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
      
      // ==================== 員工管理 ====================
      case "getAllUsers":
        return respond1(handleGetAllUsers(e.parameter));
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
      
      // ==================== 排班系統 ====================
      case "addShift":
        return respond1(handleAddShift(e.parameter));
      case "batchAddShifts":
        return respond(handleBatchAddShifts(e.parameter));
      case "getShifts":
        return respond1(handleGetShifts(e.parameter));
      case "getShiftById":
        return respond1(handleGetShiftById(e.parameter));
      case "updateShift":
        return respond1(handleUpdateShift(e.parameter));
      case "deleteShift":
        return respond1(handleDeleteShift(e.parameter));
      case "getEmployeeShiftForDate":
        return respond1(handleGetEmployeeShiftForDate(e.parameter));
      case "getWeeklyShiftStats":
        return respond1(handleGetWeeklyShiftStats(e.parameter));
      case "exportShifts":
        return respond1(handleExportShifts(e.parameter));
      
      // ==================== 薪資系統 ====================
      case "setEmployeeSalaryTW":
        return respond1(handleSetEmployeeSalaryTW(e.parameter));
      case "getEmployeeSalaryTW":
        return respond1(handleGetEmployeeSalaryTW(e.parameter));
      case "getMySalary":
        return respond1(handleGetMySalary(e.parameter));
      case "getMySalaryHistory":
        return respond1(handleGetMySalaryHistory(e.parameter));
      case "calculateMonthlySalary":
        return respond1(handleCalculateMonthlySalary(e.parameter));
      case "saveMonthlySalary":
        return respond1(handleSaveMonthlySalary(e.parameter));
      case "getAllMonthlySalary":
    return respond1(handleGetAllMonthlySalary(e.parameter));
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

// ==================== 排班系統 Handler 函數 ====================

/**
 * 處理新增排班
 */
function handleAddShift(params) {
  try {
    // 驗證 session
    if (!params.token || !validateSession(params.token)) {
      return { ok: false, msg: "未授權或 session 已過期" };
    }
    
    const shiftData = {
      employeeId: params.employeeId,
      employeeName: params.employeeName,
      date: params.date,
      shiftType: params.shiftType,
      startTime: params.startTime,
      endTime: params.endTime,
      location: params.location,
      note: params.note
    };
    
    const result = addShift(shiftData);
    return { ok: result.success, data: result, msg: result.message };
    
  } catch (error) {
    Logger.log('handleAddShift 錯誤: ' + error);
    return { ok: false, msg: error.message };
  }
}

/**
 * 處理批量新增排班
 */
function handleBatchAddShifts(params) {
  try {
    // 驗證 session
    if (!params.token || !validateSession(params.token)) {
      return { ok: false, msg: "未授權或 session 已過期" };
    }
    
    // ✅ 從 URL 參數取得資料
    let shiftsArray;
    
    if (params.shiftsArray) {
      try {
        // 解碼並解析 JSON
        if (typeof params.shiftsArray === 'string') {
          const decoded = decodeURIComponent(params.shiftsArray);
          shiftsArray = JSON.parse(decoded);
        } else {
          shiftsArray = params.shiftsArray;
        }
      } catch (parseError) {
        Logger.log('❌ 解析失敗: ' + parseError);
        return { ok: false, msg: "資料格式錯誤" };
      }
    } else {
      return { ok: false, msg: "缺少 shiftsArray 參數" };
    }
    
    // 驗證資料
    if (!Array.isArray(shiftsArray) || shiftsArray.length === 0) {
      return { ok: false, msg: "資料格式錯誤或為空" };
    }
    
    Logger.log('📊 批量新增: ' + shiftsArray.length + ' 筆');
    
    // 呼叫核心函數
    const result = batchAddShifts(shiftsArray);
    
    return { 
      ok: result.success, 
      msg: result.message,
      data: result
    };
    
  } catch (error) {
    Logger.log('❌ 錯誤: ' + error);
    return { ok: false, msg: error.message };
  }
}

/**
 * 處理查詢排班
 */
function handleGetShifts(params) {
  try {
    // 驗證 session
    if (!params.token || !validateSession(params.token)) {
      return { ok: false, msg: "未授權或 session 已過期" };
    }
    
    const filters = {
      employeeId: params.employeeId,
      startDate: params.startDate,
      endDate: params.endDate,
      shiftType: params.shiftType,
      location: params.location
    };
    
    const result = getShifts(filters);
    return { ok: result.success, data: result.data, count: result.count, msg: result.message };
    
  } catch (error) {
    Logger.log('handleGetShifts 錯誤: ' + error);
    return { ok: false, msg: error.message };
  }
}

/**
 * 處理取得單一排班詳情
 */
function handleGetShiftById(params) {
  try {
    // 驗證 session
    if (!params.token || !validateSession(params.token)) {
      return { ok: false, msg: "未授權或 session 已過期" };
    }
    
    const result = getShiftById(params.shiftId);
    return { ok: result.success, data: result.data, msg: result.message };
    
  } catch (error) {
    Logger.log('handleGetShiftById 錯誤: ' + error);
    return { ok: false, msg: error.message };
  }
}

/**
 * 處理更新排班
 */
function handleUpdateShift(params) {
  try {
    // 驗證 session
    if (!params.token || !validateSession(params.token)) {
      return { ok: false, msg: "未授權或 session 已過期" };
    }
    
    const updateData = {
      date: params.date,
      shiftType: params.shiftType,
      startTime: params.startTime,
      endTime: params.endTime,
      location: params.location,
      note: params.note
    };
    
    const result = updateShift(params.shiftId, updateData);
    return { ok: result.success, msg: result.message };
    
  } catch (error) {
    Logger.log('handleUpdateShift 錯誤: ' + error);
    return { ok: false, msg: error.message };
  }
}

/**
 * 處理刪除排班
 */
function handleDeleteShift(params) {
  try {
    // 驗證 session
    if (!params.token || !validateSession(params.token)) {
      return { ok: false, msg: "未授權或 session 已過期" };
    }
    
    const result = deleteShift(params.shiftId);
    return { ok: result.success, msg: result.message };
    
  } catch (error) {
    Logger.log('handleDeleteShift 錯誤: ' + error);
    return { ok: false, msg: error.message };
  }
}

/**
 * 處理取得員工當日排班（用於打卡驗證）
 */
function handleGetEmployeeShiftForDate(params) {
  try {
    // 驗證 session
    if (!params.token || !validateSession(params.token)) {
      return { ok: false, msg: "未授權或 session 已過期" };
    }
    
    const result = getEmployeeShiftForDate(params.employeeId, params.date);
    return { 
      ok: result.success, 
      hasShift: result.hasShift,
      data: result.data, 
      msg: result.message 
    };
    
  } catch (error) {
    Logger.log('handleGetEmployeeShiftForDate 錯誤: ' + error);
    return { ok: false, msg: error.message };
  }
}

/**
 * 處理取得本週排班統計
 */
function handleGetWeeklyShiftStats(params) {
  try {
    // 驗證 session
    if (!params.token || !validateSession(params.token)) {
      return { ok: false, msg: "未授權或 session 已過期" };
    }
    
    const result = getWeeklyShiftStats();
    return { ok: result.success, data: result.data, msg: result.message };
    
  } catch (error) {
    Logger.log('handleGetWeeklyShiftStats 錯誤: ' + error);
    return { ok: false, msg: error.message };
  }
}

/**
 * 處理匯出排班資料
 */
function handleExportShifts(params) {
  try {
    // 驗證 session
    if (!params.token || !validateSession(params.token)) {
      return { ok: false, msg: "未授權或 session 已過期" };
    }
    
    const filters = {
      employeeId: params.employeeId,
      startDate: params.startDate,
      endDate: params.endDate,
      shiftType: params.shiftType
    };
    
    const result = exportShifts(filters);
    return { ok: result.success, data: result.data, filename: result.filename, msg: result.message };
    
  } catch (error) {
    Logger.log('handleExportShifts 錯誤: ' + error);
    return { ok: false, msg: error.message };
  }
}

/**
 * 測試排班系統
 */
function testShiftAPI() {
  Logger.log('===== 測試排班 API =====');
  
  // 模擬前端請求參數
  const testParams = {
    token: '2d3ce046-3dcc-4a62-ac92-ac0c87993669',  // 請替換成真實的 token
    employeeId: 'U123456',
    employeeName: '測試員工',
    date: '2025-10-25',
    shiftType: '早班',
    startTime: '09:00',
    endTime: '18:00',
    location: '台北辦公室',
    note: '測試排班'
  };
  
  // 測試新增排班
  const addResult = handleAddShift(testParams);
  Logger.log('新增排班結果: ' + JSON.stringify(addResult));
  
  // 測試查詢排班
  const queryParams = {
    token: '2d3ce046-3dcc-4a62-ac92-ac0c87993669',
    employeeId: 'U123456'
  };
  const queryResult = handleGetShifts(queryParams);
  Logger.log('查詢排班結果: ' + JSON.stringify(queryResult));
}



// ==================== 薪資系統 Handler 函數 ====================

/**
 * 處理設定員工薪資
 */
function handleSetEmployeeSalaryTW(params) {
  try {
    if (!params.token || !validateSession(params.token)) {
      return { ok: false, msg: "未授權或 session 已過期" };
    }
    
    const salaryData = {
      employeeId: params.employeeId,
      employeeName: params.employeeName,
      idNumber: params.idNumber,
      employeeType: params.employeeType,
      salaryType: params.salaryType,
      baseSalary: parseFloat(params.baseSalary) || 0,
      bankCode: params.bankCode,
      bankAccount: params.bankAccount,
      hireDate: params.hireDate,
      paymentDay: params.paymentDay,
      pensionSelfRate: parseFloat(params.pensionSelfRate) || 0,
      laborFee: parseFloat(params.laborFee) || 0,
      healthFee: parseFloat(params.healthFee) || 0,
      employmentFee: parseFloat(params.employmentFee) || 0,
      pensionSelf: parseFloat(params.pensionSelf) || 0,
      incomeTax: parseFloat(params.incomeTax) || 0,
      note: params.note
    };
    
    if (salaryData.salaryType === '月薪' && salaryData.baseSalary < 27470) {
      return { ok: false, msg: "月薪不得低於27,470元" };
    }
    
    if (salaryData.salaryType === '時薪' && salaryData.baseSalary < 183) {
      return { ok: false, msg: "時薪不得低於183元" };
    }
    
    const result = setEmployeeSalaryTW(salaryData);
    
    return { 
      ok: result.success, 
      msg: result.message,
      data: result 
    };
    
  } catch (error) {
    Logger.log('handleSetEmployeeSalaryTW 錯誤: ' + error);
    return { ok: false, msg: error.message };
  }
}

/**
 * 處理取得員工薪資
 */
function handleGetEmployeeSalaryTW(params) {
  try {
    if (!params.token || !validateSession(params.token)) {
      return { ok: false, msg: "未授權" };
    }
    
    const result = getEmployeeSalaryTW(params.employeeId);
    return { ok: result.success, data: result.data, msg: result.message };
    
  } catch (error) {
    return { ok: false, msg: error.message };
  }
}
