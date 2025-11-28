/**
 * Bank Holiday Detection Module
 *
 * Provides functions to detect US stock market holidays and determine trading days.
 * All date operations use UTC timezone for consistency with scheduling logic.
 */

/**
 * Information about a detected bank holiday
 */
export interface HolidayInfo {
  name: string;
  date: Date;
  isObserved: boolean; // true if the holiday was shifted due to weekend
}

/**
 * Internal holiday definition with calculation logic
 */
interface HolidayDefinition {
  name: string;
  calculate: (year: number) => Date;
  observeWeekendRule: boolean;
}

/**
 * Calculate Easter Sunday using the Computus algorithm (Anonymous Gregorian)
 * @param year - Year to calculate Easter for
 * @returns Date object for Easter Sunday in UTC
 */
function calculateEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Get the nth occurrence of a weekday in a month
 * @param year - Year
 * @param month - Month (0-11)
 * @param weekday - Day of week (0=Sunday, 1=Monday, etc.)
 * @param occurrence - Which occurrence (1=first, 2=second, etc., -1=last)
 * @returns Date object in UTC
 */
function getNthWeekdayOfMonth(year: number, month: number, weekday: number, occurrence: number): Date {
  if (occurrence === -1) {
    // Last occurrence: start from end of month and work backwards
    const lastDay = new Date(Date.UTC(year, month + 1, 0));
    const lastDayOfWeek = lastDay.getUTCDay();
    const daysBack = (lastDayOfWeek - weekday + 7) % 7;
    return new Date(Date.UTC(year, month, lastDay.getUTCDate() - daysBack));
  } else {
    // Nth occurrence: start from first day of month
    const firstDay = new Date(Date.UTC(year, month, 1));
    const firstDayOfWeek = firstDay.getUTCDay();
    const daysForward = (weekday - firstDayOfWeek + 7) % 7;
    const targetDate = 1 + daysForward + (occurrence - 1) * 7;
    return new Date(Date.UTC(year, month, targetDate));
  }
}

/**
 * Apply weekend observation rules to a holiday
 * If holiday falls on Saturday, observe on Friday
 * If holiday falls on Sunday, observe on Monday
 * @param date - Original holiday date
 * @returns Observed holiday date
 */
function applyWeekendObservation(date: Date): Date {
  const dayOfWeek = date.getUTCDay();

  if (dayOfWeek === 6) {
    // Saturday: observe on Friday
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - 1));
  } else if (dayOfWeek === 0) {
    // Sunday: observe on Monday
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1));
  }

  return date;
}

/**
 * US Stock Market Holiday Definitions
 */
const HOLIDAY_DEFINITIONS: HolidayDefinition[] = [
  {
    name: "New Year's Day",
    calculate: (year) => new Date(Date.UTC(year, 0, 1)),
    observeWeekendRule: true,
  },
  {
    name: "Martin Luther King Jr. Day",
    calculate: (year) => getNthWeekdayOfMonth(year, 0, 1, 3), // 3rd Monday of January
    observeWeekendRule: false, // Always on Monday
  },
  {
    name: "Presidents' Day",
    calculate: (year) => getNthWeekdayOfMonth(year, 1, 1, 3), // 3rd Monday of February
    observeWeekendRule: false, // Always on Monday
  },
  {
    name: "Good Friday",
    calculate: (year) => {
      const easter = calculateEaster(year);
      // Good Friday is 2 days before Easter Sunday
      return new Date(Date.UTC(year, easter.getUTCMonth(), easter.getUTCDate() - 2));
    },
    observeWeekendRule: false, // Always on Friday
  },
  {
    name: "Memorial Day",
    calculate: (year) => getNthWeekdayOfMonth(year, 4, 1, -1), // Last Monday of May
    observeWeekendRule: false, // Always on Monday
  },
  {
    name: "Juneteenth",
    calculate: (year) => {
      // Juneteenth became a federal holiday in 2021
      if (year < 2021) {
        return new Date(Date.UTC(year, 5, 19)); // Return date but won't be used
      }
      return new Date(Date.UTC(year, 5, 19));
    },
    observeWeekendRule: true,
  },
  {
    name: "Independence Day",
    calculate: (year) => new Date(Date.UTC(year, 6, 4)),
    observeWeekendRule: true,
  },
  {
    name: "Labor Day",
    calculate: (year) => getNthWeekdayOfMonth(year, 8, 1, 1), // 1st Monday of September
    observeWeekendRule: false, // Always on Monday
  },
  {
    name: "Thanksgiving Day",
    calculate: (year) => getNthWeekdayOfMonth(year, 10, 4, 4), // 4th Thursday of November
    observeWeekendRule: false, // Always on Thursday
  },
  {
    name: "Christmas Day",
    calculate: (year) => new Date(Date.UTC(year, 11, 25)),
    observeWeekendRule: true,
  },
];

/**
 * Cache for calculated holidays by year
 */
const holidayCache = new Map<number, HolidayInfo[]>();

/**
 * Get all bank holidays for a given year
 * @param year - Year to get holidays for
 * @returns Array of HolidayInfo objects
 */
export function getHolidaysForYear(year: number): HolidayInfo[] {
  // Check cache first
  if (holidayCache.has(year)) {
    return holidayCache.get(year)!;
  }

  const holidays: HolidayInfo[] = [];

  for (const def of HOLIDAY_DEFINITIONS) {
    try {
      // Skip Juneteenth for years before 2021
      if (def.name === "Juneteenth" && year < 2021) {
        continue;
      }

      const originalDate = def.calculate(year);
      let observedDate = originalDate;
      let isObserved = false;

      if (def.observeWeekendRule) {
        observedDate = applyWeekendObservation(originalDate);
        isObserved = observedDate.getTime() !== originalDate.getTime();
      }

      holidays.push({
        name: def.name,
        date: observedDate,
        isObserved,
      });
    } catch (error) {
      console.error(`Error calculating holiday ${def.name} for year ${year}:`, error);
    }
  }

  // Cache the results
  holidayCache.set(year, holidays);

  return holidays;
}

/**
 * Check if a given date is a US stock market holiday
 * @param date - Date to check (uses UTC)
 * @returns HolidayInfo if it's a holiday, null otherwise
 */
export function isBankHoliday(date: Date): HolidayInfo | null {
  try {
    const year = date.getUTCFullYear();
    const holidays = getHolidaysForYear(year);

    // Compare dates by creating a date string (YYYY-MM-DD)
    const targetDateStr = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;

    for (const holiday of holidays) {
      const holidayDateStr = `${holiday.date.getUTCFullYear()}-${String(holiday.date.getUTCMonth() + 1).padStart(2, '0')}-${String(holiday.date.getUTCDate()).padStart(2, '0')}`;

      if (targetDateStr === holidayDateStr) {
        return holiday;
      }
    }

    return null;
  } catch (error) {
    console.error('Error checking bank holiday:', error);
    return null; // Fail-safe: treat as non-holiday
  }
}

/**
 * Check if a given date is a trading day (weekday and not a holiday)
 * @param date - Date to check (uses UTC)
 * @returns true if it's a trading day, false otherwise
 */
export function isTradingDay(date: Date): boolean {
  try {
    const dayOfWeek = date.getUTCDay();

    // Check if it's a weekend
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }

    // Check if it's a bank holiday
    const holiday = isBankHoliday(date);
    return holiday === null;
  } catch (error) {
    console.error('Error checking trading day:', error);
    return true; // Fail-safe: treat as trading day
  }
}
