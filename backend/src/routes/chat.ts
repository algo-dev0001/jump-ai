import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import { generateChatResponse, generateChatResponseStream, ChatMessage, SYSTEM_PROMPT } from '../services/openai';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

// Request validation schema
const chatRequestSchema = z.object({
  message: z.string().min(1).max(10000),
  stream: z.boolean().optional().default(false),
});

// Get chat history
router.get('/history', requireAuth, async (req: Request, res: Response) => {
  try {
    const messages = await prisma.message.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'asc' },
      take: 100, // Limit to last 100 messages
    });

    res.json({ messages });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Failed to get chat history' });
  }
});

// Clear chat history
router.delete('/history', requireAuth, async (req: Request, res: Response) => {
  try {
    await prisma.message.deleteMany({
      where: { userId: req.user!.id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Clear history error:', error);
    res.status(500).json({ error: 'Failed to clear chat history' });
  }
});

// Send a chat message
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    // Validate request
    const parsed = chatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const { message, stream } = parsed.data;
    const userId = req.user!.id;

    // Save user message to database
    await prisma.message.create({
      data: {
        userId,
        role: 'user',
        content: message,
      },
    });

    // Get recent chat history for context
    const recentMessages = await prisma.message.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20, // Last 20 messages for context
    });

    // Build messages array for OpenAI (reverse to chronological order)
    const chatMessages: ChatMessage[] = recentMessages
      .reverse()
      .map((msg) => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      }));

    if (stream) {
      // Streaming response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      let fullResponse = '';

      try {
        for await (const chunk of generateChatResponseStream(chatMessages)) {
          fullResponse += chunk;
          res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        }

        // Save assistant response to database
        await prisma.message.create({
          data: {
            userId,
            role: 'assistant',
            content: fullResponse,
          },
        });

        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
      } catch (error) {
        console.error('Stream error:', error);
        res.write(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`);
        res.end();
      }
    } else {
      // Non-streaming response
      const response = await generateChatResponse(chatMessages);

      // Save assistant response to database
      const assistantMessage = await prisma.message.create({
        data: {
          userId,
          role: 'assistant',
          content: response,
        },
      });

      res.json({
        message: {
          id: assistantMessage.id,
          role: 'assistant',
          content: response,
          createdAt: assistantMessage.createdAt,
        },
      });
    }
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

export default router;

