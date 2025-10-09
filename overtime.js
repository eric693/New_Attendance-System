// overtime.js - 加班功能前端邏輯

// ==================== 初始化加班頁面 ====================

/**
 * 初始化加班申請表單
 */
async function initOvertimeTab() {
    const overtimeView = document.getElementById('overtime-view');
    
    if (!overtimeView) {
        console.error("找不到加班頁面元素");
        return;
    }
    
    // 載入員工的加班記錄
    await loadEmployeeOvertimeRecords();
    
    // 綁定申請表單提交事件
    bindOvertimeFormEvents();
}

/**
 * 載入員工的加班申請記錄
 */
async function loadEmployeeOvertimeRecords() {
    const recordsList = document.getElementById('overtime-records-list');
    const recordsEmpty = document.getElementById('overtime-records-empty');
    const recordsLoading = document.getElementById('overtime-records-loading');
    
    recordsLoading.style.display = 'block';
    recordsList.innerHTML = '';
    recordsEmpty.style.display = 'none';
    
    try {
        const res = await callApifetch('getEmployeeOvertime');
        recordsLoading.style.display = 'none';
        
        if (res.ok && res.requests && res.requests.length > 0) {
            renderOvertimeRecords(res.requests, recordsList);
        } else {
            recordsEmpty.style.display = 'block';
        }
    } catch (err) {
        console.error(err);
        recordsLoading.style.display = 'none';
        showNotification(t('ERROR_LOAD_OVERTIME'), 'error');
    }
}

/**
 * 渲染加班記錄列表
 */
function renderOvertimeRecords(requests, container) {
    container.innerHTML = '';
    
    requests.forEach(req => {
        const li = document.createElement('li');
        li.className = 'p-4 bg-gray-50 dark:bg-gray-700 rounded-lg';
        
        // 狀態顯示
        let statusBadge = '';
        let statusClass = '';
        
        switch(req.status) {
            case 'pending':
                statusBadge = t('OVERTIME_STATUS_PENDING');
                statusClass = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
                break;
            case 'approved':
                statusBadge = t('OVERTIME_STATUS_APPROVED');
                statusClass = 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
                break;
            case 'rejected':
                statusBadge = t('OVERTIME_STATUS_REJECTED');
                statusClass = 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
                break;
        }
        
        li.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div>
                    <p class="font-semibold text-gray-800 dark:text-white">${req.overtimeDate}</p>
                    <p class="text-sm text-gray-600 dark:text-gray-400">
                        ${req.startTime} - ${req.endTime} (${req.hours}小時)
                    </p>
                </div>
                <span class="px-2 py-1 text-xs font-semibold rounded ${statusClass}">
                    ${statusBadge}
                </span>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
                <strong data-i18n="OVERTIME_REASON_LABEL">原因：</strong>${req.reason}
            </p>
            ${req.reviewComment ? `
                <p class="text-sm text-gray-500 dark:text-gray-400 italic">
                    <strong data-i18n="OVERTIME_REVIEW_COMMENT">審核意見：</strong>${req.reviewComment}
                </p>
            ` : ''}
        `;
        
        container.appendChild(li);
        renderTranslations(li);
    });
}

/**
 * 綁定加班表單事件
 */
function bindOvertimeFormEvents() {
    const submitBtn = document.getElementById('submit-overtime-btn');
    
    if (submitBtn) {
        submitBtn.addEventListener('click', handleOvertimeSubmit);
    }
    
    // 自動計算加班時數
    const startTimeInput = document.getElementById('overtime-start-time');
    const endTimeInput = document.getElementById('overtime-end-time');
    
    if (startTimeInput && endTimeInput) {
        const calculateHours = () => {
            const start = startTimeInput.value;
            const end = endTimeInput.value;
            
            if (start && end) {
                const startHour = parseInt(start.split(':')[0]);
                const startMin = parseInt(start.split(':')[1]);
                const endHour = parseInt(end.split(':')[0]);
                const endMin = parseInt(end.split(':')[1]);
                
                let hours = (endHour - startHour) + (endMin - startMin) / 60;
                
                if (hours < 0) hours += 24; // 跨日計算
                
                document.getElementById('overtime-hours').value = hours.toFixed(1);
            }
        };
        
        startTimeInput.addEventListener('change', calculateHours);
        endTimeInput.addEventListener('change', calculateHours);
    }
}

/**
 * 處理加班申請提交
 */
async function handleOvertimeSubmit() {
    const dateInput = document.getElementById('overtime-date');
    const startTimeInput = document.getElementById('overtime-start-time');
    const endTimeInput = document.getElementById('overtime-end-time');
    const hoursInput = document.getElementById('overtime-hours');
    const reasonInput = document.getElementById('overtime-reason');
    const submitBtn = document.getElementById('submit-overtime-btn');
    
    const overtimeDate = dateInput.value;
    const startTime = startTimeInput.value;
    const endTime = endTimeInput.value;
    const hours = hoursInput.value;
    const reason = reasonInput.value;
    
    // 驗證
    if (!overtimeDate || !startTime || !endTime || !hours || !reason) {
        showNotification(t('OVERTIME_FILL_ALL_FIELDS'), 'error');
        return;
    }
    
    if (parseFloat(hours) <= 0) {
        showNotification(t('OVERTIME_INVALID_HOURS'), 'error');
        return;
    }
    
    const loadingText = t('LOADING') || '處理中...';
    generalButtonState(submitBtn, 'processing', loadingText);
    
    try {
        const res = await callApifetch(
            `submitOvertime&overtimeDate=${overtimeDate}&startTime=${startTime}&endTime=${endTime}&hours=${hours}&reason=${encodeURIComponent(reason)}`
        );
        
        if (res.ok) {
            showNotification(t('OVERTIME_SUBMIT_SUCCESS'), 'success');
            
            // 清空表單
            dateInput.value = '';
            startTimeInput.value = '';
            endTimeInput.value = '';
            hoursInput.value = '';
            reasonInput.value = '';
            
            // 重新載入記錄
            await loadEmployeeOvertimeRecords();
        } else {
            showNotification(t(res.code) || t('ERROR_SUBMIT_OVERTIME'), 'error');
        }
    } catch (err) {
        console.error(err);
        showNotification(t('NETWORK_ERROR'), 'error');
    } finally {
        generalButtonState(submitBtn, 'idle');
    }
}

// ==================== 管理員審核功能 ====================

/**
 * 載入待審核的加班申請（管理員）
 */
async function loadPendingOvertimeRequests() {
    const requestsList = document.getElementById('pending-overtime-list');
    const requestsEmpty = document.getElementById('overtime-requests-empty');
    const requestsLoading = document.getElementById('overtime-requests-loading');
    
    requestsLoading.style.display = 'block';
    requestsList.innerHTML = '';
    requestsEmpty.style.display = 'none';
    
    try {
        const res = await callApifetch('getPendingOvertime');
        requestsLoading.style.display = 'none';
        
        if (res.ok && res.requests && res.requests.length > 0) {
            renderPendingOvertimeRequests(res.requests, requestsList);
        } else {
            requestsEmpty.style.display = 'block';
        }
    } catch (err) {
        console.error(err);
        requestsLoading.style.display = 'none';
        showNotification(t('ERROR_LOAD_OVERTIME'), 'error');
    }
}

/**
 * 渲染待審核列表
 */
function renderPendingOvertimeRequests(requests, container) {
    container.innerHTML = '';
    
    requests.forEach(req => {
        const li = document.createElement('li');
        li.className = 'p-4 bg-gray-50 dark:bg-gray-700 rounded-lg';
        
        li.innerHTML = `
            <div class="space-y-2">
                <div class="flex justify-between items-start">
                    <div>
                        <p class="font-semibold text-gray-800 dark:text-white">${req.employeeName}</p>
                        <p class="text-sm text-gray-600 dark:text-gray-400">
                            ${req.overtimeDate} | ${req.startTime} - ${req.endTime}
                        </p>
                        <p class="text-sm text-indigo-600 dark:text-indigo-400">
                            <strong data-i18n="OVERTIME_HOURS_LABEL">時數：</strong>${req.hours} 小時
                        </p>
                    </div>
                </div>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                    <strong data-i18n="OVERTIME_REASON_LABEL">原因：</strong>${req.reason}
                </p>
                <div class="flex space-x-2 mt-3">
                    <button 
                        data-i18n="ADMIN_APPROVE_BUTTON" 
                        data-row="${req.rowNumber}" 
                        class="approve-overtime-btn flex-1 px-3 py-2 rounded-md text-sm font-bold btn-primary">
                        核准
                    </button>
                    <button 
                        data-i18n="ADMIN_REJECT_BUTTON" 
                        data-row="${req.rowNumber}" 
                        class="reject-overtime-btn flex-1 px-3 py-2 rounded-md text-sm font-bold btn-warning">
                        拒絕
                    </button>
                </div>
            </div>
        `;
        
        container.appendChild(li);
        renderTranslations(li);
    });
    
    // 綁定審核按鈕事件
    container.querySelectorAll('.approve-overtime-btn').forEach(btn => {
        btn.addEventListener('click', (e) => handleOvertimeReview(e.currentTarget, 'approve'));
    });
    
    container.querySelectorAll('.reject-overtime-btn').forEach(btn => {
        btn.addEventListener('click', (e) => handleOvertimeReview(e.currentTarget, 'reject'));
    });
}

/**
 * 處理審核動作
 */
async function handleOvertimeReview(button, action) {
    const rowNumber = button.dataset.row;
    const loadingText = t('LOADING') || '處理中...';
    
    // 詢問審核意見
    const comment = action === 'reject' 
        ? prompt(t('OVERTIME_REJECT_REASON_PROMPT') || '請輸入拒絕原因（選填）') 
        : '';
    
    generalButtonState(button, 'processing', loadingText);
    
    try {
        const res = await callApifetch(
            `reviewOvertime&rowNumber=${rowNumber}&action=${action}&comment=${encodeURIComponent(comment || '')}`
        );
        
        if (res.ok) {
            showNotification(
                action === 'approve' ? t('OVERTIME_APPROVED') : t('OVERTIME_REJECTED'), 
                'success'
            );
            
            // 延遲後重新載入列表
            await new Promise(resolve => setTimeout(resolve, 500));
            loadPendingOvertimeRequests();
        } else {
            showNotification(t(res.code) || t('REVIEW_FAILED'), 'error');
        }
    } catch (err) {
        console.error(err);
        showNotification(t('NETWORK_ERROR'), 'error');
    } finally {
        generalButtonState(button, 'idle');
    }
}

// ==================== 在 DOMContentLoaded 中初始化 ====================
// 在 script.js 的 DOMContentLoaded 中加入：

/*
document.getElementById('tab-overtime-btn').addEventListener('click', () => {
    switchTab('overtime-view');
    initOvertimeTab();
});
*/