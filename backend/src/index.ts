import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { config } from './config';
import authRoutes from './routes/auth';
import chatRoutes from './routes/chat';
import ragRoutes from './routes/rag';
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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API info
app.get('/api', (req, res) => {
  res.json({ 
    message: 'AI Advisor Agent API',
    version: '1.0.0',
    endpoints: {
      auth: '/auth/*',
      chat: '/chat/*',
      health: '/health',
    }
  });
});

// Routes
app.use('/auth', authRoutes);
app.use('/chat', chatRoutes);
app.use('/rag', ragRoutes);

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
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
