// SalaryManagement.gs - 薪資管理系統核心功能（完整修正版 - Bug Fix）

// ==================== 常數定義 ====================

const SHEET_SALARY_CONFIG = "員工薪資設定";
const SHEET_MONTHLY_SALARY = "月薪資記錄";

// 台灣法定最低薪資（2024）
const MIN_MONTHLY_SALARY = 27470;  // 月薪
const MIN_HOURLY_SALARY = 183;     // 時薪

// 加班費率
const OVERTIME_RATES = {
  weekday: 1.34,      // 平日加班（前2小時）
  weekdayExtra: 1.67, // 平日加班（第3小時起）
  restday: 1.34,      // 休息日前2小時
  restdayExtra: 1.67, // 休息日第3小時起
  holiday: 2.0        // 國定假日
};

// 台灣銀行代碼列表
const TAIWAN_BANKS = {
  "004": "臺灣銀行",
  "005": "臺灣土地銀行",
  "006": "合作金庫商業銀行",
  "007": "第一商業銀行",
  "008": "華南商業銀行",
  "009": "彰化商業銀行",
  "012": "台北富邦銀行",
  "013": "國泰世華商業銀行",
  "017": "兆豐國際商業銀行",
  "803": "聯邦商業銀行",
  "806": "元大商業銀行",
  "807": "永豐商業銀行",
  "808": "玉山商業銀行",
  "809": "凱基商業銀行",
  "812": "台新國際商業銀行",
  "822": "中國信託商業銀行"
};

// ==================== 試算表管理 ====================

/**
 * 取得或建立員工薪資設定試算表
 */
function getEmployeeSalarySheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_SALARY_CONFIG);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_SALARY_CONFIG);
    
    const headers = [
      "員工ID", "員工姓名", "身分證字號", "員工類型", "薪資類型", 
      "基本薪資", "銀行代碼", "銀行帳號", "到職日期", "發薪日",
      "勞退自提率(%)", "勞保費", "健保費", "就業保險費",
      "勞退自提", "所得稅", "狀態", "備註", "最後更新時間"
    ];
    
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
    
    Logger.log("✅ 建立員工薪資設定試算表");
  }
  
  return sheet;
}

/**
 * 取得或建立月薪資記錄試算表
 */
function getMonthlySalarySheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_MONTHLY_SALARY);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_MONTHLY_SALARY);
    
    const headers = [
      "薪資單ID", "員工ID", "員工姓名", "年月", 
      "基本薪資", "平日加班費", "休息日加班費", "國定假日加班費",
      "勞保費", "健保費", "就業保險費", "勞退自提", "所得稅",
      "請假扣款", "應發總額", "實發金額",
      "銀行代碼", "銀行帳號", "狀態", "備註", "建立時間"
    ];
    
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
    
    Logger.log("✅ 建立月薪資記錄試算表");
  }
  
  return sheet;
}

// ==================== 薪資設定功能 ====================

/**
 * ✅ 設定員工薪資資料（台灣版）
 */
function setEmployeeSalaryTW(salaryData) {
  try {
    Logger.log('💰 開始設定員工薪資');
    
    const sheet = getEmployeeSalarySheet();
    const data = sheet.getDataRange().getValues();
    
    if (!salaryData.employeeId || !salaryData.employeeName || !salaryData.baseSalary || salaryData.baseSalary <= 0) {
      return { success: false, message: "缺少必填欄位或基本薪資無效" };
    }
    
    if (salaryData.salaryType === '月薪' && salaryData.baseSalary < MIN_MONTHLY_SALARY) {
      return { success: false, message: `月薪不得低於 ${MIN_MONTHLY_SALARY} 元` };
    }
    
    if (salaryData.salaryType === '時薪' && salaryData.baseSalary < MIN_HOURLY_SALARY) {
      return { success: false, message: `時薪不得低於 ${MIN_HOURLY_SALARY} 元` };
    }
    
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(salaryData.employeeId).trim()) {
        rowIndex = i + 1;
        break;
      }
    }
    
    const now = new Date();
    
    const row = [
      String(salaryData.employeeId).trim(),
      String(salaryData.employeeName).trim(),
      String(salaryData.idNumber || "").trim(),
      String(salaryData.employeeType || "正職").trim(),
      String(salaryData.salaryType || "月薪").trim(),
      parseFloat(salaryData.baseSalary) || 0,
      String(salaryData.bankCode || "").trim(),
      String(salaryData.bankAccount || "").trim(),
      salaryData.hireDate || now,
      String(salaryData.paymentDay || "5").trim(),
      parseFloat(salaryData.pensionSelfRate) || 0,
      parseFloat(salaryData.laborFee) || 0,
      parseFloat(salaryData.healthFee) || 0,
      parseFloat(salaryData.employmentFee) || 0,
      parseFloat(salaryData.pensionSelf) || 0,
      parseFloat(salaryData.incomeTax) || 0,
      "在職",
      String(salaryData.note || "").trim(),
      now
    ];
    
    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
      Logger.log(`✅ 更新員工薪資設定: ${salaryData.employeeName}`);
    } else {
      sheet.appendRow(row);
      Logger.log(`✅ 新增員工薪資設定: ${salaryData.employeeName}`);
    }
    
    const currentYearMonth = Utilities.formatDate(now, "Asia/Taipei", "yyyy-MM");
    syncSalaryToMonthlyRecord(salaryData.employeeId, currentYearMonth);
    
    return { success: true, message: "薪資設定成功" };
    
  } catch (error) {
    Logger.log("❌ 設定薪資失敗: " + error);
    return { success: false, message: error.toString() };
  }
}

/**
 * ✅ 取得員工薪資設定
 */
function getEmployeeSalaryTW(employeeId) {
  try {
    const sheet = getEmployeeSalarySheet();
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(employeeId).trim()) {
        return {
          success: true,
          data: {
            employeeId: data[i][0],
            employeeName: data[i][1],
            idNumber: data[i][2],
            employeeType: data[i][3],
            salaryType: data[i][4],
            baseSalary: data[i][5],
            bankCode: data[i][6],
            bankAccount: data[i][7],
            hireDate: data[i][8],
            paymentDay: data[i][9],
            pensionSelfRate: data[i][10],
            laborFee: data[i][11],
            healthFee: data[i][12],
            employmentFee: data[i][13],
            pensionSelf: data[i][14],
            incomeTax: data[i][15],
            status: data[i][16],
            note: data[i][17],
            lastUpdate: data[i][18]
          }
        };
      }
    }
    
    return { success: false, message: "找不到該員工薪資資料" };
    
  } catch (error) {
    Logger.log("❌ 取得薪資設定失敗: " + error);
    return { success: false, message: error.toString() };
  }
}

/**
 * ✅ 同步薪資到月薪資記錄
 */
function syncSalaryToMonthlyRecord(employeeId, yearMonth) {
  try {
    const salaryConfig = getEmployeeSalaryTW(employeeId);
    
    if (!salaryConfig.success) {
      return { success: false, message: "找不到員工薪資設定" };
    }
    
    const config = salaryConfig.data;
    const calculatedSalary = calculateMonthlySalary(employeeId, yearMonth);
    
    if (!calculatedSalary.success) {
      const totalDeductions = 
        config.laborFee + config.healthFee + config.employmentFee + 
        config.pensionSelf + config.incomeTax;
      
      const basicSalary = {
        employeeId: employeeId,
        employeeName: config.employeeName,
        yearMonth: yearMonth,
        baseSalary: config.baseSalary,
        weekdayOvertimePay: 0,
        restdayOvertimePay: 0,
        holidayOvertimePay: 0,
        laborFee: config.laborFee,
        healthFee: config.healthFee,
        employmentFee: config.employmentFee,
        pensionSelf: config.pensionSelf,
        incomeTax: config.incomeTax,
        leaveDeduction: 0,
        grossSalary: config.baseSalary,
        netSalary: config.baseSalary - totalDeductions,
        bankCode: config.bankCode,
        bankAccount: config.bankAccount,
        status: "已設定",
        note: "自動建立"
      };
      
      return saveMonthlySalary(basicSalary);
    }
    
    return saveMonthlySalary(calculatedSalary.data);
    
  } catch (error) {
    Logger.log(`❌ 同步失敗: ${error}`);
    return { success: false, message: error.toString() };
  }
}

// ==================== 薪資計算功能 ====================

/**
 * ✅ 計算月薪資
 */
function calculateMonthlySalary(employeeId, yearMonth) {
  try {
    const salaryConfig = getEmployeeSalaryTW(employeeId);
    if (!salaryConfig.success) {
      return { success: false, message: "找不到員工薪資設定" };
    }
    
    const config = salaryConfig.data;
    const overtimeRecords = getEmployeeOvertimeRecords(employeeId, yearMonth);
    const leaveRecords = getEmployeeLeaveRecords(employeeId, yearMonth);
    
    let baseSalary = config.baseSalary;
    let weekdayOvertimePay = 0;
    let restdayOvertimePay = 0;
    let holidayOvertimePay = 0;
    
    if (overtimeRecords.success && overtimeRecords.data) {
      overtimeRecords.data.forEach(record => {
        if (record.reviewStatus === '核准') {
          const hours = record.overtimeHours;
          const hourlyRate = config.salaryType === '月薪' 
            ? Math.round(config.baseSalary / 30 / 8) 
            : config.baseSalary;
          
          if (record.overtimeType === '平日加班') {
            weekdayOvertimePay += hours * hourlyRate * OVERTIME_RATES.weekday;
          } else if (record.overtimeType === '休息日加班') {
            restdayOvertimePay += hours * hourlyRate * OVERTIME_RATES.restday;
          } else if (record.overtimeType === '國定假日加班') {
            holidayOvertimePay += hours * hourlyRate * OVERTIME_RATES.holiday;
          }
        }
      });
    }
    
    let leaveDeduction = 0;
    if (leaveRecords.success && leaveRecords.data) {
      leaveRecords.data.forEach(record => {
        if (record.reviewStatus === '核准') {
          if (record.leaveType === 'PERSONAL_LEAVE' || record.leaveType === '事假') {
            const dailyRate = config.salaryType === '月薪' 
              ? Math.round(config.baseSalary / 30) 
              : config.baseSalary * 8;
            leaveDeduction += record.leaveDays * dailyRate;
          }
        }
      });
    }
    
    const grossSalary = baseSalary + weekdayOvertimePay + restdayOvertimePay + holidayOvertimePay;
    const totalDeductions = config.laborFee + config.healthFee + config.employmentFee + 
                           config.pensionSelf + config.incomeTax + leaveDeduction;
    const netSalary = grossSalary - totalDeductions;
    
    const result = {
      employeeId: employeeId,
      employeeName: config.employeeName,
      yearMonth: yearMonth,
      baseSalary: baseSalary,
      weekdayOvertimePay: Math.round(weekdayOvertimePay),
      restdayOvertimePay: Math.round(restdayOvertimePay),
      holidayOvertimePay: Math.round(holidayOvertimePay),
      laborFee: config.laborFee,
      healthFee: config.healthFee,
      employmentFee: config.employmentFee,
      pensionSelf: config.pensionSelf,
      incomeTax: config.incomeTax,
      leaveDeduction: Math.round(leaveDeduction),
      grossSalary: Math.round(grossSalary),
      netSalary: Math.round(netSalary),
      bankCode: config.bankCode,
      bankAccount: config.bankAccount,
      status: "已計算",
      note: ""
    };
    
    return { success: true, data: result };
    
  } catch (error) {
    Logger.log("❌ 計算薪資失敗: " + error);
    return { success: false, message: error.toString() };
  }
}

/**
 * ✅ 儲存月薪資單
 */
function saveMonthlySalary(salaryData) {
  try {
    const sheet = getMonthlySalarySheet();
    
    let normalizedYearMonth = salaryData.yearMonth;
    
    if (salaryData.yearMonth instanceof Date) {
      normalizedYearMonth = Utilities.formatDate(salaryData.yearMonth, "Asia/Taipei", "yyyy-MM");
    } else if (typeof salaryData.yearMonth === 'string') {
      normalizedYearMonth = salaryData.yearMonth.substring(0, 7);
    }
    
    const salaryId = `SAL-${normalizedYearMonth}-${salaryData.employeeId}`;
    
    const row = [
      salaryId,
      salaryData.employeeId,
      salaryData.employeeName,
      normalizedYearMonth,
      salaryData.baseSalary || 0,
      salaryData.weekdayOvertimePay || 0,
      salaryData.restdayOvertimePay || 0,
      salaryData.holidayOvertimePay || 0,
      salaryData.laborFee || 0,
      salaryData.healthFee || 0,
      salaryData.employmentFee || 0,
      salaryData.pensionSelf || 0,
      salaryData.incomeTax || 0,
      salaryData.leaveDeduction || 0,
      salaryData.grossSalary || 0,
      salaryData.netSalary || 0,
      salaryData.bankCode || "",
      salaryData.bankAccount || "",
      salaryData.status || "已計算",
      salaryData.note || "",
      new Date()
    ];
    
    const data = sheet.getDataRange().getValues();
    let found = false;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === salaryId) {
        sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
        found = true;
        Logger.log(`✅ 更新薪資單: ${salaryId}`);
        break;
      }
    }
    
    if (!found) {
      sheet.appendRow(row);
      Logger.log(`✅ 新增薪資單: ${salaryId}`);
    }
    
    return { success: true, salaryId: salaryId, message: "薪資單儲存成功" };
    
  } catch (error) {
    Logger.log("❌ 儲存薪資單失敗: " + error);
    return { success: false, message: error.toString() };
  }
}

/**
 * ✅ 查詢我的薪資（Bug Fix 版本）
 */
function getMySalary(userId, yearMonth) {
  try {
    Logger.log('═══════════════════════════════════════');
    Logger.log('🔍 開始查詢薪資');
    Logger.log('═══════════════════════════════════════');
    Logger.log(`📥 輸入參數:`);
    Logger.log(`   userId: "${userId}"`);
    Logger.log(`   yearMonth: "${yearMonth}"`);
    Logger.log('');
    
    const employeeId = userId;
    const sheet = getMonthlySalarySheet();
    const data = sheet.getDataRange().getValues();
    
    if (data.length < 2) {
      Logger.log('❌ 薪資記錄表為空');
      return { success: false, message: "薪資記錄表中沒有資料" };
    }
    
    const headers = data[0];
    
    Logger.log(`📊 薪資記錄表:`);
    Logger.log(`   總列數: ${data.length}`);
    Logger.log(`   資料列數: ${data.length - 1}`);
    Logger.log(`   欄位: ${headers.join(', ')}`);
    Logger.log('');
    
    // ✅ 關鍵修正：使用 indexOf 取得欄位索引
    const employeeIdIndex = headers.indexOf('員工ID');
    const yearMonthIndex = headers.indexOf('年月');
    
    Logger.log(`📋 欄位索引:`);
    Logger.log(`   員工ID 在第 ${employeeIdIndex} 欄 (${String.fromCharCode(65 + employeeIdIndex)})`);
    Logger.log(`   年月 在第 ${yearMonthIndex} 欄 (${String.fromCharCode(65 + yearMonthIndex)})`);
    Logger.log('');
    
    if (employeeIdIndex === -1) {
      Logger.log('❌ 找不到「員工ID」欄位');
      return { success: false, message: "試算表缺少「員工ID」欄位" };
    }
    
    if (yearMonthIndex === -1) {
      Logger.log('❌ 找不到「年月」欄位');
      return { success: false, message: "試算表缺少「年月」欄位" };
    }
    
    Logger.log('🔄 開始逐列比對:');
    Logger.log('───────────────────────────────────────');
    
    for (let i = 1; i < data.length; i++) {
      // ✅ 關鍵修正：使用動態索引而不是硬編碼的 [1]
      const rowEmployeeId = String(data[i][employeeIdIndex]).trim();
      const rawYearMonth = data[i][yearMonthIndex];
      
      Logger.log(`第 ${i + 1} 列 (資料第 ${i} 筆):`);
      Logger.log(`   原始員工ID: "${data[i][employeeIdIndex]}"`);
      Logger.log(`   trim後: "${rowEmployeeId}"`);
      Logger.log(`   原始年月: ${rawYearMonth}`);
      Logger.log(`   型別: ${typeof rawYearMonth}`);
      
      let normalizedYearMonth = '';
      
      if (rawYearMonth instanceof Date) {
        normalizedYearMonth = Utilities.formatDate(rawYearMonth, 'Asia/Taipei', 'yyyy-MM');
        Logger.log(`   ✓ Date物件，格式化為: "${normalizedYearMonth}"`);
      } else if (typeof rawYearMonth === 'string') {
        normalizedYearMonth = rawYearMonth.substring(0, 7);
        Logger.log(`   ✓ 字串，取前7字元: "${normalizedYearMonth}"`);
      } else {
        normalizedYearMonth = String(rawYearMonth).substring(0, 7);
        Logger.log(`   ✓ 其他型別，轉字串後取前7字元: "${normalizedYearMonth}"`);
      }
      
      const employeeIdMatch = (rowEmployeeId === employeeId);
      const yearMonthMatch = (normalizedYearMonth === yearMonth);
      
      Logger.log(`   員工ID比對: ${employeeIdMatch ? '✅' : '❌'} (${rowEmployeeId} === ${employeeId})`);
      Logger.log(`   年月比對: ${yearMonthMatch ? '✅' : '❌'} (${normalizedYearMonth} === ${yearMonth})`);
      
      if (employeeIdMatch && yearMonthMatch) {
        Logger.log('');
        Logger.log('🎉🎉🎉 找到符合的薪資記錄！');
        Logger.log('───────────────────────────────────────');
        
        const salary = {};
        headers.forEach((header, index) => {
          if (header === '年月' && data[i][index] instanceof Date) {
            salary[header] = Utilities.formatDate(data[i][index], 'Asia/Taipei', 'yyyy-MM');
          } else {
            salary[header] = data[i][index];
          }
        });
        
        Logger.log('');
        Logger.log('📦 返回薪資資料:');
        Logger.log('   薪資單ID: ' + salary['薪資單ID']);
        Logger.log('   員工姓名: ' + salary['員工姓名']);
        Logger.log('   年月: ' + salary['年月']);
        Logger.log('   實發金額: ' + salary['實發金額']);
        Logger.log('═══════════════════════════════════════');
        
        return { success: true, data: salary };
      }
      
      Logger.log('   ⏭️ 不符合，繼續下一列');
      Logger.log('');
    }
    
    Logger.log('');
    Logger.log('❌ 查無符合的薪資記錄');
    Logger.log('═══════════════════════════════════════');
    
    return { success: false, message: "查無薪資記錄" };
    
  } catch (error) {
    Logger.log('');
    Logger.log('❌❌❌ 發生錯誤');
    Logger.log('錯誤訊息: ' + error.message);
    Logger.log('錯誤堆疊: ' + error.stack);
    Logger.log('═══════════════════════════════════════');
    
    return { success: false, message: error.toString() };
  }
}

/**
 * ✅ 查詢我的薪資歷史（Bug Fix 版本）
 */
function getMySalaryHistory(userId, limit = 12) {
  try {
    const employeeId = userId;
    const sheet = getMonthlySalarySheet();
    const data = sheet.getDataRange().getValues();
    
    if (data.length < 2) {
      return { success: true, data: [], total: 0 };
    }
    
    const headers = data[0];
    
    // ✅ 關鍵修正：使用 indexOf 取得欄位索引
    const employeeIdIndex = headers.indexOf('員工ID');
    
    if (employeeIdIndex === -1) {
      Logger.log('❌ 找不到「員工ID」欄位');
      return { success: false, message: "試算表缺少「員工ID」欄位" };
    }
    
    const salaries = [];
    
    for (let i = 1; i < data.length; i++) {
      // ✅ 關鍵修正：使用動態索引而不是硬編碼的 [1]
      const rowEmployeeId = String(data[i][employeeIdIndex]).trim();
      
      if (rowEmployeeId === employeeId) {
        const salary = {};
        headers.forEach((header, index) => {
          if (header === '年月' && data[i][index] instanceof Date) {
            salary[header] = Utilities.formatDate(data[i][index], "Asia/Taipei", "yyyy-MM");
          } else {
            salary[header] = data[i][index];
          }
        });
        salaries.push(salary);
      }
    }
    
    // 按年月排序（最新的在前）
    salaries.sort((a, b) => {
      const yearMonthA = String(a['年月'] || '');
      const yearMonthB = String(b['年月'] || '');
      return yearMonthB.localeCompare(yearMonthA);
    });
    
    const result = salaries.slice(0, limit);
    
    Logger.log(`📊 查詢薪資歷史: 找到 ${salaries.length} 筆，返回 ${result.length} 筆`);
    
    return { success: true, data: result, total: salaries.length };
    
  } catch (error) {
    Logger.log("❌ 查詢薪資歷史失敗: " + error);
    return { success: false, message: error.toString() };
  }
}

/**
 * ✅ 查詢所有員工的月薪資列表
 */
function getAllMonthlySalary(yearMonth) {
  try {
    const sheet = getMonthlySalarySheet();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    const salaries = [];
    
    for (let i = 1; i < data.length; i++) {
      const rawYearMonth = data[i][3];
      
      let normalizedYearMonth = '';
      
      if (rawYearMonth instanceof Date) {
        normalizedYearMonth = Utilities.formatDate(rawYearMonth, "Asia/Taipei", "yyyy-MM");
      } else if (typeof rawYearMonth === 'string') {
        normalizedYearMonth = rawYearMonth.substring(0, 7);
      }
      
      if (!yearMonth || normalizedYearMonth === yearMonth) {
        const salary = {};
        headers.forEach((header, index) => {
          if (header === '年月') {
            salary[header] = normalizedYearMonth;
          } else {
            salary[header] = data[i][index];
          }
        });
        salaries.push(salary);
      }
    }
    
    return { success: true, data: salaries };
    
  } catch (error) {
    Logger.log("❌ 查詢薪資列表失敗: " + error);
    return { success: false, message: error.toString() };
  }
}

// ==================== 輔助函數 ====================

/**
 * ✅ 取得員工加班記錄
 */
function getEmployeeOvertimeRecords(employeeId, yearMonth) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("加班申請");
    
    if (!sheet) {
      return { success: true, data: [] };
    }
    
    const values = sheet.getDataRange().getValues();
    const records = [];
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      
      if (!row[1] || !row[3]) continue;
      
      const rowEmployeeId = String(row[1]).trim();
      const overtimeDate = row[3];
      
      if (rowEmployeeId !== employeeId) continue;
      
      let dateStr = "";
      if (overtimeDate instanceof Date) {
        dateStr = Utilities.formatDate(overtimeDate, "Asia/Taipei", "yyyy-MM");
      } else if (typeof overtimeDate === "string") {
        dateStr = overtimeDate.substring(0, 7);
      }
      
      if (dateStr !== yearMonth) continue;
      
      const status = String(row[9] || "").trim().toLowerCase();
      if (status !== "approved") continue;
      
      records.push({
        overtimeDate: dateStr,
        overtimeHours: parseFloat(row[6]) || 0,
        overtimeType: "平日加班",
        reviewStatus: "核准"
      });
    }
    
    return { success: true, data: records };
    
  } catch (error) {
    Logger.log("❌ 取得加班記錄失敗: " + error);
    return { success: false, message: error.toString(), data: [] };
  }
}

/**
 * ✅ 取得員工請假記錄
 */
function getEmployeeLeaveRecords(employeeId, yearMonth) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("請假記錄");
    
    if (!sheet) {
      return { success: true, data: [] };
    }
    
    const values = sheet.getDataRange().getValues();
    const records = [];
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      
      if (!row[1] || !row[5]) continue;
      
      const rowEmployeeId = String(row[1]).trim();
      const startDate = row[5];
      
      if (rowEmployeeId !== employeeId) continue;
      
      let dateStr = "";
      if (startDate instanceof Date) {
        dateStr = Utilities.formatDate(startDate, "Asia/Taipei", "yyyy-MM");
      } else if (typeof startDate === "string") {
        dateStr = startDate.substring(0, 7);
      }
      
      if (dateStr !== yearMonth) continue;
      
      const status = String(row[9] || "").trim().toUpperCase();
      if (status !== "APPROVED") continue;
      
      records.push({
        leaveType: row[4] || "",
        startDate: startDate,
        leaveDays: parseFloat(row[7]) || 0,
        reviewStatus: "核准"
      });
    }
    
    return { success: true, data: records };
    
  } catch (error) {
    Logger.log("❌ 取得請假記錄失敗: " + error);
    return { success: false, message: error.toString(), data: [] };
  }
}

// ==================== 測試函數 ====================

/**
 * 🧪 測試查詢薪資
 */
function testGetMySalaryComplete() {
  Logger.log('');
  Logger.log('🧪🧪🧪 開始完整測試');
  Logger.log('');
  
  const userId = 'Uffac21d92d99e3404b9228fd8c251e2a';
  const yearMonth = '2025-11';
  
  Logger.log('📥 測試參數:');
  Logger.log('   userId: ' + userId);
  Logger.log('   yearMonth: ' + yearMonth);
  Logger.log('');
  
  const result = getMySalary(userId, yearMonth);
  
  Logger.log('');
  Logger.log('🎯 最終結果:');
  Logger.log(JSON.stringify(result, null, 2));
  Logger.log('');
  
  if (result.success) {
    Logger.log('✅✅✅ 測試成功！');
    Logger.log('');
    Logger.log('📦 薪資資料:');
    if (result.data) {
      Logger.log('   薪資單ID: ' + result.data['薪資單ID']);
      Logger.log('   員工姓名: ' + result.data['員工姓名']);
      Logger.log('   年月: ' + result.data['年月']);
      Logger.log('   應發總額: ' + result.data['應發總額']);
      Logger.log('   實發金額: ' + result.data['實發金額']);
    }
  } else {
    Logger.log('❌❌❌ 測試失敗');
    Logger.log('   原因: ' + result.message);
  }
}

/**
 * 🧪 測試查詢薪資歷史
 */
function testGetMySalaryHistory() {
  Logger.log('🧪 測試查詢薪資歷史');
  
  const userId = 'Uffac21d92d99e3404b9228fd8c251e2a';
  const result = getMySalaryHistory(userId, 12);
  
  Logger.log('結果: ' + JSON.stringify(result, null, 2));
}