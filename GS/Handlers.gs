// Handlers.gs - 完整版本（包含所有功能）

// ==================== 登入相關 ====================

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

// ==================== 打卡相關 ====================

function handlePunch(params) {
  const { token, type, lat, lng, note } = params;
  return punch(token, type, parseFloat(lat), parseFloat(lng), note);
}

function handleAdjustPunch(params) {
  const { token, type, lat, lng, note, datetime } = params;
  const punchDate = datetime ? new Date(datetime) : new Date();
  return punchAdjusted(token, type, punchDate, parseFloat(lat), parseFloat(lng), note);
}

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

// ==================== 地點相關 ====================

function handleAddLocation(params) {
  const { name, lat, lng } = params;
  return addLocation(name, lat, lng);
}

function handleGetLocation() {
  return getLocation();
}

// ==================== 補打卡審核相關 ====================

function handleGetReviewRequest() {
  return getReviewRequest();
}

/**
 * 處理核准補打卡審核的請求
 * @param {object} params - 包含請求參數的物件
 * @return {object} 回傳處理結果
 */
function handleApproveReview(params) {
  const recordId = params.id;
  if (!recordId) {
    return { ok: false, msg: "缺少審核 ID" };
  }
  return updateReviewStatus(recordId, "v", "核准");
}

/**
 * 處理拒絕補打卡審核的請求
 * @param {object} params - 包含請求參數的物件
 * @return {object} 回傳處理結果
 */
function handleRejectReview(params) {
  const recordId = params.id;
  if (!recordId) {
    return { ok: false, msg: "缺少審核 ID" };
  }
  return updateReviewStatus(recordId, "x", "拒絕");
}

// ==================== 加班功能相關 ====================

/**
 * 提交加班申請
 * @param {object} params - 包含加班申請參數的物件
 * @return {object} 回傳處理結果
 */
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

/**
 * 查詢員工的加班記錄
 * @param {object} params - 包含 token 的物件
 * @return {object} 回傳加班記錄列表
 */
function handleGetEmployeeOvertime(params) {
  Logger.log(`📥 查詢員工加班記錄`);
  return getEmployeeOvertimeRequests(params.token);
}

/**
 * 查詢待審核的加班申請（管理員用）
 * @param {object} params - 包含 token 的物件
 * @return {object} 回傳待審核的加班申請列表
 */
function handleGetPendingOvertime(params) {
  Logger.log(`📥 查詢待審核加班申請`);
  return getPendingOvertimeRequests(params.token);
}

/**
 * 審核加班申請
 * @param {object} params - 包含審核參數的物件
 * @return {object} 回傳審核結果
 */
function handleReviewOvertime(params) {
  const { token, rowNumber, action, comment } = params;
  
  // 記錄原始參數
  Logger.log(`📥 handleReviewOvertime 收到參數:`);
  Logger.log(`   - rowNumber: ${rowNumber}`);
  Logger.log(`   - action: "${action}"`);
  Logger.log(`   - comment: "${comment}"`);
  
  return reviewOvertimeRequest(
    token, 
    parseInt(rowNumber), 
    action,
    comment || ""
  );
}