/**
 * Utility for formatting prices and numbers with dynamic precision
 * Essential for handling crypto assets with vast price differences (e.g., BTC vs SHIB)
 */
export class Formatter {
  /**
   * Formats a price with appropriate decimal places based on its value.
   * - Price > 1000: 2 decimals
   * - Price > 10: 2-3 decimals
   * - Price > 1: 4 decimals
   * - Price < 1: 6-8 decimals (for PEPE, SHIB, etc.)
   */
  static formatPrice(price: number): string {
    if (price === 0) return '0.00';
    if (isNaN(price)) return 'N/A';

    if (price >= 1000) return price.toFixed(2);
    if (price >= 10) return price.toFixed(3);
    if (price >= 1) return price.toFixed(4);
    if (price >= 0.01) return price.toFixed(5);
    if (price >= 0.0001) return price.toFixed(7);

    // For extremely small values like PEPE/SHIB
    return price.toFixed(8);
  }

  /**
   * Formats a technical indicator value (typically 4 decimals is enough, but can vary)
   */
  static formatIndicator(value: number): string {
    return value.toFixed(4);
  }
}
