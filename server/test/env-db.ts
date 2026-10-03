// For test files that need a real database: the local, disposable test DB.
// Create it once with `npm run test:db:setup`. Import it first, then ./env:
//   import './env-db'
//   import './env'
// (Not imported from here: ES imports are hoisted and would run before this line.)
process.env.TEST_DATABASE_URL = 'postgresql://localhost:5432/dominos_pr_test'
