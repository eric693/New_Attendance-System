// AdminTools.gs - 管理員工具腳本（完整版）

/**
 * 批次初始化所有員工的假期額度
 * 這個函數可以在 Google Apps Script 編輯器中直接執行
 */
function batchInitializeAllEmployeesLeave() {
  const employeeSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_EMPLOYEES);
  
  if (!employeeSheet) {
    Logger.log("❌ 找不到員工資料表");
    return;
  }
  
  const values = employeeSheet.getDataRange().getValues();
  let successCount = 0;
  let errorCount = 0;
  
  Logger.log('🚀 開始批次初始化所有員工假期...\n');
  Logger.log('=' .repeat(60));
  
  // 從第二行開始（跳過標題）
  for (let i = 1; i < values.length; i++) {
    const userId = values[i][EMPLOYEE_COL.USER_ID];
    const status = values[i][EMPLOYEE_COL.STATUS];
    const name = values[i][EMPLOYEE_COL.NAME] || userId;
    
    // 只處理啟用的員工
    if (status !== '啟用') {
      Logger.log(`⏭️  [${i}] 跳過未啟用員工: ${name} (${userId})`);
      continue;
    }
    
    try {
      // ⭐ 從第 7 欄（索引 6）讀取到職日期
      let hireDate = values[i][EMPLOYEE_COL.HIRE_DATE];
      
      // 如果沒有到職日期，使用建立時間
      if (!hireDate) {
        hireDate = values[i][EMPLOYEE_COL.CREATED] || new Date();
        Logger.log(`⚠️  [${i}] 員工 ${name} 沒有到職日期，使用建立時間: ${hireDate}`);
      }
      
      // 初始化假期額度
      initializeLeaveBalance_(userId, new Date(hireDate));
      
      // 計算特休假天數
      const annualLeave = calculateAnnualLeave_(new Date(hireDate));
      
      successCount++;
      Logger.log(`✅ [${i}] ${name} - 特休假: ${annualLeave} 天`);
      
    } catch (err) {
      errorCount++;
      Logger.log(`❌ [${i}] 初始化員工 ${name} 失敗: ${err.message}`);
    }
  }
  
  Logger.log('\n' + '='.repeat(60));
  Logger.log(`
📊 批次初始化完成！
✅ 成功: ${successCount} 位員工
❌ 失敗: ${errorCount} 位員工
  `);
}

/**
 * 手動為單一員工初始化假期額度
 * @param {string} userId - LINE User ID
 * @param {Date} hireDate - 到職日期
 */
function manualInitializeEmployeeLeave(userId, hireDate) {
  try {
    initializeLeaveBalance_(userId, new Date(hireDate));
    Logger.log(`✅ 成功初始化員工 ${userId} 的假期額度`);
    Logger.log(`   到職日期: ${hireDate}`);
    
    // 顯示計算出的特休假
    const annualLeave = calculateAnnualLeave_(new Date(hireDate));
    Logger.log(`   特休假: ${annualLeave} 天`);
    
  } catch (err) {
    Logger.log(`❌ 初始化失敗: ${err.message}`);
  }
}

/**
 * 查看特休假計算規則測試
 * 這個函數可以用來測試不同到職日期對應的特休假天數
 */
function testAnnualLeaveCalculation() {
  const testCases = [
    { hireDate: '2024-10-01', description: '剛到職（未滿6個月）' },
    { hireDate: '2024-04-01', description: '6個月（應得3天）' },
    { hireDate: '2023-10-01', description: '1年（應得7天）' },
    { hireDate: '2022-10-01', description: '2年（應得10天）' },
    { hireDate: '2021-10-01', description: '3年（應得14天）' },
    { hireDate: '2019-10-01', description: '5年（應得15天）' },
    { hireDate: '2014-10-01', description: '10年（應得15天）' },
    { hireDate: '2009-10-01', description: '15年（應得20天）' },
    { hireDate: '1994-10-01', description: '30年（應得30天，最高上限）' }
  ];
  
  Logger.log('📋 特休假計算規則測試：\n');
  Logger.log('=' .repeat(60));
  
  testCases.forEach(testCase => {
    const days = calculateAnnualLeave_(new Date(testCase.hireDate));
    Logger.log(`${testCase.description}`);
    Logger.log(`  到職日期: ${testCase.hireDate}`);
    Logger.log(`  特休假: ${days} 天\n`);
  });
}

/**
 * 查看員工假期使用情況報表
 */
function generateLeaveUsageReport() {
  const balanceSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LEAVE_BALANCE);
  const leaveSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LEAVE_RECORDS);
  
  if (!balanceSheet) {
    Logger.log("❌ 找不到假期額度表");
    return;
  }
  
  const balanceValues = balanceSheet.getDataRange().getValues();
  const currentYear = new Date().getFullYear();
  
  Logger.log(`📊 ${currentYear} 年度假期使用報表\n`);
  Logger.log('=' .repeat(60));
  
  for (let i = 1; i < balanceValues.length; i++) {
    if (balanceValues[i][3] !== currentYear) continue;
    
    const userId = balanceValues[i][0];
    const name = balanceValues[i][1];
    const annualLeave = balanceValues[i][4];
    const sickLeave = balanceValues[i][5];
    const personalLeave = balanceValues[i][6];
    
    Logger.log(`\n👤 員工: ${name} (${userId})`);
    Logger.log(`  特休假剩餘: ${annualLeave} 天`);
    Logger.log(`  病假剩餘: ${sickLeave} 天`);
    Logger.log(`  事假剩餘: ${personalLeave} 天`);
  }
  
  Logger.log('\n' + '='.repeat(60));
}

/**
 * 重置年度假期（新年度時使用）
 * ⚠️ 注意：這會重新計算所有員工的假期額度
 */
function resetAnnualLeave() {
  const userResponse = Browser.msgBox(
    '確認重置年度假期',
    '這將重新計算所有員工的假期額度，是否繼續？',
    Browser.Buttons.YES_NO
  );
  
  if (userResponse !== 'yes') {
    Logger.log('❌ 操作已取消');
    return;
  }
  
  const employeeSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_EMPLOYEES);
  
  if (!employeeSheet) {
    Logger.log("❌ 找不到員工資料表");
    return;
  }
  
  const values = employeeSheet.getDataRange().getValues();
  let successCount = 0;
  
  for (let i = 1; i < values.length; i++) {
    const userId = values[i][EMPLOYEE_COL.USER_ID];
    const status = values[i][EMPLOYEE_COL.STATUS];
    
    if (status !== '啟用') continue;
    
    try {
      const hireDate = values[i][EMPLOYEE_COL.HIRE_DATE] || values[i][EMPLOYEE_COL.CREATED] || new Date();
      initializeLeaveBalance_(userId, new Date(hireDate));
      successCount++;
    } catch (err) {
      Logger.log(`❌ 重置員工 ${userId} 失敗: ${err.message}`);
    }
  }
  
  Logger.log(`✅ 成功重置 ${successCount} 位員工的年度假期`);
}

/**
 * 在 Google Sheets 中新增自訂選單
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🛠️ 請假系統管理')
    .addItem('📊 特休假計算測試', 'testAnnualLeaveCalculation')
    .addItem('🔄 批次初始化所有員工假期', 'batchInitializeAllEmployeesLeave')
    .addItem('📈 查看假期使用報表', 'generateLeaveUsageReport')
    .addSeparator()
    .addItem('🔁 重置年度假期（新年度）', 'resetAnnualLeave')
    .addToUi();
}