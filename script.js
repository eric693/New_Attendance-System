// 使用 CDN 或絕對路徑來載入 JSON 檔案
// 注意：本檔案需要依賴 config.js，請確保它在腳本之前被載入。

let currentLang = localStorage.getItem("lang");
let currentMonthDate = new Date();
let translations = {};
let monthDataCache = {}; // 新增：用於快取月份打卡資料
let isApiCalled = false; // 新增：用於追蹤 API 呼叫狀態，避免重複呼叫
let userId = localStorage.getItem("sessionUserId");

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
        calendarGrid.innerHTML = '<div data-i18n="LOADING" class="col-span-full text-center text-gray-500 py-4">正在載入...</div>';
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
                        dateClass = 'pending-adjustment';
                    }
                    break;
            }
        }
        
        const isToday = (year === today.getFullYear() && month === today.getMonth() && i === today.getDate());
        if (isToday) {
            dayCell.classList.add('today');
        } else if (cellDate > today) {
            dayCell.classList.add('future-day');
            dayCell.style.pointerEvents = 'none';
        } else {
            dayCell.classList.add(dateClass);
        }
        
        dayCell.classList.add('day-cell');
        dayCell.dataset.date = dateKey;
        dayCell.dataset.records = JSON.stringify(todayRecords);
        calendarGrid.appendChild(dayCell);
    }
}

// 新增：渲染每日紀錄的函式
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
        const dailyRecords = records.filter(record => {
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

// ⭐ 關鍵修正：將 switchTab 函式定義移到 DOMContentLoaded 之外
function switchTab(tabId) {
    const tabs = ['dashboard-view', 'monthly-view', 'location-view', 'admin-view'];
    const btns = ['tab-dashboard-btn', 'tab-monthly-btn', 'tab-location-btn', 'tab-admin-btn'];
    
    tabs.forEach(id => {
        const tabElement = document.getElementById(id);
        tabElement.style.display = 'none';
        tabElement.classList.remove('active');
    });
    
    btns.forEach(id => {
        const btnElement = document.getElementById(id);
        btnElement.classList.replace('bg-indigo-600', 'bg-gray-200');
        btnElement.classList.replace('text-white', 'text-gray-600');
    });
    
    const newTabElement = document.getElementById(tabId);
    newTabElement.style.display = 'block';
    newTabElement.classList.add('active');
    
    const newBtnElement = document.getElementById(`tab-${tabId.replace('-view', '-btn')}`);
    newBtnElement.classList.replace('bg-gray-200', 'bg-indigo-600');
    newBtnElement.classList.replace('text-gray-600', 'text-white');
    
    if (tabId === 'monthly-view') {
        renderCalendar(currentMonthDate);
    } else if (tabId === 'location-view') {
        initLocationMap();
    } else if (tabId === 'admin-view') {
        fetchAndRenderReviewRequests();
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
    const abnormalList = document.getElementById('abnormal-list');
    const adjustmentFormContainer = document.getElementById('adjustment-form-container');
    const calendarGrid = document.getElementById('calendar-grid');
    const getLocationBtn = document.getElementById('get-location-btn');
    const locationLatInput = document.getElementById('location-lat');
    const locationLngInput = document.getElementById('location-lng');
    const addLocationBtn = document.getElementById('add-location-btn');
    const exportPersonalBtn = document.getElementById('export-personal-btn');
    const exportAbnormalBtn = document.getElementById('export-abnormal-btn');
    const exportMonthlyBtn = document.getElementById('export-monthly-btn');
    
    let pendingRequests = [];
    
    // 全域變數，用於儲存地圖實例
    let mapInstance = null;
    let mapLoadingText = null;
    let currentCoords = null;
    let marker = null;
    let circle = null;
    let locationMarkers = L.layerGroup();
    let locationCircles = L.layerGroup();
    
    /**
     * 通用匯出函式
     */
    async function exportReport(action, params = {}, button) {
        const token = localStorage.getItem("sessionToken");
        const month = currentMonthDate.getFullYear() + "-" + 
                     String(currentMonthDate.getMonth() + 1).padStart(2, "0");
        
        const queryParams = new URLSearchParams({
            action: action,
            token: token,
            month: month,
            format: 'csv',
            ...params
        });
        
        const url = `${API_CONFIG.apiUrl}?${queryParams.toString()}`;
        
        generalButtonState(button, 'processing', t('EXPORTING'));
        
        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const error = await response.json();
                throw new Error(error.msg || t('EXPORT_FAILED'));
            }
            
            const blob = await response.blob();
            
            const contentDisposition = response.headers.get('content-disposition');
            let filename = `出勤報表_${month}.csv`;
            
            if (contentDisposition) {
                const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
                if (matches != null && matches[1]) {
                    filename = decodeURIComponent(matches[1].replace(/['"]/g, ''));
                }
            }
            
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = downloadUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            
            window.URL.revokeObjectURL(downloadUrl);
            document.body.removeChild(a);
            
            showNotification(t('EXPORT_SUCCESS'), 'success');
            
        } catch (error) {
            console.error('匯出失敗:', error);
            showNotification(t('EXPORT_FAILED') + ': ' + error.message, 'error');
            
        } finally {
            generalButtonState(button, 'idle');
        }
    }

    exportPersonalBtn.addEventListener('click', () => {
        const userId = localStorage.getItem("sessionUserId");
        exportReport('exportAttendance', { userId }, exportPersonalBtn);
    });
    
    exportAbnormalBtn.addEventListener('click', () => {
        exportReport('exportAbnormalReport', {}, exportAbnormalBtn);
    });
    
    exportMonthlyBtn.addEventListener('click', () => {
        exportReport('exportMonthlyReport', {}, exportMonthlyBtn);
    });
    
    async function updateExportButtonsVisibility() {
        try {
            const res = await callApifetch("checkSession");
            if (res.ok && res.user && res.user.dept === "管理員") {
                exportMonthlyBtn.style.display = 'block';
            } else {
                exportMonthlyBtn.style.display = 'none';
            }
        } catch (err) {
            console.error('檢查權限失敗:', err);
        }
    }
    
    // ⭐ 包裝 switchTab，加入匯出按鈕可見性更新
    const originalSwitchTab = switchTab;
    window.switchTab = async function(tabId) {
        originalSwitchTab(tabId);
        if (tabId === 'monthly-view') {
            await updateExportButtonsVisibility();
        }
    };
    
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
                pendingRequests = res.reviewRequest;
                
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
                    <span class="text-xs text-gray-500">${req.applicationPeriod}</span>
                </div>
            </div>
            <div class="flex items-center justify-between w-full mt-2">
                <p data-i18n-key="${req.type}" class="text-sm text-indigo-600 dark:text-indigo-400 font-medium"></p> 
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
    
    async function handleReviewAction(button, index, action) {
        const request = pendingRequests[index];
        if (!request) {
            showNotification("找不到請求資料。", "error");
            return;
        }

        const recordId = request.id;
        const endpoint = action === 'approve' ? 'approveReview' : 'rejectReview';
        const loadingText = t('LOADING') || '處理中...';
        
        generalButtonState(button, 'processing', loadingText);
        
        try {
            const res = await callApifetch(`${endpoint}&id=${recordId}`);
            
            if (res.ok) {
                const translationKey = action === 'approve' ? 'REQUEST_APPROVED' : 'REQUEST_REJECTED';
                showNotification(t(translationKey), "success");
                await new Promise(resolve => setTimeout(resolve, 500));
                fetchAndRenderReviewRequests();
            } else {
                showNotification(t('REVIEW_FAILED', { msg: res.msg }), "error");
            }
            
        } catch (err) {
            showNotification(t("REVIEW_NETWORK_ERROR"), "error");
            console.error(err);
            
        } finally {
            generalButtonState(button, 'idle');
        }
    }
    
    async function fetchAndRenderLocationsOnMap() {
        try {
            const res = await callApifetch("getLocations");
            
            locationMarkers.clearLayers();
            locationCircles.clearLayers();
            
            if (res.ok && Array.isArray(res.locations)) {
                res.locations.forEach(loc => {
                    const punchInRadius = loc.scope || 50;
                    
                    const locationCircle = L.circle([loc.lat, loc.lng], {
                        color: 'red',
                        fillColor: '#f03',
                        fillOpacity: 0.2,
                        radius: punchInRadius
                    });
                    locationCircle.bindPopup(`<b>${loc.name}</b><br>可打卡範圍：${punchInRadius}公尺`);
                    locationCircles.addLayer(locationCircle);
                });
                
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
    
    function initLocationMap(forceReload = false){
        const mapContainer = document.getElementById('map-container');
        const statusEl = document.getElementById('location-status');
        const coordsEl = document.getElementById('location-coords');
        
        if (!mapLoadingText) {
            mapLoadingText = document.getElementById('map-loading-text');
        }
        
        if (mapInstance) {
            if (!forceReload) {
                mapInstance.invalidateSize();
                return;
            }
            mapInstance.remove();
            mapInstance = null;
        }
        
        mapLoadingText.style.display = 'block';
        
        mapInstance = L.map('map-container', {
            center: [25.0330, 121.5654],
            zoom: 13
        });
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(mapInstance);
        
        mapInstance.whenReady(() => {
            mapLoadingText.style.display = 'none';
            mapInstance.invalidateSize();
        });
        
        statusEl.textContent = t('DETECTING_LOCATION');
        coordsEl.textContent = t('UNKNOWN_LOCATION');
        
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    currentCoords = [latitude, longitude];
                    
                    statusEl.textContent = t('DETECTION_SUCCESS');
                    coordsEl.textContent = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
                    
                    mapInstance.setView(currentCoords, 18);
                    
                    if (marker) mapInstance.removeLayer(marker);
                    marker = L.marker(currentCoords).addTo(mapInstance)
                    .bindPopup(t('CURRENT_LOCATION'))
                    .openPopup();
                },
                (error) => {
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
                        default:
                            message = t('ERROR_GEOLOCATION_UNKNOWN');
                            break;
                    }
                    showNotification(`定位失敗：${message}`, "error");
                }
            );
            fetchAndRenderLocationsOnMap();
        } else {
            showNotification(t('ERROR_BROWSER_NOT_SUPPORTED'), "error");
            statusEl.textContent = '不支援定位';
        }
    }
    
    document.getElementById('test-api-btn').addEventListener('click', async () => {
        const testAction = "testEndpoint";
        
        try {
            const res = await callApifetch(testAction);
            
            if (res && res.ok) {
                showNotification("API 測試成功！回應：" + JSON.stringify(res), "success");
            } else {
                showNotification("API 測試失敗：" + (res ? res.msg : "無回應資料"), "error");
            }
        } catch (error) {
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
                document.getElementById('location-name').value = '';
                document.getElementById('location-lat').value = '';
                document.getElementById('location-lng').value = '';
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
    
    // 語系初始化
    let currentLang = localStorage.getItem("lang");
    
    if (!currentLang) {
        const browserLang = navigator.language || navigator.userLanguage;
        if (browserLang.startsWith("zh")) {
            currentLang = "zh-TW";
        } else if (browserLang.startsWith("ja")) {
            currentLang = "ja";
        } else if (browserLang.startsWith("vi")) {
            currentLang = "vi";
        } else if (browserLang.startsWith("id")) {
            currentLang = "id";
        } else {
            currentLang = "en-US";
        }
    }
    
    document.getElementById('language-switcher').value = currentLang;
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
    
    loginBtn.onclick = async () => {
        const res = await callApifetch("getLoginUrl");
        if (res.url) window.location.href = res.url;
    };
    
    logoutBtn.onclick = () => {
        localStorage.removeItem("sessionToken");
        window.location.href = "/New_Attendance-System"
    };
    
    function generalButtonState(button, state, loadingText = '處理中...') {
        if (!button) return;
        const loadingClasses = 'opacity-50 cursor-not-allowed';

        if (state === 'processing') {
            button.dataset.originalText = button.textContent;
            button.dataset.loadingClasses = 'opacity-50 cursor-not-allowed';
            button.disabled = true;
            button.textContent = loadingText;
            button.classList.add(...loadingClasses.split(' '));
        } else {
            if (button.dataset.loadingClasses) {
                button.classList.remove(...button.dataset.loadingClasses.split(' '));
            }
            button.disabled = false;
            if (button.dataset.originalText) {
                button.textContent = button.dataset.originalText;
                delete button.dataset.originalText;
            }
        }
    }
    
    async function doPunch(type) {
        const punchButtonId = type === '上班' ? 'punch-in-btn' : 'punch-out-btn';
        const button = document.getElementById(punchButtonId);
        const loadingText = t('LOADING') || '處理中...';

        if (!button) return;

        generalButtonState(button, 'processing', loadingText);
        
        if (!navigator.geolocation) {
            showNotification(t("ERROR_GEOLOCATION", { msg: "您的瀏覽器不支援地理位置功能。" }), "error");
            generalButtonState(button, 'idle');
            return;
        }
        
        navigator.geolocation.getCurrentPosition(async (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const action = `punch&type=${encodeURIComponent(type)}&lat=${lat}&lng=${lng}&note=${encodeURIComponent(navigator.userAgent)}`;
            
            try {
                const res = await callApifetch(action);
                const msg = t(res.code || "UNKNOWN_ERROR", res.params || {});
                showNotification(msg, res.ok ? "success" : "error");
                generalButtonState(button, 'idle');
            } catch (err) {
                console.error(err);
                generalButtonState(button, 'idle');
            }
        }, (err) => {
            showNotification(t("ERROR_GEOLOCATION", { msg: err.message }), "error");
            generalButtonState(button, 'idle');
        });
    }
    
    punchInBtn.addEventListener('click', () => doPunch("上班"));
    punchOutBtn.addEventListener('click', () => doPunch("下班"));
    
    abnormalList.addEventListener('click', (e) => {
        if (e.target.classList.contains('adjust-btn')) {
            const date = e.target.dataset.date;
            const reason = e.target.dataset.reason;
            const formHtml = `
                <div class="p-4 border-t border-gray-200 fade-in ">
                    <p data-i18n="ADJUST_BUTTON_TEXT" class="font-semibold mb-2">補打卡：<span class="text-indigo-600">${date}</span></p>
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
            let defaultTime = "09:00";
            if (reason.includes("下班")) {
                defaultTime = "18:00";
            }
            adjustDateTimeInput.value = `${date}T${defaultTime}`;
        }
    });
    
    function validateAdjustTime(value) {
        const selected = new Date(value);
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (selected < monthStart) {
            showNotification(t("ERR_BEFORE_MONTH_START"), "error");
            return false;
        }
        if (selected > today) {
            showNotification(t("ERR_AFTER_TODAY"), "error");
            return false;
        }
        return true;
    }
    
    adjustmentFormContainer.addEventListener('click', async (e) => {
        const button = e.target.closest('.submit-adjust-btn');

        if (button) {
            const loadingText = t('LOADING') || '處理中...';
            const datetime = document.getElementById("adjustDateTime").value;
            const type = button.dataset.type;

            if (!datetime) {
                showNotification("請選擇補打卡日期時間", "error");
                return;
            }
            if (!validateAdjustTime(datetime)) return;

            generalButtonState(button, 'processing', loadingText);
            
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
                    checkAbnormal();
                }
            } catch (err) {
                console.error(err);
                showNotification(t('NETWORK_ERROR') || '網絡錯誤', 'error');
            } finally {
                if (adjustmentFormContainer.innerHTML !== '') {
                    generalButtonState(button, 'idle');
                }
            }
        }
    });
    
    // 頁面切換事件 - 使用 window.switchTab
    tabDashboardBtn.addEventListener('click', () => window.switchTab('dashboard-view'));
    tabLocationBtn.addEventListener('click', () => window.switchTab('location-view'));
    tabMonthlyBtn.addEventListener('click', () => window.switchTab('monthly-view'));
    
    tabAdminBtn.addEventListener('click', async () => {
        const button = tabAdminBtn;
        const loadingText = t('CHECKING') || '檢查中...';

        generalButtonState(button, 'processing', loadingText);
        
        try {
            const res = await callApifetch("checkSession");
            
            if (res.ok && res.user && res.user.dept === "管理員") {
                window.switchTab('admin-view');
            } else {
                showNotification(t("ERR_NO_PERMISSION"), "error");
            }
        } catch (err) {
            console.error(err);
            showNotification(t("NETWORK_ERROR") || '網絡錯誤', "error");
        } finally {
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
    
    // 語系切換事件
    document.getElementById('language-switcher').addEventListener('change', (e) => {
        const newLang = e.target.value;
        loadTranslations(newLang);
        const currentTab = document.querySelector('.active');
        const currentTabId = currentTab ? currentTab.id : null;
        
        if (currentTabId === 'location-view') {
            initLocationMap(true);
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