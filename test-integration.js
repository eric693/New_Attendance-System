// test-integration.js - 完整整合測試腳本

/**
 * 🧪 薪資系統整合測試
 * 
 * 使用方式：
 * 1. 在瀏覽器 Console 中貼上這個腳本
 * 2. 執行 runAllTests()
 */

const TEST_CONFIG = {
    employeeId: 'TEST_' + Date.now(),
    employeeName: '測試員工_' + Date.now(),
    baseSalary: 30000
};

/**
 * 執行所有測試
 */
async function runAllTests() {
    console.log('🧪 開始執行薪資系統整合測試...\n');
    
    const results = {
        total: 0,
        passed: 0,
        failed: 0
    };
    
    // 測試 1: 檢查 Session
    await test1_CheckSession(results);
    
    // 測試 2: 設定員工薪資
    await test2_SetSalary(results);
    
    // 測試 3: 取得員工薪資
    await test3_GetSalary(results);
    
    // 測試 4: 計算月薪
    await test4_CalculateSalary(results);
    
    // 測試 5: 儲存薪資單
    await test5_SaveSalary(results);
    
    // 輸出測試結果
    console.log('\n' + '='.repeat(50));
    console.log('📊 測試結果摘要');
    console.log('='.repeat(50));
    console.log(`總測試數: ${results.total}`);
    console.log(`✅ 通過: ${results.passed}`);
    console.log(`❌ 失敗: ${results.failed}`);
    console.log(`成功率: ${((results.passed / results.total) * 100).toFixed(2)}%`);
    
    if (results.failed === 0) {
        console.log('\n🎉 所有測試通過！前後端串接正常！');
    } else {
        console.log('\n⚠️ 有測試失敗，請檢查錯誤訊息');
    }
}

/**
 * 測試 1: 檢查 Session
 */
async function test1_CheckSession(results) {
    results.total++;
    console.log('\n--- 測試 1: 檢查 Session ---');
    
    try {
        const res = await callApifetch('checkSession');
        
        if (res.ok && res.user) {
            console.log('✅ Session 驗證成功');
            console.log('   使用者:', res.user.name);
            console.log('   部門:', res.user.dept);
            results.passed++;
            return true;
        } else {
            console.log('❌ Session 驗證失敗');
            console.log('   錯誤:', res.code || res.msg);
            results.failed++;
            return false;
        }
    } catch (error) {
        console.log('❌ 測試失敗:', error.message);
        results.failed++;
        return false;
    }
}

/**
 * 測試 2: 設定員工薪資
 */
async function test2_SetSalary(results) {
    results.total++;
    console.log('\n--- 測試 2: 設定員工薪資 ---');
    
    try {
        const formData = {
            employeeId: TEST_CONFIG.employeeId,
            employeeName: TEST_CONFIG.employeeName,
            idNumber: 'A123456789',
            employeeType: '正職',
            salaryType: '月薪',
            baseSalary: TEST_CONFIG.baseSalary,
            bankCode: '822',
            bankAccount: '1234567890',
            hireDate: '2024-01-01',
            paymentDay: '5',
            pensionSelfRate: '6',
            laborFee: '666',
            healthFee: '517',
            employmentFee: '70',
            incomeTax: '0',
            note: '整合測試資料'
        };
        
        console.log('📤 發送資料:', formData);
        
        const params = new URLSearchParams(formData).toString();
        const res = await callApifetch(`setEmployeeSalaryTW&${params}`);
        
        console.log('📥 收到回應:', res);
        
        if (res.ok) {
            console.log('✅ 薪資設定成功');
            results.passed++;
            return true;
        } else {
            console.log('❌ 薪資設定失敗');
            console.log('   錯誤:', res.msg);
            results.failed++;
            return false;
        }
    } catch (error) {
        console.log('❌ 測試失敗:', error.message);
        results.failed++;
        return false;
    }
}

/**
 * 測試 3: 取得員工薪資
 */
async function test3_GetSalary(results) {
    results.total++;
    console.log('\n--- 測試 3: 取得員工薪資 ---');
    
    try {
        const res = await callApifetch(`getEmployeeSalaryTW&employeeId=${TEST_CONFIG.employeeId}`);
        
        console.log('📥 收到回應:', res);
        
        if (res.ok && res.data) {
            console.log('✅ 取得薪資成功');
            console.log('   員工ID:', res.data.employeeId);
            console.log('   員工姓名:', res.data.employeeName);
            console.log('   基本薪資:', res.data.baseSalary);
            results.passed++;
            return true;
        } else {
            console.log('❌ 取得薪資失敗');
            console.log('   錯誤:', res.msg);
            results.failed++;
            return false;
        }
    } catch (error) {
        console.log('❌ 測試失敗:', error.message);
        results.failed++;
        return false;
    }
}

/**
 * 測試 4: 計算月薪
 */
async function test4_CalculateSalary(results) {
    results.total++;
    console.log('\n--- 測試 4: 計算月薪 ---');
    
    try {
        const now = new Date();
        const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        const res = await callApifetch(`calculateMonthlySalary&employeeId=${TEST_CONFIG.employeeId}&yearMonth=${yearMonth}`);
        
        console.log('📥 收到回應:', res);
        
        if (res.ok && res.data) {
            console.log('✅ 計算月薪成功');
            console.log('   應發總額:', res.data.grossSalary);
            console.log('   扣款總額:', res.data.totalDeductions);
            console.log('   實發金額:', res.data.netSalary);
            
            // 儲存計算結果供測試 5 使用
            window.testSalaryData = res.data;
            
            results.passed++;
            return true;
        } else {
            console.log('❌ 計算月薪失敗');
            console.log('   錯誤:', res.msg);
            results.failed++;
            return false;
        }
    } catch (error) {
        console.log('❌ 測試失敗:', error.message);
        results.failed++;
        return false;
    }
}

/**
 * 測試 5: 儲存薪資單
 */
async function test5_SaveSalary(results) {
    results.total++;
    console.log('\n--- 測試 5: 儲存薪資單 ---');
    
    try {
        if (!window.testSalaryData) {
            console.log('⚠️ 跳過測試（需要先執行測試 4）');
            results.total--;
            return false;
        }
        
        const data = window.testSalaryData;
        
        const params = new URLSearchParams({
            employeeId: data.employeeId,
            employeeName: data.employeeName,
            yearMonth: data.yearMonth,
            baseSalary: data.baseSalary,
            weekdayOvertimePay: data.weekdayOvertimePay,
            restdayOvertimePay: data.restdayOvertimePay,
            holidayOvertimePay: data.holidayOvertimePay,
            laborFee: data.laborFee,
            healthFee: data.healthFee,
            employmentFee: data.employmentFee,
            pensionSelf: data.pensionSelf,
            incomeTax: data.incomeTax,
            leaveDeduction: data.leaveDeduction,
            lateDeduction: data.lateDeduction || 0,
            grossSalary: data.grossSalary,
            netSalary: data.netSalary,
            employerLaborFee: data.employerLaborFee,
            employerHealthFee: data.employerHealthFee,
            employerEmploymentFee: data.employerEmploymentFee,
            employerPension: data.employerPension,
            bankCode: data.bankCode,
            bankAccount: data.bankAccount
        }).toString();
        
        const res = await callApifetch(`saveMonthlySalary&${params}`);
        
        console.log('📥 收到回應:', res);
        
        if (res.ok) {
            console.log('✅ 儲存薪資單成功');
            console.log('   薪資單ID:', res.salaryId);
            results.passed++;
            return true;
        } else {
            console.log('❌ 儲存薪資單失敗');
            console.log('   錯誤:', res.msg);
            results.failed++;
            return false;
        }
    } catch (error) {
        console.log('❌ 測試失敗:', error.message);
        results.failed++;
        return false;
    }
}

/**
 * 快速測試：只測試薪資設定
 */
async function quickTest() {
    console.log('🚀 快速測試：薪資設定\n');
    
    const formData = {
        employeeId: 'QUICK_' + Date.now(),
        employeeName: '快速測試',
        salaryType: '月薪',
        baseSalary: '30000'
    };
    
    console.log('📤 發送資料:', formData);
    
    const params = new URLSearchParams(formData).toString();
    const res = await callApifetch(`setEmployeeSalaryTW&${params}`);
    
    console.log('📥 收到回應:', res);
    
    if (res.ok) {
        console.log('✅ 測試成功！前後端串接正常！');
    } else {
        console.log('❌ 測試失敗:', res.msg);
    }
}

/**
 * 檢查環境
 */
function checkEnvironment() {
    console.log('🔍 檢查測試環境\n');
    
    const checks = {
        'callApifetch 函數': typeof callApifetch === 'function',
        'Session Token': !!localStorage.getItem('sessionToken'),
        'URLSearchParams': typeof URLSearchParams === 'function'
    };
    
    let allPassed = true;
    
    for (const [name, passed] of Object.entries(checks)) {
        console.log(`${passed ? '✅' : '❌'} ${name}`);
        if (!passed) allPassed = false;
    }
    
    console.log('\n' + (allPassed ? '✅ 環境檢查通過' : '❌ 環境檢查失敗'));
    
    return allPassed;
}

// 匯出測試函數
window.runAllTests = runAllTests;
window.quickTest = quickTest;
window.checkEnvironment = checkEnvironment;

console.log('✅ 測試腳本已載入');
console.log('💡 使用方式:');
console.log('   - checkEnvironment()  檢查環境');
console.log('   - quickTest()        快速測試');
console.log('   - runAllTests()      完整測試');