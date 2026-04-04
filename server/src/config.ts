import dotenv from 'dotenv'
dotenv.config()

export const APP_VERSION = '1.2.2'

export const config = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  APP_URL: process.env.APP_URL || 'http://localhost:5173',
}
