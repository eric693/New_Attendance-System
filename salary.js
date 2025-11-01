// salary.js - 薪資管理前端邏輯（✅ 完整修正版 v1.1 - 修復初始化錯誤）

if (typeof callApifetch !== 'function') {
    console.error('❌ callApifetch 函數未定義，請確認 script.js 已正確載入');
}
// ==================== 全域變數 ====================
let currentUser = null;  // ✅ 檔案最頂部定義

/**
 * ✅ 初始化薪資頁面
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
        
        // ⭐⭐⭐ 步驟 2：立即設定 currentUser（最重要！在使用之前）
        currentUser = {
            userId: session.user.userId,
            employeeId: session.user.userId,
            name: session.user.name,
            dept: session.user.dept,
            isAdmin: session.user.dept === "管理員"
        };
        
        console.log('✅ 使用者資訊已設定');
        console.log('👤 使用者:', currentUser.name);
        console.log('🔐 權限:', currentUser.isAdmin ? '管理員' : '一般員工');
        console.log('📌 員工ID:', currentUser.employeeId);
        
        // ⭐ 步驟 3：設定當前月份
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        console.log('📅 當前月份:', currentMonth);
        
        const employeeSalaryMonth = document.getElementById('employee-salary-month');
        if (employeeSalaryMonth) {
            employeeSalaryMonth.value = currentMonth;
        }
        
        // ⭐ 步驟 4：載入薪資資料
        console.log('💰 開始載入薪資資料...');
        await loadCurrentEmployeeSalary();
        
        console.log('📋 開始載入薪資歷史...');
        await loadSalaryHistory();
        
        // ⭐ 步驟 5：綁定事件（管理員才需要）
        if (currentUser.isAdmin) {
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
            if (emptyEl) emptyEl.style.display = 'block';
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
 * ✅ 按月份查詢薪資（修正版）
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
        
        // ⭐ 關鍵：不傳 userId，後端從 session 取得
        const res = await callApifetch(`getMySalary&yearMonth=${yearMonth}`);
        
        console.log(`📥 查詢 ${yearMonth} 薪資回應:`, res);
        
        loadingEl.style.display = 'none';
        
        if (res.ok && res.data) {
            console.log(`✅ 找到 ${yearMonth} 的薪資記錄`);
            displayCurrentSalary(res.data);
            contentEl.style.display = 'block';
        } else {
            console.log(`⚠️ 沒有 ${yearMonth} 的薪資記錄`);
            showNoSalaryMessage(yearMonth);
            emptyEl.style.display = 'block';
        }
        
    } catch (error) {
        console.error(`❌ 載入 ${yearMonth} 薪資失敗:`, error);
        console.error('錯誤堆疊:', error.stack);
        loadingEl.style.display = 'none';
        emptyEl.style.display = 'block';
    }
}

/**
 * 顯示薪資明細
 */
function displayEmployeeSalary(data) {
    console.log('📊 顯示薪資明細:', data);
    
    // ✅ 安全的設定函數
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
 * 顯示當月薪資（相容舊函數名稱）
 */
function displayCurrentSalary(salary) {
    displayEmployeeSalary(salary);
}

/**
 * ✅ 載入薪資歷史（修正版）
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
        
        // ⭐ 關鍵：不傳 userId，後端從 session 取得
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
        console.error('錯誤堆疊:', error.stack);
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
        emptyEl.style.display = 'block';
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
 * ✅ 處理薪資設定表單提交（完全修正版）
 */
async function handleSalaryConfigSubmit(e) {
    e.preventDefault();
    
    console.log('📝 開始提交薪資設定表單');
    
    const safeGetValue = (id) => {
        const el = document.getElementById(id);
        return el ? el.value.trim() : '';
    };
    
    // ✅ 取得所有欄位值
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
    
    // 驗證必填欄位
    if (!employeeId) {
        showNotification('❌ 請輸入員工ID', 'error');
        return;
    }
    
    if (!employeeName) {
        showNotification('❌ 請輸入員工姓名', 'error');
        return;
    }
    
    if (!baseSalary || parseFloat(baseSalary) <= 0) {
        showNotification('❌ 請輸入有效的基本薪資', 'error');
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
        
        console.log('📤 發送薪資設定請求');
        
        const res = await callApifetch(`setEmployeeSalaryTW&${queryString}`);
        
        console.log('📥 薪資設定回應:', res);
        
        if (res.ok) {
            showNotification('✅ 薪資設定已成功儲存', 'success');
            e.target.reset();
            
            // 清空計算預覽
            if (typeof setCalculatedValues === 'function') {
                setCalculatedValues(0, 0, 0, 0, 0, 0, 0, 0, 0);
            }
        } else {
            showNotification(`❌ 儲存失敗：${res.msg || res.message || '未知錯誤'}`, 'error');
        }
        
    } catch (error) {
        console.error('❌ 設定薪資失敗:', error);
        console.error('錯誤堆疊:', error.stack);
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
    
    if (!employeeIdEl || !yearMonthEl || !resultEl) {
        console.warn('計算表單元素未找到');
        return;
    }
    
    const employeeId = employeeIdEl.value.trim();
    const yearMonth = yearMonthEl.value;
    
    if (!employeeId) {
        showNotification('❌ 請輸入員工ID', 'error');
        return;
    }
    
    if (!yearMonth) {
        showNotification('❌ 請選擇計算月份', 'error');
        return;
    }
    
    try {
        showNotification('⏳ 正在計算薪資...', 'info');
        
        console.log(`🧮 計算薪資: employeeId=${employeeId}, yearMonth=${yearMonth}`);
        
        const res = await callApifetch(`calculateMonthlySalary&employeeId=${encodeURIComponent(employeeId)}&yearMonth=${encodeURIComponent(yearMonth)}`);
        
        console.log('📥 計算結果:', res);
        
        if (res.ok && res.data) {
            displaySalaryCalculation(res.data, resultEl);
            resultEl.style.display = 'block';
            showNotification('✅ 計算完成', 'success');
            
            if (confirm('是否儲存此薪資單？')) {
                await saveSalaryRecord(res.data);
            }
        } else {
            showNotification(`❌ 計算失敗：${res.msg || res.message || '未知錯誤'}`, 'error');
        }
        
    } catch (error) {
        console.error('❌ 計算薪資失敗:', error);
        console.error('錯誤堆疊:', error.stack);
        showNotification('❌ 計算失敗，請稍後再試', 'error');
    }
}

/**
 * 顯示薪資計算結果
 */
function displaySalaryCalculation(data, container) {
    if (!container) {
        console.warn('計算結果容器未找到');
        return;
    }
    
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
    
    console.log('✅ 薪資計算結果顯示完成');
}

/**
 * ✅ 儲存薪資記錄
 */
async function saveSalaryRecord(data) {
    try {
        showNotification('⏳ 正在儲存薪資單...', 'info');
        
        console.log('💾 儲存薪資記錄:', data);
        
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
        
        console.log('📥 儲存結果:', res);
        
        if (res.ok) {
            showNotification('✅ 薪資單已成功儲存', 'success');
        } else {
            showNotification(`❌ 儲存失敗：${res.msg || res.message || '未知錯誤'}`, 'error');
        }
        
    } catch (error) {
        console.error('❌ 儲存薪資單失敗:', error);
        console.error('錯誤堆疊:', error.stack);
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
    
    if (!yearMonthEl || !loadingEl || !listEl) {
        console.warn('薪資列表元素未找到');
        return;
    }
    
    const yearMonth = yearMonthEl.value;
    
    if (!yearMonth) {
        showNotification('請選擇查詢年月', 'error');
        return;
    }
    
    try {
        console.log(`📋 載入所有員工薪資: ${yearMonth}`);
        
        loadingEl.style.display = 'block';
        listEl.innerHTML = '';
        
        const res = await callApifetch(`getAllMonthlySalary&yearMonth=${encodeURIComponent(yearMonth)}`);
        
        console.log('📥 薪資列表回應:', res);
        
        loadingEl.style.display = 'none';
        
        if (res.ok && res.data && res.data.length > 0) {
            console.log(`✅ 找到 ${res.data.length} 筆薪資記錄`);
            res.data.forEach(salary => {
                const item = createAllSalaryItem(salary);
                listEl.appendChild(item);
            });
        } else {
            listEl.innerHTML = '<p class="text-center text-gray-400 py-8">尚無薪資記錄</p>';
        }
        
    } catch (error) {
        console.error('❌ 載入薪資列表失敗:', error);
        console.error('錯誤堆疊:', error.stack);
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
        "004": "臺灣銀行",
        "005": "土地銀行",
        "006": "合作金庫",
        "007": "第一銀行",
        "008": "華南銀行",
        "009": "彰化銀行",
        "012": "台北富邦",
        "013": "國泰世華",
        "017": "兆豐銀行",
        "803": "聯邦銀行",
        "806": "元大銀行",
        "807": "永豐銀行",
        "808": "玉山銀行",
        "809": "凱基銀行",
        "812": "台新銀行",
        "822": "中國信託"
    };
    
    return banks[code] || code || '--';
}

/**
 * ✅ 顯示通知訊息
 */
function showNotification(message, type = 'info') {
    // 優先使用全域的 showNotification 函數
    if (typeof window.showNotification === 'function') {
        window.showNotification(message, type);
        return;
    }
    
    // 備用：使用 alert
    if (type === 'error') {
        alert('❌ ' + message);
    } else if (type === 'success') {
        alert('✅ ' + message);
    } else {
        console.log('ℹ️ ' + message);
    }
}

console.log('✅ salary.js 已完整載入 - 修復版本 v1.1');