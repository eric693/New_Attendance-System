// Handlers.gs

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

function handlePunch(params) {
  const { token, type, lat, lng, note } = params;
  return punch(token, type, parseFloat(lat), parseFloat(lng), note);
}

function handleAdjustPunch(params) {
  const { token, type, lat, lng, note, datetime } = params;
  const punchDate = datetime ? new Date(datetime) : new Date();
  return punchAdjusted(token, type, punchDate, parseFloat(lat), parseFloat(lng), note);
}

function handleExchangeToken(otoken) {
  const sessionToken = verifyOneTimeToken_(otoken);
  return sessionToken
    ? { ok:true, sToken: sessionToken }
    : { ok:false, code:"ERR_INVALID_TOKEN" };
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

function handleAddLocation(params) {
  const { name, lat, lng } = params;
  return addLocation(name, lat, lng);
}

function handleGetLocation() {
  return getLocation();
}

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

/**
 * 提交加班申請
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
 */
function handleGetEmployeeOvertime(params) {
  Logger.log(`📥 查詢員工加班記錄`);
  return getEmployeeOvertimeRequests(params.token);
}

/**
 * 查詢待審核的加班申請（管理員用）
 */
function handleGetPendingOvertime(params) {
  Logger.log(`📥 查詢待審核加班申請`);
  return getPendingOvertimeRequests(params.token);
}

/**
 * 審核加班申請
 * 🔧 關鍵修正：接收 reviewAction 參數
 */
function handleReviewOvertime(params) {
  const { token, rowNumber, reviewAction, comment } = params;
  
  // 記錄原始參數
  Logger.log(`📥 handleReviewOvertime 收到參數:`);
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