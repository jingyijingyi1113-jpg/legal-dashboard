import { parse, isValid } from 'date-fns';

/**
 * Convert Excel serial number to Date
 * Excel dates are stored as number of days since 1899-12-30
 * @param serial - Excel serial number
 * @returns Date object
 */
const excelSerialToDate = (serial: number): Date => {
    // Excel epoch is 1899-12-30 (accounting for the 1900 leap year bug)
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const msPerDay = 24 * 60 * 60 * 1000;
    return new Date(excelEpoch.getTime() + serial * msPerDay);
};

/**
 * Parse a month string in various formats to a Date object
 * Supported formats:
 * - 'yyyy/MM' (e.g., '2025/01')
 * - 'MMM-yy' (e.g., 'Jan-25')
 * - 'yyyy-MM' (e.g., '2025-01')
 * - Date objects (e.g., from Excel Timestamp)
 * - ISO date strings (e.g., '2025-01-01T00:00:00.000Z')
 * - Excel serial numbers (e.g., 45658 for 2025-01-01)
 * @param monthStr - The month string, Date object, or Excel serial number to parse
 * @returns Date object or null if parsing fails
 */
export const parseMonthString = (monthStr: string | Date | number | null | undefined): Date | null => {
    if (monthStr === null || monthStr === undefined) return null;
    
    // Handle Date objects directly (from Excel Timestamp)
    if (monthStr instanceof Date) {
        return isValid(monthStr) ? monthStr : null;
    }
    
    // Handle Excel serial numbers (typically 5-digit numbers representing dates)
    if (typeof monthStr === 'number') {
        // Excel serial numbers for dates from 1900-2100 are roughly 1-73000
        if (monthStr > 0 && monthStr < 100000) {
            const date = excelSerialToDate(monthStr);
            if (isValid(date)) {
                return date;
            }
        }
        return null;
    }
    
    const str = monthStr.toString().trim();
    
    // Check if it's a numeric string (Excel serial number)
    if (/^\d+$/.test(str)) {
        const serial = parseInt(str, 10);
        if (serial > 0 && serial < 100000) {
            const date = excelSerialToDate(serial);
            if (isValid(date)) {
                return date;
            }
        }
    }
    
    // Check if it's an ISO date string (e.g., '2025-01-01T00:00:00.000Z')
    if (str.includes('T') || str.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const isoDate = new Date(str);
        if (isValid(isoDate)) {
            return isoDate;
        }
    }
    
    // Try different formats
    const formats = [
        'yyyy/MM',      // 2025/01
        'MMM-yy',       // Jan-25
        'yyyy-MM',      // 2025-01
        'MM/yyyy',      // 01/2025
        'MMM yy',       // Jan 25
        'MMMM-yy',      // January-25
        'MMMM yy',      // January 25
    ];
    
    for (const fmt of formats) {
        try {
            const parsed = parse(str, fmt, new Date());
            if (isValid(parsed)) {
                return parsed;
            }
        } catch {
            // Continue to next format
        }
    }
    
    return null;
};

/**
 * Parse a month string and format it to 'yyyy/MM' standard format
 * @param monthStr - The month string, Date object, or Excel serial number to parse
 * @returns Formatted string 'yyyy/MM' or empty string if parsing fails
 */
export const normalizeMonthString = (monthStr: string | Date | number | null | undefined): string => {
    const parsed = parseMonthString(monthStr);
    if (!parsed) return '';
    
    const year = parsed.getFullYear();
    const month = (parsed.getMonth() + 1).toString().padStart(2, '0');
    return `${year}/${month}`;
};

/**
 * Normalize a string field for comparison purposes.
 * Handles: trim, multiple spaces, case-insensitive comparison,
 * normalizes hyphens/dashes with surrounding spaces,
 * and removes leading underscores
 * @param value - The string value to normalize
 * @returns Normalized lowercase string with single spaces
 */
export const normalizeField = (value: string | null | undefined): string => {
    if (!value) return '';
    return value
        .toString()
        .trim()
        // Remove leading underscores (e.g., "_BSC" -> "BSC")
        .replace(/^_+/, '')
        // Normalize various dash/hyphen characters to standard hyphen
        .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-')
        // Normalize spaces around hyphens: "Public - Others", "Public- Others", "Public -Others", "Public-Others" -> "Public - Others"
        .replace(/\s*-\s*/g, ' - ')
        // Replace multiple spaces with single space
        .replace(/\s+/g, ' ')
        .toLowerCase();
};

/**
 * Normalize a category/tag string for display purposes (preserves case).
 * Handles: trim, multiple spaces, normalizes hyphens/dashes with surrounding spaces,
 * and removes leading underscores
 * @param value - The string value to normalize
 * @returns Normalized string with proper spacing around hyphens
 */
export const normalizeCategoryDisplay = (value: string | null | undefined): string => {
    if (!value) return '';
    return value
        .toString()
        .trim()
        // Remove leading underscores (e.g., "_BSC" -> "BSC")
        .replace(/^_+/, '')
        // Normalize various dash/hyphen characters to standard hyphen
        .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-')
        // Normalize spaces around hyphens
        .replace(/\s*-\s*/g, ' - ')
        // Replace multiple spaces with single space
        .replace(/\s+/g, ' ');
};

/**
 * Check if two field values are equivalent (case-insensitive, whitespace-normalized)
 * @param a - First value
 * @param b - Second value
 * @returns true if the values are equivalent
 */
export const fieldsMatch = (a: string | null | undefined, b: string | null | undefined): boolean => {
    return normalizeField(a) === normalizeField(b);
};

/**
 * Create a normalized key for aggregation purposes
 * @param value - The string value to create a key from
 * @returns Uppercase normalized string for use as a Map/Object key
 */
export const createNormalizedKey = (value: string | null | undefined): string => {
    return normalizeField(value).toUpperCase();
};

const cnPublicHolidays2025 = [
    '2025-01-01', // New Year's Day 元旦
    '2025-01-26', '2025-01-27', '2025-01-28', '2025-01-29', '2025-01-30', '2025-01-31', '2025-02-01', '2025-02-02', '2025-02-03', '2025-02-04', // Spring Festival 春节 1/26-2/4
    '2025-04-04', '2025-04-05', '2025-04-06', // Qingming Festival 清明节 4/4-4/6
    '2025-05-01', '2025-05-02', '2025-05-03', '2025-05-04', '2025-05-05', // Labour Day 劳动节 5/1-5/5
    '2025-05-31', '2025-06-01', '2025-06-02', // Dragon Boat Festival 端午节 5/31-6/2
    '2025-10-01', '2025-10-02', '2025-10-03', '2025-10-04', '2025-10-05', '2025-10-06', '2025-10-07', '2025-10-08', // National Day + Mid-Autumn 国庆节+中秋节 10/1-10/8
];

// 2025年调休上班日（周末补班）
const cnWorkdaysOnWeekend2025 = [
    '2025-01-25', // 春节调休 周六
    '2025-02-08', // 春节调休 周六
    '2025-04-27', // 清明节调休 周日
    '2025-09-28', // 国庆节调休 周日
    '2025-10-11', // 国庆节调休 周六
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
    '2025-10-01', // National Day
    '2025-10-07', // The day following the Chinese Mid-Autumn Festival 中秋节翌日 (中秋节10/6周一)
    '2025-10-29', // Chung Yeung Festival 重阳节
    '2025-12-25', '2025-12-26', // Christmas
];

// 格式化日期为 yyyy-MM-dd（避免时区问题）
const formatDateString = (year: number, month: number, day: number): string => {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

export const getWorkdaysInMonth = (year: number, month: number, region: 'CN' | 'HK' | 'OTHER'): number => {
    const holidays = region === 'CN' ? cnPublicHolidays2025 : region === 'HK' ? hkPublicHolidays2025 : [];
    const weekendWorkdays = region === 'CN' ? cnWorkdaysOnWeekend2025 : [];
    const daysInMonth = new Date(year, month, 0).getDate();
    let workdays = 0;

    for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(year, month - 1, day);
        const dayOfWeek = currentDate.getDay();
        const dateString = formatDateString(year, month, day);

        // Check if it's a weekend but a workday due to make-up work (调休上班)
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            if (weekendWorkdays.includes(dateString)) {
                workdays++;
            }
        } else {
            // It's a weekday (Monday-Friday)
            // Check if it's not a public holiday
            if (!holidays.includes(dateString)) {
                workdays++;
            }
        }
    }
    return workdays;
};

/**
 * Calculate workdays in a date range for a specific region
 * @param startDate - Start date string (yyyy-MM-dd)
 * @param endDate - End date string (yyyy-MM-dd)
 * @param region - Region code ('CN', 'HK', 'OTHER')
 * @returns Number of workdays in the range
 */
export const getWorkdaysInRange = (startDate: string, endDate: string, region: 'CN' | 'HK' | 'OTHER'): number => {
    const holidays = region === 'CN' ? cnPublicHolidays2025 : region === 'HK' ? hkPublicHolidays2025 : [];
    const weekendWorkdays = region === 'CN' ? cnWorkdaysOnWeekend2025 : [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (end < start) return 0;
    
    let workdays = 0;
    const current = new Date(start);
    
    while (current <= end) {
        const dayOfWeek = current.getDay();
        const year = current.getFullYear();
        const month = current.getMonth() + 1;
        const day = current.getDate();
        const dateString = formatDateString(year, month, day);
        
        // Check if it's a weekend but a workday due to make-up work (调休上班)
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            if (weekendWorkdays.includes(dateString)) {
                workdays++;
            }
        } else {
            // It's a weekday (Monday-Friday)
            // Check if it's not a public holiday
            if (!holidays.includes(dateString)) {
                workdays++;
            }
        }
        current.setDate(current.getDate() + 1);
    }
    return workdays;
};