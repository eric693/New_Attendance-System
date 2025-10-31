// salary.js - 薪資管理前端邏輯（修正版）

/**
 * 初始化薪資分頁
 */
function initSalaryTab() {
    console.log('💰 初始化薪資分頁');
    
    // 檢查使用者權限
    checkUserRole();
    
    // 載入當月薪資
    loadCurrentSalary();
    
    // 載入薪資歷史
    loadSalaryHistory();
    
    // 綁定表單事件
    bindSalaryEvents();
}

/**
 * 檢查使用者角色（管理員 vs 一般員工）
 */
async function checkUserRole() {
    try {
        const res = await callApifetch("checkSession");
        
        if (res.ok && res.user) {
            const employeeSection = document.getElementById('employee-salary-section');
            const adminSection = document.getElementById('admin-salary-section');
            
            if (!employeeSection || !adminSection) {
                console.warn('薪資區塊元素未找到');
                return;
            }
            
            if (res.user.dept === "管理員") {
                employeeSection.style.display = 'none';
                adminSection.style.display = 'block';
                loadAllEmployeeSalary();
            } else {
                employeeSection.style.display = 'block';
                adminSection.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('檢查使用者角色失敗:', error);
    }
}

/**
 * 載入當月薪資
 */
async function loadCurrentSalary() {
    const loadingEl = document.getElementById('current-salary-loading');
    const emptyEl = document.getElementById('current-salary-empty');
    const contentEl = document.getElementById('current-salary-content');
    
    if (!loadingEl || !emptyEl || !contentEl) {
        console.warn('薪資顯示元素未找到');
        return;
    }
    
    try {
        loadingEl.style.display = 'block';
        emptyEl.style.display = 'none';
        contentEl.style.display = 'none';
        
        const now = new Date();
        const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        // ✅ 修正：使用正確的 API 參數名稱
        const res = await callApifetch(`getMySalary&yearMonth=${yearMonth}`);
        
        loadingEl.style.display = 'none';
        
        if (res.ok && res.data) {
            displayCurrentSalary(res.data);
            contentEl.style.display = 'block';
        } else {
            emptyEl.style.display = 'block';
        }
        
    } catch (error) {
        console.error('載入當月薪資失敗:', error);
        loadingEl.style.display = 'none';
        emptyEl.style.display = 'block';
    }
}

/**
 * 顯示當月薪資
 */
function displayCurrentSalary(salary) {
    const safeSetText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };
    
    // ✅ 修正：使用後端回傳的正確欄位名稱（中文欄位）
    safeSetText('gross-salary', formatCurrency(salary['應發總額']));
    
    // 計算總扣款
    const totalDeductions = 
        (salary['勞保費'] || 0) + 
        (salary['健保費'] || 0) + 
        (salary['就業保險費'] || 0) + 
        (salary['勞退自提'] || 0) + 
        (salary['所得稅'] || 0) + 
        (salary['請假扣款'] || 0);
    
    safeSetText('total-deductions', formatCurrency(totalDeductions));
    safeSetText('net-salary', formatCurrency(salary['實發金額']));
    
    // 應發項目
    safeSetText('detail-base-salary', formatCurrency(salary['基本薪資']));
    safeSetText('detail-weekday-overtime', formatCurrency(salary['平日加班費']));
    safeSetText('detail-restday-overtime', formatCurrency(salary['休息日加班費']));
    safeSetText('detail-holiday-overtime', formatCurrency(salary['國定假日加班費']));
    
    // 扣款項目
    safeSetText('detail-labor-fee', formatCurrency(salary['勞保費']));
    safeSetText('detail-health-fee', formatCurrency(salary['健保費']));
    safeSetText('detail-employment-fee', formatCurrency(salary['就業保險費']));
    safeSetText('detail-pension-self', formatCurrency(salary['勞退自提']));
    safeSetText('detail-income-tax', formatCurrency(salary['所得稅']));
    safeSetText('detail-leave-deduction', formatCurrency(salary['請假扣款']));
    
    // 銀行資訊
    safeSetText('detail-bank-name', getBankName(salary['銀行代碼']));
    safeSetText('detail-bank-account', salary['銀行帳號'] || '--');
}

/**
 * 載入薪資歷史
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
        
        // ✅ 修正：使用正確的參數名稱
        const res = await callApifetch('getMySalaryHistory&limit=12');
        
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
    div.className = 'bg-white dark:bg-gray-800 rounded-lg p-4 flex justify-between items-center hover:shadow-md transition';
    
    div.innerHTML = `
        <div>
            <div class="font-semibold text-gray-800 dark:text-white">
                ${salary['年月'] || '--'}
            </div>
            <div class="text-sm text-gray-500 dark:text-gray-400">
                ${salary['狀態'] || '已計算'}
            </div>
        </div>
        <div class="text-right">
            <div class="text-lg font-bold text-purple-900 dark:text-purple-200">
                ${formatCurrency(salary['實發金額'])}
            </div>
            <div class="text-xs text-gray-500">
                應發 ${formatCurrency(salary['應發總額'])}
            </div>
        </div>
    `;
    
    return div;
}

/**
 * 綁定表單事件
 */
function bindSalaryEvents() {
    // 薪資設定表單
    const configForm = document.getElementById('salary-config-form');
    if (configForm) {
        configForm.addEventListener('submit', handleSalaryConfigSubmit);
    }
    
    // 薪資計算按鈕
    const calculateBtn = document.getElementById('calculate-salary-btn');
    if (calculateBtn) {
        calculateBtn.addEventListener('click', handleSalaryCalculation);
    }
    
    // 月份篩選
    const filterMonth = document.getElementById('filter-year-month');
    if (filterMonth) {
        filterMonth.addEventListener('change', loadAllEmployeeSalary);
        
        const now = new Date();
        filterMonth.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
}

/**
 * 處理薪資設定表單提交
 */
async function handleSalaryConfigSubmit(e) {
    e.preventDefault();
    
    const safeGetValue = (id) => {
        const el = document.getElementById(id);
        return el ? el.value : '';
    };
    
    // ✅ 修正：使用後端期望的參數名稱
    const formData = {
        employeeId: safeGetValue('config-employee-id'),
        employeeName: safeGetValue('config-employee-name'),
        idNumber: safeGetValue('config-id-number'),
        employeeType: safeGetValue('config-employee-type'),
        salaryType: safeGetValue('config-salary-type'),
        baseSalary: safeGetValue('config-base-salary'),
        bankCode: safeGetValue('config-bank-code'),
        bankAccount: safeGetValue('config-bank-account'),
        hireDate: safeGetValue('config-hire-date'),
        paymentDay: safeGetValue('config-payment-day'),
        pensionSelfRate: safeGetValue('config-pension-rate'),
        laborFee: safeGetValue('config-labor-fee'),
        healthFee: safeGetValue('config-health-fee'),
        employmentFee: safeGetValue('config-employment-fee'),
        incomeTax: safeGetValue('config-income-tax'),
        note: safeGetValue('config-note')
    };
    
    try {
        // ✅ 修正：使用 URLSearchParams 正確編碼參數
        const params = new URLSearchParams(formData).toString();
        const res = await callApifetch(`setEmployeeSalaryTW&${params}`);
        
        if (res.ok) {
            showNotification('薪資設定已成功儲存', 'success');
            e.target.reset();
        } else {
            showNotification(`儲存失敗：${res.msg}`, 'error');
        }
        
    } catch (error) {
        console.error('設定薪資失敗:', error);
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
    
    const employeeId = employeeIdEl.value;
    const yearMonth = yearMonthEl.value;
    
    if (!employeeId || !yearMonth) {
        showNotification('請輸入員工ID和計算月份', 'error');
        return;
    }
    
    try {
        showNotification('正在計算薪資...', 'info');
        
        const res = await callApifetch(`calculateMonthlySalary&employeeId=${employeeId}&yearMonth=${yearMonth}`);
        
        if (res.ok && res.data) {
            displaySalaryCalculation(res.data, resultEl);
            resultEl.style.display = 'block';
            showNotification('計算完成', 'success');
            
            if (confirm('是否儲存此薪資單？')) {
                await saveSalaryRecord(res.data);
            }
        } else {
            showNotification(`計算失敗：${res.msg}`, 'error');
        }
        
    } catch (error) {
        console.error('計算薪資失敗:', error);
        showNotification('計算失敗，請稍後再試', 'error');
    }
}

/**
 * 顯示薪資計算結果
 */
function displaySalaryCalculation(data, container) {
    if (!container) return;
    
    // ✅ 修正：使用後端回傳的正確欄位名稱
    container.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-lg p-6">
            <h3 class="text-lg font-semibold mb-4">
                ${data.employeeName || '--'} - ${data.yearMonth || '--'} 薪資計算結果
            </h3>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div class="info-card">
                    <div class="info-label">應發總額</div>
                    <div class="info-value">${formatCurrency(data.grossSalary)}</div>
                </div>
                <div class="info-card">
                    <div class="info-label">扣款總額</div>
                    <div class="info-value text-red-500">${formatCurrency(data.totalDeductions)}</div>
                </div>
                <div class="info-card salary-card">
                    <div class="info-label salary-label">實發金額</div>
                    <div class="info-value">${formatCurrency(data.netSalary)}</div>
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                    <h4 class="font-semibold mb-2">應發項目</h4>
                    <div class="space-y-1 text-sm">
                        <div class="flex justify-between">
                            <span>基本薪資</span>
                            <span class="font-mono">${formatCurrency(data.baseSalary)}</span>
                        </div>
                        <div class="flex justify-between">
                            <span>平日加班費</span>
                            <span class="font-mono">${formatCurrency(data.weekdayOvertimePay)}</span>
                        </div>
                        <div class="flex justify-between">
                            <span>休息日加班費</span>
                            <span class="font-mono">${formatCurrency(data.restdayOvertimePay)}</span>
                        </div>
                        <div class="flex justify-between">
                            <span>國定假日加班費</span>
                            <span class="font-mono">${formatCurrency(data.holidayOvertimePay)}</span>
                        </div>
                    </div>
                </div>
                
                <div class="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                    <h4 class="font-semibold mb-2">扣款項目</h4>
                    <div class="space-y-1 text-sm">
                        <div class="flex justify-between">
                            <span>勞保費</span>
                            <span class="font-mono">${formatCurrency(data.laborFee)}</span>
                        </div>
                        <div class="flex justify-between">
                            <span>健保費</span>
                            <span class="font-mono">${formatCurrency(data.healthFee)}</span>
                        </div>
                        <div class="flex justify-between">
                            <span>就業保險費</span>
                            <span class="font-mono">${formatCurrency(data.employmentFee)}</span>
                        </div>
                        <div class="flex justify-between">
                            <span>勞退自提</span>
                            <span class="font-mono">${formatCurrency(data.pensionSelf)}</span>
                        </div>
                        <div class="flex justify-between">
                            <span>所得稅</span>
                            <span class="font-mono">${formatCurrency(data.incomeTax)}</span>
                        </div>
                        <div class="flex justify-between">
                            <span>請假扣款</span>
                            <span class="font-mono">${formatCurrency(data.leaveDeduction)}</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="mt-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <h4 class="font-semibold mb-2">雇主負擔（參考）</h4>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    <div>
                        <span class="text-gray-600 dark:text-gray-400">勞保費：</span>
                        <span class="font-mono">${formatCurrency(data.employerLaborFee)}</span>
                    </div>
                    <div>
                        <span class="text-gray-600 dark:text-gray-400">健保費：</span>
                        <span class="font-mono">${formatCurrency(data.employerHealthFee)}</span>
                    </div>
                    <div>
                        <span class="text-gray-600 dark:text-gray-400">就保費：</span>
                        <span class="font-mono">${formatCurrency(data.employerEmploymentFee)}</span>
                    </div>
                    <div>
                        <span class="text-gray-600 dark:text-gray-400">勞退提繳：</span>
                        <span class="font-mono">${formatCurrency(data.employerPension)}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * 儲存薪資記錄
 */
async function saveSalaryRecord(data) {
    try {
        // ✅ 修正：使用 JSON.stringify 編碼複雜物件
        const dataStr = encodeURIComponent(JSON.stringify(data));
        const res = await callApifetch(`saveMonthlySalary&data=${dataStr}`);
        
        if (res.ok) {
            showNotification('薪資單已成功儲存', 'success');
            loadAllEmployeeSalary();
        } else {
            showNotification(`儲存失敗：${res.msg}`, 'error');
        }
        
    } catch (error) {
        console.error('儲存薪資單失敗:', error);
        showNotification('儲存失敗，請稍後再試', 'error');
    }
}

/**
 * 載入所有員工薪資列表
 */
async function loadAllEmployeeSalary() {
    const loadingEl = document.getElementById('all-salary-loading');
    const listEl = document.getElementById('all-salary-list');
    const yearMonthEl = document.getElementById('filter-year-month');
    
    if (!loadingEl || !listEl || !yearMonthEl) {
        console.warn('薪資列表元素未找到');
        return;
    }
    
    const yearMonth = yearMonthEl.value;
    
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
            listEl.innerHTML = '<p class="text-center text-gray-500 py-4">尚無薪資記錄</p>';
        }
        
    } catch (error) {
        console.error('載入薪資列表失敗:', error);
        loadingEl.style.display = 'none';
        listEl.innerHTML = '<p class="text-center text-red-500 py-4">載入失敗</p>';
    }
}

/**
 * 建立所有員工薪資項目
 */
function createAllSalaryItem(salary) {
    const div = document.createElement('div');
    div.className = 'bg-white dark:bg-gray-800 rounded-lg p-4 flex justify-between items-center';
    
    div.innerHTML = `
        <div>
            <div class="font-semibold text-gray-800 dark:text-white">
                ${salary['員工姓名'] || '--'} (${salary['員工ID'] || '--'})
            </div>
            <div class="text-sm text-gray-500 dark:text-gray-400">
                ${salary['年月'] || '--'} | ${salary['狀態'] || '--'}
            </div>
        </div>
        <div class="text-right">
            <div class="text-lg font-bold text-purple-900 dark:text-purple-200">
                ${formatCurrency(salary['實發金額'])}
            </div>
            <div class="text-xs text-gray-500">
                ${getBankName(salary['銀行代碼'])} ${salary['銀行帳號'] || '--'}
            </div>
        </div>
    `;
    
    return div;
}

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