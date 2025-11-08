/**
 * 排班管理模組
 * 負責處理員工排班的所有邏輯
 */

// ==================== ⭐ 格式化函數 (新增) ====================

/**
 * ⭐ 格式化日期為 YYYY-MM-DD
 */
function formatDateOnly(dateValue) {
  if (!dateValue) return "";
  
  let date;
  if (typeof dateValue === 'string') {
    // 如果已經是字串格式,檢查格式
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      return dateValue; // 已經是正確格式
    }
    date = new Date(dateValue);
  } else if (dateValue instanceof Date) {
    date = dateValue;
  } else {
    return String(dateValue);
  }
  
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/**
 * ⭐ 格式化時間為 HH:MM
 */
function formatTimeOnly(timeValue) {
  if (!timeValue) return "";
  
  // 如果已經是 HH:MM 格式
  if (typeof timeValue === 'string' && /^\d{2}:\d{2}$/.test(timeValue)) {
    return timeValue;
  }
  
  // 如果是 "HH:MM:SS" 格式
  if (typeof timeValue === 'string' && /^\d{2}:\d{2}:\d{2}$/.test(timeValue)) {
    return timeValue.substring(0, 5); // 只取前5個字元
  }
  
  // 如果是 Date 物件
  if (timeValue instanceof Date) {
    const hours = String(timeValue.getHours()).padStart(2, '0');
    const minutes = String(timeValue.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
  
  // 如果是時間戳字串
  if (typeof timeValue === 'string') {
    try {
      const date = new Date(timeValue);
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    } catch (e) {
      return String(timeValue);
    }
  }
  
  return String(timeValue);
}

/**
 * ⭐ 格式化完整日期時間
 */
function formatDateTime(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

// ==================== 原有功能 ====================

/**
 * 取得排班工作表
 */
function getShiftSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('排班表');
  
  if (!sheet) {
    sheet = ss.insertSheet('排班表');
    const headers = [
      '排班ID',
      '員工ID', 
      '員工姓名',
      '日期',
      '班別',
      '上班時間',
      '下班時間',
      '地點',
      '備註',
      '建立時間',
      '建立者',
      '最後修改時間',
      '最後修改者',
      '狀態'
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#4285f4').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
  
  return sheet;
}

/**
 * 新增排班 (⭐ 已修正 - 使用格式化函數)
 */
function addShift(shiftData) {
  try {
    const sheet = getShiftSheet();
    const userId = Session.getActiveUser().getEmail();
    
    // 驗證必填欄位
    if (!shiftData.employeeId || !shiftData.date || !shiftData.shiftType) {
      return {
        success: false,
        message: '請填寫所有必填欄位'
      };
    }
    
    // 檢查是否已有相同日期的排班
    const existingShift = checkDuplicateShift(shiftData.employeeId, shiftData.date);
    if (existingShift) {
      return {
        success: false,
        message: '該員工在此日期已有排班記錄'
      };
    }
    
    const shiftId = 'SHIFT-' + Utilities.getUuid();
    const timestamp = formatDateTime(new Date());
    
    // ✅ 使用格式化函數
    const rowData = [
      shiftId,
      shiftData.employeeId,
      shiftData.employeeName || '',
      formatDateOnly(shiftData.date),        // ✅ 格式化日期
      shiftData.shiftType,
      formatTimeOnly(shiftData.startTime),   // ✅ 格式化時間
      formatTimeOnly(shiftData.endTime),     // ✅ 格式化時間
      shiftData.location || '',
      shiftData.note || '',
      timestamp,
      userId,
      timestamp,
      userId,
      '正常'
    ];
    
    sheet.appendRow(rowData);
    
    // 發送LINE通知給員工
    try {
      sendShiftNotification(shiftData.employeeId, shiftData);
    } catch (e) {
      Logger.log('發送排班通知失敗: ' + e);
    }
    
    return {
      success: true,
      message: '排班新增成功',
      shiftId: shiftId
    };
    
  } catch (error) {
    Logger.log('新增排班錯誤: ' + error);
    return {
      success: false,
      message: '新增排班失敗: ' + error.message
    };
  }
}

/**
 * 檢查重複排班
 */
function checkDuplicateShift(employeeId, date) {
  const sheet = getShiftSheet();
  const data = sheet.getDataRange().getValues();
  const targetDate = formatDateOnly(date);
  
  for (let i = 1; i < data.length; i++) {
    const shiftDate = formatDateOnly(data[i][3]);
    if (data[i][1] === employeeId && shiftDate === targetDate && data[i][13] !== '已刪除') {
      return true;
    }
  }
  
  return false;
}

/**
 * 批量新增排班 (⭐ 已修正 - 使用格式化函數)
 */
function batchAddShifts(shiftsArray) {
  try {
    const sheet = getShiftSheet();
    const userId = Session.getActiveUser().getEmail();
    const timestamp = formatDateTime(new Date());
    const results = {
      success: 0,
      failed: 0,
      errors: []
    };
    
    shiftsArray.forEach((shiftData, index) => {
      try {
        // 檢查重複
        if (checkDuplicateShift(shiftData.employeeId, shiftData.date)) {
          results.failed++;
          results.errors.push(`第 ${index + 1} 筆: 該員工在此日期已有排班`);
          return;
        }
        
        const shiftId = 'SHIFT-' + Utilities.getUuid();
        
        // ✅ 使用格式化函數
        const rowData = [
          shiftId,
          shiftData.employeeId,
          shiftData.employeeName || '',
          formatDateOnly(shiftData.date),
          shiftData.shiftType,
          formatTimeOnly(shiftData.startTime),
          formatTimeOnly(shiftData.endTime),
          shiftData.location || '',
          shiftData.note || '',
          timestamp,
          userId,
          timestamp,
          userId,
          '正常'
        ];
        
        sheet.appendRow(rowData);
        results.success++;
        
      } catch (e) {
        results.failed++;
        results.errors.push(`第 ${index + 1} 筆: ${e.message}`);
      }
    });
    
    return {
      success: true,
      message: `批量新增完成: 成功 ${results.success} 筆, 失敗 ${results.failed} 筆`,
      results: results
    };
    
  } catch (error) {
    Logger.log('批量新增排班錯誤: ' + error);
    return {
      success: false,
      message: '批量新增失敗: ' + error.message
    };
  }
}

/**
 * ✅ 查詢排班（完全修正版 - 確保日期過濾正確）
 */
function getShifts(filters) {
  try {
    const sheet = getShiftSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const shifts = [];
    
    Logger.log('═══════════════════════════════════════');
    Logger.log('🔍 getShifts 開始');
    Logger.log('═══════════════════════════════════════');
    Logger.log('📥 原始篩選條件:', JSON.stringify(filters, null, 2));
    Logger.log('');
    
    // ✅ 格式化篩選日期（確保格式一致）
    let filterStartDate = null;
    let filterEndDate = null;
    
    if (filters && filters.startDate) {
      filterStartDate = formatDateOnly(filters.startDate);
      Logger.log('📅 篩選開始日期:', filterStartDate);
    }
    
    if (filters && filters.endDate) {
      filterEndDate = formatDateOnly(filters.endDate);
      Logger.log('📅 篩選結束日期:', filterEndDate);
    }
    
    Logger.log('');
    Logger.log('📋 開始檢查每一筆排班...');
    Logger.log('');
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // 跳過已刪除的記錄
      if (row[13] === '已刪除') {
        continue;
      }
      
      // ✅ 格式化排班日期（確保格式一致）
      const shiftDate = formatDateOnly(row[3]);
      
      // 如果日期無效，跳過
      if (!shiftDate) {
        Logger.log(`   ⚠️  第 ${i} 筆: 日期無效，跳過`);
        continue;
      }
      
      // ✅ 應用篩選條件
      let passFilter = true;
      
      // 員工ID篩選
      if (filters && filters.employeeId && row[1] !== filters.employeeId) {
        passFilter = false;
      }
      
      // ✅ 日期範圍篩選（使用字串比較）
      if (passFilter && filterStartDate && shiftDate < filterStartDate) {
        Logger.log(`   ⏭️  第 ${i} 筆: ${shiftDate} < ${filterStartDate}（太早），跳過`);
        passFilter = false;
      }
      
      if (passFilter && filterEndDate && shiftDate > filterEndDate) {
        Logger.log(`   ⏭️  第 ${i} 筆: ${shiftDate} > ${filterEndDate}（太晚），跳過`);
        passFilter = false;
      }
      
      // 班別篩選
      if (passFilter && filters && filters.shiftType && row[4] !== filters.shiftType) {
        passFilter = false;
      }
      
      // 地點篩選
      if (passFilter && filters && filters.location && row[7] !== filters.location) {
        passFilter = false;
      }
      
      // ✅ 通過所有篩選
      if (passFilter) {
        Logger.log(`   ✅ 第 ${i} 筆: ${shiftDate} - ${row[2]}（${row[4]}）符合條件`);
        
        shifts.push({
          shiftId: row[0],
          employeeId: row[1],
          employeeName: row[2],
          date: shiftDate,
          shiftType: row[4],
          startTime: formatTimeOnly(row[5]),
          endTime: formatTimeOnly(row[6]),
          location: row[7],
          note: row[8],
          createdAt: row[9],
          createdBy: row[10],
          updatedAt: row[11],
          updatedBy: row[12],
          status: row[13]
        });
      }
    }
    
    // ✅ 按日期排序（最近的在前）
    shifts.sort((a, b) => {
      if (a.date < b.date) return -1;
      if (a.date > b.date) return 1;
      return 0;
    });
    
    Logger.log('');
    Logger.log('═══════════════════════════════════════');
    Logger.log('✅ 查詢完成');
    Logger.log('   符合條件的排班數量:', shifts.length);
    
    if (shifts.length > 0) {
      Logger.log('');
      Logger.log('📋 結果預覽（前 5 筆）:');
      shifts.slice(0, 5).forEach((shift, index) => {
        Logger.log(`   ${index + 1}. ${shift.date} - ${shift.employeeName} (${shift.shiftType})`);
      });
      
      if (shifts.length > 5) {
        Logger.log(`   ... 還有 ${shifts.length - 5} 筆`);
      }
    }
    
    Logger.log('═══════════════════════════════════════');
    
    return {
      success: true,
      data: shifts,
      count: shifts.length
    };
    
  } catch (error) {
    Logger.log('');
    Logger.log('❌❌❌ getShifts 發生錯誤');
    Logger.log('錯誤訊息:', error.message);
    Logger.log('錯誤堆疊:', error.stack);
    Logger.log('═══════════════════════════════════════');
    
    return {
      success: false,
      message: '查詢排班失敗: ' + error.message,
      data: []
    };
  }
}

function testGetShiftsDateFilter() {
  const filters = {
    employeeId: 'Uffac21d92d99e3404b9228fd8c251e2a',
    startDate: '2025-11-07',
    endDate: '2025-11-14'
  };
  
  const result = getShifts(filters);
  
  Logger.log('測試結果:');
  Logger.log('  success:', result.success);
  Logger.log('  count:', result.count);
  Logger.log('  data:', result.data);
}

function testGetShiftsWithDateFilter() {
  Logger.log('🧪 測試日期篩選');
  Logger.log('');
  
  const today = new Date();
  const startDate = Utilities.formatDate(today, 'Asia/Taipei', 'yyyy-MM-dd');
  
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 7);
  const endDateStr = Utilities.formatDate(endDate, 'Asia/Taipei', 'yyyy-MM-dd');
  
  Logger.log('📅 測試日期範圍:');
  Logger.log('   開始:', startDate);
  Logger.log('   結束:', endDateStr);
  Logger.log('');
  
  const filters = {
    employeeId: 'Uffac21d92d99e3404b9228fd8c251e2a', // 替換成真實的員工ID
    startDate: startDate,
    endDate: endDateStr
  };
  
  const result = getShifts(filters);
  
  Logger.log('');
  Logger.log('📊 測試結果:');
  Logger.log('   success:', result.success);
  Logger.log('   count:', result.count);
  
  if (result.data && result.data.length > 0) {
    Logger.log('');
    Logger.log('📋 找到的排班:');
    result.data.forEach((shift, index) => {
      Logger.log(`   ${index + 1}. ${shift.date} - ${shift.shiftType}`);
    });
  } else {
    Logger.log('   沒有找到符合條件的排班');
  }
}
function addTestShiftsForFuture() {
  Logger.log('🧪 新增測試排班（未來 7 天）');
  Logger.log('');
  
  const today = new Date();
  const userId = 'Uffac21d92d99e3404b9228fd8c251e2a'; // 你的員工 ID
  const userName = '測試員工'; // 你的姓名
  
  for (let i = 0; i < 7; i++) {
    const shiftDate = new Date(today);
    shiftDate.setDate(today.getDate() + i);
    const dateStr = Utilities.formatDate(shiftDate, 'Asia/Taipei', 'yyyy-MM-dd');
    
    const shiftData = {
      employeeId: userId,
      employeeName: userName,
      date: dateStr,
      shiftType: '早班',
      startTime: '09:00',
      endTime: '18:00',
      location: '總公司',
      note: '測試排班'
    };
    
    const result = addShift(shiftData);
    Logger.log(`${i + 1}. ${dateStr}: ${result.success ? '✅ 成功' : '❌ 失敗'}`);
  }
}
/**
 * 取得單一排班詳情 (⭐ 已修正 - 格式化回傳資料)
 */
function getShiftById(shiftId) {
  try {
    const sheet = getShiftSheet();
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === shiftId) {
        // ✅ 格式化回傳資料
        return {
          success: true,
          data: {
            shiftId: data[i][0],
            employeeId: data[i][1],
            employeeName: data[i][2],
            date: formatDateOnly(data[i][3]),
            shiftType: data[i][4],
            startTime: formatTimeOnly(data[i][5]),
            endTime: formatTimeOnly(data[i][6]),
            location: data[i][7],
            note: data[i][8],
            createdAt: data[i][9],
            createdBy: data[i][10],
            updatedAt: data[i][11],
            updatedBy: data[i][12],
            status: data[i][13]
          }
        };
      }
    }
    
    return {
      success: false,
      message: '找不到該排班記錄'
    };
    
  } catch (error) {
    Logger.log('查詢排班詳情錯誤: ' + error);
    return {
      success: false,
      message: '查詢失敗: ' + error.message
    };
  }
}

/**
 * 更新排班 (⭐ 已修正 - 使用格式化函數)
 */
function updateShift(shiftId, updateData) {
  try {
    const sheet = getShiftSheet();
    const data = sheet.getDataRange().getValues();
    const userId = Session.getActiveUser().getEmail();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === shiftId) {
        // ✅ 使用格式化函數更新欄位
        if (updateData.date) sheet.getRange(i + 1, 4).setValue(formatDateOnly(updateData.date));
        if (updateData.shiftType) sheet.getRange(i + 1, 5).setValue(updateData.shiftType);
        if (updateData.startTime) sheet.getRange(i + 1, 6).setValue(formatTimeOnly(updateData.startTime));
        if (updateData.endTime) sheet.getRange(i + 1, 7).setValue(formatTimeOnly(updateData.endTime));
        if (updateData.location) sheet.getRange(i + 1, 8).setValue(updateData.location);
        if (updateData.note !== undefined) sheet.getRange(i + 1, 9).setValue(updateData.note);
        
        // 更新修改時間和修改者
        sheet.getRange(i + 1, 12).setValue(formatDateTime(new Date()));
        sheet.getRange(i + 1, 13).setValue(userId);
        
        return {
          success: true,
          message: '排班更新成功'
        };
      }
    }
    
    return {
      success: false,
      message: '找不到該排班記錄'
    };
    
  } catch (error) {
    Logger.log('更新排班錯誤: ' + error);
    return {
      success: false,
      message: '更新失敗: ' + error.message
    };
  }
}

/**
 * 刪除排班（軟刪除）
 */
function deleteShift(shiftId) {
  try {
    const sheet = getShiftSheet();
    const data = sheet.getDataRange().getValues();
    const userId = Session.getActiveUser().getEmail();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === shiftId) {
        sheet.getRange(i + 1, 14).setValue('已刪除');
        sheet.getRange(i + 1, 12).setValue(formatDateTime(new Date()));
        sheet.getRange(i + 1, 13).setValue(userId);
        
        return {
          success: true,
          message: '排班刪除成功'
        };
      }
    }
    
    return {
      success: false,
      message: '找不到該排班記錄'
    };
    
  } catch (error) {
    Logger.log('刪除排班錯誤: ' + error);
    return {
      success: false,
      message: '刪除失敗: ' + error.message
    };
  }
}

/**
 * 取得員工的排班資訊（用於打卡驗證） (⭐ 已修正 - 格式化回傳資料)
 */
function getEmployeeShiftForDate(employeeId, date) {
  try {
    const sheet = getShiftSheet();
    const data = sheet.getDataRange().getValues();
    
    const targetDate = formatDateOnly(date);
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === employeeId && data[i][13] !== '已刪除') {
        const shiftDate = formatDateOnly(data[i][3]);
        
        if (shiftDate === targetDate) {
          // ✅ 格式化回傳資料
          return {
            success: true,
            hasShift: true,
            data: {
              shiftId: data[i][0],
              shiftType: data[i][4],
              startTime: formatTimeOnly(data[i][5]),
              endTime: formatTimeOnly(data[i][6]),
              location: data[i][7]
            }
          };
        }
      }
    }
    
    return {
      success: true,
      hasShift: false,
      message: '今日無排班'
    };
    
  } catch (error) {
    Logger.log('查詢員工排班錯誤: ' + error);
    return {
      success: false,
      message: '查詢失敗: ' + error.message
    };
  }
}

/**
 * 取得本週排班統計
 */
function getWeeklyShiftStats() {
  try {
    const sheet = getShiftSheet();
    const data = sheet.getDataRange().getValues();
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    const startDateStr = formatDateOnly(startOfWeek);
    const endDateStr = formatDateOnly(endOfWeek);
    
    const stats = {
      totalShifts: 0,
      byShiftType: {},
      byEmployee: {}
    };
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][13] === '已刪除') continue;
      
      const shiftDate = formatDateOnly(data[i][3]);
      if (shiftDate >= startDateStr && shiftDate <= endDateStr) {
        stats.totalShifts++;
        
        const shiftType = data[i][4];
        stats.byShiftType[shiftType] = (stats.byShiftType[shiftType] || 0) + 1;
        
        const employeeName = data[i][2];
        stats.byEmployee[employeeName] = (stats.byEmployee[employeeName] || 0) + 1;
      }
    }
    
    return {
      success: true,
      data: stats
    };
    
  } catch (error) {
    Logger.log('取得排班統計錯誤: ' + error);
    return {
      success: false,
      message: '取得統計失敗: ' + error.message
    };
  }
}

/**
 * 匯出排班資料
 */
function exportShifts(filters) {
  try {
    const result = getShifts(filters);
    if (!result.success) {
      return result;
    }
    
    return {
      success: true,
      data: result.data,
      filename: `排班表_${formatDateOnly(new Date()).replace(/-/g, '')}.csv`
    };
    
  } catch (error) {
    Logger.log('匯出排班錯誤: ' + error);
    return {
      success: false,
      message: '匯出失敗: ' + error.message
    };
  }
}

/**
 * 發送排班通知（透過LINE）
 */
function sendShiftNotification(employeeId, shiftData) {
  try {
    // 取得員工的LINE User ID
    const userInfo = getUserInfoByEmployeeId(employeeId);
    if (!userInfo || !userInfo.lineUserId) {
      Logger.log('找不到員工的LINE ID');
      return;
    }
    
    const message = `您好！您有新的排班通知：\n\n` +
                   `日期: ${shiftData.date}\n` +
                   `班別: ${shiftData.shiftType}\n` +
                   `上班時間: ${shiftData.startTime}\n` +
                   `下班時間: ${shiftData.endTime}\n` +
                   `地點: ${shiftData.location}\n` +
                   `${shiftData.note ? '備註: ' + shiftData.note : ''}`;
    
    sendLineMessage(userInfo.lineUserId, message);
    
  } catch (error) {
    Logger.log('發送排班通知錯誤: ' + error);
  }
}

/**
 * 從員工ID取得使用者資訊
 */
function getUserInfoByEmployeeId(employeeId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const userSheet = ss.getSheetByName('使用者資料');
    if (!userSheet) return null;
    
    const data = userSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === employeeId) {
        return {
          lineUserId: data[i][1],
          name: data[i][2],
          email: data[i][3]
        };
      }
    }
    
    return null;
  } catch (error) {
    Logger.log('取得使用者資訊錯誤: ' + error);
    return null;
  }
}

// ==================== 測試函數 ====================

/**
 * 測試時間格式化
 */
function testTimeFormatting() {
  const testCases = [
    "08:00",
    "08:00:00",
    new Date("2025-10-24T00:00:00"),
    "1899-12-30T01:00:00.000Z"
  ];
  
  Logger.log("=== 時間格式化測試 ===");
  testCases.forEach(test => {
    Logger.log(`輸入: ${test} → 輸出: ${formatTimeOnly(test)}`);
  });
}

/**
 * 測試排班系統
 */
function testShiftSystem() {
  Logger.log('===== 測試排班系統 =====');
  
  const testShift = {
    employeeId: 'TEST001',
    employeeName: '測試員工',
    date: '2025-10-25',
    shiftType: '早班',
    startTime: '08:00',
    endTime: '16:00',
    location: '測試地點',
    note: '測試備註'
  };
  
  const addResult = addShift(testShift);
  Logger.log('新增結果: ' + JSON.stringify(addResult));
  
  const queryResult = getShifts({ employeeId: 'TEST001' });
  Logger.log('查詢結果: ' + JSON.stringify(queryResult));
}