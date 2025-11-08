// leave.js - 請假系統前端邏輯（完整修正版）

/**
 * 🆕 格式化日期函數
 * 將任何日期格式轉換為 YYYY-MM-DD
 */
function formatLeaveDate(dateInput) {
    if (!dateInput) return '';
    
    const date = new Date(dateInput);
    
    // 檢查是否為有效日期
    if (isNaN(date.getTime())) return dateInput;
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}

/**
 * 初始化請假頁籤
 */
async function initLeaveTab() {
    console.log('📋 初始化請假系統...');
    
    // 載入假期餘額
    await loadLeaveBalance();
    
    // 載入請假記錄
    await loadLeaveRecords();
    
    // 綁定事件監聽器
    bindLeaveEventListeners();
}

/**
 * 綁定請假相關事件
 */
function bindLeaveEventListeners() {
    // 提交請假申請
    const submitBtn = document.getElementById('submit-leave-btn');
    if (submitBtn) {
        // 移除舊的監聽器，避免重複綁定
        submitBtn.replaceWith(submitBtn.cloneNode(true));
        document.getElementById('submit-leave-btn').addEventListener('click', handleSubmitLeave);
    }
    
    // 請假類型改變時的處理
    const leaveTypeSelect = document.getElementById('leave-type');
    if (leaveTypeSelect) {
        leaveTypeSelect.removeEventListener('change', handleLeaveTypeChange);
        leaveTypeSelect.addEventListener('change', handleLeaveTypeChange);
    }
    
    // 開始日期改變時自動計算天數
    const startDateInput = document.getElementById('leave-start-date');
    const endDateInput = document.getElementById('leave-end-date');
    
    if (startDateInput && endDateInput) {
        startDateInput.removeEventListener('change', calculateLeaveDays);
        endDateInput.removeEventListener('change', calculateLeaveDays);
        startDateInput.addEventListener('change', calculateLeaveDays);
        endDateInput.addEventListener('change', calculateLeaveDays);
    }
}

/**
 * 載入假期餘額
 */
async function loadLeaveBalance() {
    const balanceContainer = document.getElementById('leave-balance-container');
    const loadingEl = document.getElementById('leave-balance-loading');
    const token = localStorage.getItem('sessionToken');
    if (loadingEl) loadingEl.style.display = 'block';
    
    try {
        const res = await callApifetch('getLeaveBalance');
        
        if (res.ok) {
            renderLeaveBalance(res.balance);
        } else {
            showNotification(t(res.code || 'ERROR_FETCH_LEAVE_BALANCE'), 'error');
        }
    } catch (err) {
        console.error('載入假期餘額失敗:', err);
        showNotification(t('NETWORK_ERROR'), 'error');
    } finally {
        if (loadingEl) loadingEl.style.display = 'none';
    }
}

/**
 * 渲染假期餘額
 */
function renderLeaveBalance(balance) {
    const listEl = document.getElementById('leave-balance-list');
    if (!listEl) return;
    
    listEl.innerHTML = '';
    
    // 定義假別順序
    const leaveOrder = [
        'ANNUAL_LEAVE',
        'SICK_LEAVE', 
        'PERSONAL_LEAVE',
        'MARRIAGE_LEAVE',
        'BEREAVEMENT_LEAVE',
        'MATERNITY_LEAVE',
        'PATERNITY_LEAVE',
        'FAMILY_CARE_LEAVE',
        'MENSTRUAL_LEAVE'
    ];
    
    leaveOrder.forEach(leaveType => {
        if (balance[leaveType] !== undefined) {
            const item = document.createElement('div');
            item.className = 'flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg';
            
            const typeSpan = document.createElement('span');
            typeSpan.className = 'font-medium text-gray-800 dark:text-white';
            typeSpan.setAttribute('data-i18n-key', leaveType);
            typeSpan.textContent = t(leaveType);
            
            const daysSpan = document.createElement('span');
            daysSpan.className = 'text-indigo-600 dark:text-indigo-400 font-bold';
            daysSpan.textContent = `${balance[leaveType]} ${t('DAYS')}`;
            
            item.appendChild(typeSpan);
            item.appendChild(daysSpan);
            listEl.appendChild(item);
            
            renderTranslations(item);
        }
    });
}

/**
 * 載入請假記錄
 */
async function loadLeaveRecords() {
    const loadingEl = document.getElementById('leave-records-loading');
    const emptyEl = document.getElementById('leave-records-empty');
    const listEl = document.getElementById('leave-records-list');
    const token = localStorage.getItem('sessionToken');
    
    if (loadingEl) loadingEl.style.display = 'block';
    if (emptyEl) emptyEl.style.display = 'none';
    if (listEl) listEl.innerHTML = '';
    
    try {
        const res = await callApifetch('getEmployeeLeaveRecords');
        
        if (res.ok) {
            if (res.records && res.records.length > 0) {
                renderLeaveRecords(res.records);
            } else {
                if (emptyEl) emptyEl.style.display = 'block';
            }
        } else {
            showNotification(t(res.code || 'ERROR_FETCH_RECORDS'), 'error');
        }
    } catch (err) {
        console.error('載入請假記錄失敗:', err);
        showNotification(t('NETWORK_ERROR'), 'error');
    } finally {
        if (loadingEl) loadingEl.style.display = 'none';
    }
}

/**
 * 渲染請假記錄（修正版）
 */
function renderLeaveRecords(records) {
    const listEl = document.getElementById('leave-records-list');
    if (!listEl) return;
    
    listEl.innerHTML = '';
    
    records.forEach(record => {
        const li = document.createElement('li');
        li.className = 'p-4 bg-gray-50 dark:bg-gray-700 rounded-lg';
        
        // 狀態顏色
        let statusClass = 'text-yellow-600 dark:text-yellow-400';
        if (record.status === 'APPROVED') {
            statusClass = 'text-green-600 dark:text-green-400';
        } else if (record.status === 'REJECTED') {
            statusClass = 'text-red-600 dark:text-red-400';
        }
        
        // 🔧 修正：格式化日期
        const startDate = formatLeaveDate(record.startDate);
        const endDate = formatLeaveDate(record.endDate);
        
        li.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div>
                    <p class="font-medium text-gray-800 dark:text-white">
                        <span data-i18n-key="${record.leaveType}">${t(record.leaveType)}</span>
                    </p>
                    <p class="text-sm text-gray-600 dark:text-gray-400">
                        ${startDate} ~ ${endDate}
                        <span class="ml-2">(${record.days} ${t('DAYS')})</span>
                    </p>
                </div>
                <span class="${statusClass} font-semibold text-sm" data-i18n-key="${record.status}">
                    ${t(record.status)}
                </span>
            </div>
            ${record.reason ? `
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    <span data-i18n="LEAVE_REASON_LABEL">原因：</span>${record.reason}
                </p>
            ` : ''}
            ${record.reviewComment ? `
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    <span data-i18n="REVIEW_COMMENT_LABEL">審核意見：</span>${record.reviewComment}
                </p>
            ` : ''}
        `;
        
        listEl.appendChild(li);
        renderTranslations(li);
    });
}

/**
 * 處理請假類型變更
 */
function handleLeaveTypeChange(e) {
    const leaveType = e.target.value;
    const reasonContainer = document.getElementById('leave-reason-container');
    
    // 某些假別需要特別說明
    const requiresReason = [
        'BEREAVEMENT_LEAVE',
        'MATERNITY_LEAVE',
        'PATERNITY_LEAVE'
    ];
    
    if (requiresReason.includes(leaveType)) {
        reasonContainer.classList.remove('hidden');
    } else {
        reasonContainer.classList.remove('hidden'); // 都顯示以便填寫
    }
}

/**
 * 計算請假天數
 */
function calculateLeaveDays() {
    const startDate = document.getElementById('leave-start-date').value;
    const endDate = document.getElementById('leave-end-date').value;
    const daysInput = document.getElementById('leave-days');
    
    if (!startDate || !endDate) return;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (end < start) {
        showNotification(t('ERR_END_DATE_BEFORE_START'), 'error');
        daysInput.value = '';
        return;
    }
    
    // 計算天數（包含起始日）
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    daysInput.value = diffDays;
}

/**
 * 提交請假申請（完全修正版）
 */
async function handleSubmitLeave() {
    const button = document.getElementById('submit-leave-btn');
    const loadingText = t('LOADING') || '處理中...';
    
    // 取得表單資料
    const leaveType = document.getElementById('leave-type').value;
    const startDate = document.getElementById('leave-start-date').value;
    const endDate = document.getElementById('leave-end-date').value;
    const days = document.getElementById('leave-days').value;
    const reason = document.getElementById('leave-reason').value;
    
    // 驗證
    if (!leaveType || !startDate || !endDate || !days) {
        showNotification(t('ERR_MISSING_FIELDS'), 'error');
        return;
    }
    
    if (parseFloat(days) <= 0) {
        showNotification(t('ERR_INVALID_DAYS'), 'error');
        return;
    }
    
    // 🔧 修正：確保日期格式為 YYYY-MM-DD
    const formattedStartDate = formatLeaveDate(startDate);
    const formattedEndDate = formatLeaveDate(endDate);
    
    // ⭐⭐⭐ 關鍵修正：加入 token 參數
    const token = localStorage.getItem('sessionToken');
    
    if (!token) {
        showNotification(t('ERR_NO_SESSION'), 'error');
        return;
    }
    
    // 進入處理中狀態
    generalButtonState(button, 'processing', loadingText);
    
    try {
        const res = await callApifetch(
            `submitLeave&token=${encodeURIComponent(token)}` + // ⭐ 新增 token
            `&leaveType=${encodeURIComponent(leaveType)}` +
            `&startDate=${encodeURIComponent(formattedStartDate)}` +
            `&endDate=${encodeURIComponent(formattedEndDate)}` +
            `&days=${encodeURIComponent(days)}` +
            `&reason=${encodeURIComponent(reason)}`
        );
        
        if (res.ok) {
            showNotification(t(res.code || 'LEAVE_SUBMIT_SUCCESS'), 'success');
            
            // 清空表單
            document.getElementById('leave-type').value = '';
            document.getElementById('leave-start-date').value = '';
            document.getElementById('leave-end-date').value = '';
            document.getElementById('leave-days').value = '';
            document.getElementById('leave-reason').value = '';
            
            // 重新載入資料
            await loadLeaveBalance();
            await loadLeaveRecords();
        } else {
            showNotification(t(res.code || 'LEAVE_SUBMIT_FAILED', res.params), 'error');
        }
    } catch (err) {
        console.error('提交請假失敗:', err);
        showNotification(t('NETWORK_ERROR'), 'error');
    } finally {
        generalButtonState(button, 'idle');
    }
}

/**
 * 載入待審核的請假申請（管理員用）
 */
async function loadPendingLeaveRequests() {
    const loadingEl = document.getElementById('leave-requests-loading');
    const emptyEl = document.getElementById('leave-requests-empty');
    const listEl = document.getElementById('pending-leave-list');
    
    if (loadingEl) loadingEl.style.display = 'block';
    if (emptyEl) emptyEl.style.display = 'none';
    if (listEl) listEl.innerHTML = '';
    
    try {
        const res = await callApifetch('getPendingLeaveRequests');
        
        if (res.ok) {
            if (res.requests && res.requests.length > 0) {
                renderPendingLeaveRequests(res.requests);
            } else {
                if (emptyEl) emptyEl.style.display = 'block';
            }
        } else {
            showNotification(t(res.code || 'ERROR_FETCH_REQUESTS'), 'error');
        }
    } catch (err) {
        console.error('載入待審核請假失敗:', err);
        showNotification(t('NETWORK_ERROR'), 'error');
    } finally {
        if (loadingEl) loadingEl.style.display = 'none';
    }
}

/**
 * 渲染待審核請假列表（修正版）
 */
function renderPendingLeaveRequests(requests) {
    const listEl = document.getElementById('pending-leave-list');
    if (!listEl) return;
    
    listEl.innerHTML = '';
    
    requests.forEach(req => {
        const li = document.createElement('li');
        li.className = 'p-4 bg-gray-50 dark:bg-gray-700 rounded-lg';
        
        // 🔧 修正：格式化日期
        const startDate = formatLeaveDate(req.startDate);
        const endDate = formatLeaveDate(req.endDate);
        
        li.innerHTML = `
            <div class="flex flex-col space-y-2">
                <div class="flex items-center justify-between">
                    <div class="flex-1">
                        <p class="font-semibold text-gray-800 dark:text-white">
                            ${req.employeeName} - <span data-i18n-key="${req.leaveType}">${t(req.leaveType)}</span>
                        </p>
                        <p class="text-sm text-gray-600 dark:text-gray-400">
                            ${startDate} ~ ${endDate} (${req.days} ${t('DAYS')})
                        </p>
                        ${req.reason ? `
                            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                <span data-i18n="LEAVE_REASON_LABEL">原因：</span>${req.reason}
                            </p>
                        ` : ''}
                    </div>
                </div>
                
                <div class="flex space-x-2 mt-2">
                    <button 
                        data-i18n="ADMIN_APPROVE_BUTTON" 
                        data-row="${req.rowNumber}" 
                        class="approve-leave-btn flex-1 px-3 py-2 rounded-md text-sm font-bold btn-primary">
                        核准
                    </button>
                    <button 
                        data-i18n="ADMIN_REJECT_BUTTON" 
                        data-row="${req.rowNumber}" 
                        class="reject-leave-btn flex-1 px-3 py-2 rounded-md text-sm font-bold btn-warning">
                        拒絕
                    </button>
                </div>
            </div>
        `;
        
        listEl.appendChild(li);
        renderTranslations(li);
    });
    
    // 綁定審核按鈕事件
    listEl.querySelectorAll('.approve-leave-btn').forEach(btn => {
        btn.addEventListener('click', (e) => handleReviewLeave(e.currentTarget, 'approve'));
    });
    
    listEl.querySelectorAll('.reject-leave-btn').forEach(btn => {
        btn.addEventListener('click', (e) => handleReviewLeave(e.currentTarget, 'reject'));
    });
}

/**
 * 處理請假審核
 */
async function handleReviewLeave(button, action) {
    const rowNumber = button.dataset.row;
    const loadingText = t('LOADING') || '處理中...';
    
    // 詢問審核意見
    const comment = action === 'reject' 
        ? prompt(t('ENTER_REJECT_REASON') || '請輸入拒絕原因：') 
        : '';
    
    if (action === 'reject' && !comment) {
        showNotification(t('ERR_MISSING_REJECT_REASON'), 'warning');
        return;
    }
    
    generalButtonState(button, 'processing', loadingText);
    
    try {
        const res = await callApifetch(
            `reviewLeave&rowNumber=${rowNumber}` +
            `&reviewAction=${action}` +
            `&comment=${encodeURIComponent(comment || '')}`
        );
        
        if (res.ok) {
            const translationKey = action === 'approve' 
                ? 'LEAVE_APPROVED' 
                : 'LEAVE_REJECTED';
            showNotification(t(translationKey), 'success');
            
            // 延遲後重新載入列表
            await new Promise(resolve => setTimeout(resolve, 500));
            loadPendingLeaveRequests();
        } else {
            showNotification(t(res.code || 'REVIEW_FAILED', res.params), 'error');
        }
    } catch (err) {
        console.error('審核請假失敗:', err);
        showNotification(t('NETWORK_ERROR'), 'error');
    } finally {
        generalButtonState(button, 'idle');
    }
}