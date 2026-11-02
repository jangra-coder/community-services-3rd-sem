/**
 * Environment used by the test-suite. `TEST_DATABASE_URL` can point at any
 * empty PostgreSQL database – its schema is reset before the tests run.
 */
export const testEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: process.env.TEST_DATABASE_URL || 'postgres://eventpass:eventpass@localhost:5432/eventpass_test',
  JWT_SECRET: 'test-secret-not-for-production',
  JWT_EXPIRES_IN: '1h',
  CLIENT_URL: 'http://localhost:5173',
  APP_NAME: 'EventPass Test',
  SMTP_HOST: '',
  ORGANIZER_SIGNUP_CODE: '',
  AUTO_MIGRATE: 'false',
  SERVE_CLIENT: 'false',
};
