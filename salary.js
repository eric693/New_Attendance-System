// salary.js - 薪資管理前端邏輯

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
            if (res.user.dept === "管理員") {
                // 管理員：顯示管理介面
                document.getElementById('employee-salary-section').style.display = 'none';
                document.getElementById('admin-salary-section').style.display = 'block';
                loadAllEmployeeSalary();
            } else {
                // 一般員工：顯示個人薪資
                document.getElementById('employee-salary-section').style.display = 'block';
                document.getElementById('admin-salary-section').style.display = 'none';
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
    
    try {
        loadingEl.style.display = 'block';
        emptyEl.style.display = 'none';
        contentEl.style.display = 'none';
        
        // 取得當前年月
        const now = new Date();
        const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
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
    // 薪資概覽
    document.getElementById('gross-salary').textContent = formatCurrency(salary['應發總額']);
    document.getElementById('total-deductions').textContent = formatCurrency(
        salary['勞保費'] + salary['健保費'] + salary['就業保險費'] + 
        salary['勞退自提'] + salary['所得稅'] + salary['請假扣款']
    );
    document.getElementById('net-salary').textContent = formatCurrency(salary['實發金額']);
    
    // 應發項目
    document.getElementById('detail-base-salary').textContent = formatCurrency(salary['基本薪資']);
    document.getElementById('detail-weekday-overtime').textContent = formatCurrency(salary['平日加班費']);
    document.getElementById('detail-restday-overtime').textContent = formatCurrency(salary['休息日加班費']);
    document.getElementById('detail-holiday-overtime').textContent = formatCurrency(salary['國定假日加班費']);
    
    // 扣款項目
    document.getElementById('detail-labor-fee').textContent = formatCurrency(salary['勞保費']);
    document.getElementById('detail-health-fee').textContent = formatCurrency(salary['健保費']);
    document.getElementById('detail-employment-fee').textContent = formatCurrency(salary['就業保險費']);
    document.getElementById('detail-pension-self').textContent = formatCurrency(salary['勞退自提']);
    document.getElementById('detail-income-tax').textContent = formatCurrency(salary['所得稅']);
    document.getElementById('detail-leave-deduction').textContent = formatCurrency(salary['請假扣款']);
    
    // 銀行資訊
    document.getElementById('detail-bank-name').textContent = getBankName(salary['銀行代碼']);
    document.getElementById('detail-bank-account').textContent = salary['銀行帳號'] || '--';
}

/**
 * 載入薪資歷史
 */
async function loadSalaryHistory() {
    const loadingEl = document.getElementById('salary-history-loading');
    const emptyEl = document.getElementById('salary-history-empty');
    const listEl = document.getElementById('salary-history-list');
    
    try {
        loadingEl.style.display = 'block';
        emptyEl.style.display = 'none';
        listEl.innerHTML = '';
        
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
                ${salary['年月']}
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
        
        // 設定預設值為當月
        const now = new Date();
        filterMonth.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
}

/**
 * 處理薪資設定表單提交
 */
async function handleSalaryConfigSubmit(e) {
    e.preventDefault();
    
    const formData = {
        employeeId: document.getElementById('config-employee-id').value,
        employeeName: document.getElementById('config-employee-name').value,
        idNumber: document.getElementById('config-id-number').value,
        employeeType: document.getElementById('config-employee-type').value,
        salaryType: document.getElementById('config-salary-type').value,
        baseSalary: document.getElementById('config-base-salary').value,
        bankCode: document.getElementById('config-bank-code').value,
        bankAccount: document.getElementById('config-bank-account').value,
        hireDate: document.getElementById('config-hire-date').value,
        paymentDay: document.getElementById('config-payment-day').value,
        pensionSelfRate: document.getElementById('config-pension-rate').value,
        laborFee: document.getElementById('config-labor-fee').value,
        healthFee: document.getElementById('config-health-fee').value,
        employmentFee: document.getElementById('config-employment-fee').value,
        incomeTax: document.getElementById('config-income-tax').value,
        note: document.getElementById('config-note').value
    };
    
    try {
        const params = new URLSearchParams(formData).toString();
        const res = await callApifetch(`setEmployeeSalaryTW&${params}`);
        
        if (res.ok) {
            showNotification('薪資設定已成功儲存', 'success');
            // 清空表單
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
    const employeeId = document.getElementById('calc-employee-id').value;
    const yearMonth = document.getElementById('calc-year-month').value;
    const resultEl = document.getElementById('salary-calculation-result');
    
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
            
            // 詢問是否儲存
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
    container.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-lg p-6">
            <h3 class="text-lg font-semibold mb-4">
                ${data.employeeName} - ${data.yearMonth} 薪資計算結果
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
        const params = new URLSearchParams(data).toString();
        const res = await callApifetch(`saveMonthlySalary&${params}`);
        
        if (res.ok) {
            showNotification('薪資單已成功儲存', 'success');
            loadAllEmployeeSalary(); // 重新載入列表
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
    const yearMonth = document.getElementById('filter-year-month').value;
    
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
                ${salary['員工姓名']} (${salary['員工ID']})
            </div>
            <div class="text-sm text-gray-500 dark:text-gray-400">
                ${salary['年月']} | ${salary['狀態']}
            </div>
        </div>
        <div class="text-right">
            <div class="text-lg font-bold text-purple-900 dark:text-purple-200">
                ${formatCurrency(salary['實發金額'])}
            </div>
            <div class="text-xs text-gray-500">
                ${getBankName(salary['銀行代碼'])} ${salary['銀行帳號']}
            </div>
        </div>
    `;
    
    return div;
}

/**
 * 格式化貨幣
 */
function formatCurrency(amount) {
    if (amount === null || amount === undefined) return '$0';
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
    
    return banks[code] || code;
}

/**
 * 顯示通知
 */
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    const notificationMessage = document.getElementById('notification-message');
    
    notificationMessage.textContent = message;
    notification.className = 'notification show';
    
    if (type === 'success') {
        notification.classList.add('bg-green-500');
    } else if (type === 'error') {
        notification.classList.add('bg-red-500');
    } else if (type === 'info') {
        notification.classList.add('bg-blue-500');
    } else if (type === 'warning') {
        notification.classList.add('bg-yellow-500');
    }
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}