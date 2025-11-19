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
function checkAttendanceAbnormal(attendanceRows) {
  const dailyRecords = {};
  const abnormalRecords = [];
  let abnormalIdCounter = 0;
  
  Logger.log("═══════════════════════════════════════");
  Logger.log("🔍 checkAttendanceAbnormal 開始");
  Logger.log(`📊 總記錄數: ${attendanceRows.length}`);
  
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  
  // ===== 步驟 1：按使用者和日期分組 =====
  let targetUserId = null;
  let targetMonth = null;
  
  attendanceRows.forEach(row => {
    try {
      const date = getYmdFromRow(row);
      const userId = row.userId;
      
      if (!targetUserId) targetUserId = userId;
      if (!targetMonth && date) targetMonth = date.substring(0, 7);
      
      if (date === today) {
        Logger.log(`⏭️ 跳過今天的資料: ${date}`);
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
      const dayOfWeek = new Date(year, month - 1, day).getDay();
      const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
      
      if (dateStr < today && !isWeekend) {
        allDatesInMonth.push(dateStr);
      }
    }
    Logger.log(`📅 本月應檢查的日期數: ${allDatesInMonth.length}`);
  }
  
  // ===== 步驟 3：檢查每一天的打卡狀態 =====
  if (targetUserId && targetMonth) {
    for (const date of allDatesInMonth) {
      const dayRecords = dailyRecords[targetUserId]?.[date] || [];
      const filteredRows = dayRecords.filter(r => r.note !== "系統虛擬卡");
      
      const punchInRecords = filteredRows.filter(r => r.type === "上班");
      const punchOutRecords = filteredRows.filter(r => r.type === "下班");
      
      const adjustedPunchIn = punchInRecords.find(r => r.note === "補打卡");
      const adjustedPunchOut = punchOutRecords.find(r => r.note === "補打卡");
      
      const hasNormalPunchIn = punchInRecords.some(r => r.note !== "補打卡");
      const hasNormalPunchOut = punchOutRecords.some(r => r.note !== "補打卡");
      const hasApprovedPunchIn = adjustedPunchIn && adjustedPunchIn.audit === "v";
      const hasApprovedPunchOut = adjustedPunchOut && adjustedPunchOut.audit === "v";
      
      const hasPunchIn = hasNormalPunchIn || hasApprovedPunchIn;
      const hasPunchOut = hasNormalPunchOut || hasApprovedPunchOut;
      
      // ⭐⭐⭐ 處理上班卡狀態
      if (adjustedPunchIn && adjustedPunchIn.audit === "?") {
        abnormalIdCounter++;
        abnormalRecords.push({
          date: date,
          reason: "STATUS_REPAIR_PENDING",
          userId: targetUserId,
          id: `abnormal-${abnormalIdCounter}`,
          punchTypes: "補上班審核中"
        });
        Logger.log(`⏳ ${date}: 補上班審核中`);
      } else if (adjustedPunchIn && adjustedPunchIn.audit === "v") {
        abnormalIdCounter++;
        abnormalRecords.push({
          date: date,
          reason: "STATUS_REPAIR_APPROVED",
          userId: targetUserId,
          id: `abnormal-${abnormalIdCounter}`,
          punchTypes: "補上班通過"
        });
        Logger.log(`✅ ${date}: 補上班已通過`);
      } else if (adjustedPunchIn && adjustedPunchIn.audit === "x") {
        abnormalIdCounter++;
        abnormalRecords.push({
          date: date,
          reason: "STATUS_REPAIR_REJECTED",
          userId: targetUserId,
          id: `abnormal-${abnormalIdCounter}`,
          punchTypes: "補上班被拒絕"
        });
        Logger.log(`❌ ${date}: 補上班被拒絕`);
      } else if (!hasPunchIn) {
        abnormalIdCounter++;
        abnormalRecords.push({
          date: date,
          reason: "STATUS_PUNCH_IN_MISSING",
          userId: targetUserId,
          id: `abnormal-${abnormalIdCounter}`
        });
        Logger.log(`📋 ${date}: 缺少上班卡`);
      }
      
      // ⭐⭐⭐ 處理下班卡狀態
      if (adjustedPunchOut && adjustedPunchOut.audit === "?") {
        abnormalIdCounter++;
        abnormalRecords.push({
          date: date,
          reason: "STATUS_REPAIR_PENDING",
          userId: targetUserId,
          id: `abnormal-${abnormalIdCounter}`,
          punchTypes: "補下班審核中"
        });
        Logger.log(`⏳ ${date}: 補下班審核中`);
      } else if (adjustedPunchOut && adjustedPunchOut.audit === "v") {
        abnormalIdCounter++;
        abnormalRecords.push({
          date: date,
          reason: "STATUS_REPAIR_APPROVED",
          userId: targetUserId,
          id: `abnormal-${abnormalIdCounter}`,
          punchTypes: "補下班通過"
        });
        Logger.log(`✅ ${date}: 補下班已通過`);
      } else if (adjustedPunchOut && adjustedPunchOut.audit === "x") {
        abnormalIdCounter++;
        abnormalRecords.push({
          date: date,
          reason: "STATUS_REPAIR_REJECTED",
          userId: targetUserId,
          id: `abnormal-${abnormalIdCounter}`,
          punchTypes: "補下班被拒絕"
        });
        Logger.log(`❌ ${date}: 補下班被拒絕`);
      } else if (!hasPunchOut) {
        abnormalIdCounter++;
        abnormalRecords.push({
          date: date,
          reason: "STATUS_PUNCH_OUT_MISSING",
          userId: targetUserId,
          id: `abnormal-${abnormalIdCounter}`
        });
        Logger.log(`📋 ${date}: 缺少下班卡`);
      }
    }
  }
  
  Logger.log("═══════════════════════════════════════");
  Logger.log(`📋 檢查完成，發現 ${abnormalRecords.length} 筆異常記錄`);
  Logger.log("異常記錄: " + JSON.stringify(abnormalRecords, null, 2));
  Logger.log("═══════════════════════════════════════");
  
  return abnormalRecords;
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
        userId: userId,
        name: userName,
        dept: userDept,
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