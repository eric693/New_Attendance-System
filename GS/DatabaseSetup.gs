// DatabaseSetup.gs - 資料庫結構初始化腳本（完整版）

/**
 * 建立請假系統所需的資料表結構
 * 執行這個函數會自動建立所需的工作表和欄位
 */
function setupLeaveSystemDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  Logger.log('🚀 開始建立請假系統資料庫...\n');
  
  // 1. 建立「員工假期額度」工作表
  createLeaveBalanceSheet_(ss);
  
  // 2. 建立「請假紀錄」工作表
  createLeaveRecordsSheet_(ss);
  
  // 3. 檢查並更新「員工資料」工作表
  updateEmployeeSheet_(ss);
  
  Logger.log('\n✅ 請假系統資料庫建立完成！');
  Logger.log('📌 下一步：');
  Logger.log('   1. 在員工資料表的 G 欄填寫所有員工的到職日期');
  Logger.log('   2. 執行選單 > 🛠️ 請假系統管理 > 批次初始化所有員工假期');
}

/**
 * 建立「員工假期額度」工作表
 */
function createLeaveBalanceSheet_(ss) {
  let sheet = ss.getSheetByName(SHEET_LEAVE_BALANCE);
  
  if (sheet) {
    Logger.log('⚠️  「員工假期額度」工作表已存在，跳過建立');
    return;
  }
  
  Logger.log('📊 建立「員工假期額度」工作表...');
  
  sheet = ss.insertSheet(SHEET_LEAVE_BALANCE);
  
  // 設定標題行
  const headers = [
    '員工ID',
    '姓名',
    '到職日期',
    '年度',
    '特休假',
    '病假',
    '事假',
    '婚假',
    '喪假',
    '產假',
    '陪產假',
    '家庭照顧假',
    '生理假',
    '更新時間'
  ];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // 格式化標題行
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#4285f4');
  headerRange.setFontColor('#ffffff');
  headerRange.setHorizontalAlignment('center');
  
  // 設定欄寬
  sheet.setColumnWidth(1, 200); // 員工ID
  sheet.setColumnWidth(2, 100); // 姓名
  sheet.setColumnWidth(3, 100); // 到職日期
  sheet.setColumnWidth(4, 60);  // 年度
  
  // 假期欄位
  for (let i = 5; i <= 13; i++) {
    sheet.setColumnWidth(i, 80);
  }
  
  sheet.setColumnWidth(14, 150); // 更新時間
  
  // 凍結標題行
  sheet.setFrozenRows(1);
  
  Logger.log('✅ 「員工假期額度」工作表建立完成');
}

/**
 * 建立「請假紀錄」工作表
 */
function createLeaveRecordsSheet_(ss) {
  let sheet = ss.getSheetByName(SHEET_LEAVE_RECORDS);
  
  if (sheet) {
    Logger.log('⚠️  「請假紀錄」工作表已存在，跳過建立');
    return;
  }
  
  Logger.log('📝 建立「請假紀錄」工作表...');
  
  sheet = ss.insertSheet(SHEET_LEAVE_RECORDS);
  
  // 設定標題行
  const headers = [
    '申請時間',
    '員工ID',
    '姓名',
    '部門',
    '假別',
    '開始日期',
    '結束日期',
    '天數',
    '原因',
    '狀態',
    '審核人',
    '審核時間',
    '審核意見'
  ];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // 格式化標題行
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#34a853');
  headerRange.setFontColor('#ffffff');
  headerRange.setHorizontalAlignment('center');
  
  // 設定欄寬
  sheet.setColumnWidth(1, 150);  // 申請時間
  sheet.setColumnWidth(2, 200);  // 員工ID
  sheet.setColumnWidth(3, 100);  // 姓名
  sheet.setColumnWidth(4, 80);   // 部門
  sheet.setColumnWidth(5, 100);  // 假別
  sheet.setColumnWidth(6, 100);  // 開始日期
  sheet.setColumnWidth(7, 100);  // 結束日期
  sheet.setColumnWidth(8, 60);   // 天數
  sheet.setColumnWidth(9, 200);  // 原因
  sheet.setColumnWidth(10, 80);  // 狀態
  sheet.setColumnWidth(11, 100); // 審核人
  sheet.setColumnWidth(12, 150); // 審核時間
  sheet.setColumnWidth(13, 200); // 審核意見
  
  // 凍結標題行
  sheet.setFrozenRows(1);
  
  // 設定資料驗證（狀態欄位）
  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['PENDING', 'APPROVED', 'REJECTED'], true)
    .setAllowInvalid(false)
    .build();
  
  sheet.getRange('J2:J1000').setDataValidation(statusRule);
  
  Logger.log('✅ 「請假紀錄」工作表建立完成');
}

/**
 * 檢查並更新「員工資料」工作表
 */
function updateEmployeeSheet_(ss) {
  const sheet = ss.getSheetByName(SHEET_EMPLOYEES);
  
  if (!sheet) {
    Logger.log('❌ 找不到「員工資料」工作表');
    Logger.log('   請先建立員工資料表，或檢查工作表名稱是否正確');
    return;
  }
  
  Logger.log('👥 檢查「員工資料」工作表...');
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // 檢查是否有「到職日期」欄位
  const hireDateIndex = headers.indexOf('到職日期');
  
  if (hireDateIndex === -1) {
    Logger.log('⚠️  未找到「到職日期」欄位');
    Logger.log('   建議在員工資料表中新增「到職日期」欄位（建議位置：G 欄，第 7 欄）');
    Logger.log('   或者系統會使用「建立時間」作為替代');
  } else {
    Logger.log(`✅ 找到「到職日期」欄位（第 ${hireDateIndex + 1} 欄，${String.fromCharCode(65 + hireDateIndex)} 欄）`);
  }
  
  // 檢查員工數量
  const employeeCount = sheet.getLastRow() - 1; // 扣除標題行
  Logger.log(`📊 目前共有 ${employeeCount} 位員工`);
  
  // 檢查有多少員工已填寫到職日期
  if (hireDateIndex !== -1) {
    const values = sheet.getRange(2, hireDateIndex + 1, employeeCount, 1).getValues();
    let filledCount = 0;
    
    for (let i = 0; i < values.length; i++) {
      if (values[i][0]) filledCount++;
    }
    
    Logger.log(`📋 已填寫到職日期: ${filledCount} 位`);
    Logger.log(`📋 未填寫到職日期: ${employeeCount - filledCount} 位`);
    
    if (filledCount < employeeCount) {
      Logger.log('\n⚠️  建議：請為所有員工填寫到職日期，才能正確計算特休假天數');
    }
  }
}

/**
 * 驗證資料庫結構
 * 檢查所有必要的工作表和欄位是否存在
 */
function validateLeaveSystemDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let isValid = true;
  
  Logger.log('🔍 開始驗證請假系統資料庫結構...\n');
  Logger.log('=' .repeat(60));
  
  // 檢查「員工假期額度」工作表
  const balanceSheet = ss.getSheetByName(SHEET_LEAVE_BALANCE);
  if (!balanceSheet) {
    Logger.log('❌ 找不到「員工假期額度」工作表');
    isValid = false;
  } else {
    Logger.log('✅ 「員工假期額度」工作表存在');
    
    // 檢查欄位
    const headers = balanceSheet.getRange(1, 1, 1, balanceSheet.getLastColumn()).getValues()[0];
    const requiredHeaders = [
      '員工ID', '姓名', '到職日期', '年度',
      '特休假', '病假', '事假', '婚假', '喪假',
      '產假', '陪產假', '家庭照顧假', '生理假', '更新時間'
    ];
    
    let allFieldsPresent = true;
    requiredHeaders.forEach(header => {
      if (headers.indexOf(header) === -1) {
        Logger.log(`   ❌ 缺少欄位：${header}`);
        allFieldsPresent = false;
        isValid = false;
      }
    });
    
    if (allFieldsPresent) {
      Logger.log('   ✅ 所有欄位完整');
      
      // 檢查是否有資料
      const rowCount = balanceSheet.getLastRow() - 1;
      Logger.log(`   📊 已初始化 ${rowCount} 位員工的假期額度`);
    }
  }
  
  Logger.log('');
  
  // 檢查「請假紀錄」工作表
  const recordsSheet = ss.getSheetByName(SHEET_LEAVE_RECORDS);
  if (!recordsSheet) {
    Logger.log('❌ 找不到「請假紀錄」工作表');
    isValid = false;
  } else {
    Logger.log('✅ 「請假紀錄」工作表存在');
    
    const headers = recordsSheet.getRange(1, 1, 1, recordsSheet.getLastColumn()).getValues()[0];
    const requiredHeaders = [
      '申請時間', '員工ID', '姓名', '部門', '假別',
      '開始日期', '結束日期', '天數', '原因',
      '狀態', '審核人', '審核時間', '審核意見'
    ];
    
    let allFieldsPresent = true;
    requiredHeaders.forEach(header => {
      if (headers.indexOf(header) === -1) {
        Logger.log(`   ❌ 缺少欄位：${header}`);
        allFieldsPresent = false;
        isValid = false;
      }
    });
    
    if (allFieldsPresent) {
      Logger.log('   ✅ 所有欄位完整');
      
      // 檢查是否有資料
      const rowCount = recordsSheet.getLastRow() - 1;
      Logger.log(`   📊 目前有 ${rowCount} 筆請假記錄`);
    }
  }
  
  Logger.log('');
  
  // 檢查「員工資料」工作表
  const employeeSheet = ss.getSheetByName(SHEET_EMPLOYEES);
  if (!employeeSheet) {
    Logger.log('❌ 找不到「員工資料」工作表');
    isValid = false;
  } else {
    Logger.log('✅ 「員工資料」工作表存在');
    
    const headers = employeeSheet.getRange(1, 1, 1, employeeSheet.getLastColumn()).getValues()[0];
    const hireDateIndex = headers.indexOf('到職日期');
    
    if (hireDateIndex === -1) {
      Logger.log('   ⚠️  未找到「到職日期」欄位（建議在 G 欄新增）');
      Logger.log('   系統將使用「建立時間」作為替代');
    } else {
      Logger.log(`   ✅ 找到「到職日期」欄位（${String.fromCharCode(65 + hireDateIndex)} 欄）`);
    }
  }
  
  Logger.log('\n' + '='.repeat(60));
  
  if (isValid) {
    Logger.log('✅ 資料庫結構驗證通過！');
    Logger.log('\n📌 系統已準備就緒，下一步：');
    Logger.log('   1. 確認所有員工都有填寫到職日期（G 欄）');
    Logger.log('   2. 執行：選單 > 🛠️ 請假系統管理 > 批次初始化所有員工假期');
  } else {
    Logger.log('❌ 資料庫結構驗證失敗');
    Logger.log('\n📌 請執行以下函數建立資料表：');
    Logger.log('   setupLeaveSystemDatabase()');
  }
  
  return isValid;
}

/**
 * 清理測試資料
 * ⚠️ 警告：這會刪除所有請假相關的資料！
 */
function cleanupLeaveSystemData() {
  const userResponse = Browser.msgBox(
    '⚠️ 警告',
    '這將刪除所有請假紀錄和假期額度資料！\n\n' +
    '建議先備份資料再執行此操作。\n\n' +
    '是否確定要繼續？',
    Browser.Buttons.YES_NO
  );
  
  if (userResponse !== 'yes') {
    Logger.log('❌ 操作已取消');
    return;
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 清空「員工假期額度」
  const balanceSheet = ss.getSheetByName(SHEET_LEAVE_BALANCE);
  if (balanceSheet) {
    const lastRow = balanceSheet.getLastRow();
    if (lastRow > 1) {
      balanceSheet.deleteRows(2, lastRow - 1);
      Logger.log('✅ 已清空「員工假期額度」資料');
    }
  }
  
  // 清空「請假紀錄」
  const recordsSheet = ss.getSheetByName(SHEET_LEAVE_RECORDS);
  if (recordsSheet) {
    const lastRow = recordsSheet.getLastRow();
    if (lastRow > 1) {
      recordsSheet.deleteRows(2, lastRow - 1);
      Logger.log('✅ 已清空「請假紀錄」資料');
    }
  }
  
  Logger.log('\n📌 資料清理完成！請重新執行「批次初始化所有員工假期」');
}

/**
 * 匯出假期資料為 CSV
 */
function exportLeaveDataToCSV() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const balanceSheet = ss.getSheetByName(SHEET_LEAVE_BALANCE);
  
  if (!balanceSheet) {
    Logger.log('❌ 找不到「員工假期額度」工作表');
    return;
  }
  
  const data = balanceSheet.getDataRange().getValues();
  const csv = data.map(row => row.join(',')).join('\n');
  
  const fileName = `假期額度_${new Date().toISOString().split('T')[0]}.csv`;
  const blob = Utilities.newBlob(csv, 'text/csv', fileName);
  
  // 儲存到 Google Drive
  const file = DriveApp.createFile(blob);
  
  Logger.log('✅ CSV 檔案已建立');
  Logger.log('📁 檔案名稱：' + fileName);
  Logger.log('🔗 連結：' + file.getUrl());
  
  return file.getUrl();
}

/**
 * 批次更新所有員工的到職日期（從建立時間）
 * 如果員工沒有到職日期，自動填入建立時間
 */
function batchFillHireDateFromCreated() {
  const employeeSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_EMPLOYEES);
  
  if (!employeeSheet) {
    Logger.log('❌ 找不到員工資料表');
    return;
  }
  
  const values = employeeSheet.getDataRange().getValues();
  let updateCount = 0;
  
  Logger.log('🔄 開始批次填寫到職日期...\n');
  
  for (let i = 1; i < values.length; i++) {
    const hireDate = values[i][EMPLOYEE_COL.HIRE_DATE];
    const createdDate = values[i][EMPLOYEE_COL.CREATED];
    const name = values[i][EMPLOYEE_COL.NAME];
    
    // 如果沒有到職日期，但有建立時間
    if (!hireDate && createdDate) {
      employeeSheet.getRange(i + 1, EMPLOYEE_COL.HIRE_DATE + 1).setValue(createdDate);
      updateCount++;
      Logger.log(`✅ [${i}] ${name} - 填入到職日期: ${createdDate}`);
    }
  }
  
  Logger.log(`\n📊 完成！共更新 ${updateCount} 位員工的到職日期`);
}

/**
 * 顯示所有員工的特休假計算結果（不寫入資料庫）
 * 用於檢查計算是否正確
 */
function previewAnnualLeaveCalculation() {
  const employeeSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_EMPLOYEES);
  
  if (!employeeSheet) {
    Logger.log('❌ 找不到員工資料表');
    return;
  }
  
  const values = employeeSheet.getDataRange().getValues();
  
  Logger.log('📋 員工特休假預覽\n');
  Logger.log('=' .repeat(80));
  Logger.log(sprintf('%-30s %-15s %-8s %s', '姓名', '到職日期', '年資', '特休假'));
  Logger.log('-'.repeat(80));
  
  for (let i = 1; i < values.length; i++) {
    const name = values[i][EMPLOYEE_COL.NAME];
    const status = values[i][EMPLOYEE_COL.STATUS];
    let hireDate = values[i][EMPLOYEE_COL.HIRE_DATE];
    
    if (status !== '啟用') continue;
    
    // 如果沒有到職日期，使用建立時間
    if (!hireDate) {
      hireDate = values[i][EMPLOYEE_COL.CREATED] || new Date();
    }
    
    const hireDateObj = new Date(hireDate);
    const annualLeave = calculateAnnualLeave_(hireDateObj);
    
    // 計算年資
    const now = new Date();
    const months = (now.getFullYear() - hireDateObj.getFullYear()) * 12 
                 + (now.getMonth() - hireDateObj.getMonth());
    const years = Math.floor(months / 12);
    const remainMonths = months % 12;
    
    const yearStr = years > 0 ? `${years}年${remainMonths}月` : `${remainMonths}月`;
    const dateStr = Utilities.formatDate(hireDateObj, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    
    Logger.log(sprintf('%-30s %-15s %-8s %d天', name, dateStr, yearStr, annualLeave));
  }
  
  Logger.log('=' .repeat(80));
}

/**
 * 簡易的字串格式化函數（類似 C 的 sprintf）
 */
function sprintf(format) {
  let args = Array.prototype.slice.call(arguments, 1);
  let i = 0;
  return format.replace(/%(-?\d+)?s/g, function(match, width) {
    let str = String(args[i++] || '');
    if (width) {
      let w = parseInt(width);
      if (w < 0) {
        // 左對齊
        str = str + ' '.repeat(Math.max(0, -w - str.length));
      } else {
        // 右對齊
        str = ' '.repeat(Math.max(0, w - str.length)) + str;
      }
    }
    return str;
  });
}