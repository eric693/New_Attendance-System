// Handlers.gs - 完整版本（包含原有功能 + 排班功能修正版）

// ==================== 登入與認證相關 ====================

function handleGetProfile(code) {
  const tokenResp = exchangeCodeForToken_(code);
  const profile   = getLineUserInfo_(tokenResp);
  const sToken    = writeSession_(profile.userId);
  writeEmployee_(profile);
  return {
    ok: true,
    code: "WELCOME_BACK",
    params: { name: profile.displayName },
    sToken
  };
}

function handleGetLoginUrl() {
  const baseUrl = LINE_REDIRECT_URL;
  const state   = Utilities.getUuid();
  const scope   = encodeURIComponent('openid profile email');
  const redirect= encodeURIComponent(baseUrl);
  const url     = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${encodeURIComponent(LINE_CHANNEL_ID)}&redirect_uri=${redirect}&state=${state}&scope=${scope}`;
  return { url };
}

function handleCheckSession(sessionToken) {
  const user = checkSession_(sessionToken);
  return user.ok ? user : { ok: false, code: user.code };
}

function handleExchangeToken(otoken) {
  const sessionToken = verifyOneTimeToken_(otoken);
  return sessionToken
    ? { ok:true, sToken: sessionToken }
    : { ok:false, code:"ERR_INVALID_TOKEN" };
}

// ==================== 打卡功能相關 ====================

function handlePunch(params) {
  const { token, type, lat, lng, note } = params;
  return punch(token, type, parseFloat(lat), parseFloat(lng), note);
}

function handleAdjustPunch(params) {
  const { token, type, lat, lng, note, datetime } = params;
  const punchDate = datetime ? new Date(datetime) : new Date();
  return punchAdjusted(token, type, punchDate, parseFloat(lat), parseFloat(lng), note);
}

// ==================== 出勤記錄相關 ====================

function handleGetAbnormalRecords(params) {
  const { month, userId } = params;
  if (!month) return { ok: false, code: "ERR_MISSING_MONTH" };
  const records = getAttendanceRecords(month, userId);
  const abnormalResults = checkAttendanceAbnormal(records);
  return { ok: true, records: abnormalResults };
}

function handleGetAttendanceDetails(params) {
  const { month, userId } = params;
  if (!month) return { ok: false, code: "ERR_MISSING_MONTH" };
  
  const records = getAttendanceRecords(month, userId);
  const results = checkAttendance(records);  
  
  return { ok: true, records: results };
}

// ==================== 地點管理相關 ====================

function handleAddLocation(params) {
  const { name, lat, lng } = params;
  return addLocation(name, lat, lng);
}

function handleGetLocation() {
  return getLocation();
}

function handleGetLocations() {
  return getLocation();
}

// ==================== 員工管理相關 ====================

function handleGetAllUsers() {
  return getAllUsers();
}

// ==================== 審核功能相關 ====================

function handleGetReviewRequest() {
  return getReviewRequest();
}

function handleApproveReview(params) {
  const recordId = params.id;
  if (!recordId) {
    return { ok: false, msg: "缺少審核 ID" };
  }
  return updateReviewStatus(recordId, "v", "核准");
}

function handleRejectReview(params) {
  const recordId = params.id;
  if (!recordId) {
    return { ok: false, msg: "缺少審核 ID" };
  }
  return updateReviewStatus(recordId, "x", "拒絕");
}

// ==================== 加班功能相關 ====================

function handleSubmitOvertime(params) {
  const { token, overtimeDate, startTime, endTime, hours, reason } = params;
  Logger.log(`收到加班申請: 日期=${overtimeDate}, 開始=${startTime}, 結束=${endTime}, 時數=${hours}`);
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
  Logger.log(`查詢員工加班記錄`);
  return getEmployeeOvertimeRequests(params.token);
}

function handleGetPendingOvertime(params) {
  Logger.log(`查詢待審核加班申請`);
  return getPendingOvertimeRequests(params.token);
}

function handleReviewOvertime(params) {
  const { token, rowNumber, reviewAction, comment } = params;
  
  Logger.log(`handleReviewOvertime 收到參數:`);
  Logger.log(`   - rowNumber: ${rowNumber}`);
  Logger.log(`   - reviewAction: "${reviewAction}"`);
  Logger.log(`   - comment: "${comment}"`);
  
  return reviewOvertimeRequest(
    token, 
    parseInt(rowNumber), 
    reviewAction,
    comment || ""
  );
}

// ==================== 請假功能相關 ====================

function handleGetLeaveBalance(params) {
  return getLeaveBalance(params.token);
}

function handleSubmitLeave(params) {
  const { token, leaveType, startDate, endDate, days, reason } = params;
  return submitLeaveRequest(token, leaveType, startDate, endDate, parseFloat(days), reason);
}

function handleGetEmployeeLeaveRecords(params) {
  return getEmployeeLeaveRecords(params.token);
}

function handleGetPendingLeaveRequests(params) {
  return getPendingLeaveRequests(params.token);
}

function handleReviewLeave(params) {
  const { token, rowNumber, reviewAction, comment } = params;
  return reviewLeaveRequest(token, parseInt(rowNumber), reviewAction, comment || "");
}

function handleInitializeEmployeeLeave(params) {
  return initializeEmployeeLeave(params.token);
}

// ==================== 排班功能相關 ====================

/**
 * 新增單筆排班 ⭐ 修正版
 */
function handleAddShift(params) {
  try {
    // 驗證 session
    if (!params.token || !validateSession(params.token)) {
      return { ok: false, msg: "未授權或 session 已過期" };
    }
    
    Logger.log('📝 收到新增排班請求');
    
    // 準備排班資料
    const shiftData = {
      employeeId: params.employeeId,
      employeeName: params.employeeName,
      date: params.date,
      shiftType: params.shiftType,
      startTime: params.startTime,
      endTime: params.endTime,
      location: params.location,
      note: params.note || ''
    };
    
    // 驗證必填欄位
    if (!shiftData.employeeId || !shiftData.date || !shiftData.shiftType) {
      return { ok: false, msg: "缺少必填欄位" };
    }
    
    // 呼叫核心函數 (在 ShiftManagement.gs 中)
    const result = addShift(shiftData);
    
    return { 
      ok: result.success, 
      msg: result.message,
      data: result
    };
    
  } catch (error) {
    Logger.log('❌ handleAddShift 錯誤: ' + error);
    return { ok: false, msg: error.message };
  }
}

/**
 * 批量新增排班 ⭐ 修正版 - 關鍵函數
 */
function handleBatchAddShifts(params) {
  try {
    // 驗證 session
    if (!params.token || !validateSession(params.token)) {
      return { ok: false, msg: "未授權或 session 已過期" };
    }
    
    Logger.log('📦 收到批量新增排班請求');
    
    // ⭐ 從 URL 參數取得資料 (GET 請求)
    let shiftsArray;
    
    if (params.shiftsArray) {
      try {
        // 如果是 URL 編碼的字串,先解碼再解析
        if (typeof params.shiftsArray === 'string') {
          const decoded = decodeURIComponent(params.shiftsArray);
          shiftsArray = JSON.parse(decoded);
          Logger.log('✅ 成功解析 shiftsArray: ' + shiftsArray.length + ' 筆');
        } else {
          shiftsArray = params.shiftsArray;
        }
      } catch (parseError) {
        Logger.log('❌ 解析 shiftsArray 失敗: ' + parseError);
        return { ok: false, msg: "資料格式錯誤: 無法解析 JSON" };
      }
    } else {
      Logger.log('❌ 缺少 shiftsArray 參數');
      return { ok: false, msg: "缺少 shiftsArray 參數" };
    }
    
    // 驗證是否為陣列
    if (!Array.isArray(shiftsArray)) {
      return { ok: false, msg: "shiftsArray 必須是陣列" };
    }
    
    // 驗證陣列不為空
    if (shiftsArray.length === 0) {
      return { ok: false, msg: "批量資料不能為空" };
    }
    
    Logger.log('📊 準備批量新增: ' + shiftsArray.length + ' 筆排班');
    
    // 呼叫核心函數 (在 ShiftManagement.gs 中)
    const result = batchAddShifts(shiftsArray);
    
    Logger.log('✅ 批量新增結果: ' + JSON.stringify(result));
    
    return { 
      ok: result.success, 
      msg: result.message,
      data: result
    };
    
  } catch (error) {
    Logger.log('❌ handleBatchAddShifts 錯誤: ' + error);
    return { ok: false, msg: "批量新增失敗: " + error.message };
  }
}

/**
 * 更新排班 ⭐ 修正版
 */
function handleUpdateShift(params) {
  try {
    // 驗證 session
    if (!params.token || !validateSession(params.token)) {
      return { ok: false, msg: "未授權或 session 已過期" };
    }
    
    if (!params.shiftId) {
      return { ok: false, msg: "缺少 shiftId 參數" };
    }
    
    Logger.log('✏️ 更新排班: ' + params.shiftId);
    
    // 準備更新資料
    const updateData = {
      date: params.date,
      shiftType: params.shiftType,
      startTime: params.startTime,
      endTime: params.endTime,
      location: params.location,
      note: params.note
    };
    
    // 呼叫核心函數
    const result = updateShift(params.shiftId, updateData);
    
    return { 
      ok: result.success, 
      msg: result.message 
    };
    
  } catch (error) {
    Logger.log('❌ handleUpdateShift 錯誤: ' + error);
    return { ok: false, msg: error.message };
  }
}

/**
 * 刪除排班 ⭐ 修正版
 */
function handleDeleteShift(params) {
  try {
    // 驗證 session
    if (!params.token || !validateSession(params.token)) {
      return { ok: false, msg: "未授權或 session 已過期" };
    }
    
    if (!params.shiftId) {
      return { ok: false, msg: "缺少 shiftId 參數" };
    }
    
    Logger.log('🗑️ 刪除排班: ' + params.shiftId);
    
    // 呼叫核心函數
    const result = deleteShift(params.shiftId);
    
    return { 
      ok: result.success, 
      msg: result.message 
    };
    
  } catch (error) {
    Logger.log('❌ handleDeleteShift 錯誤: ' + error);
    return { ok: false, msg: error.message };
  }
}

/**
 * 查詢排班列表 ⭐ 修正版
 */
function handleGetShifts(params) {
  try {
    // 驗證 session
    if (!params.token || !validateSession(params.token)) {
      return { ok: false, msg: "未授權或 session 已過期" };
    }
    
    Logger.log('🔍 收到查詢排班請求');
    
    // 準備篩選條件
    const filters = {
      employeeId: params.employeeId,
      startDate: params.startDate,
      endDate: params.endDate,
      shiftType: params.shiftType,
      location: params.location
    };
    
    // 呼叫核心函數
    const result = getShifts(filters);
    
    return { 
      ok: result.success, 
      data: result.data, 
      count: result.count,
      msg: result.message 
    };
    
  } catch (error) {
    Logger.log('❌ handleGetShifts 錯誤: ' + error);
    return { ok: false, msg: error.message };
  }
}

/**
 * 查詢單一排班詳情 ⭐ 修正版
 */
function handleGetShiftById(params) {
  try {
    // 驗證 session
    if (!params.token || !validateSession(params.token)) {
      return { ok: false, msg: "未授權或 session 已過期" };
    }
    
    if (!params.shiftId) {
      return { ok: false, msg: "缺少 shiftId 參數" };
    }
    
    Logger.log('🔍 查詢排班詳情: ' + params.shiftId);
    
    // 呼叫核心函數
    const result = getShiftById(params.shiftId);
    
    return { 
      ok: result.success, 
      data: result.data, 
      msg: result.message 
    };
    
  } catch (error) {
    Logger.log('❌ handleGetShiftById 錯誤: ' + error);
    return { ok: false, msg: error.message };
  }
}

/**
 * 查詢員工特定日期的排班 ⭐ 修正版
 */
function handleGetEmployeeShiftForDate(params) {
  try {
    // 驗證 session
    if (!params.token || !validateSession(params.token)) {
      return { ok: false, msg: "未授權或 session 已過期" };
    }
    
    if (!params.employeeId || !params.date) {
      return { ok: false, msg: "缺少必要參數" };
    }
    
    Logger.log('📅 查詢員工排班: ' + params.employeeId + ', 日期: ' + params.date);
    
    // 呼叫核心函數
    const result = getEmployeeShiftForDate(params.employeeId, params.date);
    
    return { 
      ok: result.success, 
      hasShift: result.hasShift,
      data: result.data, 
      msg: result.message 
    };
    
  } catch (error) {
    Logger.log('❌ handleGetEmployeeShiftForDate 錯誤: ' + error);
    return { ok: false, msg: error.message };
  }
}

/**
 * 取得本週排班統計 ⭐ 修正版
 */
function handleGetWeeklyShiftStats(params) {
  try {
    // 驗證 session
    if (!params.token || !validateSession(params.token)) {
      return { ok: false, msg: "未授權或 session 已過期" };
    }
    
    Logger.log('📊 查詢本週排班統計');
    
    // 呼叫核心函數
    const result = getWeeklyShiftStats();
    
    return { 
      ok: result.success, 
      data: result.data, 
      msg: result.message 
    };
    
  } catch (error) {
    Logger.log('❌ handleGetWeeklyShiftStats 錯誤: ' + error);
    return { ok: false, msg: error.message };
  }
}

/**
 * 匯出排班資料 ⭐ 修正版
 */
function handleExportShifts(params) {
  try {
    // 驗證 session
    if (!params.token || !validateSession(params.token)) {
      return { ok: false, msg: "未授權或 session 已過期" };
    }
    
    Logger.log('📥 匯出排班資料');
    
    // 準備篩選條件
    const filters = {
      employeeId: params.employeeId,
      startDate: params.startDate,
      endDate: params.endDate,
      shiftType: params.shiftType
    };
    
    // 呼叫核心函數
    const result = exportShifts(filters);
    
    return { 
      ok: result.success, 
      data: result.data, 
      filename: result.filename, 
      msg: result.message 
    };
    
  } catch (error) {
    Logger.log('❌ handleExportShifts 錯誤: ' + error);
    return { ok: false, msg: error.message };
  }
}