export default {
  // Use Node.js environment (matches Cloudflare Workers runtime)
  testEnvironment: 'node',

  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.js'
  ],

  // Module resolution
  moduleFileExtensions: ['js', 'ts'],
  extensionsToTreatAsEsm: ['.ts'],

  // Transform TypeScript files
  preset: 'ts-jest/presets/default-esm',
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
    }],
  },

  // Module name mapping for ESM
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],

  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],

  // Timeout for async tests (increased for worker communication)
  testTimeout: 15000,

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Global setup/teardown for automatic worker management
  globalSetup: './tests/utils/global-setup.js',
  globalTeardown: './tests/utils/global-teardown.js',

  // Coverage thresholds (optional - can be enabled to enforce minimum coverage)
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },

  // CI-specific settings
  ci: process.env.CI === 'true',
  maxWorkers: process.env.CI ? 2 : '50%',
};
