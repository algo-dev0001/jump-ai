import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001'),
  DATABASE_URL: z.string(),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  
  OPENAI_API_KEY: z.string().optional(),
  
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_REDIRECT_URI: z.string().default('http://localhost:3001/auth/google/callback'),
  
  HUBSPOT_CLIENT_ID: z.string().optional(),
  HUBSPOT_CLIENT_SECRET: z.string().optional(),
  HUBSPOT_REDIRECT_URI: z.string().optional(),
  
  SESSION_SECRET: z.string().default('dev-session-secret-change-in-production'),
  JWT_SECRET: z.string().default('dev-jwt-secret-change-in-production'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  console.error('Required: DATABASE_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET');
  throw new Error('Invalid environment variables');
}

export const config = parsed.data;

