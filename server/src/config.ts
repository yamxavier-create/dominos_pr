import dotenv from 'dotenv'
dotenv.config()

export const config = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  NODE_ENV: process.env.NODE_ENV || 'development',
}
