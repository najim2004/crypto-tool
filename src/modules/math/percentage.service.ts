/**
 * Percentage Calculation Service
 * Provides reusable percentage calculation utilities
 */
export class PercentageService {
  /**
   * Calculate percentage change between two values
   * @param oldValue - Original value
   * @param newValue - New value
   * @returns Percentage change (positive for increase, negative for decrease)
   */
  calculateChange(oldValue: number, newValue: number): number {
    if (oldValue === 0) return 0;
    return ((newValue - oldValue) / oldValue) * 100;
  }

  /**
   * Calculate percentage of a number
   * @param value - The base value
   * @param percentage - The percentage to calculate
   * @returns The calculated percentage value
   */
  calculatePercentage(value: number, percentage: number): number {
    return (value * percentage) / 100;
  }

  /**
   * Calculate what percentage one number is of another
   * @param part - The part value
   * @param whole - The whole value
   * @returns The percentage representation
   */
  calculateRatio(part: number, whole: number): number {
    if (whole === 0) return 0;
    return (part / whole) * 100;
  }

  /**
   * Format percentage for display
   * @param value - The percentage value
   * @param decimals - Number of decimal places (default: 2)
   * @returns Formatted percentage string with % sign
   */
  formatPercentage(value: number, decimals: number = 2): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(decimals)}%`;
  }

  /**
   * Check if percentage is within a range
   * @param value - The percentage to check
   * @param min - Minimum threshold
   * @param max - Maximum threshold
   * @returns True if within range
   */
  isWithinRange(value: number, min: number, max: number): boolean {
    return value >= min && value <= max;
  }
}

export const percentageService = new PercentageService();
