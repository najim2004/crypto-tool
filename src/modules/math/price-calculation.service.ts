/**
 * Price Calculation Service
 * Provides price-related calculation utilities
 */
export class PriceCalculationService {
  /**
   * Calculate absolute distance between two prices
   * @param price1 - First price
   * @param price2 - Second price
   * @returns Absolute distance
   */
  calculateDistance(price1: number, price2: number): number {
    return Math.abs(price1 - price2);
  }

  /**
   * Calculate price after applying a percentage change
   * @param price - Original price
   * @param percentage - Percentage change (positive for increase, negative for decrease)
   * @returns New price after percentage change
   */
  calculatePriceAfterChange(price: number, percentage: number): number {
    return price * (1 + percentage / 100);
  }

  /**
   * Calculate the midpoint between two prices
   * @param price1 - First price
   * @param price2 - Second price
   * @returns Midpoint price
   */
  calculateMidpoint(price1: number, price2: number): number {
    return (price1 + price2) / 2;
  }

  /**
   * Determine if current price is between two levels
   * @param currentPrice - Current price to check
   * @param level1 - First price level
   * @param level2 - Second price level
   * @returns True if price is between the two levels
   */
  isBetween(currentPrice: number, level1: number, level2: number): boolean {
    const min = Math.min(level1, level2);
    const max = Math.max(level1, level2);
    return currentPrice >= min && currentPrice <= max;
  }

  /**
   * Determine price trend from an array of prices
   * @param prices - Array of price values
   * @returns Trend direction
   */
  determinePriceTrend(prices: number[]): 'UP' | 'DOWN' | 'SIDEWAYS' {
    if (prices.length < 2) return 'SIDEWAYS';

    const firstHalf = prices.slice(0, Math.floor(prices.length / 2));
    const secondHalf = prices.slice(Math.floor(prices.length / 2));

    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const diffPercent = ((avgSecond - avgFirst) / avgFirst) * 100;

    if (diffPercent > 0.5) return 'UP';
    if (diffPercent < -0.5) return 'DOWN';
    return 'SIDEWAYS';
  }

  /**
   * Calculate percentage distance from entry to current price
   * @param entry - Entry price
   * @param current - Current price
   * @returns Percentage distance (positive if above entry, negative if below)
   */
  calculatePercentageFromEntry(entry: number, current: number): number {
    if (entry === 0) return 0;
    return ((current - entry) / entry) * 100;
  }
}

export const priceCalculationService = new PriceCalculationService();
