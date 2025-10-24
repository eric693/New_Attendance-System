// salary.js - 薪資管理系統前端

console.log('💰 薪資管理系統載入中...');

// ==================== 全域變數 ====================

let currentEmployeeData = null;
let currentMonthlyData = null;

// ==================== 初始化 ====================

document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ 頁面載入完成');
    
    // 設定今天的日期
    const today = new Date();
    const yearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('monthly-yearMonth').value = yearMonth;
    document.getElementById('hourly-yearMonth').value = yearMonth;
    document.getElementById('hireDate').value = today.toISOString().split('T')[0];
    
    // 載入員工列表
    loadEmployeeList();
    
    // 綁定表單提交
    document.getElementById('employee-salary-form').addEventListener('submit', handleEmployeeSalarySubmit);
    
    console.log('✅ 薪資系統初始化完成');
});

// ==================== 標籤切換 ====================

function switchTab(tabName) {
    // 隱藏所有內容
    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(content => content.classList.remove('active'));
    
    // 移除所有標籤的 active 狀態
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    
    // 顯示選中的內容
    document.getElementById(tabName).classList.add('active');
    
    // 設定標籤為 active
    event.target.classList.add('active');
    
    // 根據標籤載入資料
    if (tabName === 'salary-list') {
        loadSalaryList();
    }
}

// ==================== 訊息顯示 ====================

function showMessage(message, type = 'success') {
    const messageEl = document.getElementById('message');
    messageEl.textContent = message;
    messageEl.className = `message ${type}`;
    messageEl.style.display = 'block';
    
    setTimeout(() => {
        messageEl.style.display = 'none';
    }, 5000);
}

// ==================== 員工類型選擇 ====================

function selectEmployeeType(type) {
    if (type === 'fulltime') {
        document.getElementById('employeeType').value = '全職';
        document.getElementById('salaryType').value = '月薪';
        document.getElementById('baseSalaryLabel').textContent = '基本薪資 (月薪) *';
        document.getElementById('deduction-fields').style.display = 'grid';
    } else {
        document.getElementById('employeeType').value = '兼職';
        document.getElementById('salaryType').value = '時薪';
        document.getElementById('baseSalaryLabel').textContent = '基本薪資 (時薪) *';
        document.getElementById('deduction-fields').style.display = 'none';
    }
}

function updateSalaryType() {
    const employeeType = document.getElementById('employeeType').value;
    const salaryTypeEl = document.getElementById('salaryType');
    
    if (employeeType === '全職') {
        salaryTypeEl.value = '月薪';
        document.getElementById('baseSalaryLabel').textContent = '基本薪資 (月薪) *';
        document.getElementById('deduction-fields').style.display = 'grid';
    } else {
        salaryTypeEl.value = '時薪';
        document.getElementById('baseSalaryLabel').textContent = '基本薪資 (時薪) *';
        document.getElementById('deduction-fields').style.display = 'none';
    }
}

// ==================== 員工薪資設定 ====================

async function handleEmployeeSalarySubmit(e) {
    e.preventDefault();
    
    const salaryData = {
        employeeId: document.getElementById('employeeId').value,
        employeeName: document.getElementById('employeeName').value,
        employeeType: document.getElementById('employeeType').value,
        salaryType: document.getElementById('salaryType').value,
        baseSalary: parseFloat(document.getElementById('baseSalary').value),
        overtimeRate: parseFloat(document.getElementById('overtimeRate').value),
        laborInsurance: parseFloat(document.getElementById('laborInsurance').value) || 0,
        healthInsurance: parseFloat(document.getElementById('healthInsurance').value) || 0,
        incomeTax: parseFloat(document.getElementById('incomeTax').value) || 0,
        bankAccount: document.getElementById('bankAccount').value,
        hireDate: document.getElementById('hireDate').value,
        status: '在職',
        note: document.getElementById('note').value
    };
    
    try {
        const token = localStorage.getItem('sessionToken');
        const url = `${apiUrl}?action=setEmployeeSalary&token=${token}&` + 
                    Object.keys(salaryData).map(key => 
                        `${key}=${encodeURIComponent(salaryData[key])}`
                    ).join('&');
        
        const callbackName = 'salaryCallback' + Date.now();
        
        window[callbackName] = function(response) {
            delete window[callbackName];
            document.getElementById('salary-script')?.remove();
            
            if (response.ok) {
                showMessage(response.msg || '員工薪資設定成功', 'success');
                document.getElementById('employee-salary-form').reset();
                loadEmployeeList();
            } else {
                showMessage(response.msg || '設定失敗', 'error');
            }
        };
        
        const script = document.createElement('script');
        script.id = 'salary-script';
        script.src = url + `&callback=${callbackName}`;
        document.body.appendChild(script);
        
    } catch (error) {
        console.error('設定員工薪資失敗:', error);
        showMessage('設定失敗: ' + error.message, 'error');
    }
}

// ==================== 載入員工列表 ====================

async function loadEmployeeList() {
    try {
        const token = localStorage.getItem('sessionToken');
        const url = `${apiUrl}?action=getAllEmployeeSalary&token=${token}`;
        
        const callbackName = 'employeeListCallback' + Date.now();
        
        window[callbackName] = function(response) {
            delete window[callbackName];
            document.getElementById('employee-list-script')?.remove();
            
            if (response.ok && response.data) {
                updateEmployeeSelects(response.data);
            }
        };
        
        const script = document.createElement('script');
        script.id = 'employee-list-script';
        script.src = url + `&callback=${callbackName}`;
        document.body.appendChild(script);
        
    } catch (error) {
        console.error('載入員工列表失敗:', error);
    }
}

function updateEmployeeSelects(employees) {
    const monthlySelect = document.getElementById('monthly-employeeId');
    const hourlySelect = document.getElementById('hourly-employeeId');
    
    // 清空現有選項
    monthlySelect.innerHTML = '<option value="">-- 請選擇 --</option>';
    hourlySelect.innerHTML = '<option value="">-- 請選擇 --</option>';
    
    // 加入員工選項
    employees.forEach(emp => {
        const option = `<option value="${emp.employeeId}">${emp.employeeName} (${emp.salaryType})</option>`;
        
        if (emp.salaryType === '月薪') {
            monthlySelect.innerHTML += option;
        } else {
            hourlySelect.innerHTML += option;
        }
    });
}

// ==================== 月薪計算 ====================

async function calculateMonthly() {
    const employeeId = document.getElementById('monthly-employeeId').value;
    const yearMonth = document.getElementById('monthly-yearMonth').value;
    
    if (!employeeId || !yearMonth) {
        showMessage('請選擇員工和年月', 'error');
        return;
    }
    
    try {
        const token = localStorage.getItem('sessionToken');
        const url = `${apiUrl}?action=calculateMonthlySalary&token=${token}&employeeId=${employeeId}&yearMonth=${yearMonth}`;
        
        const callbackName = 'monthlyCallback' + Date.now();
        
        window[callbackName] = function(response) {
            delete window[callbackName];
            document.getElementById('monthly-script')?.remove();
            
            if (response.ok && response.data) {
                displayMonthlyResult(response.data);
                currentMonthlyData = response.data;
            } else {
                showMessage(response.msg || '計算失敗', 'error');
            }
        };
        
        const script = document.createElement('script');
        script.id = 'monthly-script';
        script.src = url + `&callback=${callbackName}`;
        document.body.appendChild(script);
        
    } catch (error) {
        console.error('計算月薪失敗:', error);
        showMessage('計算失敗: ' + error.message, 'error');
    }
}

function displayMonthlyResult(data) {
    const infoDiv = document.getElementById('monthly-info');
    
    infoDiv.innerHTML = `
        <div class="info-item">
            <span class="info-label">員工姓名</span>
            <span class="info-value">${data.employeeName}</span>
        </div>
        <div class="info-item">
            <span class="info-label">年月</span>
            <span class="info-value">${data.yearMonth}</span>
        </div>
        <div class="info-item">
            <span class="info-label">基本薪資</span>
            <span class="info-value">$${data.baseSalary.toLocaleString()}</span>
        </div>
        <div class="info-item">
            <span class="info-label">出勤天數</span>
            <span class="info-value">${data.attendanceDays}/${data.requiredDays} 天</span>
        </div>
        <div class="info-item">
            <span class="info-label">工作時數</span>
            <span class="info-value">${data.workHours} 小時</span>
        </div>
        <div class="info-item">
            <span class="info-label">加班時數</span>
            <span class="info-value">${data.overtimeHours} 小時</span>
        </div>
        <div class="info-item">
            <span class="info-label">加班費</span>
            <span class="info-value">$${data.overtimePay.toLocaleString()}</span>
        </div>
        <div class="info-item">
            <span class="info-label">請假扣款</span>
            <span class="info-value">-$${data.leaveDeduction.toLocaleString()}</span>
        </div>
        <div class="info-item">
            <span class="info-label">應發薪資</span>
            <span class="info-value" style="color: #667eea;">$${data.grossSalary.toLocaleString()}</span>
        </div>
        <div class="info-item">
            <span class="info-label">勞保</span>
            <span class="info-value">-$${data.deductions.laborInsurance.toLocaleString()}</span>
        </div>
        <div class="info-item">
            <span class="info-label">健保</span>
            <span class="info-value">-$${data.deductions.healthInsurance.toLocaleString()}</span>
        </div>
        <div class="info-item">
            <span class="info-label">所得稅</span>
            <span class="info-value">-$${data.deductions.incomeTax.toLocaleString()}</span>
        </div>
        <div class="info-item" style="background: #667eea; color: white;">
            <span class="info-label" style="color: white;">實發薪資</span>
            <span class="info-value" style="color: white; font-size: 1.3em;">$${data.netSalary.toLocaleString()}</span>
        </div>
    `;
    
    document.getElementById('monthly-result').style.display = 'block';
}

async function saveMonthlySalary() {
    if (!currentMonthlyData) {
        showMessage('請先計算薪資', 'error');
        return;
    }
    
    try {
        const token = localStorage.getItem('sessionToken');
        const url = `${apiUrl}?action=saveMonthlySalary&token=${token}&data=${encodeURIComponent(JSON.stringify(currentMonthlyData))}`;
        
        const callbackName = 'saveMonthlyCallback' + Date.now();
        
        window[callbackName] = function(response) {
            delete window[callbackName];
            document.getElementById('save-monthly-script')?.remove();
            
            if (response.ok) {
                showMessage('薪資單已儲存', 'success');
            } else {
                showMessage(response.msg || '儲存失敗', 'error');
            }
        };
        
        const script = document.createElement('script');
        script.id = 'save-monthly-script';
        script.src = url + `&callback=${callbackName}`;
        document.body.appendChild(script);
        
    } catch (error) {
        console.error('儲存薪資單失敗:', error);
        showMessage('儲存失敗: ' + error.message, 'error');
    }
}

// ==================== 時薪明細 ====================

async function loadHourlySalary() {
    const employeeId = document.getElementById('hourly-employeeId').value;
    const yearMonth = document.getElementById('hourly-yearMonth').value;
    
    if (!employeeId || !yearMonth) {
        showMessage('請選擇員工和年月', 'error');
        return;
    }
    
    try {
        const token = localStorage.getItem('sessionToken');
        const url = `${apiUrl}?action=getMonthlyHourlySalary&token=${token}&employeeId=${employeeId}&yearMonth=${yearMonth}`;
        
        const callbackName = 'hourlyCallback' + Date.now();
        
        window[callbackName] = function(response) {
            delete window[callbackName];
            document.getElementById('hourly-script')?.remove();
            
            if (response.ok && response.data) {
                displayHourlyResult(response.data);
            } else {
                showMessage(response.msg || '查詢失敗', 'error');
            }
        };
        
        const script = document.createElement('script');
        script.id = 'hourly-script';
        script.src = url + `&callback=${callbackName}`;
        document.body.appendChild(script);
        
    } catch (error) {
        console.error('查詢時薪明細失敗:', error);
        showMessage('查詢失敗: ' + error.message, 'error');
    }
}

function displayHourlyResult(data) {
    const tbody = document.getElementById('hourly-table-body');
    
    if (data.details.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #999;">查無資料</td></tr>';
        document.getElementById('hourly-result').style.display = 'block';
        return;
    }
    
    tbody.innerHTML = data.details.map(detail => `
        <tr>
            <td>${detail.date}</td>
            <td>${detail.workHours}</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
            <td>$${detail.totalPay.toLocaleString()}</td>
        </tr>
    `).join('');
    
    document.getElementById('total-hours').textContent = data.totalHours.toFixed(2) + ' 小時';
    document.getElementById('total-pay').textContent = '$' + data.totalPay.toLocaleString();
    
    document.getElementById('hourly-result').style.display = 'block';
}

// ==================== 薪資列表 ====================

async function loadSalaryList() {
    const content = document.getElementById('salary-list-content');
    content.innerHTML = '<div class="loading">載入中...</div>';
    
    // 這裡應該從後端載入薪資列表
    // 目前先顯示佔位文字
    setTimeout(() => {
        content.innerHTML = '<p>薪資列表功能開發中...</p>';
    }, 1000);
}

console.log('✅ 薪資管理系統載入完成');