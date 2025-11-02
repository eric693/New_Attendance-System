// salary.js - 薪資管理前端邏輯（✅ 完整版 - 修復 ReferenceError + 保留所有功能）

// ==================== 檢查依賴 ====================
if (typeof callApifetch !== 'function') {
    console.error('❌ callApifetch 函數未定義，請確認 script.js 已正確載入');
}

// ==================== 初始化薪資頁面 ====================

/**
 * ✅ 初始化薪資頁面（修復 ReferenceError）
 */
async function initSalaryTab() {
    try {
        console.log('🎯 開始初始化薪資頁面');
        
        // ⭐ 步驟 1：驗證 Session
        console.log('📡 正在驗證 Session...');
        const session = await callApifetch("checkSession");
        
        if (!session.ok || !session.user) {
            console.error('❌ Session 驗證失敗:', session);
            showNotification('請先登入', 'error');
            return;
        }
        
        console.log('✅ Session 驗證成功');
        console.log('👤 使用者:', session.user.name);
        console.log('🔐 權限:', session.user.dept);
        console.log('📌 員工ID:', session.user.userId);
        
        // ⭐ 步驟 2：設定當前月份
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        console.log('📅 當前月份:', currentMonth);
        
        const employeeSalaryMonth = document.getElementById('employee-salary-month');
        if (employeeSalaryMonth) {
            employeeSalaryMonth.value = currentMonth;
        }
        
        // ⭐ 步驟 3：載入薪資資料
        console.log('💰 開始載入薪資資料...');
        await loadCurrentEmployeeSalary();
        
        console.log('📋 開始載入薪資歷史...');
        await loadSalaryHistory();
        
        // ⭐ 步驟 4：綁定事件（管理員才需要）
        if (session.user.dept === "管理員") {
            console.log('🔧 綁定管理員功能...');
            bindSalaryEvents();
        }
        
        console.log('✅ 薪資頁面初始化完成！');
        
    } catch (error) {
        console.error('❌ 初始化失敗:', error);
        console.error('錯誤堆疊:', error.stack);
        showNotification('初始化失敗：' + error.message, 'error');
    }
}

// ==================== 員工薪資功能 ====================

/**
 * ✅ 載入當前員工的薪資
 */
async function loadCurrentEmployeeSalary() {
    try {
        console.log(`💰 載入員工薪資`);
        
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        const loadingEl = document.getElementById('current-salary-loading');
        const emptyEl = document.getElementById('current-salary-empty');
        const contentEl = document.getElementById('current-salary-content');
        
        if (loadingEl) loadingEl.style.display = 'block';
        if (emptyEl) emptyEl.style.display = 'none';
        if (contentEl) contentEl.style.display = 'none';
        
        // ⭐ 關鍵：後端會從 token 自動取得 userId
        const result = await callApifetch(`getMySalary&yearMonth=${currentMonth}`);
        
        console.log('📥 薪資資料回應:', result);
        
        if (loadingEl) loadingEl.style.display = 'none';
        
        if (result.ok && result.data) {
            console.log('✅ 成功載入薪資資料');
            displayEmployeeSalary(result.data);
            if (contentEl) contentEl.style.display = 'block';
        } else {
            console.log(`⚠️ 沒有 ${currentMonth} 的薪資記錄`);
            if (emptyEl) {
                showNoSalaryMessage(currentMonth);
                emptyEl.style.display = 'block';
            }
        }
        
    } catch (error) {
        console.error('❌ 載入失敗:', error);
        const loadingEl = document.getElementById('current-salary-loading');
        const emptyEl = document.getElementById('current-salary-empty');
        if (loadingEl) loadingEl.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'block';
    }
}

/**
 * ✅ 按月份查詢薪資
 */
async function loadEmployeeSalaryByMonth() {
    const monthInput = document.getElementById('employee-salary-month');
    const yearMonth = monthInput ? monthInput.value : '';
    
    if (!yearMonth) {
        showNotification('請選擇查詢月份', 'error');
        return;
    }
    
    const loadingEl = document.getElementById('current-salary-loading');
    const emptyEl = document.getElementById('current-salary-empty');
    const contentEl = document.getElementById('current-salary-content');
    
    if (!loadingEl || !emptyEl || !contentEl) {
        console.warn('薪資顯示元素未找到');
        return;
    }
    
    try {
        console.log(`🔍 查詢 ${yearMonth} 薪資`);
        
        loadingEl.style.display = 'block';
        emptyEl.style.display = 'none';
        contentEl.style.display = 'none';
        
        const res = await callApifetch(`getMySalary&yearMonth=${yearMonth}`);
        
        console.log(`📥 查詢 ${yearMonth} 薪資回應:`, res);
        
        loadingEl.style.display = 'none';
        
        if (res.ok && res.data) {
            console.log(`✅ 找到 ${yearMonth} 的薪資記錄`);
            displayEmployeeSalary(res.data);
            contentEl.style.display = 'block';
        } else {
            console.log(`⚠️ 沒有 ${yearMonth} 的薪資記錄`);
            showNoSalaryMessage(yearMonth);
            emptyEl.style.display = 'block';
        }
        
    } catch (error) {
        console.error(`❌ 載入 ${yearMonth} 薪資失敗:`, error);
        loadingEl.style.display = 'none';
        emptyEl.style.display = 'block';
    }
}

/**
 * 顯示薪資明細
 */
function displayEmployeeSalary(data) {
    console.log('📊 顯示薪資明細:', data);
    
    const safeSet = (id, value) => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = value;
        } else {
            console.warn(`⚠️ 元素 #${id} 未找到`);
        }
    };
    
    safeSet('gross-salary', formatCurrency(data['應發總額']));
    safeSet('net-salary', formatCurrency(data['實發金額']));
    
    const deductions = 
        (parseFloat(data['勞保費']) || 0) + 
        (parseFloat(data['健保費']) || 0) + 
        (parseFloat(data['就業保險費']) || 0) + 
        (parseFloat(data['勞退自提']) || 0) + 
        (parseFloat(data['所得稅']) || 0) +
        (parseFloat(data['請假扣款']) || 0);
    
    safeSet('total-deductions', formatCurrency(deductions));
    safeSet('detail-base-salary', formatCurrency(data['基本薪資']));
    safeSet('detail-weekday-overtime', formatCurrency(data['平日加班費']));
    safeSet('detail-restday-overtime', formatCurrency(data['休息日加班費']));
    safeSet('detail-holiday-overtime', formatCurrency(data['國定假日加班費']));
    safeSet('detail-labor-fee', formatCurrency(data['勞保費']));
    safeSet('detail-health-fee', formatCurrency(data['健保費']));
    safeSet('detail-employment-fee', formatCurrency(data['就業保險費']));
    safeSet('detail-pension-self', formatCurrency(data['勞退自提']));
    safeSet('detail-income-tax', formatCurrency(data['所得稅']));
    safeSet('detail-leave-deduction', formatCurrency(data['請假扣款']));
    safeSet('detail-bank-name', getBankName(data['銀行代碼']));
    safeSet('detail-bank-account', data['銀行帳號'] || '--');
    
    console.log('✅ 薪資明細顯示完成');
}

/**
 * 顯示當月薪資（相容性函數）
 */
function displayCurrentSalary(salary) {
    displayEmployeeSalary(salary);
}

/**
 * ✅ 載入薪資歷史
 */
async function loadSalaryHistory() {
    const loadingEl = document.getElementById('salary-history-loading');
    const emptyEl = document.getElementById('salary-history-empty');
    const listEl = document.getElementById('salary-history-list');
    
    if (!loadingEl || !emptyEl || !listEl) {
        console.warn('薪資歷史元素未找到');
        return;
    }
    
    try {
        console.log('📋 載入薪資歷史');
        
        loadingEl.style.display = 'block';
        emptyEl.style.display = 'none';
        listEl.innerHTML = '';
        
        const res = await callApifetch('getMySalaryHistory&limit=12');
        
        console.log('📥 薪資歷史回應:', res);
        
        loadingEl.style.display = 'none';
        
        if (res.ok && res.data && res.data.length > 0) {
            console.log(`✅ 找到 ${res.data.length} 筆薪資歷史`);
            res.data.forEach(salary => {
                const item = createSalaryHistoryItem(salary);
                listEl.appendChild(item);
            });
        } else {
            console.log('⚠️ 沒有薪資歷史記錄');
            emptyEl.style.display = 'block';
        }
        
    } catch (error) {
        console.error('❌ 載入薪資歷史失敗:', error);
        loadingEl.style.display = 'none';
        emptyEl.style.display = 'block';
    }
}

/**
 * 建立薪資歷史項目
 */
function createSalaryHistoryItem(salary) {
    const div = document.createElement('div');
    div.className = 'feature-box flex justify-between items-center hover:bg-white/10 transition cursor-pointer';
    
    div.innerHTML = `
        <div>
            <div class="font-semibold text-lg">
                ${salary['年月'] || '--'}
            </div>
            <div class="text-sm text-gray-400 mt-1">
                ${salary['狀態'] || '已計算'}
            </div>
        </div>
        <div class="text-right">
            <div class="text-2xl font-bold text-purple-400">
                ${formatCurrency(salary['實發金額'])}
            </div>
            <div class="text-xs text-gray-400 mt-1">
                應發 ${formatCurrency(salary['應發總額'])}
            </div>
        </div>
    `;
    
    return div;
}

/**
 * 顯示無薪資訊息
 */
function showNoSalaryMessage(month) {
    const emptyEl = document.getElementById('current-salary-empty');
    if (emptyEl) {
        emptyEl.innerHTML = `
            <div class="empty-state-icon">📄</div>
            <div class="empty-state-title">尚無薪資記錄</div>
            <div class="empty-state-text">
                <p>${month} 還沒有薪資資料</p>
                <p style="margin-top: 0.5rem; font-size: 0.875rem;">
                    💡 提示：薪資需要由管理員先設定和計算<br>
                    請聯繫您的主管或人資部門
                </p>
            </div>
        `;
    }
}

/**
 * 顯示錯誤訊息
 */
function showErrorMessage(message) {
    const emptyEl = document.getElementById('current-salary-empty');
    if (emptyEl) {
        emptyEl.innerHTML = `
            <div class="empty-state-icon">❌</div>
            <div class="empty-state-title">${message}</div>
            <div class="empty-state-text">
                <p>請重新整理頁面或聯繫系統管理員</p>
            </div>
        `;
        emptyEl.style.display = 'block';
    }
}

// ==================== 管理員功能 ====================

/**
 * 綁定表單事件
 */
function bindSalaryEvents() {
    console.log('🔗 綁定薪資表單事件');
    
    const configForm = document.getElementById('salary-config-form');
    if (configForm) {
        configForm.addEventListener('submit', handleSalaryConfigSubmit);
        console.log('✅ 薪資設定表單已綁定');
    }
    
    const calculateBtn = document.getElementById('calculate-salary-btn');
    if (calculateBtn) {
        calculateBtn.addEventListener('click', handleSalaryCalculation);
        console.log('✅ 薪資計算按鈕已綁定');
    }
    
    const filterMonth = document.getElementById('filter-year-month-list');
    if (filterMonth) {
        const now = new Date();
        filterMonth.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
}

/**
 * ✅ 處理薪資設定表單提交
 */
async function handleSalaryConfigSubmit(e) {
    e.preventDefault();
    
    console.log('📝 開始提交薪資設定表單');
    
    const safeGetValue = (id) => {
        const el = document.getElementById(id);
        return el ? el.value.trim() : '';
    };
    
    const employeeId = safeGetValue('config-employee-id');
    const employeeName = safeGetValue('config-employee-name');
    const idNumber = safeGetValue('config-id-number');
    const employeeType = safeGetValue('config-employee-type');
    const salaryType = safeGetValue('config-salary-type');
    const baseSalary = safeGetValue('config-base-salary');
    const bankCode = safeGetValue('config-bank-code');
    const bankAccount = safeGetValue('config-bank-account');
    const hireDate = safeGetValue('config-hire-date');
    const paymentDay = safeGetValue('config-payment-day') || '5';
    const pensionSelfRate = safeGetValue('config-pension-rate') || '0';
    const laborFee = safeGetValue('config-labor-fee') || '0';
    const healthFee = safeGetValue('config-health-fee') || '0';
    const employmentFee = safeGetValue('config-employment-fee') || '0';
    const pensionSelf = safeGetValue('config-pension-self') || '0';
    const incomeTax = safeGetValue('config-income-tax') || '0';
    const note = safeGetValue('config-note');
    
    if (!employeeId || !employeeName || !baseSalary || parseFloat(baseSalary) <= 0) {
        showNotification('❌ 請填寫必填欄位', 'error');
        return;
    }
    
    try {
        showNotification('⏳ 正在儲存薪資設定...', 'info');
        
        const queryString = 
            `employeeId=${encodeURIComponent(employeeId)}` +
            `&employeeName=${encodeURIComponent(employeeName)}` +
            `&idNumber=${encodeURIComponent(idNumber)}` +
            `&employeeType=${encodeURIComponent(employeeType)}` +
            `&salaryType=${encodeURIComponent(salaryType)}` +
            `&baseSalary=${encodeURIComponent(baseSalary)}` +
            `&bankCode=${encodeURIComponent(bankCode)}` +
            `&bankAccount=${encodeURIComponent(bankAccount)}` +
            `&hireDate=${encodeURIComponent(hireDate)}` +
            `&paymentDay=${encodeURIComponent(paymentDay)}` +
            `&pensionSelfRate=${encodeURIComponent(pensionSelfRate)}` +
            `&laborFee=${encodeURIComponent(laborFee)}` +
            `&healthFee=${encodeURIComponent(healthFee)}` +
            `&employmentFee=${encodeURIComponent(employmentFee)}` +
            `&pensionSelf=${encodeURIComponent(pensionSelf)}` +
            `&incomeTax=${encodeURIComponent(incomeTax)}` +
            `&note=${encodeURIComponent(note)}`;
        
        const res = await callApifetch(`setEmployeeSalaryTW&${queryString}`);
        
        if (res.ok) {
            showNotification('✅ 薪資設定已成功儲存', 'success');
            e.target.reset();
            if (typeof setCalculatedValues === 'function') {
                setCalculatedValues(0, 0, 0, 0, 0, 0, 0, 0, 0);
            }
        } else {
            showNotification(`❌ 儲存失敗：${res.msg || res.message || '未知錯誤'}`, 'error');
        }
        
    } catch (error) {
        console.error('❌ 設定薪資失敗:', error);
        showNotification('❌ 設定失敗，請稍後再試', 'error');
    }
}

/**
 * 處理薪資計算
 */
async function handleSalaryCalculation() {
    const employeeIdEl = document.getElementById('calc-employee-id');
    const yearMonthEl = document.getElementById('calc-year-month');
    const resultEl = document.getElementById('salary-calculation-result');
    
    if (!employeeIdEl || !yearMonthEl || !resultEl) return;
    
    const employeeId = employeeIdEl.value.trim();
    const yearMonth = yearMonthEl.value;
    
    if (!employeeId || !yearMonth) {
        showNotification('❌ 請輸入員工ID和計算月份', 'error');
        return;
    }
    
    try {
        showNotification('⏳ 正在計算薪資...', 'info');
        
        const res = await callApifetch(`calculateMonthlySalary&employeeId=${encodeURIComponent(employeeId)}&yearMonth=${encodeURIComponent(yearMonth)}`);
        
        if (res.ok && res.data) {
            displaySalaryCalculation(res.data, resultEl);
            resultEl.style.display = 'block';
            showNotification('✅ 計算完成', 'success');
            
            if (confirm('是否儲存此薪資單？')) {
                await saveSalaryRecord(res.data);
            }
        } else {
            showNotification(`❌ 計算失敗：${res.msg || '未知錯誤'}`, 'error');
        }
        
    } catch (error) {
        console.error('❌ 計算薪資失敗:', error);
        showNotification('❌ 計算失敗，請稍後再試', 'error');
    }
}

/**
 * 顯示薪資計算結果
 */
/**
 * ✅ 顯示薪資計算結果（移除雇主負擔區塊）
 */
function displaySalaryCalculation(data, container) {
    if (!container) return;
    
    const totalDeductions = 
        (parseFloat(data.laborFee) || 0) + 
        (parseFloat(data.healthFee) || 0) + 
        (parseFloat(data.employmentFee) || 0) + 
        (parseFloat(data.pensionSelf) || 0) + 
        (parseFloat(data.incomeTax) || 0) + 
        (parseFloat(data.leaveDeduction) || 0);
    
    container.innerHTML = `
        <div class="calculation-card">
            <h3 class="text-xl font-bold mb-4">
                ${data.employeeName || '--'} - ${data.yearMonth || '--'} 薪資計算結果
            </h3>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div class="info-card" style="background: rgba(34, 197, 94, 0.1);">
                    <div class="info-label">應發總額</div>
                    <div class="info-value" style="color: #22c55e;">${formatCurrency(data.grossSalary)}</div>
                </div>
                <div class="info-card" style="background: rgba(239, 68, 68, 0.1);">
                    <div class="info-label">扣款總額</div>
                    <div class="info-value" style="color: #ef4444;">${formatCurrency(totalDeductions)}</div>
                </div>
                <div class="info-card" style="background: rgba(168, 85, 247, 0.1);">
                    <div class="info-label">實發金額</div>
                    <div class="info-value" style="color: #a855f7;">${formatCurrency(data.netSalary)}</div>
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="calculation-detail">
                    <h4 class="font-semibold mb-3 text-green-400">應發項目</h4>
                    <div class="calculation-row">
                        <span>基本薪資</span>
                        <span class="font-mono">${formatCurrency(data.baseSalary)}</span>
                    </div>
                    <div class="calculation-row">
                        <span>平日加班費</span>
                        <span class="font-mono">${formatCurrency(data.weekdayOvertimePay)}</span>
                    </div>
                    <div class="calculation-row">
                        <span>休息日加班費</span>
                        <span class="font-mono">${formatCurrency(data.restdayOvertimePay)}</span>
                    </div>
                    <div class="calculation-row">
                        <span>國定假日加班費</span>
                        <span class="font-mono">${formatCurrency(data.holidayOvertimePay)}</span>
                    </div>
                    <div class="calculation-row total">
                        <span>應發總額</span>
                        <span>${formatCurrency(data.grossSalary)}</span>
                    </div>
                </div>
                
                <div class="calculation-detail">
                    <h4 class="font-semibold mb-3 text-red-400">扣款項目</h4>
                    <div class="calculation-row">
                        <span>勞保費</span>
                        <span class="font-mono">${formatCurrency(data.laborFee)}</span>
                    </div>
                    <div class="calculation-row">
                        <span>健保費</span>
                        <span class="font-mono">${formatCurrency(data.healthFee)}</span>
                    </div>
                    <div class="calculation-row">
                        <span>就業保險費</span>
                        <span class="font-mono">${formatCurrency(data.employmentFee)}</span>
                    </div>
                    <div class="calculation-row">
                        <span>勞退自提</span>
                        <span class="font-mono">${formatCurrency(data.pensionSelf)}</span>
                    </div>
                    <div class="calculation-row">
                        <span>所得稅</span>
                        <span class="font-mono">${formatCurrency(data.incomeTax)}</span>
                    </div>
                    <div class="calculation-row">
                        <span>請假扣款</span>
                        <span class="font-mono">${formatCurrency(data.leaveDeduction || 0)}</span>
                    </div>
                    <div class="calculation-row total">
                        <span>實發金額</span>
                        <span>${formatCurrency(data.netSalary)}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * ✅ 儲存薪資記錄
 */
async function saveSalaryRecord(data) {
    try {
        showNotification('⏳ 正在儲存薪資單...', 'info');
        
        const queryString = 
            `employeeId=${encodeURIComponent(data.employeeId)}` +
            `&employeeName=${encodeURIComponent(data.employeeName)}` +
            `&yearMonth=${encodeURIComponent(data.yearMonth)}` +
            `&baseSalary=${encodeURIComponent(data.baseSalary)}` +
            `&weekdayOvertimePay=${encodeURIComponent(data.weekdayOvertimePay || 0)}` +
            `&restdayOvertimePay=${encodeURIComponent(data.restdayOvertimePay || 0)}` +
            `&holidayOvertimePay=${encodeURIComponent(data.holidayOvertimePay || 0)}` +
            `&laborFee=${encodeURIComponent(data.laborFee || 0)}` +
            `&healthFee=${encodeURIComponent(data.healthFee || 0)}` +
            `&employmentFee=${encodeURIComponent(data.employmentFee || 0)}` +
            `&pensionSelf=${encodeURIComponent(data.pensionSelf || 0)}` +
            `&incomeTax=${encodeURIComponent(data.incomeTax || 0)}` +
            `&leaveDeduction=${encodeURIComponent(data.leaveDeduction || 0)}` +
            `&grossSalary=${encodeURIComponent(data.grossSalary)}` +
            `&netSalary=${encodeURIComponent(data.netSalary)}` +
            `&bankCode=${encodeURIComponent(data.bankCode || '')}` +
            `&bankAccount=${encodeURIComponent(data.bankAccount || '')}`;
        
        const res = await callApifetch(`saveMonthlySalary&${queryString}`);
        
        if (res.ok) {
            showNotification('✅ 薪資單已成功儲存', 'success');
        } else {
            showNotification(`❌ 儲存失敗：${res.msg || '未知錯誤'}`, 'error');
        }
        
    } catch (error) {
        console.error('❌ 儲存薪資單失敗:', error);
        showNotification('❌ 儲存失敗，請稍後再試', 'error');
    }
}

/**
 * 載入所有員工薪資列表
 */
async function loadAllEmployeeSalaryFromList() {
    const yearMonthEl = document.getElementById('filter-year-month-list');
    const loadingEl = document.getElementById('all-salary-loading-list');
    const listEl = document.getElementById('all-salary-list-content');
    
    if (!yearMonthEl || !loadingEl || !listEl) return;
    
    const yearMonth = yearMonthEl.value;
    
    if (!yearMonth) {
        showNotification('請選擇查詢年月', 'error');
        return;
    }
    
    try {
        loadingEl.style.display = 'block';
        listEl.innerHTML = '';
        
        const res = await callApifetch(`getAllMonthlySalary&yearMonth=${encodeURIComponent(yearMonth)}`);
        
        loadingEl.style.display = 'none';
        
        if (res.ok && res.data && res.data.length > 0) {
            res.data.forEach(salary => {
                const item = createAllSalaryItem(salary);
                listEl.appendChild(item);
            });
        } else {
            listEl.innerHTML = '<p class="text-center text-gray-400 py-8">尚無薪資記錄</p>';
        }
        
    } catch (error) {
        console.error('❌ 載入薪資列表失敗:', error);
        loadingEl.style.display = 'none';
        listEl.innerHTML = '<p class="text-center text-red-400 py-8">載入失敗</p>';
    }
}

/**
 * 建立所有員工薪資項目
 */
function createAllSalaryItem(salary) {
    const div = document.createElement('div');
    div.className = 'feature-box flex justify-between items-center hover:bg-white/10 transition cursor-pointer';
    
    div.innerHTML = `
        <div>
            <div class="font-semibold text-lg">
                ${salary['員工姓名'] || '--'} <span class="text-gray-400 text-sm">(${salary['員工ID'] || '--'})</span>
            </div>
            <div class="text-sm text-gray-400 mt-1">
                ${salary['年月'] || '--'} | ${salary['狀態'] || '--'}
            </div>
        </div>
        <div class="text-right">
            <div class="text-2xl font-bold text-green-400">
                ${formatCurrency(salary['實發金額'])}
            </div>
            <div class="text-xs text-gray-400 mt-1">
                ${getBankName(salary['銀行代碼'])} ${salary['銀行帳號'] || '--'}
            </div>
        </div>
    `;
    
    return div;
}

// ==================== 工具函數 ====================

/**
 * 格式化貨幣
 */
function formatCurrency(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) return '$0';
    const num = parseFloat(amount);
    if (isNaN(num)) return '$0';
    return '$' + num.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/**
 * 取得銀行名稱
 */
function getBankName(code) {
    const banks = {
        // 公營銀行
        "004": "臺灣銀行",
        "005": "臺灣土地銀行",
        "006": "合作金庫商業銀行",
        "007": "第一商業銀行",
        "008": "華南商業銀行",
        "009": "彰化商業銀行",
        "011": "上海商業儲蓄銀行",
        "012": "台北富邦商業銀行",
        "013": "國泰世華商業銀行",
        "016": "高雄銀行",
        "017": "兆豐國際商業銀行",
        "018": "全國農業金庫",
        
        // 民營銀行
        "021": "花旗（台灣）商業銀行",
        "050": "臺灣中小企業銀行",
        "052": "渣打國際商業銀行",
        "053": "台中商業銀行",
        "054": "京城商業銀行",
        "081": "匯豐（台灣）商業銀行",
        "101": "瑞興商業銀行",
        "102": "華泰商業銀行",
        "103": "臺灣新光商業銀行",
        "108": "陽信商業銀行",
        "118": "板信商業銀行",
        "147": "三信商業銀行",
        
        // 新銀行（8開頭）
        "803": "聯邦商業銀行",
        "805": "遠東國際商業銀行",
        "806": "元大商業銀行",
        "807": "永豐商業銀行",
        "808": "玉山商業銀行",
        "809": "凱基商業銀行",
        "810": "星展（台灣）商業銀行",
        "812": "台新國際商業銀行",
        "814": "大眾商業銀行",
        "815": "日盛國際商業銀行",
        "816": "安泰商業銀行",
        "822": "中國信託商業銀行",
        "824": "連線商業銀行",
        
        // 外商銀行
        "072": "德意志銀行",
        "075": "東亞銀行",
        "082": "法國巴黎銀行",
        "085": "新加坡商新加坡華僑銀行",
        
        // 郵局
        "700": "中華郵政",
        
        // 農漁會信用部
        "910": "財團法人農漁會聯合資訊中心"
    };
    
    return banks[code] || "未知銀行";
}

/**
 * ✅ 顯示通知訊息
 */
function showNotification(message, type = 'info') {
    if (typeof window.showNotification === 'function') {
        window.showNotification(message, type);
        return;
    }
    
    if (type === 'error') {
        alert('❌ ' + message);
    } else if (type === 'success') {
        alert('✅ ' + message);
    } else {
        console.log('ℹ️ ' + message);
    }
}

// 🔍 前端診斷工具 - 請在瀏覽器 Console 執行

/**
 * 診斷薪資查詢問題
 */
async function diagnoseSalaryIssue() {
    console.log('═══════════════════════════════════════');
    console.log('🔍 開始診斷薪資查詢問題');
    console.log('═══════════════════════════════════════');
    console.log('');
    
    // 步驟 1：檢查 Session
    console.log('📡 步驟 1：檢查 Session');
    try {
        const session = await callApifetch("checkSession");
        console.log('Session 結果:', session);
        
        if (!session.ok || !session.user) {
            console.error('❌ Session 無效');
            return;
        }
        
        console.log('✅ Session 有效');
        console.log('   - userId:', session.user.userId);
        console.log('   - name:', session.user.name);
        console.log('   - dept:', session.user.dept);
        console.log('');
        
    } catch (error) {
        console.error('❌ Session 檢查失敗:', error);
        return;
    }
    
    // 步驟 2：測試薪資查詢
    console.log('💰 步驟 2：測試薪資查詢');
    const yearMonth = '2025-11';
    console.log('   查詢月份:', yearMonth);
    console.log('');
    
    try {
        // 方法 A：使用完整 URL
        console.log('🔍 方法 A：測試完整 API 路徑');
        const urlA = `${API_BASE_URL}?action=getMySalary&yearMonth=${yearMonth}&token=${getToken()}`;
        console.log('   URL:', urlA);
        
        const responseA = await fetch(urlA);
        const resultA = await responseA.json();
        console.log('   結果:', resultA);
        console.log('');
        
        // 方法 B：使用 callApifetch
        console.log('🔍 方法 B：使用 callApifetch');
        const resultB = await callApifetch(`getMySalary&yearMonth=${yearMonth}`);
        console.log('   結果:', resultB);
        console.log('');
        
        // 步驟 3：比較結果
        console.log('📊 步驟 3：結果比較');
        console.log('   方法 A 成功:', resultA.ok || resultA.success);
        console.log('   方法 B 成功:', resultB.ok || resultB.success);
        console.log('');
        
        if (resultA.ok && resultA.data) {
            console.log('✅ 找到資料！');
            console.log('   薪資單ID:', resultA.data['薪資單ID']);
            console.log('   員工姓名:', resultA.data['員工姓名']);
            console.log('   實發金額:', resultA.data['實發金額']);
        } else if (resultB.ok && resultB.data) {
            console.log('✅ 找到資料！');
            console.log('   薪資單ID:', resultB.data['薪資單ID']);
            console.log('   員工姓名:', resultB.data['員工姓名']);
            console.log('   實發金額:', resultB.data['實發金額']);
        } else {
            console.error('❌ 兩種方法都失敗');
            console.log('   錯誤訊息 A:', resultA.msg || resultA.message);
            console.log('   錯誤訊息 B:', resultB.msg || resultB.message);
        }
        
    } catch (error) {
        console.error('❌ 查詢失敗:', error);
        console.error('錯誤堆疊:', error.stack);
    }
    
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('🏁 診斷完成');
    console.log('═══════════════════════════════════════');
}

/**
 * 獲取當前 Token
 */
function getToken() {
    return sessionStorage.getItem('token') || localStorage.getItem('token') || '';
}

// 執行診斷
console.log('💡 執行以下指令開始診斷：');
console.log('   diagnoseSalaryIssue()');

console.log('✅ salary.js 已完整載入 - 完整版（800+行）');