/**
 * Date Utilities
 * 
 * Handles date formatting to avoid timezone issues.
 * All dates are stored as YYYY-MM-DD strings (local date, no time component).
 */

/**
 * Converts a Date object to YYYY-MM-DD format in local timezone
 * This avoids timezone conversion issues when storing dates
 */
export function formatDateForStorage(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Parses a YYYY-MM-DD string to a Date object in local timezone
 */
export function parseDateFromStorage(dateString: string): Date {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
}

/**
 * Gets today's date as YYYY-MM-DD string
 */
export function getTodayString(): string {
    return formatDateForStorage(new Date());
}
