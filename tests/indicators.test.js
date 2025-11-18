/**
 * Technical indicators calculation tests
 */

import { calculateIndicators } from '../src/indicators.js';
import { TestRunner, assertEqual, assertThrows } from './utils/test-helpers.js';
import assert from 'node:assert';

const runner = new TestRunner();

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

// Test 1: Calculate SMA correctly
runner.test('Calculate SMA correctly', () => {
  const data = createPriceData(200);
  const indicators = calculateIndicators(data);
  
  assert(typeof indicators.sma20 === 'number', 'SMA 20 should be a number');
  assert(typeof indicators.sma50 === 'number', 'SMA 50 should be a number');
  assert(typeof indicators.sma100 === 'number', 'SMA 100 should be a number');
  assert(typeof indicators.sma200 === 'number', 'SMA 200 should be a number');
  
  // SMA 200 should be less than SMA 20 if prices are generally increasing
  // (in our test data, prices increase over time)
  assert(indicators.sma200 < indicators.sma20, 'SMA 200 should be less than SMA 20 for increasing prices');
});

// Test 2: Calculate Bollinger Bands correctly
runner.test('Calculate Bollinger Bands correctly', () => {
  const data = createPriceData(200);
  const indicators = calculateIndicators(data);
  
  assert(typeof indicators.bollingerUpper === 'number', 'Bollinger upper should be a number');
  assert(typeof indicators.bollingerMiddle === 'number', 'Bollinger middle should be a number');
  assert(typeof indicators.bollingerLower === 'number', 'Bollinger lower should be a number');
  
  // Bollinger middle should equal SMA 20
  assertEqual(indicators.bollingerMiddle, indicators.sma20, 'Bollinger middle should equal SMA 20');
  
  // Upper should be greater than middle
  assert(indicators.bollingerUpper > indicators.bollingerMiddle, 'Bollinger upper should be greater than middle');
  
  // Lower should be less than middle
  assert(indicators.bollingerLower < indicators.bollingerMiddle, 'Bollinger lower should be less than middle');
});

// Test 3: Throw error on insufficient data
runner.test('Throw error on insufficient data', () => {
  const data = createPriceData(50); // Less than 200 days needed
  
  assertThrows(() => {
    calculateIndicators(data);
  }, 'Should throw error for insufficient data');
});

// Test 4: Handle exact minimum data
runner.test('Handle exact minimum data', () => {
  const data = createPriceData(200); // Exactly 200 days
  
  const indicators = calculateIndicators(data);
  assert(typeof indicators.sma200 === 'number', 'Should calculate SMA 200 with exact minimum data');
});

// Test 5: Verify SMA calculation with known values
runner.test('Verify SMA calculation with known values', () => {
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
  assertEqual(indicators.sma20, 100, 'SMA 20 should be 100');
  assertEqual(indicators.sma50, 100, 'SMA 50 should be 100');
  assertEqual(indicators.sma100, 100, 'SMA 100 should be 100');
  assertEqual(indicators.sma200, 100, 'SMA 200 should be 100');
  
  // Bollinger bands should be centered at 100
  assertEqual(indicators.bollingerMiddle, 100, 'Bollinger middle should be 100');
  // With no variance, upper and lower should be close to middle
  assert(Math.abs(indicators.bollingerUpper - 100) < 1, 'Bollinger upper should be close to 100');
  assert(Math.abs(indicators.bollingerLower - 100) < 1, 'Bollinger lower should be close to 100');
});

// Run tests
runner.run().catch(console.error);

