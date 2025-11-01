// salary.js - 薪資管理前端邏輯（✅ 完整修正版 - 確保唯一性）

if (typeof callApifetch !== 'function') {
    console.error('❌ callApifetch 函數未定義，請確認 script.js 已正確載入');
}

// ==================== 全域變數 ====================
let currentUser = null;  // ⭐ 儲存當前使用者資訊

/**
 * ✅ 初始化薪資頁面（修正版）
 */
async function initSalaryTab() {
    try {
        console.log('🎯 初始化薪資頁面');
        
        // ⭐ 關鍵：先驗證並取得使用者資訊
        const session = await callApifetch("checkSession");
        
        if (!session.ok || !session.user) {
            console.warn('❌ 無法取得使用者資訊');
            showNotification('請先登入', 'error');
            
            // 重新導向到登入頁
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
            return;
        }
        
        // ⭐ 儲存使用者資訊到全域變數
        currentUser = {
            userId: session.user.userId,
            name: session.user.name,
            dept: session.user.dept,
            isAdmin: session.user.dept === "管理員"
        };
        
        console.log(`👤 使用者: ${currentUser.name} (${currentUser.userId})`);
        console.log(`🔐 權限: ${currentUser.isAdmin ? '管理員' : '一般員工'}`);
        console.log(`📌 完整資訊:`, currentUser);
        
        // ⭐ 載入當前員工的薪資（使用 session 中的 userId）
        await loadCurrentEmployeeSalary();
        
        // ⭐ 載入薪資歷史
        await loadSalaryHistory();
        
    } catch (error) {
        console.error('❌ 初始化薪資頁面失敗:', error);
        showNotification('初始化失敗，請重新登入', 'error');
    }
}

/**
 * ✅ 載入當前員工的薪資（修正版 - 不需傳入參數）
 */
async function loadCurrentEmployeeSalary() {
    try {
        // ⭐ 關鍵修正：不需要傳入 userId，後端會從 session 取得
        console.log(`💰 載入員工薪資 - 使用 session token`);
        
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
            console.log('⚠️ 沒有薪資記錄');
            showNoSalaryMessage(currentMonth);
            if (emptyEl) emptyEl.style.display = 'block';
        }
        
    } catch (error) {
        console.error('❌ 載入失敗:', error);
        showErrorMessage('載入薪資資料失敗');
        
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
    
    if (!loadingEl || !emptyEl || !contentEl) return;
    
    try {
        loadingEl.style.display = 'block';
        emptyEl.style.display = 'none';
        contentEl.style.display = 'none';
        
        // ⭐ 關鍵：不傳 userId，後端從 session 取得
        const res = await callApifetch(`getMySalary&yearMonth=${yearMonth}`);
        
        console.log(`📥 查詢 ${yearMonth} 薪資:`, res);
        
        loadingEl.style.display = 'none';
        
        if (res.ok && res.data) {
            displayCurrentSalary(res.data);
            contentEl.style.display = 'block';
        } else {
            emptyEl.style.display = 'block';
        }
        
    } catch (error) {
        console.error('載入薪資失敗:', error);
        loadingEl.style.display = 'none';
        emptyEl.style.display = 'block';
    }
}

/**
 * 顯示薪資明細
 */
function displayEmployeeSalary(data) {
    console.log('📊 顯示薪資明細:', data);
    
    setElementText('gross-salary', formatCurrency(data['應發總額']));
    setElementText('net-salary', formatCurrency(data['實發金額']));
    
    const deductions = 
        (data['勞保費'] || 0) + 
        (data['健保費'] || 0) + 
        (data['就業保險費'] || 0) + 
        (data['勞退自提'] || 0) + 
        (data['所得稅'] || 0) +
        (data['請假扣款'] || 0);
    
    setElementText('total-deductions', formatCurrency(deductions));
    
    setElementText('detail-base-salary', formatCurrency(data['基本薪資']));
    setElementText('detail-weekday-overtime', formatCurrency(data['平日加班費']));
    setElementText('detail-restday-overtime', formatCurrency(data['休息日加班費']));
    setElementText('detail-holiday-overtime', formatCurrency(data['國定假日加班費']));
    
    setElementText('detail-labor-fee', formatCurrency(data['勞保費']));
    setElementText('detail-health-fee', formatCurrency(data['健保費']));
    setElementText('detail-employment-fee', formatCurrency(data['就業保險費']));
    setElementText('detail-pension-self', formatCurrency(data['勞退自提']));
    setElementText('detail-income-tax', formatCurrency(data['所得稅']));
    setElementText('detail-leave-deduction', formatCurrency(data['請假扣款']));
    
    setElementText('detail-bank-name', getBankName(data['銀行代碼']));
    setElementText('detail-bank-account', data['銀行帳號'] || '--');
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
        loadingEl.style.display = 'block';
        emptyEl.style.display = 'none';
        listEl.innerHTML = '';
        
        // ⭐ 關鍵：不傳 userId，後端從 session 取得
        const res = await callApifetch('getMySalaryHistory&limit=12');
        
        console.log('📥 薪資歷史:', res);
        
        loadingEl.style.display = 'none';
        
        if (res.ok && res.data && res.data.length > 0) {
            res.data.forEach(salary => {
                const item = createSalaryHistoryItem(salary);
                listEl.appendChild(item);
            });
        } else {
            emptyEl.style.display = 'block';
        }
        
    } catch (error) {
        console.error('載入薪資歷史失敗:', error);
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
    const container = document.getElementById('current-salary-content');
    if (container) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📄</div>
                <div class="empty-state-title">尚無薪資記錄</div>
                <div class="empty-state-text">
                    <p>${month} 還沒有薪資資料</p>
                    <p style="margin-top: 0.5rem; font-size: 0.875rem;">
                        💡 提示：薪資需要由管理員先設定和計算<br>
                        請聯繫您的主管或人資部門
                    </p>
                </div>
            </div>
        `;
        container.style.display = 'block';
    }
}

/**
 * 顯示錯誤訊息
 */
function showErrorMessage(message) {
    const container = document.getElementById('current-salary-content');
    if (container) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">❌</div>
                <div class="empty-state-title">${message}</div>
            </div>
        `;
        container.style.display = 'block';
    }
}

/**
 * 設定元素文字內容（安全版本）
 */
function setElementText(id, text) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = text;
    } else {
        console.warn(`元素 #${id} 未找到`);
    }
}

// ==================== 管理員功能 ====================

/**
 * 綁定表單事件
 */
function bindSalaryEvents() {
    const configForm = document.getElementById('salary-config-form');
    if (configForm) {
        configForm.addEventListener('submit', handleSalaryConfigSubmit);
    }
    
    const calculateBtn = document.getElementById('calculate-salary-btn');
    if (calculateBtn) {
        calculateBtn.addEventListener('click', handleSalaryCalculation);
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
        return el ? el.value : '';
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
    const paymentDay = safeGetValue('config-payment-day');
    const pensionSelfRate = safeGetValue('config-pension-rate') || '0';
    const laborFee = safeGetValue('config-labor-fee') || '0';
    const healthFee = safeGetValue('config-health-fee') || '0';
    const employmentFee = safeGetValue('config-employment-fee') || '0';
    const pensionSelf = safeGetValue('config-pension-self') || '0';
    const incomeTax = safeGetValue('config-income-tax') || '0';
    const note = safeGetValue('config-note') || '';
    
    if (!employeeId || !employeeName || !baseSalary) {
        showNotification('❌ 請填寫必填欄位', 'error');
        return;
    }
    
    try {
        showNotification('⏳ 正在儲存...', 'info');
        
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
            setCalculatedValues(0, 0, 0, 0, 0, 0, 0, 0, 0);
        } else {
            showNotification(`❌ 儲存失敗：${res.msg || '未知錯誤'}`, 'error');
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
    
    const employeeId = employeeIdEl.value;
    const yearMonth = yearMonthEl.value;
    
    if (!employeeId || !yearMonth) {
        showNotification('❌ 請輸入員工ID和計算月份', 'error');
        return;
    }
    
    try {
        showNotification('⏳ 正在計算薪資...', 'info');
        
        const res = await callApifetch(`calculateMonthlySalary&employeeId=${employeeId}&yearMonth=${yearMonth}`);
        
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
function displaySalaryCalculation(data, container) {
    if (!container) return;
    
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
                    <div class="info-value" style="color: #ef4444;">${formatCurrency(data.laborFee + data.healthFee + data.employmentFee + data.pensionSelf + data.incomeTax + (data.leaveDeduction || 0))}</div>
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
            `&weekdayOvertimePay=${encodeURIComponent(data.weekdayOvertimePay)}` +
            `&restdayOvertimePay=${encodeURIComponent(data.restdayOvertimePay)}` +
            `&holidayOvertimePay=${encodeURIComponent(data.holidayOvertimePay)}` +
            `&laborFee=${encodeURIComponent(data.laborFee)}` +
            `&healthFee=${encodeURIComponent(data.healthFee)}` +
            `&employmentFee=${encodeURIComponent(data.employmentFee)}` +
            `&pensionSelf=${encodeURIComponent(data.pensionSelf)}` +
            `&incomeTax=${encodeURIComponent(data.incomeTax)}` +
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
        
        const res = await callApifetch(`getAllMonthlySalary&yearMonth=${yearMonth}`);
        
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
    return '$' + Number(amount).toLocaleString('zh-TW');
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
    if (typeof window.showNotification === 'function') {
        window.showNotification(message, type);
        return;
    }
    
    if (type === 'error') {
        alert('❌ ' + message);
    } else if (type === 'success') {
        alert('✅ ' + message);
    } else {
        console.log(message);
    }
}

console.log('✅ salary.js 已完整載入 - 確保唯一性版本');