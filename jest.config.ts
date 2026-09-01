import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }] },

  // Pins the timezone before any test module loads. Without this, date tests
  // pass on a developer's machine and fail in CI -- the single most common
  // failure mode in a booking system.
  setupFiles: ['<rootDir>/../test/setup-env.ts'],

  collectCoverageFrom: ['**/*.ts', '!**/*.spec.ts', '!**/*.module.ts', '!main.ts'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',

  coverageThreshold: {
    global: { branches: 80, functions: 85, lines: 85, statements: 85 },
    // Raised to 100% for reservations/rules/ and period.vo.ts once those
    // exist (phase F5). A threshold pointing at an empty path fails the run.
  },
};

export default config;
