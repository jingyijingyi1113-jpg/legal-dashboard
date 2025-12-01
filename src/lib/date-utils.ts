const cnPublicHolidays2025 = [
    '2025-01-01', // New Year's Day
    '2025-01-28', '2025-01-29', '2025-01-30', '2025-01-31', '2025-02-01', '2025-02-02', '2025-02-03', // Spring Festival
    '2025-04-05', // Qingming Festival
    '2025-05-01', '2025-05-02', '2025-05-03', // Labour Day
    '2025-05-31', // Dragon Boat Festival
    '2025-09-06', // Mid-Autumn Festival
    '2025-10-01', '2025-10-02', '2025-10-03', '2025-10-04', '2025-10-05', '2025-10-06', '2025-10-07', // National Day
];

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
    '2025-10-23', // Chung Yeung Festival
    '2025-12-25', '2025-12-26', // Christmas
];

export const getWorkdaysInMonth = (year: number, month: number, region: 'CN' | 'HK'): number => {
    const holidays = region === 'CN' ? cnPublicHolidays2025 : hkPublicHolidays2025;
    const daysInMonth = new Date(year, month, 0).getDate();
    let workdays = 0;

    for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(year, month - 1, day);
        const dayOfWeek = currentDate.getDay();
        const dateString = currentDate.toISOString().split('T')[0];

        // Check if it's a weekday (Monday-Friday)
        if (dayOfWeek > 0 && dayOfWeek < 6) {
            // Check if it's not a public holiday
            if (!holidays.includes(dateString)) {
                workdays++;
            }
        }
    }
    return workdays;
};