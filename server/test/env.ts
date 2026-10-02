// Imported first by every test file. ES imports are hoisted, so this must be its
// own module to run before src/db/prisma reads DATABASE_URL. Port 1 refuses
// connections: any DB call in a test fails fast and nothing is ever written.
process.env.DATABASE_URL = 'postgresql://test@127.0.0.1:1/none'
