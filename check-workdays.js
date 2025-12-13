const hkPublicHolidays2025 = [
    '2025-01-01', // New Year's Day
    '2025-01-29', '2025-01-30', '2025-01-31', // Lunar New Year
    '2025-04-04', // Ching Ming Festival
    '2025-04-18', '2025-04-19', '2025-04-21', // Easter
    '2025-05-01', // Labour Day
    '2025-05-05', // The day following the Birthday of the Buddha
    '2025-05-31', // Tuen Ng Festival
    '2025-07-01', // HKSAR Establishment Day
    '2025-09-08', // The day following the Chinese Mid-Autumn Festival
    '2025-10-01', // National Day
    '2025-10-23', // Chung Yeung Festival (实际是10月29日)
    '2025-12-25', '2025-12-26', // Christmas
];

function formatDateString(year, month, day) {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getWorkdaysInMonth(year, month) {
    const holidays = hkPublicHolidays2025;
    const daysInMonth = new Date(year, month, 0).getDate();
    let workdays = 0;
    let details = [];
    const dayNames = ['日', '一', '二', '三', '四', '五', '六'];

    for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(year, month - 1, day);
        const dayOfWeek = currentDate.getDay();
        const dateString = formatDateString(year, month, day);

        if (dayOfWeek === 0 || dayOfWeek === 6) {
            // 周末不上班（香港没有调休制度）
        } else {
            if (!holidays.includes(dateString)) {
                workdays++;
            } else {
                details.push(`${dateString}(周${dayNames[dayOfWeek]}) 公众假期`);
            }
        }
    }
    return { workdays, details };
}

console.log('2025年香港各月工作日（代码当前计算）:');
for (let m = 1; m <= 12; m++) {
    const result = getWorkdaysInMonth(2025, m);
    console.log(`${m}月: ${result.workdays}天`);
    if (result.details.length > 0) {
        result.details.forEach(d => console.log(`  ${d}`));
    }
}
