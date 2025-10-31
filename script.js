// 使用 CDN 或絕對路徑來載入 JSON 檔案
// 注意：本檔案需要依賴 config.js，請確保它在腳本之前被載入。

let currentLang = localStorage.getItem("lang");
let currentMonthDate = new Date();
let translations = {};
let monthDataCache = {}; // 新增：用於快取月份打卡資料
let isApiCalled = false; // 新增：用於追蹤 API 呼叫狀態，避免重複呼叫
let userId = localStorage.getItem("sessionUserId");
let todayShiftCache = null; // 快取今日排班
let weekShiftCache = null;  // 快取本週排班
// 載入語系檔
async function loadTranslations(lang) {
    try {
        const res = await fetch(`https://eric693.github.io/New_Attendance-System/i18n/${lang}.json`);
        if (!res.ok) {
            throw new Error(`HTTP 錯誤: ${res.status}`);
        }
        translations = await res.json();
        currentLang = lang;
        localStorage.setItem("lang", lang);
        renderTranslations();
    } catch (err) {
        console.error("載入語系失敗:", err);
    }
}

// 翻譯函式
function t(code, params = {}) {
    let text = translations[code] || code;
    
    // 檢查並替換參數中的變數
    for (const key in params) {
        // 在替換之前，先翻譯參數的值
        let paramValue = params[key];
        if (paramValue in translations) {
            paramValue = translations[paramValue];
        }
        
        text = text.replace(`{${key}}`, paramValue);
    }
    return text;
}

// renderTranslations 可接受一個容器參數
function renderTranslations(container = document) {
    // 翻譯網頁標題（只在整頁翻譯時執行）
    if (container === document) {
        document.title = t("APP_TITLE");
    }

    // 處理靜態內容：[data-i18n]
    const elementsToTranslate = container.querySelectorAll('[data-i18n]');
    elementsToTranslate.forEach(element => {
        const key = element.getAttribute('data-i18n');
        const translatedText = t(key);
        
        // 檢查翻譯結果是否為空字串，或是否回傳了原始鍵值
        if (translatedText !== key) {
            if (element.tagName === 'INPUT') {
                element.placeholder = translatedText;
            } else {
                element.textContent = translatedText;
            }
        }
    });

    // ✨ 新增邏輯：處理動態內容的翻譯，使用 [data-i18n-key]
    const dynamicElements = container.querySelectorAll('[data-i18n-key]');
    dynamicElements.forEach(element => {
        const key = element.getAttribute('data-i18n-key');
        if (key) {
             const translatedText = t(key);
             
             // 只有當翻譯結果不是原始鍵值時才進行更新
             if (translatedText !== key) {
                 element.textContent = translatedText;
             }
        }
    });
}

/**
 * 透過 fetch API 呼叫後端 API。
 * @param {string} action - API 的動作名稱。
 * @param {string} [loadingId="loading"] - 顯示 loading 狀態的 DOM 元素 ID。
 * @returns {Promise<object>} - 回傳一個包含 API 回應資料的 Promise。
 */
async function callApifetch(action, loadingId = "loading") {
    const token = localStorage.getItem("sessionToken");
    const url = `${API_CONFIG.apiUrl}?action=${action}&token=${token}`;
    
    // 顯示指定的 loading 元素
    const loadingEl = document.getElementById(loadingId);
    if (loadingEl) loadingEl.style.display = "block";
    
    try {
        // 使用 fetch API 發送請求
        const response = await fetch(url);
        
        // 檢查 HTTP 狀態碼
        if (!response.ok) {
            throw new Error(`HTTP 錯誤: ${response.status}`);
        }
        
        // 解析 JSON 回應
        const data = await response.json();
        return data;
    } catch (error) {
        // 處理網路或其他錯誤
        showNotification(t("CONNECTION_FAILED"), "error");
        console.error("API 呼叫失敗:", error);
        // 拋出錯誤以便外部捕獲
        throw error;
    } finally {
        // 不論成功或失敗，都隱藏 loading 元素
        if (loadingEl) loadingEl.style.display = "none";
    }
}

// ==================== 📊 管理員匯出所有員工報表功能 ====================

/**
 * 管理員匯出所有員工的出勤報表
 * @param {string} monthKey - 月份，格式: "YYYY-MM"
 */
async function exportAllEmployeesReport(monthKey) {
    const exportBtn = document.getElementById('admin-export-all-btn');
    const loadingText = t('EXPORT_LOADING') || '正在準備報表...';
    
    showNotification(loadingText, 'warning');
    
    if (exportBtn) {
        generalButtonState(exportBtn, 'processing', loadingText);
    }
    
    try {
        // 呼叫 API 取得所有員工的出勤資料（不傳 userId）
        const res = await callApifetch(`getAttendanceDetails&month=${monthKey}`);
        
        if (!res.ok || !res.records || res.records.length === 0) {
            showNotification(t('EXPORT_NO_DATA') || '本月沒有出勤記錄', 'warning');
            return;
        }
        
        // 👇 修正：先檢查資料結構
        console.log('API 回傳的資料:', res.records[0]); // 除錯用
        
        // 按員工分組
        const employeeData = {};
        
        res.records.forEach(record => {
            // 👇 修正：確保正確讀取 userId 和 name
            const userId = record.userId || 'unknown';
            const userName = record.name || '未知員工';
            
            if (!employeeData[userId]) {
                employeeData[userId] = {
                    name: userName,
                    records: []
                };
            }
            
            // 找出上班和下班的記錄
            const punchIn = record.record ? record.record.find(r => r.type === '上班') : null;
            const punchOut = record.record ? record.record.find(r => r.type === '下班') : null;
            
            // 計算工時
            let workHours = '-';
            if (punchIn && punchOut) {
                try {
                    const inTime = new Date(`${record.date} ${punchIn.time}`);
                    const outTime = new Date(`${record.date} ${punchOut.time}`);
                    const diffMs = outTime - inTime;
                    const diffHours = (diffMs / (1000 * 60 * 60)).toFixed(2);
                    workHours = diffHours > 0 ? diffHours : '-';
                } catch (e) {
                    console.error('計算工時失敗:', e);
                    workHours = '-';
                }
            }
            
            const statusText = t(record.reason) || record.reason;
            
            const notes = record.record
                ? record.record
                    .filter(r => r.note && r.note !== '系統虛擬卡')
                    .map(r => r.note)
                    .join('; ')
                : '';
            
            employeeData[userId].records.push({
                '日期': record.date,
                '上班時間': punchIn?.time || '-',
                '上班地點': punchIn?.location || '-',
                '下班時間': punchOut?.time || '-',
                '下班地點': punchOut?.location || '-',
                '工作時數': workHours,
                '狀態': statusText,
                '備註': notes || '-'
            });
        });
        
        // 建立工作簿
        const wb = XLSX.utils.book_new();
        
        // 為每位員工建立一個工作表
        for (const userId in employeeData) {
            const employee = employeeData[userId];
            const ws = XLSX.utils.json_to_sheet(employee.records);
            
            const wscols = [
                { wch: 12 },  // 日期
                { wch: 10 },  // 上班時間
                { wch: 20 },  // 上班地點
                { wch: 10 },  // 下班時間
                { wch: 20 },  // 下班地點
                { wch: 10 },  // 工作時數
                { wch: 15 },  // 狀態
                { wch: 30 }   // 備註
            ];
            ws['!cols'] = wscols;
            
            const sheetName = employee.name.substring(0, 31);
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        }
        
        const [year, month] = monthKey.split('-');
        const fileName = `所有員工出勤記錄_${year}年${month}月.xlsx`;
        XLSX.writeFile(wb, fileName);
        
        showNotification(t('EXPORT_SUCCESS') || '報表已成功匯出！', 'success');
        
    } catch (error) {
        console.error('匯出失敗:', error);
        showNotification(t('EXPORT_FAILED') || '匯出失敗，請稍後再試', 'error');
        
    } finally {
        if (exportBtn) {
            generalButtonState(exportBtn, 'idle');
        }
    }
}

// ==================== 📊 管理員匯出功能結束 ====================

// ==================== 📊 匯出出勤報表功能 ====================

/**
 * 匯出指定月份的出勤報表為 Excel 檔案
 * @param {Date} date - 要匯出的月份日期物件
 */
async function exportAttendanceReport(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const userId = localStorage.getItem("sessionUserId");
    
    // 取得匯出按鈕
    const exportBtn = document.getElementById('export-attendance-btn');
    const loadingText = t('EXPORT_LOADING') || '正在準備報表...';
    
    // 顯示載入提示
    showNotification(loadingText, 'warning');
    
    // 按鈕進入處理中狀態
    if (exportBtn) {
        generalButtonState(exportBtn, 'processing', loadingText);
    }
    
    try {
        // 呼叫 API 取得出勤資料
        const res = await callApifetch(`getAttendanceDetails&month=${monthKey}&userId=${userId}`);
        
        if (!res.ok || !res.records || res.records.length === 0) {
            showNotification(t('EXPORT_NO_DATA') || '本月沒有出勤記錄', 'warning');
            return;
        }
        
        // 整理資料為 Excel 格式
        const exportData = [];
        
        res.records.forEach(record => {
            // 找出上班和下班的記錄
            const punchIn = record.record.find(r => r.type === '上班');
            const punchOut = record.record.find(r => r.type === '下班');
            
            // 計算工時
            let workHours = '-';
            if (punchIn && punchOut) {
                try {
                    const inTime = new Date(`${record.date} ${punchIn.time}`);
                    const outTime = new Date(`${record.date} ${punchOut.time}`);
                    const diffMs = outTime - inTime;
                    const diffHours = (diffMs / (1000 * 60 * 60)).toFixed(2);
                    workHours = diffHours > 0 ? diffHours : '-';
                } catch (e) {
                    console.error('計算工時失敗:', e);
                    workHours = '-';
                }
            }
            
            // 翻譯狀態
            const statusText = t(record.reason) || record.reason;
            
            // 處理備註
            const notes = record.record
                .filter(r => r.note && r.note !== '系統虛擬卡')
                .map(r => r.note)
                .join('; ');
            
            exportData.push({
                '日期': record.date,
                '上班時間': punchIn?.time || '-',
                '上班地點': punchIn?.location || '-',
                '下班時間': punchOut?.time || '-',
                '下班地點': punchOut?.location || '-',
                '工作時數': workHours,
                '狀態': statusText,
                '備註': notes || '-'
            });
        });
        
        // 使用 SheetJS 建立 Excel 檔案
        const ws = XLSX.utils.json_to_sheet(exportData);
        
        // 設定欄位寬度
        const wscols = [
            { wch: 12 },  // 日期
            { wch: 10 },  // 上班時間
            { wch: 20 },  // 上班地點
            { wch: 10 },  // 下班時間
            { wch: 20 },  // 下班地點
            { wch: 10 },  // 工作時數
            { wch: 15 },  // 狀態
            { wch: 30 }   // 備註
        ];
        ws['!cols'] = wscols;
        
        // 建立工作簿
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `${month}月出勤記錄`);
        
        // 下載檔案
        const fileName = `出勤記錄_${year}年${month}月.xlsx`;
        XLSX.writeFile(wb, fileName);
        
        showNotification(t('EXPORT_SUCCESS') || '報表已成功匯出！', 'success');
        
    } catch (error) {
        console.error('匯出失敗:', error);
        showNotification(t('EXPORT_FAILED') || '匯出失敗，請稍後再試', 'error');
        
    } finally {
        // 恢復按鈕狀態
        if (exportBtn) {
            generalButtonState(exportBtn, 'idle');
        }
    }
}

// ==================== 📊 匯出功能結束 ====================

/* ===== 共用訊息顯示 ===== */
const showNotification = (message, type = 'success') => {
    const notification = document.getElementById('notification');
    const notificationMessage = document.getElementById('notification-message');
    notificationMessage.textContent = message;
    notification.className = 'notification'; // reset classes
    if (type === 'success') {
        notification.classList.add('bg-green-500', 'text-white');
    } else if (type === 'warning') {
        notification.classList.add('bg-yellow-500', 'text-white');
    } else {
        notification.classList.add('bg-red-500', 'text-white');
    }
    notification.classList.add('show');
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
};

// 確保登入
async function ensureLogin() {
    return new Promise(async (resolve) => {
        if (localStorage.getItem("sessionToken")) {
            document.getElementById("status").textContent = t("CHECKING_LOGIN");
            try {
                const res = await callApifetch("checkSession");
                res.msg = t(res.code);
                if (res.ok) {
                    if(res.user.dept==="管理員")
                    {
                        console.log(res.user.dept);
                        document.getElementById('tab-admin-btn').style.display = 'block';
                    }
                    document.getElementById("user-name").textContent = res.user.name;
                    document.getElementById("profile-img").src = res.user.picture || res.user.rate;
                    
                    localStorage.setItem("sessionUserId", res.user.userId);
                    showNotification(t("LOGIN_SUCCESS"));
                    
                    document.getElementById('login-section').style.display = 'none';
                    document.getElementById('user-header').style.display = 'flex';
                    document.getElementById('main-app').style.display = 'block';
                    
                    // 檢查異常打卡
                    checkAbnormal();
                    resolve(true);
                } else {
                    const errorMsg = t(res.code || "UNKNOWN_ERROR");
                    showNotification(`❌ ${errorMsg}`, "error");
                    document.getElementById("status").textContent = t("PLEASE_RELOGIN");
                    document.getElementById('login-btn').style.display = 'block';
                    document.getElementById('user-header').style.display = 'none';
                    document.getElementById('main-app').style.display = 'none';
                    resolve(false);
                }
            } catch (err) {
                console.error(err);
                document.getElementById('login-btn').style.display = 'block';
                document.getElementById('user-header').style.display = 'none';
                document.getElementById('main-app').style.display = 'none';
                document.getElementById("status").textContent = t("PLEASE_RELOGIN");
                resolve(false);
            }
        } else {
            document.getElementById('login-btn').style.display = 'block';
            document.getElementById('user-header').style.display = 'none';
            document.getElementById('main-app').style.display = 'none';
            document.getElementById("status").textContent = t("SUBTITLE_LOGIN");
            resolve(false);
        }
    });
}

//檢查本月打卡異常
async function checkAbnormal() {
    const now = new Date();
    const month = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
    const userId = localStorage.getItem("sessionUserId");
    
    const recordsLoading = document.getElementById("records-loading");
    recordsLoading.style.display = 'block';
    
    try {
        const res = await callApifetch(`getAbnormalRecords&month=${month}&userId=${userId}`);
        recordsLoading.style.display = 'none';
        if (res.ok) {
            const abnormalRecordsSection = document.getElementById("abnormal-records-section");
            const abnormalList = document.getElementById("abnormal-list");
            const recordsEmpty = document.getElementById("records-empty");
            
            if (res.records.length > 0) {
                abnormalRecordsSection.style.display = 'block';
                recordsEmpty.style.display = 'none';
                abnormalList.innerHTML = '';
                res.records.forEach(record => {
                    const li = document.createElement('li');
                    li.className = 'p-3 bg-gray-50 rounded-lg flex justify-between items-center dark:bg-gray-700';
                    li.innerHTML = `
                        <div>
                            <p class="font-medium text-gray-800 dark:text-white">${record.date}</p>
                    <p class="text-sm text-red-600 dark:text-red-400"
                       data-i18n-dynamic="true"
                       data-i18n-key="${record.reason}">
                       </p>
                        </div>
                    <button data-i18n="ADJUST_BUTTON_TEXT" data-date="${record.date}" data-reason="${record.reason}" 
                            class="adjust-btn text-sm font-semibold 
                                   text-indigo-600 dark:text-indigo-400 
                                   hover:text-indigo-800 dark:hover:text-indigo-300">
                        補打卡
                    </button>
                    `;
                    abnormalList.appendChild(li);
                    renderTranslations(li);
                });
                
            } else {
                abnormalRecordsSection.style.display = 'block';
                recordsEmpty.style.display = 'block';
                abnormalList.innerHTML = '';
            }
        } else {
            console.error("Failed to fetch abnormal records:", res.msg);
            showNotification(t("ERROR_FETCH_RECORDS"), "error");
        }
    } catch (err) {
        console.error(err);
        recordsLoading.style.display = 'none';
    }
}

// 渲染日曆的函式
async function renderCalendar(date) {
    const monthTitle = document.getElementById('month-title');
    const calendarGrid = document.getElementById('calendar-grid');
    const year = date.getFullYear();
    const month = date.getMonth();
    const today = new Date();
    
    // 生成 monthKey
    const monthkey = currentMonthDate.getFullYear() + "-" + String(currentMonthDate.getMonth() + 1).padStart(2, "0");
    
    // 檢查快取中是否已有該月份資料
    if (monthDataCache[monthkey]) {
        // 如果有，直接從快取讀取資料並渲染
        const records = monthDataCache[monthkey];
        renderCalendarWithData(year, month, today, records, calendarGrid, monthTitle);
    } else {
        // 如果沒有，才發送 API 請求
        // 清空日曆，顯示載入狀態，並確保置中
        calendarGrid.innerHTML = '<div data-i18n="LOADING" class="col-span-full text-center text-gray-500 dark:text-gray-400 py-4">正在載入...</div>';
        renderTranslations(calendarGrid);
        try {
            const res = await callApifetch(`getAttendanceDetails&month=${monthkey}&userId=${userId}`);
            if (res.ok) {
                // 將資料存入快取
                monthDataCache[monthkey] = res.records;
                
                // 收到資料後，清空載入訊息
                calendarGrid.innerHTML = '';
                
                // 從快取取得本月資料
                const records = monthDataCache[monthkey] || [];
                renderCalendarWithData(year, month, today, records, calendarGrid, monthTitle);
            } else {
                console.error("Failed to fetch attendance records:", res.msg);
                showNotification(t("ERROR_FETCH_RECORDS"), "error");
            }
        } catch (err) {
            console.error(err);
        }
    }
}

// 新增一個獨立的渲染函式，以便從快取或 API 回應中調用
function renderCalendarWithData(year, month, today, records, calendarGrid, monthTitle) {
    // 確保日曆網格在每次渲染前被清空
    calendarGrid.innerHTML = '';
    monthTitle.textContent = t("MONTH_YEAR_TEMPLATE", {
        year: year,
        month: month+1
    });
    
    // 取得該月第一天是星期幾
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // 填補月初的空白格子
    for (let i = 0; i < firstDayOfMonth; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'day-cell';
        calendarGrid.appendChild(emptyCell);
    }
    
    // 根據資料渲染每一天的顏色
    for (let i = 1; i <= daysInMonth; i++) {
        const dayCell = document.createElement('div');
        const cellDate = new Date(year, month, i);
        dayCell.textContent = i;
        let dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        let dateClass = 'normal-day';
        
        const todayRecords = records.filter(r => r.date === dateKey);
        
        if (todayRecords.length > 0) {
            const reason = todayRecords[0].reason;
            switch (reason) {
                case "STATUS_PUNCH_IN_MISSING":
                    dateClass = 'abnormal-day';
                    break;
                case "STATUS_PUNCH_OUT_MISSING":
                    dateClass = 'abnormal-day';
                    break;
                case "STATUS_PUNCH_NORMAL":
                    dateClass = 'day-off';
                    break;
                case "STATUS_REPAIR_PENDING":
                    dateClass = 'pending-virtual';
                    break;
                case "STATUS_REPAIR_APPROVED":
                    dateClass = 'approved-virtual';
                    break;
                default:
                    if (reason && reason !== "") {
                        dateClass = 'pending-adjustment'; // 假設所有有備註的都算 pending
                    }
                    break;
            }
        }
        
        const isToday = (year === today.getFullYear() && month === today.getMonth() && i === today.getDate());
        if (isToday) {
            dayCell.classList.add('today');
        } else if (cellDate > today) {
            dayCell.classList.add('future-day');
            dayCell.style.pointerEvents = 'none'; // 未來日期不可點擊
        } else {
            dayCell.classList.add(dateClass);
        }
        
        dayCell.classList.add('day-cell');
        dayCell.dataset.date = dateKey;
        dayCell.dataset.records = JSON.stringify(todayRecords); // 儲存當天資料
        calendarGrid.appendChild(dayCell);
    }
}

// 新增：渲染每日紀錄的函式 (修正非同步問題)
async function renderDailyRecords(dateKey) {
    const dailyRecordsCard = document.getElementById('daily-records-card');
    const dailyRecordsTitle = document.getElementById('daily-records-title');
    const dailyRecordsList = document.getElementById('daily-records-list');
    const dailyRecordsEmpty = document.getElementById('daily-records-empty');
    const recordsLoading = document.getElementById("records-loading");
    
    dailyRecordsTitle.textContent = t("DAILY_RECORDS_TITLE", {
        dateKey: dateKey
    });
    
    dailyRecordsList.innerHTML = '';
    dailyRecordsEmpty.style.display = 'none';
    recordsLoading.style.display = 'block';
    
    const dateObject = new Date(dateKey);
    const month = dateObject.getFullYear() + "-" + String(dateObject.getMonth() + 1).padStart(2, "0");
    const userId = localStorage.getItem("sessionUserId");
    
    // 檢查快取
    if (monthDataCache[month]) {
        renderRecords(monthDataCache[month]);
        recordsLoading.style.display = 'none';
    } else {
        // 否則從 API 取得資料
        try {
            const res = await callApifetch(`getAttendanceDetails&month=${month}&userId=${userId}`);
            recordsLoading.style.display = 'none';
            if (res.ok) {
                // 將資料存入快取
                monthDataCache[month] = res.records;
                renderRecords(res.records);
            } else {
                console.error("Failed to fetch attendance records:", res.msg);
                showNotification(t("ERROR_FETCH_RECORDS"), "error");
            }
        } catch (err) {
            console.error(err);
        }
    }
    
    function renderRecords(records) {
        // 從該月份的所有紀錄中，過濾出所選日期的紀錄
        const dailyRecords = records.filter(record =>{
            
            return record.date === dateKey
        });
        if (dailyRecords.length > 0) {
            dailyRecordsEmpty.style.display = 'none';
            dailyRecords.forEach(records => {
                const li = document.createElement('li');
                li.className = 'p-3 bg-gray-50 dark:bg-gray-700 rounded-lg';
                const recordHtml = records.record.map(r => {
                    // 根據 r.type 的值來選擇正確的翻譯鍵值
                    const typeKey = r.type === '上班' ? 'PUNCH_IN' : 'PUNCH_OUT';
                    
                    return `
                        <p class="font-medium text-gray-800 dark:text-white">${r.time} - ${t(typeKey)}</p>
                        <p class="text-sm text-gray-500 dark:text-gray-400">${r.location}</p>
                        <p data-i18n="RECORD_NOTE_PREFIX" class="text-sm text-gray-500 dark:text-gray-400">備註：${r.note}</p>
                    `;
                }).join("");
                
                li.innerHTML = `
    ${recordHtml}
    <p class="text-sm text-gray-500 dark:text-gray-400">
        <span data-i18n="RECORD_REASON_PREFIX">系統判斷：</span>
        
        ${t(records.reason)}
    </p>                `;
                dailyRecordsList.appendChild(li);
                renderTranslations(li);
            });
            
        } else {
            dailyRecordsEmpty.style.display = 'block';
        }
        dailyRecordsCard.style.display = 'block';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const punchInBtn = document.getElementById('punch-in-btn');
    const punchOutBtn = document.getElementById('punch-out-btn');
    const tabDashboardBtn = document.getElementById('tab-dashboard-btn');
    const tabMonthlyBtn = document.getElementById('tab-monthly-btn');
    const tabLocationBtn = document.getElementById('tab-location-btn');
    const tabAdminBtn = document.getElementById('tab-admin-btn');
    const tabOvertimeBtn = document.getElementById('tab-overtime-btn');
    const tabLeaveBtn = document.getElementById('tab-leave-btn');
    const tabSalaryBtn = document.getElementById('tab-salary-btn'); // 👈 新增薪資按鈕
    const abnormalList = document.getElementById('abnormal-list');
    const adjustmentFormContainer = document.getElementById('adjustment-form-container');
    const calendarGrid = document.getElementById('calendar-grid');
    // 取得當前位置按鈕事件
    const getLocationBtn = document.getElementById('get-location-btn');
    const locationLatInput = document.getElementById('location-lat');
    const locationLngInput = document.getElementById('location-lng');
    const addLocationBtn = document.getElementById('add-location-btn');
    
    let pendingRequests = []; // 新增：用於快取待審核的請求
    
    // 全域變數，用於儲存地圖實例
    let mapInstance = null;
    let mapLoadingText = null;
    let currentCoords = null;
    let marker = null;
    let circle = null;
    /**
     * 從後端取得所有打卡地點，並將它們顯示在地圖上。
     */
    // 全域變數，用於儲存地點標記和圓形
    let locationMarkers = L.layerGroup();
    let locationCircles = L.layerGroup();
    
    /**
     * 取得並渲染所有待審核的請求。
     */
    async function fetchAndRenderReviewRequests() {
        const loadingEl = document.getElementById('requests-loading');
        const emptyEl = document.getElementById('requests-empty');
        const listEl = document.getElementById('pending-requests-list');
        
        loadingEl.style.display = 'block';
        emptyEl.style.display = 'none';
        listEl.innerHTML = '';
        
        try {
            const res = await callApifetch("getReviewRequest");
            
            if (res.ok && Array.isArray(res.reviewRequest)) {
                pendingRequests = res.reviewRequest; // 快取所有請求
                
                if (pendingRequests.length === 0) {
                    emptyEl.style.display = 'block';
                } else {
                    renderReviewRequests(pendingRequests);
                }
            } else {
                showNotification("取得待審核請求失敗：" + res.msg, "error");
                emptyEl.style.display = 'block';
            }
        } catch (error) {
            showNotification("取得待審核請求失敗，請檢查網路。", "error");
            emptyEl.style.display = 'block';
            console.error("Failed to fetch review requests:", error);
        } finally {
            loadingEl.style.display = 'none';
        }
    }
    
    /**
     * 根據資料渲染待審核列表。
     * @param {Array<Object>} requests - 請求資料陣列。
     */
    function renderReviewRequests(requests) {
        const listEl = document.getElementById('pending-requests-list');
        listEl.innerHTML = '';
        
        requests.forEach((req, index) => {
            const li = document.createElement('li');
            li.className = 'p-4 bg-gray-50 rounded-lg shadow-sm flex flex-col space-y-2 dark:bg-gray-700';
            li.innerHTML = `
             <div class="flex flex-col space-y-1">

                        <div class="flex items-center justify-between w-full">
                            <p class="text-sm font-semibold text-gray-800 dark:text-white">${req.name} - ${req.remark}</p>
                            <span class="text-xs text-gray-500 dark:text-gray-400">${req.applicationPeriod}</span>
                        </div>
                    </div>
                    
                <div class="flex items-center justify-between w-full mt-2">
                    <p 
                        data-i18n-key="${req.type}" 
                        class="text-sm text-indigo-600 dark:text-indigo-400 font-medium">
                    </p> 
                    
                    <div class="flex space-x-2"> 
                        <button data-i18n="ADMIN_APPROVE_BUTTON" data-index="${index}" class="approve-btn px-3 py-1 rounded-md text-sm font-bold btn-primary">核准</button>
                        <button data-i18n="ADMIN_REJECT_BUTTON" data-index="${index}" class="reject-btn px-3 py-1 rounded-md text-sm font-bold btn-warning">拒絕</button>
                    </div>
                </div>
            `;
            listEl.appendChild(li);
            renderTranslations(li);
        });
        
        listEl.querySelectorAll('.approve-btn').forEach(button => {
            button.addEventListener('click', (e) => handleReviewAction(e.currentTarget, e.currentTarget.dataset.index, 'approve'));
        });
        
        listEl.querySelectorAll('.reject-btn').forEach(button => {
            button.addEventListener('click', (e) => handleReviewAction(e.currentTarget, e.currentTarget.dataset.index, 'reject'));
        });
    }
    
    /**
     * 處理審核動作（核准或拒絕）。
     * @param {HTMLElement} button - 被點擊的按鈕元素。
     * @param {number} index - 請求在陣列中的索引。
     * @param {string} action - 'approve' 或 'reject'。
     */
    async function handleReviewAction(button, index, action) {
        const request = pendingRequests[index];
        if (!request) {
            showNotification("找不到請求資料。", "error");
            return;
        }

        const recordId = request.id;
        const endpoint = action === 'approve' ? 'approveReview' : 'rejectReview';
        const loadingText = t('LOADING') || '處理中...';
        
        // A. 進入處理中狀態
        generalButtonState(button, 'processing', loadingText);
        
        try {
            const res = await callApifetch(`${endpoint}&id=${recordId}`);
            
            if (res.ok) {
                const translationKey = action === 'approve' ? 'REQUEST_APPROVED' : 'REQUEST_REJECTED';
                showNotification(t(translationKey), "success");
                
                // 由於成功後列表會被重新整理，這裡可以不立即恢復按鈕狀態
                // 但是為了保險起見，我們仍然在 finally 中恢復。
                
                // 延遲執行，讓按鈕的禁用狀態能被看到
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // 列表重新整理會渲染新按鈕，覆蓋舊的按鈕
                fetchAndRenderReviewRequests();
            } else {
                showNotification(t('REVIEW_FAILED', { msg: res.msg }), "error");
            }
            
        } catch (err) {
            showNotification(t("REVIEW_NETWORK_ERROR"), "error");
            console.error(err);
            
        } finally {
            // B. 無論成功或失敗，都需要將按鈕恢復到可點擊狀態
            // 只有在列表沒有被重新整理時，這個恢復才有意義
            generalButtonState(button, 'idle');
        }
    }
    /**
     * 從後端取得所有打卡地點，並將它們顯示在地圖上。
     */
    async function fetchAndRenderLocationsOnMap() {
        try {
            const res = await callApifetch("getLocations");
            
            // 清除舊的地點標記和圓形
            locationMarkers.clearLayers();
            locationCircles.clearLayers();
            
            if (res.ok && Array.isArray(res.locations)) {
                // 遍歷所有地點並在地圖上放置標記和圓形
                res.locations.forEach(loc => {
                    // 如果沒有容許誤差，則預設為 50 公尺
                    const punchInRadius = loc.scope || 50;
                    
                    // 加入圓形範圍
                    const locationCircle = L.circle([loc.lat, loc.lng], {
                        color: 'red',
                        fillColor: '#f03',
                        fillOpacity: 0.2,
                        radius: punchInRadius
                    });
                    locationCircle.bindPopup(`<b>${loc.name}</b><br>可打卡範圍：${punchInRadius}公尺`);
                    locationCircles.addLayer(locationCircle);
                });
                
                // 將所有地點標記和圓形一次性加到地圖上
                locationMarkers.addTo(mapInstance);
                locationCircles.addTo(mapInstance);
                
                console.log("地點標記和範圍已成功載入地圖。");
            } else {
                showNotification("取得地點清單失敗：" + res.msg, "error");
                console.error("Failed to fetch locations:", res.msg);
            }
        } catch (error) {
            showNotification("取得地點清單失敗，請檢查網路。", "error");
            console.error("Failed to fetch locations:", error);
        }
    }
    // 初始化地圖並取得使用者位置
    function initLocationMap(forceReload = false){
        const mapContainer = document.getElementById('map-container');
        const statusEl = document.getElementById('location-status');
        const coordsEl = document.getElementById('location-coords');
        console.log(mapInstance && !forceReload);
        // 取得載入文字元素
        if (!mapLoadingText) {
            mapLoadingText = document.getElementById('map-loading-text');
        }
        // 檢查地圖實例是否已存在
        if (mapInstance) {
            // 如果已經存在，並且沒有被要求強制重新載入，則直接返回
            if (!forceReload) {
                mapInstance.invalidateSize();
                return;
            }
            
            // 如果被要求強制重新載入，則先徹底銷毀舊的地圖實例
            mapInstance.remove();
            mapInstance = null;
        }
        
        
        // 顯示載入中的文字
        mapLoadingText.style.display = 'block'; // 或 'block'，根據你的樣式決定
        
        // 建立地圖
        mapInstance = L.map('map-container', {
            center: [25.0330, 121.5654], // 預設中心點為台北市
            zoom: 13
        });
        
        // 加入 OpenStreetMap 圖層
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(mapInstance);
        
        // 讓地圖在完成載入後隱藏載入中的文字
        mapInstance.whenReady(() => {
            mapLoadingText.style.display = 'none';
            // 確保地圖的尺寸正確
            mapInstance.invalidateSize();
        });
        
        // 顯示載入狀態
        //mapContainer.innerHTML = t("MAP_LOADING");
        statusEl.textContent = t('DETECTING_LOCATION');
        coordsEl.textContent = t('UNKNOWN_LOCATION');
        
        // 取得使用者地理位置
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                                                     (position) => {
                                                         const { latitude, longitude } = position.coords;
                                                         currentCoords = [latitude, longitude];
                                                         
                                                         // 更新狀態顯示
                                                         statusEl.textContent = t('DETECTION_SUCCESS');
                                                         coordsEl.textContent = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
                                                         
                                                         // 設定地圖視圖
                                                         mapInstance.setView(currentCoords, 18);
                                                         
                                                         // 在地圖上放置標記
                                                         if (marker) mapInstance.removeLayer(marker);
                                                         marker = L.marker(currentCoords).addTo(mapInstance)
                                                         .bindPopup(t('CURRENT_LOCATION'))
                                                         .openPopup();
                                                         
                                                         
                                                     },
                                                     (error) => {
                                                         // 處理定位失敗
                                                         statusEl.textContent = t('ERROR_GEOLOCATION_PERMISSION_DENIED');
                                                         console.error("Geolocation failed:", error);
                                                         
                                                         let message;
                                                         switch(error.code) {
                                                             case error.PERMISSION_DENIED:
                                                                 message = t('ERROR_GEOLOCATION_PERMISSION_DENIED');
                                                                 break;
                                                             case error.POSITION_UNAVAILABLE:
                                                                 message = t('ERROR_GEOLOCATION_UNAVAILABLE');
                                                                 break;
                                                             case error.TIMEOUT:
                                                                 message = t('ERROR_GEOLOCATION_TIMEOUT');
                                                                 break;
                                                             case error.UNKNOWN_ERROR:
                                                                 message = t('ERROR_GEOLOCATION_UNKNOWN');
                                                                 break;
                                                         }
                                                         showNotification(`定位失敗：${message}`, "error");
                                                     }
                                                     );
            // 成功取得使用者位置後，載入所有打卡地點
            fetchAndRenderLocationsOnMap();
        } else {
            showNotification(t('ERROR_BROWSER_NOT_SUPPORTED'), "error");
            statusEl.textContent = '不支援定位';
        }
    }
    
    
    // 處理 API 測試按鈕事件
    document.getElementById('test-api-btn').addEventListener('click', async () => {
        // 這裡替換成您想要測試的 API action 名稱
        const testAction = "testEndpoint";
        
        try {
            // 使用 await 等待 API 呼叫完成並取得回應
            const res = await callApifetch(testAction);
            
            // 檢查 API 回應中的 'ok' 屬性
            if (res && res.ok) {
                showNotification("API 測試成功！回應：" + JSON.stringify(res), "success");
            } else {
                // 如果 res.ok 為 false，表示後端處理失敗
                showNotification("API 測試失敗：" + (res ? res.msg : "無回應資料"), "error");
            }
        } catch (error) {
            // 捕捉任何在 callApifetch 函式中拋出的錯誤（例如網路連線問題）
            console.error("API 呼叫發生錯誤:", error);
            showNotification("API 呼叫失敗，請檢查網路連線或後端服務。", "error");
        }
    });
    
    getLocationBtn.addEventListener('click', () => {
        if (!navigator.geolocation) {
            showNotification(t("ERROR_GEOLOCATION", { msg: t('ERROR_BROWSER_NOT_SUPPORTED') }), "error");
            return;
        }
        
        getLocationBtn.textContent = '取得中...';
        getLocationBtn.disabled = true;
        
        navigator.geolocation.getCurrentPosition((pos) => {
            locationLatInput.value = pos.coords.latitude;
            locationLngInput.value = pos.coords.longitude;
            getLocationBtn.textContent = '已取得';
            addLocationBtn.disabled = false;
            showNotification("位置已成功取得！", "success");
        }, (err) => {
            showNotification(t("ERROR_GEOLOCATION", { msg: err.message }), "error");
            getLocationBtn.textContent = '取得當前位置';
            getLocationBtn.disabled = false;
        });
    });
    // 處理新增打卡地點
    document.getElementById('add-location-btn').addEventListener('click', async () => {
        const name = document.getElementById('location-name').value;
        const lat = document.getElementById('location-lat').value;
        const lng = document.getElementById('location-lng').value;
        
        if (!name || !lat || !lng) {
            showNotification("請填寫所有欄位並取得位置", "error");
            return;
        }
        
        try {
            const res = await callApifetch(`addLocation&name=${encodeURIComponent(name)}&lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`);
            if (res.ok) {
                showNotification("地點新增成功！", "success");
                // 清空輸入欄位
                document.getElementById('location-name').value = '';
                document.getElementById('location-lat').value = '';
                document.getElementById('location-lng').value = '';
                // 重設按鈕狀態
                getLocationBtn.textContent = '取得當前位置';
                getLocationBtn.disabled = false;
                addLocationBtn.disabled = true;
            } else {
                showNotification("新增地點失敗：" + res.msg, "error");
            }
        } catch (err) {
            console.error(err);
        }
    });
    // UI切換邏輯
    const switchTab = (tabId) => {
        // 修改這一行，加入 'shift-view'
        const tabs = ['dashboard-view', 'monthly-view', 'location-view', 'shift-view', 'admin-view', 'overtime-view', 'leave-view', 'salary-view'];
        // 修改這一行，加入 'tab-shift-btn'
        const btns = ['tab-dashboard-btn', 'tab-monthly-btn', 'tab-location-btn', 'tab-shift-btn', 'tab-admin-btn', 'tab-overtime-btn', 'tab-leave-btn', 'tab-salary-btn'];
        // 1. 移除舊的 active 類別和 CSS 屬性
        tabs.forEach(id => {
            const tabElement = document.getElementById(id);
            if (tabElement) {
                tabElement.style.display = 'none';
                tabElement.classList.remove('active');
            }
        });
        
        // 2. 移除按鈕的選中狀態
        btns.forEach(id => {
            const btnElement = document.getElementById(id);
            if (btnElement) {
                btnElement.classList.replace('bg-indigo-600', 'bg-gray-200');
                btnElement.classList.replace('text-white', 'text-gray-600');
                btnElement.classList.add('dark:text-gray-300', 'dark:bg-gray-700');
            }
        });
        
        // 3. 顯示新頁籤並新增 active 類別
        const newTabElement = document.getElementById(tabId);
        if (newTabElement) {
            newTabElement.style.display = 'block';
            newTabElement.classList.add('active');
        }
        
        // 4. 設定新頁籤按鈕的選中狀態
        const newBtnElement = document.getElementById(`tab-${tabId.replace('-view', '-btn')}`);
        if (newBtnElement) {
            newBtnElement.classList.replace('bg-gray-200', 'bg-indigo-600');
            newBtnElement.classList.replace('text-gray-600', 'text-white');
            newBtnElement.classList.remove('dark:text-gray-300', 'dark:bg-gray-700');
            newBtnElement.classList.add('dark:bg-indigo-500');
        }
        
        // 5. 根據頁籤 ID 執行特定動作
        if (tabId === 'monthly-view') {
            renderCalendar(currentMonthDate);
        } else if (tabId === 'location-view') {
            initLocationMap();
        } else if (tabId === 'shift-view') {
            initShiftTab();
        } else if (tabId === 'admin-view') {
            fetchAndRenderReviewRequests();
        } else if (tabId === 'overtime-view') {
            // 加班頁面初始化
            initOvertimeTab();
        } else if (tabId === 'leave-view') {
            // 請假頁面初始化
            initLeaveTab();
        } else if (tabId === 'salary-view') {
            // 薪資頁面初始化 (未來可加入)
            console.log('切換到薪資頁面');
        }
    };
    
    // 語系初始化
    let currentLang = localStorage.getItem("lang"); // 先從 localStorage 讀取上次的設定
    
    // 如果 localStorage 沒有紀錄，才根據瀏覽器設定判斷
    if (!currentLang) {
        const browserLang = navigator.language || navigator.userLanguage;
        if (browserLang.startsWith("zh")) {
            currentLang = "zh-TW";
        } else if (browserLang.startsWith("ja")) {
            currentLang = "ja"; // 建議使用 ja.json，所以這裡可以只用 'ja'
        } else if (browserLang.startsWith("vi")) {
            currentLang = "vi";
        } else if (browserLang.startsWith("id")) {
            currentLang = "id";
        } else if (browserLang.startsWith("ko")) {
            currentLang = "ko";
        } else {
            currentLang = "en-US";
        }
    }
    // 在這裡設定語言切換器的值
    document.getElementById('language-switcher').value = currentLang;
    // 將最終確定的語言存入 localStorage 並載入翻譯
    localStorage.setItem("lang", currentLang);
    await loadTranslations(currentLang);
    
    
    
    const params = new URLSearchParams(window.location.search);
    const otoken = params.get('code');
    
    if (otoken) {
        try {
            const res = await callApifetch(`getProfile&otoken=${otoken}`);
            if (res.ok && res.sToken) {
                localStorage.setItem("sessionToken", res.sToken);
                history.replaceState({}, '', window.location.pathname);
                ensureLogin();
            } else {
                showNotification(t("ERROR_LOGIN_FAILED", { msg: res.msg || t("UNKNOWN_ERROR") }), "error");
                loginBtn.style.display = 'block';
            }
        } catch (err) {
            console.error(err);
            loginBtn.style.display = 'block';
        }
    } else {
        ensureLogin();
    }
    
    // 綁定按鈕事件
    loginBtn.onclick = async () => {
        const res = await callApifetch("getLoginUrl");
        if (res.url) window.location.href = res.url;
    };
    
    logoutBtn.onclick = () => {
        localStorage.removeItem("sessionToken");
        window.location.href = "/New_Attendance-System"
    };
    
    /* ===== 打卡功能 ===== */
    function punchButtonState(buttonId, state) {
        const button = document.getElementById(buttonId);
        if (!button) return;
        
        if (state === 'processing') {
            button.disabled = true;
            button.textContent = t('LOADING');
        } else {
            button.disabled = false;
            if (buttonId === 'punch-in-btn') {
                button.textContent = t('PUNCH_IN_LABEL');
            } else if (buttonId === 'punch-out-btn') {
                button.textContent = t('PUNCH_OUT_LABEL');
            }
        }
    }
    function generalButtonState(button, state, loadingText = '處理中...') {
        if (!button) return;
        const loadingClasses = 'opacity-50 cursor-not-allowed';

        if (state === 'processing') {
            // --- 進入處理中狀態 ---
            
            // 1. 儲存原始文本 (用於恢復)
            button.dataset.originalText = button.textContent;
            
            // 2. 儲存原始類別 (用於恢復樣式)
            // 這是為了在恢復時移除我們為了禁用而添加的類別
            button.dataset.loadingClasses = 'opacity-50 cursor-not-allowed';

            // 3. 禁用並設置處理中文字
            button.disabled = true;
            button.textContent = loadingText; // 使用傳入的 loadingText
            
            // 4. 添加視覺反饋 (禁用時的樣式)
            button.classList.add(...loadingClasses.split(' '));
            
            // 可選：移除 hover 效果，防止滑鼠移動時顏色變化
            // 假設您的按鈕有 hover:opacity-100 之類的類別，這裡需要調整
            
        } else {
            // --- 恢復到原始狀態 ---
            
            // 1. 移除視覺反饋
            if (button.dataset.loadingClasses) {
                button.classList.remove(...button.dataset.loadingClasses.split(' '));
            }

            // 2. 恢復禁用狀態
            button.disabled = false;
            
            // 3. 恢復原始文本
            if (button.dataset.originalText) {
                button.textContent = button.dataset.originalText;
                delete button.dataset.originalText; // 清除儲存，讓它在下一次點擊時再次儲存
            }
        }
    }

        /**
     * 輔助函數：計算時間差（分鐘）
     * @param {string} time1 - 時間 1，格式 "HH:MM"
     * @param {string} time2 - 時間 2，格式 "HH:MM"
     * @returns {number} - 時間差（分鐘），正數表示 time1 晚於 time2
     */
    function getTimeDifference(time1, time2) {
        const [h1, m1] = time1.split(':').map(Number);
        const [h2, m2] = time2.split(':').map(Number);
        
        const minutes1 = h1 * 60 + m1;
        const minutes2 = h2 * 60 + m2;
        
        return minutes1 - minutes2;
    }

    /**
     * 清除排班快取
     * 在打卡成功或排班有更新時呼叫
     */
    function clearShiftCache() {
        todayShiftCache = null;
        weekShiftCache = null;
    }
    async function doPunch(type) {
        const punchButtonId = type === '上班' ? 'punch-in-btn' : 'punch-out-btn';
        
        // 獲取按鈕元素
        const button = document.getElementById(punchButtonId);
        const loadingText = t('LOADING') || '處理中...';
    
        // 檢查按鈕是否存在，若不存在則直接返回
        if (!button) return;
    
        // A. 進入處理中狀態
        generalButtonState(button, 'processing', loadingText);
        
        // ==================== 新增：上班打卡前檢查排班 ====================
        if (type === '上班') {
            try {
                const userId = localStorage.getItem('sessionUserId');
                const today = new Date().toISOString().split('T')[0];
                
                // 呼叫排班 API
                const shiftRes = await callApifetch(`getEmployeeShiftForDate&employeeId=${userId}&date=${today}`);
                
                if (shiftRes.ok && shiftRes.hasShift) {
                    const shift = shiftRes.data;
                    
                    // 顯示排班資訊提示
                    showNotification(
                        t('SHIFT_INFO_NOTIFICATION', {
                            shiftType: shift.shiftType,
                            startTime: shift.startTime,
                            endTime: shift.endTime
                        }) || `今日排班：${shift.shiftType} (${shift.startTime}-${shift.endTime})`,
                        'info'
                    );
                    
                    // 可選：檢查打卡時間是否合理
                    const now = new Date();
                    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
                    
                    if (shift.startTime) {
                        const timeDiff = getTimeDifference(currentTime, shift.startTime);
                        
                        // 如果提前超過 30 分鐘打卡，給予提醒
                        if (timeDiff < -30) {
                            showNotification(
                                t('EARLY_PUNCH_WARNING') || `注意：您的排班時間是 ${shift.startTime}，目前提前超過 30 分鐘打卡。`,
                                'warning'
                            );
                        }
                        // 如果遲到超過 30 分鐘，給予提醒
                        else if (timeDiff > 30) {
                            showNotification(
                                t('LATE_PUNCH_WARNING') || `注意：您的排班時間是 ${shift.startTime}，目前已遲到超過 30 分鐘。`,
                                'warning'
                            );
                        }
                    }
                } else {
                    // 今日沒有排班，可選擇是否提醒
                    // showNotification(t('NO_SHIFT_TODAY') || '今日無排班記錄', 'info');
                }
            } catch (error) {
                console.error('檢查排班失敗:', error);
                // 排班檢查失敗不影響打卡流程，繼續執行
            }
        }
        // ==================== 排班檢查結束 ====================
        
        // 檢查瀏覽器是否支援定位
        if (!navigator.geolocation) {
            showNotification(t("ERROR_GEOLOCATION", { msg: "您的瀏覽器不支援地理位置功能。" }), "error");
            
            // B. 退出點 1: 不支援定位，恢復按鈕狀態
            generalButtonState(button, 'idle');
            return;
        }
        
        // C. 處理地理位置的異步回呼
        navigator.geolocation.getCurrentPosition(async (pos) => {
            // --- 定位成功：執行 API 請求 ---
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const action = `punch&type=${encodeURIComponent(type)}&lat=${lat}&lng=${lng}&note=${encodeURIComponent(navigator.userAgent)}`;
            
            try {
                const res = await callApifetch(action);
                const msg = t(res.code || "UNKNOWN_ERROR", res.params || {});
                showNotification(msg, res.ok ? "success" : "error");
                
                // 打卡成功後，清除排班快取（以便下次載入最新資料）
                if (res.ok && type === '上班') {
                    clearShiftCache();
                }
                
                // D. 退出點 2: API 成功，恢復按鈕狀態
                generalButtonState(button, 'idle');
            } catch (err) {
                console.error(err);
                
                // E. 退出點 3: API 失敗，恢復按鈕狀態
                generalButtonState(button, 'idle');
            }
            
        }, (err) => {
            // --- 定位失敗：處理權限錯誤等 ---
            showNotification(t("ERROR_GEOLOCATION", { msg: err.message }), "error");
            
            // F. 退出點 4: 定位回呼失敗，恢復按鈕狀態
            generalButtonState(button, 'idle');
        });
    }
    
    punchInBtn.addEventListener('click', () => doPunch("上班"));
    punchOutBtn.addEventListener('click', () => doPunch("下班"));

    // 處理補打卡表單
    abnormalList.addEventListener('click', (e) => {
        if (e.target.classList.contains('adjust-btn')) {
            const date = e.target.dataset.date;
            const reason = e.target.dataset.reason;
            const formHtml = `
                <div class="p-4 border-t border-gray-200 dark:border-gray-600 fade-in ">
                    <p data-i18n="ADJUST_BUTTON_TEXT" class="font-semibold mb-2 dark:text-white">補打卡：<span class="text-indigo-600 dark:text-indigo-400">${date}</span></p>
                    <div class="form-group mb-3">
                        <label for="adjustDateTime" data-i18n="SELECT_DATETIME_LABEL" class="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">選擇日期與時間：</label>
            <input id="adjustDateTime" 
                   type="datetime-local" 
                   class="w-full p-2 
                          border border-gray-300 dark:border-gray-600 
                          rounded-md shadow-sm 
                          dark:bg-gray-700 dark:text-white
                          focus:ring-indigo-500 focus:border-indigo-500">
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button data-type="in" data-i18n="BTN_ADJUST_IN" class="submit-adjust-btn w-full py-2 px-4 rounded-lg font-bold btn-secondary">補上班卡</button>
                        <button data-type="out" data-i18n="BTN_ADJUST_OUT" class="submit-adjust-btn w-full py-2 px-4 rounded-lg font-bold btn-secondary">補下班卡</button>
                    </div>
                </div>
            `;
            adjustmentFormContainer.innerHTML = formHtml;
            renderTranslations(adjustmentFormContainer);
            const adjustDateTimeInput = document.getElementById("adjustDateTime");
            let defaultTime = "09:00"; // 預設為上班時間
            if (reason.includes("下班")) {
                defaultTime = "18:00";
            }
            adjustDateTimeInput.value = `${date}T${defaultTime}`;
        }
    });
    
    function validateAdjustTime(value) {
        const selected = new Date(value);
        const now = new Date();
        const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (selected < monthStart) {
            showNotification(t("ERR_BEFORE_MONTH_START"), "error");
            return false;
        }
        // 不允許選今天以後
        if (selected > today) {
            showNotification(t("ERR_AFTER_TODAY"), "error");
            return false;
        }
        return true;
    }
    
    adjustmentFormContainer.addEventListener('click', async (e) => {
        
        // 修正 1：在這裡使用 e.target.closest() 來尋找按鈕
        const button = e.target.closest('.submit-adjust-btn'); // 確保 selector 前面有 '.'

        // 只有在點擊到按鈕時才繼續執行
        if (button) {
            const  loadingText = t('LOADING') || '處理中...';

            const datetime = document.getElementById("adjustDateTime").value;
            const type = button.dataset.type; // 應該從找到的 button 元素上讀取 data-type

            if (!datetime) {
                showNotification("請選擇補打卡日期時間", "error");
                return;
            }
            if (!validateAdjustTime(datetime)) return;

            // 步驟 A: 進入處理中狀態
            generalButtonState(button, 'processing', loadingText);
            
            // ------------------ API 邏輯 ------------------
            const dateObj = new Date(datetime);
            const lat = 0;
            const lng = 0;
            const action = `adjustPunch&type=${type === 'in' ? "上班" : "下班"}&lat=${lat}&lng=${lng}&datetime=${dateObj.toISOString()}&note=${encodeURIComponent(navigator.userAgent)}`;
            
            try {
                const res = await callApifetch(action, "loadingMsg");
                const msg = t(res.code || "UNKNOWN_ERROR", res.params || {});
                showNotification(msg, res.ok ? "success" : "error");

                if (res.ok) {
                    adjustmentFormContainer.innerHTML = '';
                    checkAbnormal(); // 補打卡成功後，重新檢查異常紀錄
                }

            } catch (err) {
                console.error(err);
                showNotification(t('NETWORK_ERROR') || '網絡錯誤', 'error');
                
            } finally {
                // 修正 3：操作完成後，必須在 finally 區塊恢復按鈕狀態
                // **只有在沒有成功清空表單時才恢復按鈕**
                // 因為成功時您已經清空了 adjustmentFormContainer.innerHTML = '';
                // 如果成功時，按鈕已經消失，則不需要復原。
                
                // 判斷：如果容器沒有清空 (即請求失敗或有錯誤)，則恢復按鈕。
                if (adjustmentFormContainer.innerHTML !== '') {
                    generalButtonState(button, 'idle');
                }
            }
        }
    });
    

    // 頁面切換事件
    const tabShiftBtn = document.getElementById('tab-shift-btn');

    // 在現有的分頁按鈕事件後面加入：
    tabShiftBtn.addEventListener('click', () => {switchTab('shift-view');});


    
    tabDashboardBtn.addEventListener('click', () => switchTab('dashboard-view'));
    
    tabLocationBtn.addEventListener('click', () => switchTab('location-view'));
    tabMonthlyBtn.addEventListener('click', () => switchTab('monthly-view'));
    tabOvertimeBtn.addEventListener('click', () => {
        switchTab('overtime-view');
        initOvertimeTab();
    });

    // 👈 新增請假按鈕事件
    tabLeaveBtn.addEventListener('click', () => {
        switchTab('leave-view');
        initLeaveTab();
    });

    // 薪資按鈕 (新增)
    tabSalaryBtn.addEventListener('click', () => {
        switchTab('salary-view');
        initSalaryTab(); // 載入 salary.js 的初始化函數
    });
    tabAdminBtn.addEventListener('click', async () => {
        // 獲取按鈕元素和處理中文字
        const button = tabAdminBtn;
        const loadingText = t('CHECKING') || '檢查中...';

        // A. 進入處理中狀態
        generalButtonState(button, 'processing', loadingText);
        
        try {
            // 呼叫 API 檢查 Session 和權限
            const res = await callApifetch("checkSession");
            
            // 檢查回傳的結果和權限
            if (res.ok && res.user && res.user.dept === "管理員") {
                // 如果 Session 有效且是管理員，執行頁籤切換
                switchTab('admin-view');
            } else {
                // 如果權限不足或 Session 無效，給予錯誤提示
                alert(t('ADMIN_ACCESS_DENIED') || '無權限進入管理後台');
            }
        } catch (error) {
            console.error('檢查 Session 失敗:', error);
            alert(t('ERROR_CHECK_SESSION') || '檢查權限時發生錯誤');
        } finally {
            // B. 恢復按鈕狀態
            generalButtonState(button, 'idle');
        }
    });
    // 月曆按鈕事件
    document.getElementById('prev-month').addEventListener('click', () => {
        currentMonthDate.setMonth(currentMonthDate.getMonth() - 1);
        renderCalendar(currentMonthDate);
    });
    
    document.getElementById('next-month').addEventListener('click', () => {
        currentMonthDate.setMonth(currentMonthDate.getMonth() + 1);
        renderCalendar(currentMonthDate);
    });

    const exportAttendanceBtn = document.getElementById('export-attendance-btn');
    if (exportAttendanceBtn) {
        exportAttendanceBtn.addEventListener('click', () => {
            exportAttendanceReport(currentMonthDate);
        });
    }

    const adminExportAllBtn = document.getElementById('admin-export-all-btn');
    const adminExportMonthInput = document.getElementById('admin-export-month');

    if (adminExportAllBtn && adminExportMonthInput) {
        // 設定預設月份為當月
        const now = new Date();
        const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        adminExportMonthInput.value = defaultMonth;
        
        // 綁定按鈕點擊事件
        adminExportAllBtn.addEventListener('click', () => {
            const selectedMonth = adminExportMonthInput.value;
            
            if (!selectedMonth) {
                showNotification('請選擇要匯出的月份', 'error');
                return;
            }
            
            exportAllEmployeesReport(selectedMonth);
        });
    }
    // 語系切換事件
    document.getElementById('language-switcher').addEventListener('change', (e) => {
        const newLang = e.target.value;
        loadTranslations(newLang);
        // 取得當前顯示的標籤頁ID
        const currentTab = document.querySelector('.active');
        const currentTabId = currentTab ? currentTab.id : null;
        console.log(currentTabId);
        // 如果當前頁面是「地圖」頁籤，則重新載入地圖
        if (currentTabId === 'location-view') {
            initLocationMap(true); // 重新載入地圖
        }
    });
    // 點擊日曆日期的事件監聽器
    calendarGrid.addEventListener('click', (e) => {
        if (e.target.classList.contains('day-cell') && e.target.dataset.date) {
            const date = e.target.dataset.date;
            renderDailyRecords(date);
        }
    });
});

/**
 * 初始化排班分頁
 */
function initShiftTab() {
    loadTodayShift();
    loadWeekShift();
}

/**
 * 載入今日排班
 */
async function loadTodayShift() {
    const loadingEl = document.getElementById('today-shift-loading');
    const emptyEl = document.getElementById('today-shift-empty');
    const infoEl = document.getElementById('today-shift-info');
    
    // 如果有快取，直接使用
    if (todayShiftCache !== null) {
        displayTodayShift(todayShiftCache);
        return;
    }
    
    try {
        loadingEl.style.display = 'block';
        emptyEl.style.display = 'none';
        infoEl.style.display = 'none';
        
        const userId = localStorage.getItem('sessionUserId');
        const today = new Date().toISOString().split('T')[0];
        
        const res = await callApifetch(`getEmployeeShiftForDate&employeeId=${userId}&date=${today}`);
        
        loadingEl.style.display = 'none';
        
        // 快取結果
        todayShiftCache = res;
        displayTodayShift(res);
        
    } catch (error) {
        console.error('載入今日排班失敗:', error);
        loadingEl.style.display = 'none';
        emptyEl.style.display = 'block';
    }
}

/**
 * 顯示今日排班
 */
function displayTodayShift(res) {
    const emptyEl = document.getElementById('today-shift-empty');
    const infoEl = document.getElementById('today-shift-info');
    
    if (res.ok && res.hasShift) {
        document.getElementById('shift-type').textContent = res.data.shiftType;
        document.getElementById('shift-time').textContent = 
            `${res.data.startTime} - ${res.data.endTime}`;
        document.getElementById('shift-location').textContent = res.data.location;
        infoEl.style.display = 'block';
    } else {
        emptyEl.style.display = 'block';
    }
}

/**
 * 載入本週排班
 */
async function loadWeekShift() {
    const loadingEl = document.getElementById('week-shift-loading');
    const emptyEl = document.getElementById('week-shift-empty');
    const listEl = document.getElementById('week-shift-list');
    
    // 如果有快取，直接使用
    if (weekShiftCache !== null) {
        displayWeekShift(weekShiftCache);
        return;
    }
    
    try {
        loadingEl.style.display = 'block';
        emptyEl.style.display = 'none';
        listEl.innerHTML = '';
        
        const userId = localStorage.getItem('sessionUserId');
        
        // 計算本週日期範圍
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        
        const filters = {
            employeeId: userId,
            startDate: startOfWeek.toISOString().split('T')[0],
            endDate: endOfWeek.toISOString().split('T')[0]
        };
        
        const res = await callApifetch(`getShifts&filters=${encodeURIComponent(JSON.stringify(filters))}`);
        
        loadingEl.style.display = 'none';
        
        // 快取結果
        weekShiftCache = res;
        displayWeekShift(res);
        
    } catch (error) {
        console.error('載入本週排班失敗:', error);
        loadingEl.style.display = 'none';
        emptyEl.style.display = 'block';
    }
}

/**
 * 顯示本週排班
 */
function displayWeekShift(res) {
    const emptyEl = document.getElementById('week-shift-empty');
    const listEl = document.getElementById('week-shift-list');
    
    if (res.ok && res.data && res.data.length > 0) {
        listEl.innerHTML = '';
        res.data.forEach(shift => {
            const item = document.createElement('div');
            item.className = 'flex justify-between items-center text-sm bg-white dark:bg-gray-800 p-2 rounded-md';
            item.innerHTML = `
                <div>
                    <span class="font-semibold text-purple-900 dark:text-purple-200">
                        ${formatShiftDate(shift.date)}
                    </span>
                    <span class="text-purple-700 dark:text-purple-400 ml-2">
                        ${shift.shiftType}
                    </span>
                </div>
                <div class="text-purple-700 dark:text-purple-400">
                    ${shift.startTime} - ${shift.endTime}
                </div>
            `;
            listEl.appendChild(item);
        });
    } else {
        emptyEl.style.display = 'block';
    }
}

/**
 * 格式化排班日期
 */
function formatShiftDate(dateString) {
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const weekday = weekdays[date.getDay()];
    
    return `${month}/${day} (${weekday})`;
}

/**
 * 清除排班快取（當有更新時使用）
 */
function clearShiftCache() {
    todayShiftCache = null;
    weekShiftCache = null;
}