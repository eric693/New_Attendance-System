// Handlers.gs - 完整版本（包含原有功能 + 薪資系統完全修正版）

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

function handleAddShift(params) {
  try {
    if (!params.token || !validateSession(params.token)) {
      return { ok: false, msg: "未授權或 session 已過期" };
    }
    
    Logger.log('📝 收到新增排班請求');
    
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
    
    if (!shiftData.employeeId || !shiftData.date || !shiftData.shiftType) {
      return { ok: false, msg: "缺少必填欄位" };
    }
    
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

function handleBatchAddShifts(params) {
  try {
    if (!params.token || !validateSession(params.token)) {
      return { ok: false, msg: "未授權或 session 已過期" };
    }
    
    Logger.log('📦 收到批量新增排班請求');
    
    let shiftsArray;
    
    if (params.shiftsArray) {
      try {
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
    
    if (!Array.isArray(shiftsArray)) {
      return { ok: false, msg: "shiftsArray 必須是陣列" };
    }
    
    if (shiftsArray.length === 0) {
      return { ok: false, msg: "批量資料不能為空" };
    }
    
    Logger.log('📊 準備批量新增: ' + shiftsArray.length + ' 筆排班');
    
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

function handleUpdateShift(params) {
  try {
    if (!params.token || !validateSession(params.token)) {
      return { ok: false, msg: "未授權或 session 已過期" };
    }
    
    if (!params.shiftId) {
      return { ok: false, msg: "缺少 shiftId 參數" };
    }
    
    Logger.log('✏️ 更新排班: ' + params.shiftId);
    
    const updateData = {
      date: params.date,
      shiftType: params.shiftType,
      startTime: params.startTime,
      endTime: params.endTime,
      location: params.location,
      note: params.note
    };
    
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

function handleDeleteShift(params) {
  try {
    if (!params.token || !validateSession(params.token)) {
      return { ok: false, msg: "未授權或 session 已過期" };
    }
    
    if (!params.shiftId) {
      return { ok: false, msg: "缺少 shiftId 參數" };
    }
    
    Logger.log('🗑️ 刪除排班: ' + params.shiftId);
    
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

function handleGetShifts(params) {
  try {
    if (!params.token || !validateSession(params.token)) {
      return { ok: false, msg: "未授權或 session 已過期" };
    }
    
    Logger.log('🔍 收到查詢排班請求');
    
    const filters = {
      employeeId: params.employeeId,
      startDate: params.startDate,
      endDate: params.endDate,
      shiftType: params.shiftType,
      location: params.location
    };
    
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

function handleGetShiftById(params) {
  try {
    if (!params.token || !validateSession(params.token)) {
      return { ok: false, msg: "未授權或 session 已過期" };
    }
    
    if (!params.shiftId) {
      return { ok: false, msg: "缺少 shiftId 參數" };
    }
    
    Logger.log('🔍 查詢排班詳情: ' + params.shiftId);
    
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

function handleGetEmployeeShiftForDate(params) {
  try {
    if (!params.token || !validateSession(params.token)) {
      return { ok: false, msg: "未授權或 session 已過期" };
    }
    
    if (!params.employeeId || !params.date) {
      return { ok: false, msg: "缺少必要參數" };
    }
    
    Logger.log('📅 查詢員工排班: ' + params.employeeId + ', 日期: ' + params.date);
    
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

function handleGetWeeklyShiftStats(params) {
  try {
    if (!params.token || !validateSession(params.token)) {
      return { ok: false, msg: "未授權或 session 已過期" };
    }
    
    Logger.log('📊 查詢本週排班統計');
    
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

function handleExportShifts(params) {
  try {
    if (!params.token || !validateSession(params.token)) {
      return { ok: false, msg: "未授權或 session 已過期" };
    }
    
    Logger.log('📥 匯出排班資料');
    
    const filters = {
      employeeId: params.employeeId,
      startDate: params.startDate,
      endDate: params.endDate,
      shiftType: params.shiftType
    };
    
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

// ==================== 薪資系統 Handler 函數（完全修正版 v4.0）====================

/**
 * ✅ 處理設定員工薪資
 */
function handleSetEmployeeSalaryTW(params) {
  try {
    Logger.log('═══════════════════════════════════════');
    Logger.log('💰 開始設定員工薪資');
    Logger.log('═══════════════════════════════════════');
    
    if (!params || Object.keys(params).length === 0) {
      Logger.log('❌ params 為空或未定義');
      return { ok: false, msg: "未收到任何參數" };
    }
    
    Logger.log('📥 收到的參數:');
    Logger.log('   - token: ' + (params.token ? '存在' : '缺少'));
    Logger.log('   - employeeId: ' + (params.employeeId || '缺少'));
    Logger.log('   - employeeName: ' + (params.employeeName || '缺少'));
    Logger.log('   - baseSalary: ' + (params.baseSalary || '缺少'));
    
    if (!params.token) {
      Logger.log('❌ 缺少認證 token');
      return { ok: false, msg: "缺少認證 token" };
    }
    
    const sessionResult = checkSession_(params.token);
    
    if (!sessionResult.ok) {
      Logger.log('❌ Session 驗證失敗');
      return { ok: false, msg: "未授權或 session 已過期" };
    }
    
    Logger.log('✅ Session 驗證成功');
    
    const safeString = (value) => {
      if (value === null || value === undefined) return '';
      return String(value).trim();
    };
    
    const safeNumber = (value) => {
      if (value === null || value === undefined) return 0;
      const num = parseFloat(value);
      return isNaN(num) ? 0 : num;
    };
    
    const salaryData = {
      employeeId: safeString(params.employeeId),
      employeeName: safeString(params.employeeName),
      idNumber: safeString(params.idNumber),
      employeeType: safeString(params.employeeType) || '正職',
      salaryType: safeString(params.salaryType) || '月薪',
      baseSalary: safeNumber(params.baseSalary),
      bankCode: safeString(params.bankCode),
      bankAccount: safeString(params.bankAccount),
      hireDate: params.hireDate || new Date(),
      paymentDay: safeString(params.paymentDay) || '5',
      pensionSelfRate: safeNumber(params.pensionSelfRate),
      laborFee: safeNumber(params.laborFee),
      healthFee: safeNumber(params.healthFee),
      employmentFee: safeNumber(params.employmentFee),
      pensionSelf: safeNumber(params.pensionSelf),
      incomeTax: safeNumber(params.incomeTax),
      note: safeString(params.note)
    };
    
    if (!salaryData.employeeId || !salaryData.employeeName || salaryData.baseSalary <= 0) {
      Logger.log('❌ 必填欄位驗證失敗');
      return { ok: false, msg: "必填欄位不完整或無效" };
    }
    
    if (salaryData.salaryType === '月薪' && salaryData.baseSalary < 27470) {
      return { ok: false, msg: "月薪不得低於27,470元" };
    }
    
    if (salaryData.salaryType === '時薪' && salaryData.baseSalary < 183) {
      return { ok: false, msg: "時薪不得低於183元" };
    }
    
    Logger.log('💾 開始儲存薪資設定...');
    
    const result = setEmployeeSalaryTW(salaryData);
    
    Logger.log('📤 儲存結果: ' + result.success);
    Logger.log('═══════════════════════════════════════');
    
    return { 
      ok: result.success, 
      msg: result.message,
      data: result 
    };
    
  } catch (error) {
    Logger.log('❌❌❌ 發生嚴重錯誤');
    Logger.log('錯誤訊息: ' + error.message);
    Logger.log('錯誤堆疊: ' + error.stack);
    
    return { 
      ok: false, 
      msg: `設定失敗: ${error.message}`,
      error: error.stack
    };
  }
}

/**
 * ✅ 處理取得員工薪資
 */
function handleGetEmployeeSalaryTW(params) {
  try {
    if (!params.token || !validateSession(params.token)) {
      return { ok: false, msg: "未授權" };
    }
    
    if (!params.employeeId) {
      return { ok: false, msg: "缺少員工ID" };
    }
    
    const result = getEmployeeSalaryTW(params.employeeId);
    return { ok: result.success, data: result.data, msg: result.message };
    
  } catch (error) {
    Logger.log('❌ handleGetEmployeeSalaryTW 錯誤: ' + error);
    return { ok: false, msg: error.message };
  }
}

// Handlers.gs - handleGetMySalary 完全修正版（修復 userId = null 問題）

// ✅✅✅ 最終修正版 - 使用 Logger.log 而不是 console.log



/**
 * ✅ 處理取得我的薪資（最終修正版 - 使用 Logger.log）
 */
function handleGetMySalary(params) {
  try {
    Logger.log('═══════════════════════════════════════');
    Logger.log('🎯 handleGetMySalary 開始');
    Logger.log('═══════════════════════════════════════');
    
    // ⭐ 步驟 1：檢查參數
    if (!params || !params.token) {
      Logger.log('❌ 缺少 token');
      return { ok: false, msg: "缺少 token" };
    }
    
    Logger.log('📥 收到的參數:');
    Logger.log('   - token: ' + params.token.substring(0, 20) + '...');
    Logger.log('   - yearMonth: ' + (params.yearMonth || '缺少'));
    Logger.log('');
    
    // ⭐ 步驟 2：驗證 Session
    Logger.log('📡 驗證 Session...');
    const session = checkSession_(params.token);
    
    Logger.log('📤 Session 檢查結果:');
    Logger.log('   - ok: ' + session.ok);
    Logger.log('   - code: ' + (session.code || '無'));
    
    if (!session.ok) {
      Logger.log('❌ Session 無效');
      return { ok: false, msg: "未授權或 session 已過期" };
    }
    
    // ⭐ 步驟 3：檢查並取得 user 物件
    if (!session.user) {
      Logger.log('❌ Session 中沒有 user 資訊');
      return { ok: false, msg: "無法取得使用者資訊" };
    }
    
    Logger.log('👤 使用者資訊:');
    Logger.log('   - userId: ' + (session.user.userId || 'undefined'));
    Logger.log('   - employeeId: ' + (session.user.employeeId || 'undefined'));
    Logger.log('   - name: ' + (session.user.name || 'undefined'));
    Logger.log('   - dept: ' + (session.user.dept || 'undefined'));
    Logger.log('');
    
    // ⭐⭐⭐ 關鍵修正：確保正確取得 employeeId
    let employeeId = null;
    
    // 優先順序：userId > employeeId > id
    if (session.user.userId) {
      employeeId = String(session.user.userId).trim();
      Logger.log('✅ 從 session.user.userId 取得: ' + employeeId);
    } else if (session.user.employeeId) {
      employeeId = String(session.user.employeeId).trim();
      Logger.log('✅ 從 session.user.employeeId 取得: ' + employeeId);
    } else if (session.user.id) {
      employeeId = String(session.user.id).trim();
      Logger.log('✅ 從 session.user.id 取得: ' + employeeId);
    }
    
    if (!employeeId || employeeId === 'null' || employeeId === 'undefined') {
      Logger.log('❌ 無法取得有效的員工ID');
      Logger.log('   完整 user 物件: ' + JSON.stringify(session.user));
      return { ok: false, msg: "無法取得員工ID" };
    }
    
    Logger.log('✅ 最終員工ID: ' + employeeId);
    Logger.log('');
    
    // ⭐ 步驟 4：檢查 yearMonth
    if (!params.yearMonth) {
      Logger.log('❌ 缺少 yearMonth 參數');
      return { ok: false, msg: "缺少年月參數" };
    }
    
    // 正規化 yearMonth（確保格式為 yyyy-MM）
    let yearMonth = params.yearMonth;
    if (typeof yearMonth === 'string' && yearMonth.length > 7) {
      yearMonth = yearMonth.substring(0, 7);
    }
    
    Logger.log('📅 查詢年月: ' + yearMonth);
    Logger.log('');
    Logger.log('💰 開始查詢薪資...');
    Logger.log('   employeeId: ' + employeeId);
    Logger.log('   yearMonth: ' + yearMonth);
    Logger.log('');
    
    // ⭐ 步驟 5：呼叫核心查詢函數
    const result = getMySalary(employeeId, yearMonth);
    
    Logger.log('');
    Logger.log('📤 查詢結果:');
    Logger.log('   - success: ' + result.success);
    Logger.log('   - message: ' + (result.message || result.msg || '無'));
    
    if (result.success && result.data) {
      Logger.log('   - 有資料: 是');
      Logger.log('   - 薪資單ID: ' + result.data['薪資單ID']);
      Logger.log('   - 員工姓名: ' + result.data['員工姓名']);
      Logger.log('   - 實發金額: ' + result.data['實發金額']);
    } else {
      Logger.log('   - 有資料: 否');
    }
    
    Logger.log('═══════════════════════════════════════');
    
    // ⭐ 步驟 6：返回結果（統一格式）
    return { 
      ok: result.success,
      success: result.success, // 向後相容
      data: result.data, 
      msg: result.message || result.msg || (result.success ? '查詢成功' : '查無資料')
    };
    
  } catch (error) {
    Logger.log('');
    Logger.log('❌❌❌ 發生錯誤');
    Logger.log('錯誤訊息: ' + error.message);
    Logger.log('錯誤堆疊: ' + error.stack);
    Logger.log('═══════════════════════════════════════');
    
    return { 
      ok: false, 
      success: false,
      msg: '查詢失敗: ' + error.message,
      error: error.stack
    };
  }
}

/**
 * ✅ 處理取得我的薪資歷史（修正版）
 */
function handleGetMySalaryHistory(params) {
  try {
    Logger.log('═══════════════════════════════════════');
    Logger.log('📋 handleGetMySalaryHistory 開始');
    Logger.log('═══════════════════════════════════════');
    
    if (!params.token) {
      Logger.log('❌ 缺少 token');
      return { ok: false, msg: "缺少 token" };
    }
    
    Logger.log('📡 驗證 Session...');
    const session = checkSession_(params.token);
    
    if (!session.ok || !session.user) {
      Logger.log('❌ Session 無效');
      return { ok: false, msg: "未授權" };
    }
    
    Logger.log('✅ Session 有效');
    
    // 取得員工ID
    let employeeId = null;
    if (session.user.userId) {
      employeeId = String(session.user.userId).trim();
    } else if (session.user.employeeId) {
      employeeId = String(session.user.employeeId).trim();
    }
    
    if (!employeeId) {
      Logger.log('❌ 無法取得員工ID');
      return { ok: false, msg: "無法取得員工ID" };
    }
    
    Logger.log('👤 員工ID: ' + employeeId);
    
    const limit = parseInt(params.limit) || 12;
    Logger.log('📋 查詢筆數限制: ' + limit);
    
    const result = getMySalaryHistory(employeeId, limit);
    
    Logger.log('📤 查詢結果:');
    Logger.log('   - success: ' + result.success);
    Logger.log('   - total: ' + (result.total || 0));
    Logger.log('═══════════════════════════════════════');
    
    return { 
      ok: result.success, 
      data: result.data,
      total: result.total,
      msg: result.message 
    };
    
  } catch (error) {
    Logger.log('❌ handleGetMySalaryHistory 錯誤: ' + error);
    return { ok: false, msg: error.message };
  }
}

/**
 * 🧪 測試函數
 */
function testHandleGetMySalaryFinal() {
  Logger.log('🧪 測試最終修正版 handleGetMySalary');
  Logger.log('');
  
  const testParams = {
    token: '04fd1452-4aca-4b03-ad17-45f03144c6ff',
    yearMonth: '2025-11'
  };
  
  Logger.log('📥 測試參數:');
  Logger.log('   token: ' + testParams.token.substring(0, 20) + '...');
  Logger.log('   yearMonth: ' + testParams.yearMonth);
  Logger.log('');
  
  const result = handleGetMySalary(testParams);
  
  Logger.log('');
  Logger.log('📤 最終結果:');
  Logger.log(JSON.stringify(result, null, 2));
  
  if (result.ok) {
    Logger.log('');
    Logger.log('✅✅✅ 測試成功！');
  } else {
    Logger.log('');
    Logger.log('❌❌❌ 測試失敗');
    Logger.log('   原因: ' + result.msg);
  }
}
function manualTestGetMySalary() {
  Logger.log('🧪 手動測試 getMySalary');
  Logger.log('');
  
  const token = '04fd1452-4aca-4b03-ad17-45f03144c6ff';
  const yearMonth = '2025-11';
  
  Logger.log('📡 Step 1: 檢查 Session');
  const session = checkSession_(token);
  Logger.log('Session 結果: ' + JSON.stringify(session, null, 2));
  
  if (!session.ok) {
    Logger.log('❌ Session 無效');
    return;
  }
  
  Logger.log('');
  Logger.log('📡 Step 2: 取得 userId');
  const userId = session.user.userId;
  Logger.log('userId: ' + userId);
  Logger.log('userId 型別: ' + typeof userId);
  
  if (!userId) {
    Logger.log('❌ userId 是 null 或 undefined');
    return;
  }
  
  Logger.log('');
  Logger.log('📡 Step 3: 呼叫 getMySalary');
  const result = getMySalary(userId, yearMonth);
  
  Logger.log('');
  Logger.log('📤 最終結果:');
  Logger.log(JSON.stringify(result, null, 2));
  
  if (result.success) {
    Logger.log('');
    Logger.log('✅✅✅ 成功！');
  } else {
    Logger.log('');
    Logger.log('❌❌❌ 失敗');
  }
}

/**
 * ✅ 處理計算月薪
 */
function handleCalculateMonthlySalary(params) {
  try {
    if (!params.token || !validateSession(params.token)) {
      return { ok: false, msg: "未授權或 session 已過期" };
    }
    
    if (!params.employeeId) {
      return { ok: false, msg: "缺少員工ID" };
    }
    
    if (!params.yearMonth) {
      return { ok: false, msg: "缺少年月參數" };
    }
    
    Logger.log('💰 計算月薪: ' + params.employeeId + ', ' + params.yearMonth);
    
    const result = calculateMonthlySalary(params.employeeId, params.yearMonth);
    
    return { 
      ok: result.success, 
      data: result.data, 
      msg: result.message 
    };
    
  } catch (error) {
    Logger.log('❌ handleCalculateMonthlySalary 錯誤: ' + error);
    return { ok: false, msg: error.message };
  }
}

/**
 * ✅ 處理儲存月薪記錄
 */
function handleSaveMonthlySalary(params) {
  try {
    if (!params.token || !validateSession(params.token)) {
      return { ok: false, msg: "未授權或 session 已過期" };
    }
    
    Logger.log('💾 儲存月薪資單');
    
    let salaryData;
    if (params.data) {
      if (typeof params.data === 'string') {
        try {
          salaryData = JSON.parse(decodeURIComponent(params.data));
        } catch (e) {
          Logger.log('❌ 解析 data 參數失敗: ' + e);
          return { ok: false, msg: "資料格式錯誤" };
        }
      } else {
        salaryData = params.data;
      }
    } else {
      salaryData = {
        employeeId: params.employeeId,
        employeeName: params.employeeName,
        yearMonth: params.yearMonth,
        baseSalary: params.baseSalary,
        weekdayOvertimePay: params.weekdayOvertimePay,
        restdayOvertimePay: params.restdayOvertimePay,
        holidayOvertimePay: params.holidayOvertimePay,
        laborFee: params.laborFee,
        healthFee: params.healthFee,
        employmentFee: params.employmentFee,
        pensionSelf: params.pensionSelf,
        incomeTax: params.incomeTax,
        leaveDeduction: params.leaveDeduction,
        grossSalary: params.grossSalary,
        netSalary: params.netSalary,
        bankCode: params.bankCode,
        bankAccount: params.bankAccount
      };
    }
    
    const result = saveMonthlySalary(salaryData);
    
    return { 
      ok: result.success, 
      msg: result.message,
      salaryId: result.salaryId
    };
    
  } catch (error) {
    Logger.log('❌ handleSaveMonthlySalary 錯誤: ' + error);
    return { ok: false, msg: error.message };
  }
}

/**
 * ✅ 處理取得所有員工薪資列表
 */
function handleGetAllMonthlySalary(params) {
  try {
    if (!params.token || !validateSession(params.token)) {
      return { ok: false, msg: "未授權" };
    }
    
    const result = getAllMonthlySalary(params.yearMonth);
    return { ok: result.success, data: result.data, msg: result.message };
    
  } catch (error) {
    Logger.log('❌ handleGetAllMonthlySalary 錯誤: ' + error);
    return { ok: false, msg: error.message };
  }
}

/**
 * ✅ 從 Session 取得員工ID的輔助函數
 */
function getUserIdFromSession(token) {
  try {
    const session = checkSession_(token);
    if (session.ok && session.user) {
      return session.user.userId || session.user.employeeId;
    }
    return null;
  } catch (error) {
    Logger.log('❌ getUserIdFromSession 錯誤: ' + error);
    return null;
  }
}

// ==================== 測試函數 ====================

/**
 * 🧪 測試取得我的薪資
 */
function testHandleGetMySalary() {
  Logger.log('🧪🧪🧪 測試 handleGetMySalary');
  Logger.log('');
  
  const testParams = {
    token: '04fd1452-4aca-4b03-ad17-45f03144c6ff',  // ⚠️ 替換成有效的 token
    yearMonth: '2025-11'
  };
  
  Logger.log('📥 測試參數:');
  Logger.log('   token: ' + testParams.token.substring(0, 20) + '...');
  Logger.log('   yearMonth: ' + testParams.yearMonth);
  Logger.log('');
  
  const result = handleGetMySalary(testParams);
  
  Logger.log('');
  Logger.log('📤 最終結果:');
  Logger.log(JSON.stringify(result, null, 2));
  Logger.log('');
  
  if (result.ok) {
    Logger.log('✅✅✅ 測試成功！');
    if (result.data) {
      Logger.log('');
      Logger.log('💰 薪資資料:');
      Logger.log('   員工姓名: ' + result.data['員工姓名']);
      Logger.log('   年月: ' + result.data['年月']);
      Logger.log('   實發金額: ' + result.data['實發金額']);
    }
  } else {
    Logger.log('❌ 測試失敗');
    Logger.log('   原因: ' + result.msg);
  }
}