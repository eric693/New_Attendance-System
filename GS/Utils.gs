// Utils.gs

function jsonp(e, obj) {
  const cb = e.parameter.callback || "callback";
  return ContentService.createTextOutput(cb + "(" + JSON.stringify(obj) + ")")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

// 距離計算公式
function getDistanceMeters_(lat1, lng1, lat2, lng2) {
  function toRad(deg) { return deg * Math.PI / 180; }
  const R = 6371000; // 地球半徑 (公尺)
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/**
 * 檢查員工每天的打卡異常狀態，並回傳格式化的異常列表
 * @param {Array} attendanceRows 打卡紀錄，每筆包含：
 * [打卡時間, 員工ID, 薪資, 員工姓名, 上下班, GPS位置, 地點, 備註, 使用裝置詳細訊息]
 * @returns {Array} 每天每位員工的異常結果，格式為 { date: string, reason: string, id: string } 的陣列
 */
function testCheckAbnormalWithStatus() {
  Logger.log('🧪 測試方案 B - 顯示審核狀態');
  Logger.log('');
  
  const month = '2025-11';
  const userId = 'Uffac21d92d99e3404b9228fd8c251e2a';
  
  const records = getAttendanceRecords(month, userId);
  const abnormalResults = checkAttendanceAbnormal(records);
  
  Logger.log('📊 測試結果:');
  Logger.log(`   總記錄數: ${records.length}`);
  Logger.log(`   異常數量: ${abnormalResults.length}`);
  Logger.log('');
  Logger.log('📋 詳細記錄:');
  abnormalResults.forEach((r, i) => {
    Logger.log(`   ${i + 1}. ${r.date} - ${r.reason}`);
  });
}
/**
 * ✅ 檢查員工每天的打卡異常狀態（方案 B - 顯示審核狀態）
 * @param {Array} attendanceRows - 打卡紀錄陣列
 * @returns {Array} - 異常記錄陣列
 */
function checkAttendanceAbnormal(attendanceRows) {
  const dailyRecords = {}; // 按 userId+date 分組
  const abnormalRecords = []; // 用於儲存格式化的異常紀錄
  
  Logger.log("═══════════════════════════════════════");
  Logger.log("🔍 checkAttendanceAbnormal 開始");
  Logger.log(`📊 總記錄數: ${attendanceRows.length}`);
  
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  
  // ===== 步驟 1：按使用者和日期分組 =====
  let targetUserId = null;  // 用於記錄目標使用者ID
  let targetMonth = null;   // 用於記錄目標月份
  
  attendanceRows.forEach(row => {
    try {
      const date = getYmdFromRow(row);
      const userId = row.userId;
      
      // 記錄使用者ID和月份（用於後續檢查缺少的日期）
      if (!targetUserId) targetUserId = userId;
      if (!targetMonth && date) targetMonth = date.substring(0, 7); // "2025-11"
      
      // 🚫 跳過今天的資料
      if (date === today) {
        Logger.log(`⏭️  跳過今天的資料: ${date}`);
        return;
      }
      
      if (!dailyRecords[userId]) dailyRecords[userId] = {};
      if (!dailyRecords[userId][date]) dailyRecords[userId][date] = [];
      dailyRecords[userId][date].push(row);

    } catch (err) {
      Logger.log("❌ 解析 row 失敗: " + JSON.stringify(row) + " | 錯誤: " + err.message);
    }
  });

  // ===== 步驟 2：生成整個月份的日期列表 =====
  const allDatesInMonth = [];
  if (targetMonth) {
    const [year, month] = targetMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      // ⭐ 排除週末（可選）
      const dayOfWeek = new Date(year, month - 1, day).getDay();
      const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6); // 0=週日, 6=週六
      
      // 只加入過去的工作日（不包含今天、未來和週末）
      if (dateStr < today && !isWeekend) {
        allDatesInMonth.push(dateStr);
      }
    }
    
    Logger.log(`📅 本月應檢查的日期數: ${allDatesInMonth.length}`);
  }

  // ===== 步驟 3：檢查每一天的打卡狀態 =====
  if (targetUserId && targetMonth) {
    for (const date of allDatesInMonth) {
      // 檢查這一天是否有打卡記錄
      const dayRecords = dailyRecords[targetUserId]?.[date] || [];
      
      // 過濾系統虛擬卡
      const filteredRows = dayRecords.filter(r => r.note !== "系統虛擬卡");
      
      const types = filteredRows.map(r => r.type);
      const notes = filteredRows.map(r => r.note || "");
      const audits = filteredRows.map(r => r.audit || "");

      // ⭐⭐⭐ 方案 B：檢查補打卡狀態
      const hasPendingAdjustment = notes.some(n => n === "補打卡") && 
                                   audits.some(a => a === "?");
      
      const hasApprovedAdjustment = notes.some(n => n === "補打卡") && 
                                    audits.some(a => a === "v");
      
      const hasRejectedAdjustment = notes.some(n => n === "補打卡") && 
                                    audits.some(a => a === "x");

      // ⭐ 如果有待審核的補打卡，標記為「審核中」
      if (hasPendingAdjustment) {
        Logger.log(`⏳ ${date}: 補打卡審核中`);
        abnormalRecords.push({
          date: date,
          reason: "STATUS_REPAIR_PENDING",
          userId: targetUserId
        });
        continue;
      }

      // ⭐ 如果補打卡已通過，標記為「已通過」
      if (hasApprovedAdjustment) {
        Logger.log(`✅ ${date}: 補打卡已通過`);
        abnormalRecords.push({
          date: date,
          reason: "STATUS_REPAIR_APPROVED",
          userId: targetUserId
        });
        continue;
      }

      // ⭐ 如果補打卡被拒絕，仍顯示為異常（可重新申請）
      if (hasRejectedAdjustment) {
        Logger.log(`❌ ${date}: 補打卡被拒絕`);
        // 繼續往下判斷異常類型
      }

      // 判斷異常類型
      let reason = "";
      
      if (dayRecords.length === 0 || types.length === 0) {
        reason = "STATUS_NO_RECORD";
        Logger.log(`📋 ${date}: 完全沒有打卡記錄`);
      } else if (types.every(t => t === "上班")) {
        reason = "STATUS_PUNCH_OUT_MISSING";
        Logger.log(`📋 ${date}: 缺少下班卡`);
      } else if (types.every(t => t === "下班")) {
        reason = "STATUS_PUNCH_IN_MISSING";
        Logger.log(`📋 ${date}: 缺少上班卡`);
      } else {
        // 有成對的上下班打卡，視為正常
        Logger.log(`✅ ${date}: 打卡正常`);
        continue;
      }

      if (reason) {
        abnormalRecords.push({
          date: date,
          reason: reason,
          userId: targetUserId
        });
      }
    }
  }

  Logger.log("═══════════════════════════════════════");
  Logger.log(`📋 檢查完成，發現 ${abnormalRecords.length} 筆記錄`);
  Logger.log("異常記錄: " + JSON.stringify(abnormalRecords, null, 2));
  Logger.log("═══════════════════════════════════════");
  
  return abnormalRecords;
}
/**
 * 🧪 測試修正後的 checkAttendanceAbnormal
 */
function testCheckAbnormalFixed() {
  Logger.log('');
  Logger.log('🧪🧪🧪 測試修正後的 checkAttendanceAbnormal');
  Logger.log('');
  
  const month = '2025-11';
  const userId = 'Uffac21d92d99e3404b9228fd8c251e2a';  // ⚠️ 替換成真實的 userId
  
  Logger.log(`📅 測試月份: ${month}`);
  Logger.log(`👤 員工ID: ${userId}`);
  Logger.log('');
  
  // 1. 取得出勤記錄
  Logger.log('📡 步驟 1: 取得出勤記錄');
  const records = getAttendanceRecords(month, userId);
  Logger.log(`   ✅ 找到 ${records.length} 筆記錄`);
  Logger.log('');
  
  // 2. 顯示前 5 筆記錄的詳情
  Logger.log('📋 記錄詳情（前 5 筆）:');
  records.slice(0, 5).forEach((r, i) => {
    const date = Utilities.formatDate(new Date(r.date), 'Asia/Taipei', 'yyyy-MM-dd HH:mm');
    Logger.log(`   ${i + 1}. ${date} | ${r.type} | note: "${r.note}" | audit: "${r.audit}"`);
  });
  Logger.log('');
  
  // 3. 檢查異常
  Logger.log('📡 步驟 2: 檢查異常記錄');
  const abnormalResults = checkAttendanceAbnormal(records);
  Logger.log('');
  
  // 4. 顯示結果摘要
  Logger.log('═══════════════════════════════════════');
  Logger.log('📊 測試結果摘要');
  Logger.log('═══════════════════════════════════════');
  Logger.log(`   總記錄數: ${records.length}`);
  Logger.log(`   異常數量: ${abnormalResults.length}`);
  Logger.log('');
  
  if (abnormalResults.length === 0) {
    Logger.log('   ✅ 沒有異常記錄（或都已提交補打卡）');
  } else {
    Logger.log('   📋 異常記錄詳情:');
    abnormalResults.forEach((record, index) => {
      Logger.log(`      ${index + 1}. ${record.date} - ${record.reason}`);
    });
  }
  
  Logger.log('═══════════════════════════════════════');
  
  return {
    ok: true,
    total: records.length,
    abnormal: abnormalResults.length,
    records: abnormalResults
  };
}
function checkAttendance(attendanceRows) {
  const dailyRecords = {}; // 按 userId+date 分組
  const dailyStatus = []; // 用於儲存格式化的異常紀錄
  let abnormalIdCounter = 0; // 用於產生唯一的 id
  
  // 輔助函式：從時間戳記中擷取 'YYYY-MM-DD'
  function getYmdFromRow(row) {
    if (row.date) {
      const d = new Date(row.date);
      return Utilities.formatDate(d, 'Asia/Taipei', 'yyyy-MM-dd');
    }
    return '';
  }

  // 輔助函式：從時間戳記中擷取 'HH:mm'
  function getHhMmFromRow(row) {
    if (row.date) {
      const d = new Date(row.date);
      return Utilities.formatDate(d, 'Asia/Taipei', 'HH:mm');
    }
    return '未知時間';
  }
  
  attendanceRows.forEach(row => {
    try {
      const date = getYmdFromRow(row);
      const userId = row.userId;
  
      if (!dailyRecords[userId]) dailyRecords[userId] = {};
      if (!dailyRecords[userId][date]) dailyRecords[userId][date] = [];
      dailyRecords[userId][date].push(row);

    } catch (err) {
      Logger.log("❌ 解析 row 失敗: " + JSON.stringify(row) + " | 錯誤: " + err.message);
    }
  });

  for (const userId in dailyRecords) {
    for (const date in dailyRecords[userId]) {
      const rows = dailyRecords[userId][date] || [];

      // ✅ 新增：取得員工姓名（從第一筆記錄中取得）
      const userName = rows[0]?.name || '未知員工';
      const userDept = rows[0]?.dept || '';

      // 過濾系統虛擬卡
      const filteredRows = rows.filter(r => r.note !== "系統虛擬卡");

      const record = filteredRows.map(r => ({
        time: getHhMmFromRow(r),
        type: r.type || '未知類型',
        note: r.note || "",
        audit: r.audit || "",
        location: r.location || ""
      }));

      const types = record.map(r => r.type);
      const notes = record.map(r => r.note);
      const audits = record.map(r => r.audit);

      let reason = "";
      let id = "normal";

      const hasAdjustment = notes.some(note => note === "補打卡");
      
      const approvedAdjustments = record.filter(r => r.note === "補打卡");
      const isAllApproved = approvedAdjustments.length > 0 &&
                      approvedAdjustments.every(r => r.audit === "v");

      // 計算成對數量
      const typeCounts = { 上班: 0, 下班: 0 };
      record.forEach(r => {
        if (r.type === "上班") typeCounts["上班"]++;
        else if (r.type === "下班") typeCounts["下班"]++;
      });

      // 只要至少有一對就算正常
      const hasPair = typeCounts["上班"] > 0 && typeCounts["下班"] > 0;

      if (!hasPair) {
        if (typeCounts["上班"] === 0 && typeCounts["下班"] === 0) {
          reason = "未打上班卡, 未打下班卡";
        } else if (typeCounts["上班"] > 0) {
          reason = "未打下班卡";
        } else if (typeCounts["下班"] > 0) {
          reason = "未打上班卡";
        }
      } else if (isAllApproved) {
        reason = "補卡通過";
      } else if (hasAdjustment) {
        reason = "有補卡(審核中)";
      } else {
        reason = "正常";
      }

      if (reason) {
        abnormalIdCounter++;
        id = `abnormal-${abnormalIdCounter}`;
      }

      dailyStatus.push({
        ok: !reason,
        date: date,
        userId: userId,      // ✅ 新增：回傳 userId
        name: userName,      // ✅ 新增：回傳員工姓名
        dept: userDept,      // ✅ 新增：回傳部門（選用）
        record: record,
        reason: reason,
        id: id
      });
    }
  }

  Logger.log("checkAttendance debug: %s", JSON.stringify(dailyStatus));
  return dailyStatus;
}



// 工具函式：將日期格式化 yyyy-mm-dd
/** 取得 row 的 yyy-MM-dd（支援物件/陣列、字串/Date），以台北時區輸出 */
function getYmdFromRow(row) {
  const raw = (row && (row.date ?? row[0])) ?? null; // 物件 row.date 或 陣列 row[0]
  if (raw == null) return null;

  try {
    if (raw instanceof Date) {
      return Utilities.formatDate(raw, "Asia/Taipei", "yyyy-MM-dd");
    }
    const s = String(raw).trim();

    // 先嘗試用 Date 解析（支援 ISO 或一般日期字串）
    const d = new Date(s);
    if (!isNaN(d)) {
      return Utilities.formatDate(d, "Asia/Taipei", "yyyy-MM-dd");
    }

    // 再退而求其次處理 ISO 字串（有 T）
    if (s.includes("T")) return s.split("T")[0];

    return s; // 最後保底，讓外層去判斷是否為有效格式
  } catch (e) {
    return null;
  }
}

/** 取欄位：優先物件屬性，其次陣列索引 */
function pick(row, objKey, idx) {
  const v = row?.[objKey];
  return (v !== undefined && v !== null) ? v : row?.[idx];
}
