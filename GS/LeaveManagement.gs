// LeaveManagement.gs - 請假系統後端邏輯（修正版）

// ==================== 所有常數都在 Constants.gs 中定義 ====================
// 不需要在這裡重複定義 SHEET_LEAVE_RECORDS、SHEET_LEAVE_BALANCE、EMPLOYEE_COL
// 所有 .gs 檔案會共享 Constants.gs 中的常數

/**
 * 計算特休假天數（根據台灣勞基法）
 * @param {Date} hireDate - 到職日期
 * @param {Date} calculateDate - 計算日期（預設為今天）
 * @return {number} 特休假天數
 */
function calculateAnnualLeave_(hireDate, calculateDate = new Date()) {
  const hire = new Date(hireDate);
  const calc = new Date(calculateDate);
  
  // 計算工作月數
  const monthsDiff = (calc.getFullYear() - hire.getFullYear()) * 12 
                   + (calc.getMonth() - hire.getMonth());
  
  // 計算工作年數
  const years = Math.floor(monthsDiff / 12);
  
  // 未滿6個月：0天
  if (monthsDiff < 6) return 0;
  
  // 6個月以上未滿1年：3天
  if (monthsDiff >= 6 && monthsDiff < 12) return 3;
  
  // 1年以上未滿2年：7天
  if (years >= 1 && years < 2) return 7;
  
  // 2年以上未滿3年：10天
  if (years >= 2 && years < 3) return 10;
  
  // 3年以上未滿5年：14天
  if (years >= 3 && years < 5) return 14;
  
  // 5年以上未滿10年：15天
  if (years >= 5 && years < 10) return 15;
  
  // 10年以上：每年15天 + 每多一年加1天（最高30天）
  if (years >= 10) {
    const additionalDays = Math.min(years - 10, 15);
    return 15 + additionalDays;
  }
  
  return 0;
}

/**
 * 初始化或更新員工假期額度
 * @param {string} userId - 員工 ID
 * @param {Date} hireDate - 到職日期
 */
function initializeLeaveBalance_(userId, hireDate) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LEAVE_BALANCE);
  
  // 如果工作表不存在，創建它
  if (!sheet) {
    const newSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(SHEET_LEAVE_BALANCE);
    newSheet.appendRow([
      '員工ID', '姓名', '到職日期', '年度',
      '特休假', '病假', '事假', '婚假', '喪假',
      '產假', '陪產假', '家庭照顧假', '生理假',
      '更新時間'
    ]);
    return initializeLeaveBalance_(userId, hireDate);
  }
  
  const values = sheet.getDataRange().getValues();
  const currentYear = new Date().getFullYear();
  
  // 查找現有記錄
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === userId && values[i][3] === currentYear) {
      // 記錄已存在，更新特休假
      const annualLeave = calculateAnnualLeave_(hireDate);
      sheet.getRange(i + 1, 5).setValue(annualLeave);
      sheet.getRange(i + 1, 14).setValue(new Date());
      Logger.log(`✅ 更新員工 ${userId} 的特休假：${annualLeave} 天`);
      return;
    }
  }
  
  // 記錄不存在，新增
  const employee = findEmployeeByLineUserId_(userId);
  const annualLeave = calculateAnnualLeave_(hireDate);
  
  sheet.appendRow([
    userId,                    // 員工ID
    employee.name || '',       // 姓名
    hireDate,                  // 到職日期
    currentYear,               // 年度
    annualLeave,               // 特休假
    30,                        // 病假（每年30天）
    14,                        // 事假（每年14天）
    8,                         // 婚假（8天）
    0,                         // 喪假（依親屬關係）
    56,                        // 產假（8週=56天）
    7,                         // 陪產假（7天）
    7,                         // 家庭照顧假（7天）
    12,                        // 生理假（每月1天，一年12天）
    new Date()                 // 更新時間
  ]);
  
  Logger.log(`✅ 新增員工 ${userId} 的假期額度，特休假：${annualLeave} 天`);
}

/**
 * 取得員工假期餘額
 * @param {string} sessionToken - Session Token
 * @return {Object} 假期餘額資訊
 */
function getLeaveBalance(sessionToken) {
  const session = checkSession_(sessionToken);
  if (!session.ok) return { ok: false, code: session.code };
  
  const userId = session.user.userId;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LEAVE_BALANCE);
  
  if (!sheet) {
    return { 
      ok: false, 
      code: 'ERR_LEAVE_SYSTEM_NOT_INITIALIZED' 
    };
  }
  
  const values = sheet.getDataRange().getValues();
  const currentYear = new Date().getFullYear();
  
  // 查找當年度的假期額度
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === userId && values[i][3] === currentYear) {
      return {
        ok: true,
        balance: {
          ANNUAL_LEAVE: values[i][4],        // 特休假
          SICK_LEAVE: values[i][5],          // 病假
          PERSONAL_LEAVE: values[i][6],      // 事假
          MARRIAGE_LEAVE: values[i][7],      // 婚假
          BEREAVEMENT_LEAVE: values[i][8],   // 喪假
          MATERNITY_LEAVE: values[i][9],     // 產假
          PATERNITY_LEAVE: values[i][10],    // 陪產假
          FAMILY_CARE_LEAVE: values[i][11],  // 家庭照顧假
          MENSTRUAL_LEAVE: values[i][12]     // 生理假
        }
      };
    }
  }
  
  // 如果找不到記錄，可能需要初始化
  return { 
    ok: false, 
    code: 'ERR_NO_LEAVE_BALANCE',
    msg: '找不到假期額度，請聯繫管理員初始化系統'
  };
}

/**
 * 提交請假申請
 * @param {string} sessionToken - Session Token
 * @param {string} leaveType - 假別
 * @param {string} startDate - 開始日期
 * @param {string} endDate - 結束日期
 * @param {number} days - 請假天數
 * @param {string} reason - 請假原因
 */
function submitLeaveRequest(sessionToken, leaveType, startDate, endDate, days, reason) {
  const session = checkSession_(sessionToken);
  if (!session.ok) return { ok: false, code: session.code };
  
  const user = session.user;
  
  // 驗證假期餘額
  const balanceResult = getLeaveBalance(sessionToken);
  if (!balanceResult.ok) return balanceResult;
  
  const balance = balanceResult.balance;
  const currentBalance = balance[leaveType];
  
  if (currentBalance === undefined) {
    return { ok: false, code: 'ERR_INVALID_LEAVE_TYPE' };
  }
  
  if (currentBalance < days) {
    return { 
      ok: false, 
      code: 'ERR_INSUFFICIENT_LEAVE_BALANCE',
      params: { 
        leaveType: leaveType,
        required: days,
        available: currentBalance
      }
    };
  }
  
  // 建立請假紀錄工作表（如果不存在）
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LEAVE_RECORDS);
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(SHEET_LEAVE_RECORDS);
    sheet.appendRow([
      '申請時間', '員工ID', '姓名', '部門', '假別',
      '開始日期', '結束日期', '天數', '原因',
      '狀態', '審核人', '審核時間', '審核意見'
    ]);
  }
  
  // 新增請假記錄
  sheet.appendRow([
    new Date(),              // 申請時間
    user.userId,             // 員工ID
    user.name,               // 姓名
    user.dept,               // 部門
    leaveType,               // 假別
    startDate,               // 開始日期
    endDate,                 // 結束日期
    days,                    // 天數
    reason || '',            // 原因
    'PENDING',               // 狀態（待審核）
    '',                      // 審核人
    '',                      // 審核時間
    ''                       // 審核意見
  ]);
  
  return { 
    ok: true, 
    code: 'LEAVE_SUBMIT_SUCCESS'
  };
}

/**
 * 取得員工的請假記錄
 * @param {string} sessionToken - Session Token
 */
function getEmployeeLeaveRecords(sessionToken) {
  const session = checkSession_(sessionToken);
  if (!session.ok) return { ok: false, code: session.code };
  
  const userId = session.user.userId;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LEAVE_RECORDS);
  
  if (!sheet) {
    return { ok: true, records: [] };
  }
  
  const values = sheet.getDataRange().getValues();
  const records = [];
  
  for (let i = 1; i < values.length; i++) {
    if (values[i][1] === userId) {
      records.push({
        applyTime: values[i][0],
        employeeName: values[i][2],
        leaveType: values[i][4],
        startDate: values[i][5],
        endDate: values[i][6],
        days: values[i][7],
        reason: values[i][8],
        status: values[i][9],
        reviewer: values[i][10],
        reviewTime: values[i][11],
        reviewComment: values[i][12]
      });
    }
  }
  
  // 按申請時間倒序排列
  records.sort((a, b) => new Date(b.applyTime) - new Date(a.applyTime));
  
  return { ok: true, records };
}

/**
 * 取得待審核的請假申請（管理員用）
 * @param {string} sessionToken - Session Token
 */
function getPendingLeaveRequests(sessionToken) {
  const session = checkSession_(sessionToken);
  if (!session.ok) return { ok: false, code: session.code };
  
  // 檢查是否為管理員
  if (session.user.dept !== '管理員') {
    return { ok: false, code: 'ERR_NO_PERMISSION' };
  }
  
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LEAVE_RECORDS);
  
  if (!sheet) {
    return { ok: true, requests: [] };
  }
  
  const values = sheet.getDataRange().getValues();
  const requests = [];
  
  for (let i = 1; i < values.length; i++) {
    if (values[i][9] === 'PENDING') {
      requests.push({
        rowNumber: i + 1,
        applyTime: values[i][0],
        userId: values[i][1],
        employeeName: values[i][2],
        dept: values[i][3],
        leaveType: values[i][4],
        startDate: values[i][5],
        endDate: values[i][6],
        days: values[i][7],
        reason: values[i][8]
      });
    }
  }
  
  return { ok: true, requests };
}

/**
 * 審核請假申請（含 LINE 通知）
 * @param {string} sessionToken - Session Token
 * @param {number} rowNumber - 記錄行號
 * @param {string} reviewAction - 審核動作（approve/reject）
 * @param {string} comment - 審核意見
 */
function reviewLeaveRequest(sessionToken, rowNumber, reviewAction, comment) {
  const session = checkSession_(sessionToken);
  if (!session.ok) return { ok: false, code: session.code };
  
  // 檢查是否為管理員
  if (session.user.dept !== '管理員') {
    return { ok: false, code: 'ERR_NO_PERMISSION' };
  }
  
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LEAVE_RECORDS);
  const balanceSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LEAVE_BALANCE);
  
  if (!sheet) {
    return { ok: false, code: 'ERR_LEAVE_RECORDS_NOT_FOUND' };
  }
  
  // 👉 取得請假記錄（包含所有欄位用於通知）
  const record = sheet.getRange(rowNumber, 1, 1, 13).getValues()[0];
  const userId = record[1];              // 員工ID
  const employeeName = record[2];        // 員工姓名
  const leaveType = record[4];           // 假別
  const startDate = record[5];           // 開始日期
  const endDate = record[6];             // 結束日期
  const days = record[7];                // 天數
  const currentYear = new Date().getFullYear();
  
  // 👉 格式化日期用於通知
  const formattedStartDate = formatDate(startDate);
  const formattedEndDate = formatDate(endDate);
  
  // 👉 翻譯假別名稱
  const leaveTypeName = getLeaveTypeName(leaveType);
  
  // 更新審核狀態
  const status = reviewAction === 'approve' ? 'APPROVED' : 'REJECTED';
  sheet.getRange(rowNumber, 10).setValue(status);           // 狀態
  sheet.getRange(rowNumber, 11).setValue(session.user.name); // 審核人
  sheet.getRange(rowNumber, 12).setValue(new Date());       // 審核時間
  sheet.getRange(rowNumber, 13).setValue(comment || "");    // 審核意見
  
  // 👉 發送 LINE 通知
  try {
    const isApproved = (reviewAction === 'approve');
    notifyLeaveReview(
      userId,
      employeeName,
      leaveTypeName,
      formattedStartDate,
      formattedEndDate,
      days,
      session.user.name,
      isApproved,
      comment || ""
    );
    Logger.log(`📤 已發送請假審核通知給 ${employeeName} (${userId})`);
  } catch (err) {
    Logger.log(`⚠️ LINE 通知發送失敗: ${err.message}`);
    // 通知失敗不影響審核流程
  }
  
  // 如果核准，扣除假期餘額
  if (reviewAction === 'approve' && balanceSheet) {
    const balanceValues = balanceSheet.getDataRange().getValues();
    
    // 假別對應的欄位索引
    const leaveTypeColumns = {
      'ANNUAL_LEAVE': 5,
      'SICK_LEAVE': 6,
      'PERSONAL_LEAVE': 7,
      'MARRIAGE_LEAVE': 8,
      'BEREAVEMENT_LEAVE': 9,
      'MATERNITY_LEAVE': 10,
      'PATERNITY_LEAVE': 11,
      'FAMILY_CARE_LEAVE': 12,
      'MENSTRUAL_LEAVE': 13
    };
    
    const columnIndex = leaveTypeColumns[leaveType];
    
    if (columnIndex) {
      for (let i = 1; i < balanceValues.length; i++) {
        if (balanceValues[i][0] === userId && balanceValues[i][3] === currentYear) {
          const currentBalance = balanceValues[i][columnIndex - 1];
          const newBalance = currentBalance - days;
          balanceSheet.getRange(i + 1, columnIndex).setValue(newBalance);
          balanceSheet.getRange(i + 1, 14).setValue(new Date()); // 更新時間
          Logger.log(`✅ 扣除 ${userId} 的 ${leaveType}：${days} 天，剩餘 ${newBalance} 天`);
          break;
        }
      }
    }
  }
  
  return { 
    ok: true, 
    code: reviewAction === 'approve' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED'
  };
}


/**
 * 翻譯假別代碼為中文名稱
 */
function getLeaveTypeName(leaveType) {
  const leaveTypeMap = {
    'ANNUAL_LEAVE': '特休假',
    'SICK_LEAVE': '病假',
    'PERSONAL_LEAVE': '事假',
    'MARRIAGE_LEAVE': '婚假',
    'BEREAVEMENT_LEAVE': '喪假',
    'MATERNITY_LEAVE': '產假',
    'PATERNITY_LEAVE': '陪產假',
    'FAMILY_CARE_LEAVE': '家庭照顧假',
    'MENSTRUAL_LEAVE': '生理假'
  };
  
  return leaveTypeMap[leaveType] || leaveType;
}

// ==================== Handler 函式 ====================

function handleGetLeaveBalance(params) {
  return getLeaveBalance(params.token);
}

function handleSubmitLeave(params) {
  const { token, leaveType, startDate, endDate, days, reason } = params;
  return submitLeaveRequest(
    token,
    leaveType,
    startDate,
    endDate,
    parseFloat(days),
    reason
  );
}

function handleGetEmployeeLeaveRecords(params) {
  return getEmployeeLeaveRecords(params.token);
}

function handleGetPendingLeaveRequests(params) {
  return getPendingLeaveRequests(params.token);
}

function handleReviewLeave(params) {
  const { token, rowNumber, reviewAction, comment } = params;
  
  Logger.log(`📥 handleReviewLeave 收到參數:`);
  Logger.log(`   - rowNumber: ${rowNumber}`);
  Logger.log(`   - reviewAction: "${reviewAction}"`);
  Logger.log(`   - comment: "${comment}"`);
  
  return reviewLeaveRequest(
    token,
    parseInt(rowNumber),
    reviewAction,
    comment || ''
  );
}

/**
 * 管理員手動初始化員工假期額度
 * @param {string} sessionToken - Session Token
 * @param {string} targetUserId - 目標員工ID
 * @param {string} hireDate - 到職日期（YYYY-MM-DD）
 */
function handleInitializeEmployeeLeave(params) {
  const { token, targetUserId, hireDate } = params;
  
  const session = checkSession_(token);
  if (!session.ok) return { ok: false, code: session.code };
  
  // 檢查是否為管理員
  if (session.user.dept !== '管理員') {
    return { ok: false, code: 'ERR_NO_PERMISSION' };
  }
  
  try {
    initializeLeaveBalance_(targetUserId, new Date(hireDate));
    return { ok: true, code: 'LEAVE_BALANCE_INITIALIZED' };
  } catch (err) {
    return { ok: false, code: 'ERR_INITIALIZE_FAILED', msg: err.message };
  }
}