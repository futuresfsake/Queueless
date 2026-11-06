// Integration tests: real Postgres via Testcontainers, connected as the non-owner app role.
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testRegex: '.*\.int\.spec\.ts$',
  transform: { '^.+\.ts$': require.resolve('ts-jest') },
  testTimeout: 60000,
  maxWorkers: 1,
};
