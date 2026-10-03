// Imported first by every test file. ES imports are hoisted, so this must be its
// own module to run before src/db/prisma reads DATABASE_URL.
//
// By default Prisma points at port 1, which refuses connections: any DB call
// fails fast and nothing is ever written. Files that need a real database
// import ./env-db first, which sets TEST_DATABASE_URL to the local test DB.
const testDb = process.env.TEST_DATABASE_URL
if (testDb && !/^postgresql:\/\/([^@/]+@)?(localhost|127\.0\.0\.1)[:/]/.test(testDb)) {
  throw new Error('Tests may only use a local database')
}
process.env.DATABASE_URL = testDb ?? 'postgresql://test@127.0.0.1:1/none'

// src/config.ts loads server/.env, which holds production secrets. dotenv never
// overrides variables that already exist, so pin the dangerous ones here.
process.env.NODE_ENV = 'test'
process.env.RESEND_API_KEY = '' // never send real email from a test
process.env.DIRECT_URL = process.env.DATABASE_URL
process.env.JWT_SECRET = 'test-secret'
