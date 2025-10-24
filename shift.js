/**
 * 排班管理前端邏輯 - 完整修正版
 * 修正項目:
 * 1. 統一使用 data.ok 而不是 data.success
 * 2. 所有 API 呼叫都加入 token
 * 3. 修正 filters 參數傳遞方式
 */

let currentShifts = [];
let allEmployees = [];
let allLocations = [];
let batchData = [];

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeTabs();
    loadEmployees();
    loadLocations();
    loadShifts();
    setupEventListeners();
    setupBatchUpload();
    
    // 設定預設日期為今天
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('shift-date').value = today;
    
    // 設定篩選日期為本週
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    
    document.getElementById('filter-start-date').value = startOfWeek.toISOString().split('T')[0];
    document.getElementById('filter-end-date').value = endOfWeek.toISOString().split('T')[0];
});

// 初始化分頁
function initializeTabs() {
    const tabs = document.querySelectorAll('.shift-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            switchTab(tabName);
        });
    });
}

// 切換分頁
function switchTab(tabName) {
    // 更新分頁按鈕狀態
    document.querySelectorAll('.shift-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // 更新內容顯示
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    // 載入對應資料
    if (tabName === 'view') {
        loadShifts();
    } else if (tabName === 'stats') {
        loadStats();
    }
}

// 設定事件監聽器
function setupEventListeners() {
    // 新增排班表單
    document.getElementById('add-shift-form').addEventListener('submit', function(e) {
        e.preventDefault();
        addShift();
    });
    
    // 班別改變時自動填入時間
    document.getElementById('shift-type').addEventListener('change', function() {
        autoFillShiftTime(this.value);
    });
}

// 自動填入班別時間（但不鎖定，使用者可自行修改）
function autoFillShiftTime(shiftType) {
    const times = {
        '早班': ['08:00', '16:00'],
        '中班': ['12:00', '20:00'],
        '晚班': ['16:00', '00:00'],
        '全日班': ['09:00', '18:00']
    };
    
    const startTimeInput = document.getElementById('start-time');
    const endTimeInput = document.getElementById('end-time');
    
    if (times[shiftType]) {
        if (!startTimeInput.value) {
            startTimeInput.value = times[shiftType][0];
        }
        if (!endTimeInput.value) {
            endTimeInput.value = times[shiftType][1];
        }
    }
}

// ⭐ 載入員工列表 - 修正版
async function loadEmployees() {
    try {
        const token = localStorage.getItem('sessionToken');
        const response = await fetch(`${apiUrl}?action=getAllUsers&token=${token}`, {
            method: 'GET'
        });
        
        const data = await response.json();
        console.log('✅ 員工列表回應:', data);
        
        if (data.ok) {
            allEmployees = data.users || [];
            populateEmployeeSelect();
        }
    } catch (error) {
        console.error('載入員工列表失敗:', error);
        showMessage('載入員工列表失敗', 'error');
    }
}

// 填充員工選單
function populateEmployeeSelect() {
    const select = document.getElementById('employee-select');
    select.innerHTML = '<option value="">請選擇員工</option>';
    
    allEmployees.forEach(emp => {
        const option = document.createElement('option');
        option.value = emp.userId;
        option.textContent = `${emp.name} (${emp.userId})`;
        option.dataset.name = emp.name;
        select.appendChild(option);
    });
}

// ⭐ 載入地點列表 - 修正版
async function loadLocations() {
    try {
        const token = localStorage.getItem('sessionToken');
        const response = await fetch(`${apiUrl}?action=getLocations&token=${token}`, {
            method: 'GET'
        });
        
        const data = await response.json();
        console.log('✅ 地點列表回應:', data);
        
        if (data.ok) {
            allLocations = data.locations || [];
            populateLocationSelects();
        }
    } catch (error) {
        console.error('載入地點列表失敗:', error);
    }
}

// 填充地點選單
function populateLocationSelects() {
    const selects = ['shift-location', 'filter-location'];
    
    selects.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;
        
        const currentValue = select.value;
        
        if (id === 'filter-location') {
            select.innerHTML = '<option value="">全部</option>';
        } else {
            select.innerHTML = '<option value="">請選擇地點</option>';
        }
        
        allLocations.forEach(loc => {
            const option = document.createElement('option');
            option.value = loc.name;
            option.textContent = loc.name;
            select.appendChild(option);
        });
        
        if (currentValue) {
            select.value = currentValue;
        }
    });
}

// ⭐ 載入排班列表 - 完整修正版
async function loadShifts(filters = {}) {
    const listContainer = document.getElementById('shift-list');
    listContainer.innerHTML = '<div class="loading">載入中...</div>';
    
    try {
        const token = localStorage.getItem('sessionToken');
        
        // 如果沒有指定篩選條件，使用預設的日期範圍
        if (!filters.startDate && !filters.endDate) {
            const startDateEl = document.getElementById('filter-start-date');
            const endDateEl = document.getElementById('filter-end-date');
            
            if (startDateEl && startDateEl.value) filters.startDate = startDateEl.value;
            if (endDateEl && endDateEl.value) filters.endDate = endDateEl.value;
        }
        
        const queryParams = new URLSearchParams({
            action: 'getShifts',
            token: token
        });
        
        // 加入個別篩選參數
        if (filters.employeeId) queryParams.append('employeeId', filters.employeeId);
        if (filters.startDate) queryParams.append('startDate', filters.startDate);
        if (filters.endDate) queryParams.append('endDate', filters.endDate);
        if (filters.shiftType) queryParams.append('shiftType', filters.shiftType);
        if (filters.location) queryParams.append('location', filters.location);
        
        const url = `${apiUrl}?${queryParams}`;
        console.log('📡 載入排班:', url);
        
        const response = await fetch(url, { method: 'GET' });
        const data = await response.json();
        
        console.log('✅ 排班回應:', data);
        
        if (data.ok) {
            currentShifts = data.data || [];
            displayShifts(currentShifts);
            console.log(`✅ 顯示 ${currentShifts.length} 筆排班`);
        } else {
            console.log('❌ 載入失敗:', data.msg);
            listContainer.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📋</div><p>載入失敗: ${data.msg || '未知錯誤'}</p></div>`;
        }
    } catch (error) {
        console.error('❌ 載入排班失敗:', error);
        listContainer.innerHTML = '<div class="empty-state"><div class="empty-state-icon">❌</div><p>載入失敗</p></div>';
    }
}

// 顯示排班列表
function displayShifts(shifts) {
    const listContainer = document.getElementById('shift-list');
    
    if (shifts.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📅</div>
                <p>目前沒有排班資料</p>
            </div>
        `;
        return;
    }
    
    listContainer.innerHTML = '';
    
    shifts.forEach(shift => {
        const shiftItem = createShiftItem(shift);
        listContainer.appendChild(shiftItem);
    });
}

// 創建排班項目元素
function createShiftItem(shift) {
    const div = document.createElement('div');
    div.className = 'shift-item';
    
    const shiftTypeBadge = getShiftTypeBadge(shift.shiftType);
    
    div.innerHTML = `
        <div class="shift-info">
            <h3>${shift.employeeName} ${shiftTypeBadge}</h3>
            <p>日期: ${formatDate(shift.date)}</p>
            <p>時間: ${shift.startTime} - ${shift.endTime}</p>
            <p>地點: ${shift.location}</p>
            ${shift.note ? `<p>備註: ${shift.note}</p>` : ''}
        </div>
        <div class="shift-actions">
            <button class="btn-icon" onclick="editShift('${shift.shiftId}')">編輯</button>
            <button class="btn-icon btn-danger" onclick="deleteShift('${shift.shiftId}')">刪除</button>
        </div>
    `;
    
    return div;
}

// 取得班別徽章
function getShiftTypeBadge(shiftType) {
    const badgeClass = {
        '早班': 'badge-morning',
        '中班': 'badge-afternoon',
        '晚班': 'badge-night',
        '全日班': 'badge-full'
    }[shiftType] || 'badge-morning';
    
    return `<span class="badge ${badgeClass}">${shiftType}</span>`;
}

// 格式化日期
function formatDate(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const weekday = weekdays[date.getDay()];
    
    return `${year}/${month}/${day} (${weekday})`;
}

// ⭐ 新增排班 - 修正版
async function addShift() {
    const employeeSelect = document.getElementById('employee-select');
    const selectedOption = employeeSelect.selectedOptions[0];
    
    if (!selectedOption || !selectedOption.value) {
        showMessage('請選擇員工', 'error');
        return;
    }
    
    const token = localStorage.getItem('sessionToken');
    
    const shiftData = {
        action: 'addShift',
        token: token,
        employeeId: selectedOption.value,
        employeeName: selectedOption.dataset.name || selectedOption.textContent.split('(')[0].trim(),
        date: document.getElementById('shift-date').value,
        shiftType: document.getElementById('shift-type').value,
        startTime: document.getElementById('start-time').value,
        endTime: document.getElementById('end-time').value,
        location: document.getElementById('shift-location').value,
        note: document.getElementById('shift-note')?.value || ''
    };
    
    console.log('📝 新增排班:', shiftData);
    
    try {
        const queryParams = new URLSearchParams(shiftData);
        const url = `${apiUrl}?${queryParams}`;
        
        const response = await fetch(url, { method: 'GET' });
        const data = await response.json();
        
        console.log('✅ 新增回應:', data);
        
        if (data.ok) {
            showMessage('排班新增成功!', 'success');
            resetForm();
            switchTab('view');
            loadShifts();
        } else {
            showMessage(data.msg || '新增失敗', 'error');
        }
    } catch (error) {
        console.error('❌ 新增排班失敗:', error);
        showMessage('新增排班失敗', 'error');
    }
}

// 編輯排班
async function editShift(shiftId) {
    const shift = currentShifts.find(s => s.shiftId === shiftId);
    if (!shift) return;
    
    // 切換到新增分頁
    switchTab('add');
    
    // 填充表單
    document.querySelector('#add-tab h2').textContent = '編輯排班';
    document.getElementById('employee-select').value = shift.employeeId;
    document.getElementById('shift-date').value = shift.date;
    document.getElementById('shift-type').value = shift.shiftType;
    document.getElementById('start-time').value = shift.startTime;
    document.getElementById('end-time').value = shift.endTime;
    document.getElementById('shift-location').value = shift.location;
    if (document.getElementById('shift-note')) {
        document.getElementById('shift-note').value = shift.note || '';
    }
    
    // 更改提交按鈕
    const submitBtn = document.querySelector('#add-shift-form button[type="submit"]');
    submitBtn.textContent = '更新排班';
    submitBtn.onclick = function(e) {
        e.preventDefault();
        updateShift(shiftId);
    };
}

// 更新排班
async function updateShift(shiftId) {
    const employeeSelect = document.getElementById('employee-select');
    const selectedOption = employeeSelect.selectedOptions[0];
    
    if (!selectedOption || !selectedOption.value) {
        showMessage('請選擇員工', 'error');
        return;
    }
    
    const token = localStorage.getItem('sessionToken');
    
    const shiftData = {
        action: 'updateShift',
        token: token,
        shiftId: shiftId,
        employeeId: selectedOption.value,
        employeeName: selectedOption.dataset.name || selectedOption.textContent.split('(')[0].trim(),
        date: document.getElementById('shift-date').value,
        shiftType: document.getElementById('shift-type').value,
        startTime: document.getElementById('start-time').value,
        endTime: document.getElementById('end-time').value,
        location: document.getElementById('shift-location').value,
        note: document.getElementById('shift-note')?.value || ''
    };
    
    console.log('📝 更新排班:', shiftData);
    
    try {
        const queryParams = new URLSearchParams(shiftData);
        const url = `${apiUrl}?${queryParams}`;
        
        const response = await fetch(url, { method: 'GET' });
        const data = await response.json();
        
        console.log('✅ 更新回應:', data);
        
        if (data.ok) {
            showMessage('排班更新成功!', 'success');
            resetForm();
            switchTab('view');
            loadShifts();
        } else {
            showMessage(data.msg || '更新失敗', 'error');
        }
    } catch (error) {
        console.error('❌ 更新排班失敗:', error);
        showMessage('更新排班失敗', 'error');
    }
}

// 刪除排班
async function deleteShift(shiftId) {
    if (!confirm('確定要刪除這個排班嗎?')) return;
    
    try {
        const token = localStorage.getItem('sessionToken');
        const url = `${apiUrl}?action=deleteShift&token=${token}&shiftId=${shiftId}`;
        
        console.log('🗑️ 刪除排班:', url);
        
        const response = await fetch(url);
        const data = await response.json();
        
        console.log('✅ 刪除回應:', data);
        
        if (data.ok) {
            showMessage('排班已刪除', 'success');
            loadShifts();
        } else {
            showMessage(data.msg || '刪除失敗', 'error');
        }
    } catch (error) {
        console.error('❌ 刪除排班失敗:', error);
        showMessage('刪除失敗', 'error');
    }
}

// 篩選排班
function filterShifts() {
    const filters = {};
    
    const employeeEl = document.getElementById('filter-employee');
    const startDateEl = document.getElementById('filter-start-date');
    const endDateEl = document.getElementById('filter-end-date');
    const shiftTypeEl = document.getElementById('filter-shift-type');
    const locationEl = document.getElementById('filter-location');
    
    if (employeeEl && employeeEl.value) filters.employeeId = employeeEl.value;
    if (startDateEl && startDateEl.value) filters.startDate = startDateEl.value;
    if (endDateEl && endDateEl.value) filters.endDate = endDateEl.value;
    if (shiftTypeEl && shiftTypeEl.value) filters.shiftType = shiftTypeEl.value;
    if (locationEl && locationEl.value) filters.location = locationEl.value;
    
    console.log('🔍 篩選條件:', filters);
    loadShifts(filters);
}

// 清除篩選
function clearFilters() {
    const employeeEl = document.getElementById('filter-employee');
    const shiftTypeEl = document.getElementById('filter-shift-type');
    const locationEl = document.getElementById('filter-location');
    
    if (employeeEl) employeeEl.value = '';
    if (shiftTypeEl) shiftTypeEl.value = '';
    if (locationEl) locationEl.value = '';
    
    // 重設為本週
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    
    document.getElementById('filter-start-date').value = startOfWeek.toISOString().split('T')[0];
    document.getElementById('filter-end-date').value = endOfWeek.toISOString().split('T')[0];
    
    loadShifts();
}

// 匯出排班
function exportShifts() {
    if (currentShifts.length === 0) {
        showMessage('目前沒有可匯出的資料', 'error');
        return;
    }
    
    const csv = convertToCSV(currentShifts);
    const filename = `排班表_${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(csv, filename);
    showMessage('匯出成功', 'success');
}

// 轉換為CSV
function convertToCSV(data) {
    const headers = ['排班ID', '員工ID', '員工姓名', '日期', '班別', '上班時間', '下班時間', '地點', '備註'];
    const rows = data.map(shift => [
        shift.shiftId,
        shift.employeeId,
        shift.employeeName,
        shift.date,
        shift.shiftType,
        shift.startTime,
        shift.endTime,
        shift.location,
        shift.note || ''
    ]);
    
    const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');
    
    return '\ufeff' + csvContent;
}

// 下載CSV
function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

// 重置表單
function resetForm() {
    document.getElementById('add-shift-form').reset();
    document.querySelector('#add-tab h2').textContent = '新增排班';
    const submitBtn = document.querySelector('#add-shift-form button[type="submit"]');
    submitBtn.textContent = '新增排班';
    submitBtn.onclick = null;
    
    // 重設日期為今天
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('shift-date').value = today;
}

// 批量上傳設定
function setupBatchUpload() {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('batch-file-input');
    
    if (!uploadArea || !fileInput) return;
    
    // 拖放事件
    uploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.classList.add('drag-over');
    });
    
    uploadArea.addEventListener('dragleave', function() {
        this.classList.remove('drag-over');
    });
    
    uploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        this.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleBatchFile(files[0]);
        }
    });
    
    // 檔案選擇
    fileInput.addEventListener('change', function() {
        if (this.files.length > 0) {
            handleBatchFile(this.files[0]);
        }
    });
}

// 處理批量檔案
function handleBatchFile(file) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const content = e.target.result;
        parseBatchData(content, file.name);
    };
    
    if (file.name.endsWith('.csv')) {
        reader.readAsText(file, 'UTF-8');
    } else {
        showMessage('目前只支援 CSV 格式', 'error');
    }
}

// 解析批量資料
function parseBatchData(content, filename) {
    const lines = content.split('\n');
    const data = [];
    
    // 跳過標題行
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        
        if (values.length >= 7) {
            data.push({
                employeeId: values[0],
                employeeName: values[1],
                date: values[2],
                shiftType: values[3],
                startTime: values[4],
                endTime: values[5],
                location: values[6],
                note: values[7] || ''
            });
        }
    }
    
    if (data.length === 0) {
        showMessage('檔案中沒有有效資料', 'error');
        return;
    }
    
    batchData = data;
    displayBatchPreview(data);
}

// 顯示批量預覽
function displayBatchPreview(data) {
    const previewDiv = document.getElementById('batch-preview');
    const tableDiv = document.getElementById('preview-table');
    
    if (!previewDiv || !tableDiv) return;
    
    let html = '<table style="width: 100%; border-collapse: collapse;">';
    html += '<tr style="background: #f5f5f5;">';
    html += '<th>員工ID</th><th>員工姓名</th><th>日期</th><th>班別</th><th>上班時間</th><th>下班時間</th><th>地點</th>';
    html += '</tr>';
    
    data.slice(0, 10).forEach(row => {
        html += '<tr style="border-bottom: 1px solid #eee;">';
        html += `<td>${row.employeeId}</td>`;
        html += `<td>${row.employeeName}</td>`;
        html += `<td>${row.date}</td>`;
        html += `<td>${row.shiftType}</td>`;
        html += `<td>${row.startTime}</td>`;
        html += `<td>${row.endTime}</td>`;
        html += `<td>${row.location}</td>`;
        html += '</tr>';
    });
    
    if (data.length > 10) {
        html += `<tr><td colspan="7" style="text-align: center; padding: 10px; color: #666;">還有 ${data.length - 10} 筆資料...</td></tr>`;
    }
    
    html += '</table>';
    
    tableDiv.innerHTML = html;
    previewDiv.style.display = 'block';
    document.getElementById('upload-area').style.display = 'none';
}

// 確認批量上傳
async function confirmBatchUpload() {
    if (batchData.length === 0) return;
    
    try {
        const token = localStorage.getItem('sessionToken');
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'batchAddShifts',
                token: token,
                data: batchData
            })
        });
        
        const data = await response.json();
        
        if (data.ok) {
            showMessage(data.message || '批量上傳成功', 'success');
            cancelBatchUpload();
            switchTab('view');
            loadShifts();
        } else {
            showMessage(data.message || '批量上傳失敗', 'error');
        }
    } catch (error) {
        console.error('批量上傳失敗:', error);
        showMessage('批量上傳失敗', 'error');
    }
}

// 取消批量上傳
function cancelBatchUpload() {
    batchData = [];
    const previewDiv = document.getElementById('batch-preview');
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('batch-file-input');
    
    if (previewDiv) previewDiv.style.display = 'none';
    if (uploadArea) uploadArea.style.display = 'block';
    if (fileInput) fileInput.value = '';
}

// 下載範本
function downloadTemplate() {
    const template = '員工ID,員工姓名,日期,班別,上班時間,下班時間,地點,備註\n' +
                    'EMP001,張三,2025-10-25,早班,08:00,16:00,總公司,\n' +
                    'EMP002,李四,2025-10-25,中班,12:00,20:00,分公司,';
    
    downloadCSV(template, '排班範本.csv');
}

// ⭐ 載入統計資料 - 修正版
async function loadStats() {
    try {
        const token = localStorage.getItem('sessionToken');
        const response = await fetch(`${apiUrl}?action=getWeeklyShiftStats&token=${token}`);
        const data = await response.json();
        
        console.log('✅ 統計資料回應:', data);
        
        if (data.ok) {
            displayStats(data.data);
        }
    } catch (error) {
        console.error('載入統計失敗:', error);
    }
}

// 顯示統計資料
function displayStats(stats) {
    const statsGrid = document.getElementById('stats-grid');
    if (!statsGrid) return;
    
    const html = `
        <div class="stat-card">
            <div class="stat-label">本週總排班</div>
            <div class="stat-value">${stats.totalShifts}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">早班</div>
            <div class="stat-value">${stats.byShiftType['早班'] || 0}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">中班</div>
            <div class="stat-value">${stats.byShiftType['中班'] || 0}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">晚班</div>
            <div class="stat-value">${stats.byShiftType['晚班'] || 0}</div>
        </div>
    `;
    
    statsGrid.innerHTML = html;
}

// 顯示訊息
function showMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    messageDiv.textContent = message;
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (messageDiv.parentNode) {
                document.body.removeChild(messageDiv);
            }
        }, 300);
    }, 3000);
}

// 返回上一頁
function goBack() {
    window.history.back();
}