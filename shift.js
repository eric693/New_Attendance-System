/**
 * 排班管理前端邏輯 - 完整版(含月曆功能)
 * 功能: 查看/新增/編輯/刪除排班、批量上傳、月曆顯示、統計分析
 */

// ========== 全域變數 ==========
let currentShifts = [];
let allEmployees = [];
let allLocations = [];
let batchData = [];

// 月曆專用全域變數
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0-11
let allMonthShifts = [];

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', function() {
    initializeTabs();
    loadEmployees();
    loadLocations();
    loadShifts();
    setupEventListeners();
    setupBatchUpload();
    
    // 設定預設日期為今天
    const today = new Date().toISOString().split('T')[0];
    const shiftDateEl = document.getElementById('shift-date');
    if (shiftDateEl) shiftDateEl.value = today;
    
    // 設定篩選日期為本週
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    
    const filterStartEl = document.getElementById('filter-start-date');
    const filterEndEl = document.getElementById('filter-end-date');
    if (filterStartEl) filterStartEl.value = startOfWeek.toISOString().split('T')[0];
    if (filterEndEl) filterEndEl.value = endOfWeek.toISOString().split('T')[0];
});

// ========== 分頁管理 ==========

function initializeTabs() {
    const tabs = document.querySelectorAll('.shift-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            switchTab(tabName);
        });
    });
}

function switchTab(tabName) {
    document.querySelectorAll('.shift-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
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

// ========== 事件監聽器 ==========

function setupEventListeners() {
    const addForm = document.getElementById('add-shift-form');
    if (addForm) {
        addForm.addEventListener('submit', function(e) {
            e.preventDefault();
            addShift();
        });
    }
    
    const shiftTypeEl = document.getElementById('shift-type');
    if (shiftTypeEl) {
        shiftTypeEl.addEventListener('change', function() {
            autoFillShiftTime(this.value);
        });
    }
}

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
        if (!startTimeInput.value) startTimeInput.value = times[shiftType][0];
        if (!endTimeInput.value) endTimeInput.value = times[shiftType][1];
    }
}

// ========== API 呼叫函數 ==========

async function loadEmployees() {
    try {
        const token = localStorage.getItem('sessionToken');
        const response = await fetch(`${apiUrl}?action=getAllUsers&token=${token}`);
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

function populateEmployeeSelect() {
    const select = document.getElementById('employee-select');
    if (!select) return;
    
    select.innerHTML = '<option value="">請選擇員工</option>';
    
    allEmployees.forEach(emp => {
        const option = document.createElement('option');
        option.value = emp.userId;
        option.textContent = `${emp.name} (${emp.userId})`;
        option.dataset.name = emp.name;
        select.appendChild(option);
    });
}

async function loadLocations() {
    try {
        const token = localStorage.getItem('sessionToken');
        const response = await fetch(`${apiUrl}?action=getLocations&token=${token}`);
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

function populateLocationSelects() {
    const selects = ['shift-location', 'filter-location'];
    
    selects.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;
        
        const currentValue = select.value;
        select.innerHTML = id === 'filter-location' ? 
            '<option value="">全部</option>' : 
            '<option value="">請選擇地點</option>';
        
        allLocations.forEach(loc => {
            const option = document.createElement('option');
            option.value = loc.name;
            option.textContent = loc.name;
            select.appendChild(option);
        });
        
        if (currentValue) select.value = currentValue;
    });
}

async function loadShifts(filters = {}) {
    const listContainer = document.getElementById('shift-list');
    if (!listContainer) return;
    
    listContainer.innerHTML = '<div class="loading">載入中</div>';
    
    try {
        const token = localStorage.getItem('sessionToken');
        
        // 使用預設日期範圍
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
        
        if (filters.employeeId) queryParams.append('employeeId', filters.employeeId);
        if (filters.startDate) queryParams.append('startDate', filters.startDate);
        if (filters.endDate) queryParams.append('endDate', filters.endDate);
        if (filters.shiftType) queryParams.append('shiftType', filters.shiftType);
        if (filters.location) queryParams.append('location', filters.location);
        
        const response = await fetch(`${apiUrl}?${queryParams}`);
        const data = await response.json();
        
        console.log('✅ 排班回應:', data);
        
        if (data.ok) {
            currentShifts = data.data || [];
            displayShifts(currentShifts);
        } else {
            listContainer.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📋</div><p>載入失敗: ${data.msg}</p></div>`;
        }
    } catch (error) {
        console.error('❌ 載入排班失敗:', error);
        listContainer.innerHTML = '<div class="empty-state"><div class="empty-state-icon">❌</div><p>載入失敗</p></div>';
    }
}

function displayShifts(shifts) {
    const listContainer = document.getElementById('shift-list');
    if (!listContainer) return;
    
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

function getShiftTypeBadge(shiftType) {
    const badgeClass = {
        '早班': 'badge-morning',
        '中班': 'badge-afternoon',
        '晚班': 'badge-night',
        '全日班': 'badge-full'
    }[shiftType] || 'badge-morning';
    
    return `<span class="badge ${badgeClass}">${shiftType}</span>`;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const weekday = weekdays[date.getDay()];
    
    return `${year}/${month}/${day} (${weekday})`;
}

async function addShift() {
    const employeeSelect = document.getElementById('employee-select');
    const selectedOption = employeeSelect.selectedOptions[0];
    
    if (!selectedOption || !selectedOption.value) {
        showMessage('請選擇員工', 'error');
        return;
    }
    
    const token = localStorage.getItem('sessionToken');
    const shiftNoteEl = document.getElementById('shift-note');
    
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
        note: shiftNoteEl ? shiftNoteEl.value : ''
    };
    
    console.log('📝 新增排班:', shiftData);
    
    try {
        const queryParams = new URLSearchParams(shiftData);
        const response = await fetch(`${apiUrl}?${queryParams}`);
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

async function editShift(shiftId) {
    const shift = currentShifts.find(s => s.shiftId === shiftId);
    if (!shift) return;
    
    switchTab('add');
    
    document.querySelector('#add-tab h2').textContent = '編輯排班';
    document.getElementById('employee-select').value = shift.employeeId;
    document.getElementById('shift-date').value = shift.date;
    document.getElementById('shift-type').value = shift.shiftType;
    document.getElementById('start-time').value = shift.startTime;
    document.getElementById('end-time').value = shift.endTime;
    document.getElementById('shift-location').value = shift.location;
    
    const shiftNoteEl = document.getElementById('shift-note');
    if (shiftNoteEl) shiftNoteEl.value = shift.note || '';
    
    const submitBtn = document.querySelector('#add-shift-form button[type="submit"]');
    submitBtn.textContent = '更新排班';
    submitBtn.onclick = function(e) {
        e.preventDefault();
        updateShift(shiftId);
    };
}

async function updateShift(shiftId) {
    const employeeSelect = document.getElementById('employee-select');
    const selectedOption = employeeSelect.selectedOptions[0];
    
    if (!selectedOption || !selectedOption.value) {
        showMessage('請選擇員工', 'error');
        return;
    }
    
    const token = localStorage.getItem('sessionToken');
    const shiftNoteEl = document.getElementById('shift-note');
    
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
        note: shiftNoteEl ? shiftNoteEl.value : ''
    };
    
    try {
        const queryParams = new URLSearchParams(shiftData);
        const response = await fetch(`${apiUrl}?${queryParams}`);
        const data = await response.json();
        
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

async function deleteShift(shiftId) {
    if (!confirm('確定要刪除這個排班嗎?')) return;
    
    try {
        const token = localStorage.getItem('sessionToken');
        const url = `${apiUrl}?action=deleteShift&token=${token}&shiftId=${shiftId}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
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

function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

function resetForm() {
    const form = document.getElementById('add-shift-form');
    if (form) form.reset();
    
    document.querySelector('#add-tab h2').textContent = '新增排班';
    
    const submitBtn = document.querySelector('#add-shift-form button[type="submit"]');
    if (submitBtn) {
        submitBtn.textContent = '新增排班';
        submitBtn.onclick = null;
    }
    
    const today = new Date().toISOString().split('T')[0];
    const shiftDateEl = document.getElementById('shift-date');
    if (shiftDateEl) shiftDateEl.value = today;
}

// ========== 批量上傳 ==========

function setupBatchUpload() {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('batch-file-input');
    
    if (!uploadArea || !fileInput) return;
    
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
    
    fileInput.addEventListener('change', function() {
        if (this.files.length > 0) {
            handleBatchFile(this.files[0]);
        }
    });
}

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

function parseBatchData(content, filename) {
    const lines = content.split('\n');
    const data = [];
    
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

function cancelBatchUpload() {
    batchData = [];
    const previewDiv = document.getElementById('batch-preview');
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('batch-file-input');
    
    if (previewDiv) previewDiv.style.display = 'none';
    if (uploadArea) uploadArea.style.display = 'block';
    if (fileInput) fileInput.value = '';
}

function downloadTemplate() {
    const template = '員工ID,員工姓名,日期,班別,上班時間,下班時間,地點,備註\n' +
                    'EMP001,張三,2025-10-25,早班,08:00,16:00,總公司,\n' +
                    'EMP002,李四,2025-10-25,中班,12:00,20:00,分公司,';
    
    downloadCSV(template, '排班範本.csv');
}

// ========== 月曆功能 ==========

async function loadStats() {
    try {
        currentYear = new Date().getFullYear();
        currentMonth = new Date().getMonth();
        
        updateMonthDisplay();
        await loadMonthlyStats();
        await loadMonthlyShifts();
        await loadShiftDistribution();
    } catch (error) {
        console.error('載入統計失敗:', error);
    }
}

function updateMonthDisplay() {
    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', 
                        '7月', '8月', '9月', '10月', '11月', '12月'];
    const displayText = `${currentYear}年${monthNames[currentMonth]}`;
    const monthEl = document.getElementById('current-month');
    if (monthEl) monthEl.textContent = displayText;
}

function previousMonth() {
    currentMonth--;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    updateMonthDisplay();
    loadMonthlyStats();
    loadMonthlyShifts();
    loadShiftDistribution();
}

function nextMonth() {
    currentMonth++;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    updateMonthDisplay();
    loadMonthlyStats();
    loadMonthlyShifts();
    loadShiftDistribution();
}

function goToToday() {
    const today = new Date();
    currentYear = today.getFullYear();
    currentMonth = today.getMonth();
    updateMonthDisplay();
    loadMonthlyStats();
    loadMonthlyShifts();
    loadShiftDistribution();
}

async function loadMonthlyStats() {
    try {
        const token = localStorage.getItem('sessionToken');
        const startDate = new Date(currentYear, currentMonth, 1);
        const endDate = new Date(currentYear, currentMonth + 1, 0);
        
        const queryParams = new URLSearchParams({
            action: 'getShifts',
            token: token,
            startDate: formatDateYMD(startDate),
            endDate: formatDateYMD(endDate)
        });
        
        const response = await fetch(`${apiUrl}?${queryParams}`);
        const data = await response.json();
        
        console.log('📊 月度統計:', data);
        
        if (data.ok && data.data) {
            allMonthShifts = data.data;
            displayMonthlyStats(data.data);
        }
    } catch (error) {
        console.error('載入月度統計失敗:', error);
    }
}

function displayMonthlyStats(shifts) {
    const statsGrid = document.getElementById('stats-grid');
    if (!statsGrid) return;
    
    const stats = {
        total: shifts.length,
        morning: 0,
        afternoon: 0,
        night: 0,
        full: 0
    };
    
    shifts.forEach(shift => {
        switch(shift.shiftType) {
            case '早班': stats.morning++; break;
            case '中班': stats.afternoon++; break;
            case '晚班': stats.night++; break;
            case '全日班': stats.full++; break;
        }
    });
    
    const html = `
        <div class="stat-card">
            <div class="stat-label">本月總排班</div>
            <div class="stat-value">${stats.total}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">早班</div>
            <div class="stat-value" style="color: #ff9800;">${stats.morning}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">中班</div>
            <div class="stat-value" style="color: #2196f3;">${stats.afternoon}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">晚班</div>
            <div class="stat-value" style="color: #9c27b0;">${stats.night}</div>
        </div>
    `;
    
    statsGrid.innerHTML = html;
}

async function loadMonthlyShifts() {
    const calendarGrid = document.getElementById('calendar-grid');
    if (!calendarGrid) return;
    
    calendarGrid.innerHTML = '<div class="loading">載入月曆中</div>';
    
    try {
        displayMonthCalendar(allMonthShifts);
    } catch (error) {
        console.error('載入月曆失敗:', error);
        calendarGrid.innerHTML = '<div class="loading">載入失敗</div>';
    }
}

function displayMonthCalendar(shifts) {
    const calendarGrid = document.getElementById('calendar-grid');
    if (!calendarGrid) return;
    
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    
    const today = new Date();
    const todayStr = formatDateYMD(today);
    
    let html = '';
    let dayCounter = 1;
    let nextMonthDay = 1;
    
    const totalCells = Math.ceil((daysInMonth + startingDayOfWeek) / 7) * 7;
    
    for (let i = 0; i < totalCells; i++) {
        let dateStr = '';
        let dayNumber = '';
        let otherMonthClass = '';
        let isToday = false;
        
        if (i < startingDayOfWeek) {
            dayNumber = prevMonthLastDay - startingDayOfWeek + i + 1;
            otherMonthClass = 'other-month';
            const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
            const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
            dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
        } else if (dayCounter <= daysInMonth) {
            dayNumber = dayCounter;
            dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
            isToday = dateStr === todayStr;
            dayCounter++;
        } else {
            dayNumber = nextMonthDay;
            otherMonthClass = 'other-month';
            const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
            const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
            dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
            nextMonthDay++;
        }
        
        const dayShifts = shifts.filter(shift => {
            const shiftDate = new Date(shift.date);
            return formatDateYMD(shiftDate) === dateStr;
        });
        
        const hasShifts = dayShifts.length > 0;
        const todayClass = isToday ? 'today' : '';
        const hasShiftsClass = hasShifts ? 'has-shifts' : '';
        
        html += `
            <div class="calendar-day ${otherMonthClass} ${todayClass} ${hasShiftsClass}">
                <div class="day-number">${dayNumber}</div>
                <div class="day-shifts">
                    ${dayShifts.slice(0, 3).map(shift => `
                        <div class="shift-item-mini ${getShiftClass(shift.shiftType)}" 
                             onclick="showShiftDetail('${shift.shiftId}')"
                             title="${shift.employeeName} - ${shift.shiftType} (${shift.startTime}-${shift.endTime})">
                            <div class="shift-item-name">${shift.employeeName}</div>
                            <div class="shift-item-time">${shift.startTime}-${shift.endTime}</div>
                        </div>
                    `).join('')}
                </div>
                ${dayShifts.length > 3 ? `<div class="shift-count">+${dayShifts.length - 3}</div>` : ''}
            </div>
        `;
    }
    
    calendarGrid.innerHTML = html;
}

function getShiftClass(shiftType) {
    const classMap = {
        '早班': 'shift-morning',
        '中班': 'shift-afternoon',
        '晚班': 'shift-night',
        '全日班': 'shift-full'
    };
    return classMap[shiftType] || 'shift-morning';
}

function showShiftDetail(shiftId) {
    const shift = allMonthShifts.find(s => s.shiftId === shiftId);
    if (shift) {
        const detail = `排班詳情:\n\n` +
              `員工: ${shift.employeeName}\n` +
              `日期: ${shift.date}\n` +
              `班別: ${shift.shiftType}\n` +
              `時間: ${shift.startTime} - ${shift.endTime}\n` +
              `地點: ${shift.location}\n` +
              `備註: ${shift.note || '無'}`;
        
        alert(detail);
    }
}

async function loadShiftDistribution() {
    const distributionContainer = document.getElementById('shift-distribution');
    if (!distributionContainer) return;
    
    displayShiftDistribution(allMonthShifts);
}

function displayShiftDistribution(shifts) {
    const distributionContainer = document.getElementById('shift-distribution');
    if (!distributionContainer || shifts.length === 0) {
        if (distributionContainer) distributionContainer.innerHTML = '';
        return;
    }
    
    const employeeStats = {};
    const shiftTypeStats = { '早班': 0, '中班': 0, '晚班': 0, '全日班': 0 };
    
    shifts.forEach(shift => {
        if (!employeeStats[shift.employeeName]) {
            employeeStats[shift.employeeName] = 0;
        }
        employeeStats[shift.employeeName]++;
        
        if (shiftTypeStats[shift.shiftType] !== undefined) {
            shiftTypeStats[shift.shiftType]++;
        }
    });
    
    const maxCount = Math.max(...Object.values(employeeStats), 1);
    
    let html = '<div class="distribution-section">';
    html += '<h3 class="distribution-title">📊 本月員工排班分布</h3>';
    html += '<div class="distribution-bars">';
    
    const sortedEmployees = Object.entries(employeeStats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15);
    
    sortedEmployees.forEach(([name, count]) => {
        const percentage = (count / maxCount * 100).toFixed(0);
        html += `
            <div class="distribution-bar-item">
                <div class="distribution-bar-label">${name}</div>
                <div class="distribution-bar-container">
                    <div class="distribution-bar" style="width: ${percentage}%">
                        <div class="distribution-bar-value">${count} 班</div>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div></div>';
    
    html += '<div class="distribution-section">';
    html += '<h3 class="distribution-title">🎨 本月班別分布</h3>';
    html += '<div class="shift-type-distribution">';
    
    const totalShifts = Object.values(shiftTypeStats).reduce((a, b) => a + b, 0);
    const shiftTypeColors = {
        '早班': '#ff9800',
        '中班': '#2196f3',
        '晚班': '#9c27b0',
        '全日班': '#4caf50'
    };
    
    Object.entries(shiftTypeStats).forEach(([type, count]) => {
        const percentage = totalShifts > 0 ? (count / totalShifts * 100).toFixed(1) : 0;
        const color = shiftTypeColors[type];
        
        html += `
            <div class="shift-type-stat">
                <div class="shift-type-stat-header">
                    <span class="shift-type-label ${getShiftClass(type)}">${type}</span>
                    <span class="shift-type-count">${count}</span>
                </div>
                <div class="shift-type-bar-container">
                    <div class="shift-type-bar" style="width: ${percentage}%; background: ${color};"></div>
                </div>
                <div class="shift-type-percentage">${percentage}%</div>
            </div>
        `;
    });
    
    html += '</div></div>';
    
    distributionContainer.innerHTML = html;
}

function formatDateYMD(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ========== 工具函數 ==========

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

function goBack() {
    window.history.back();
}

console.log('✅ 排班管理系統(含月曆功能)已載入');