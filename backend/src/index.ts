import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { config } from './config';
import authRoutes from './routes/auth';
import chatRoutes from './routes/chat';
import ragRoutes from './routes/rag';
import instructionsRoutes from './routes/instructions';
import { startEmailPoller, stopEmailPoller } from './jobs';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = config.PORT || 3001;

// Middleware
app.use(cors({
  origin: config.FRONTEND_URL,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());

// Basic health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Detailed health check for deployment verification
app.get('/health/detailed', async (req, res) => {
  const checks: Record<string, { status: string; message?: string; latency?: number }> = {};
  
  // Database check
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: 'ok', latency: Date.now() - dbStart };
  } catch (error) {
    checks.database = { 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
  
  // OpenAI check (just verify key format)
  checks.openai = config.OPENAI_API_KEY?.startsWith('sk-') 
    ? { status: 'ok' }
    : { status: 'error', message: 'Invalid API key format' };
  
  // Google OAuth check
  checks.google = config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET
    ? { status: 'ok' }
    : { status: 'warning', message: 'Google OAuth not configured' };
  
  // HubSpot check (optional)
  checks.hubspot = config.HUBSPOT_CLIENT_ID
    ? { status: 'ok' }
    : { status: 'warning', message: 'HubSpot not configured (optional)' };
  
  // Overall status
  const hasErrors = Object.values(checks).some(c => c.status === 'error');
  const overallStatus = hasErrors ? 'unhealthy' : 'healthy';
  
  res.status(hasErrors ? 503 : 200).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    checks,
  });
});

// API info
app.get('/api', (req, res) => {
  res.json({ 
    message: 'AI Advisor Agent API',
    version: '1.0.0',
    endpoints: {
      auth: '/auth/*',
      chat: '/chat/*',
      instructions: '/instructions/*',
      health: '/health',
    }
  });
});

// Routes
app.use('/auth', authRoutes);
app.use('/chat', chatRoutes);
app.use('/rag', ragRoutes);
app.use('/instructions', instructionsRoutes);

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('❌ Unhandled error:', err.message);
  console.error(err.stack);
  
  // Don't leak error details in production
  const message = config.NODE_ENV === 'production' 
    ? 'An unexpected error occurred' 
    : err.message;
    
  res.status(500).json({ 
    error: message,
    ...(config.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📝 Google OAuth callback: ${config.GOOGLE_REDIRECT_URI}`);
  
  // Start background jobs
  startEmailPoller();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  stopEmailPoller();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
});
