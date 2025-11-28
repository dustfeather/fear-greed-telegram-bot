/**
 * Technical indicators calculation tests
 */

import { calculateIndicators } from '../../../src/trading/utils/indicators.js';

// Helper to create mock price data
function createPriceData(days, basePrice = 100, volatility = 1) {
  const data = [];
  for (let i = 0; i < days; i++) {
    const price = basePrice + (Math.sin(i / 10) * volatility * 10) + (i * 0.1);
    data.push({
      date: Date.now() / 1000 - (days - i) * 86400,
      open: price,
      high: price * 1.02,
      low: price * 0.98,
      close: price,
      volume: 1000000
    });
  }
  return data;
}

describe('Technical Indicators', () => {

  test('should calculate SMA correctly', () => {
    const data = createPriceData(200);
    const indicators = calculateIndicators(data);

    expect(typeof indicators.sma20).toBe('number');
    expect(typeof indicators.sma50).toBe('number');
    expect(typeof indicators.sma100).toBe('number');
    expect(typeof indicators.sma200).toBe('number');

    // SMA 200 should be less than SMA 20 if prices are generally increasing
    // (in our test data, prices increase over time)
    expect(indicators.sma200).toBeLessThan(indicators.sma20);
  });

  test('should calculate Bollinger Bands correctly', () => {
    const data = createPriceData(200);
    const indicators = calculateIndicators(data);

    expect(typeof indicators.bollingerUpper).toBe('number');
    expect(typeof indicators.bollingerMiddle).toBe('number');
    expect(typeof indicators.bollingerLower).toBe('number');

    // Bollinger middle should equal SMA 20
    expect(indicators.bollingerMiddle).toBe(indicators.sma20);

    // Upper should be greater than middle
    expect(indicators.bollingerUpper).toBeGreaterThan(indicators.bollingerMiddle);

    // Lower should be less than middle
    expect(indicators.bollingerLower).toBeLessThan(indicators.bollingerMiddle);
  });

  test('should handle insufficient data gracefully', () => {
    const data = createPriceData(50); // Less than 200 days needed

    // Should not throw, but calculate with available data
    const indicators = calculateIndicators(data);

    // Should still return valid indicators
    expect(typeof indicators.sma20).toBe('number');
    expect(typeof indicators.sma50).toBe('number');
    expect(typeof indicators.sma100).toBe('number');
    expect(typeof indicators.sma200).toBe('number');
  });

  test('should handle exact minimum data', () => {
    const data = createPriceData(200); // Exactly 200 days

    const indicators = calculateIndicators(data);
    expect(typeof indicators.sma200).toBe('number');
  });

  test('should verify SMA calculation with known values', () => {
    // Create data with known prices
    const data = [];
    for (let i = 0; i < 200; i++) {
      data.push({
        date: Date.now() / 1000 - (200 - i) * 86400,
        open: 100,
        high: 101,
        low: 99,
        close: 100,
        volume: 1000000
      });
    }

    const indicators = calculateIndicators(data);

    // All SMAs should be 100 (since all closes are 100)
    expect(indicators.sma20).toBe(100);
    expect(indicators.sma50).toBe(100);
    expect(indicators.sma100).toBe(100);
    expect(indicators.sma200).toBe(100);

    // Bollinger bands should be centered at 100
    expect(indicators.bollingerMiddle).toBe(100);
    // With no variance, upper and lower should be close to middle
    expect(Math.abs(indicators.bollingerUpper - 100)).toBeLessThan(1);
    expect(Math.abs(indicators.bollingerLower - 100)).toBeLessThan(1);
  });
});

