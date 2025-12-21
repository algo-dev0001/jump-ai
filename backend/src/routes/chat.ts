import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import { runAgent, runAgentStream, AgentMessage } from '../agent';
import { z } from 'zod';
import { createLogger } from '../lib/logger';

const router = Router();
const prisma = new PrismaClient();
const log = createLogger('Chat');

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
      take: 100,
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

// Send a chat message (with tool calling)
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
      take: 20,
    });

    // Build messages array for agent
    const agentMessages: AgentMessage[] = recentMessages
      .reverse()
      .map((msg) => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      }));

    // Tool execution context
    const toolContext = { userId };

    if (stream) {
      // Streaming response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      let fullResponse = '';
      const toolCallsExecuted: Array<{ name: string; args: unknown; result: unknown }> = [];

      try {
        log.info('Starting agent stream', { userId });
        
        for await (const event of runAgentStream(agentMessages, toolContext)) {
          switch (event.type) {
            case 'thinking':
              res.write(`data: ${JSON.stringify({ type: 'thinking', iteration: (event.data as { iteration: number }).iteration })}\n\n`);
              break;
              
            case 'tool_call':
              log.debug('Tool call started', { userId, tool: (event.data as { name: string }).name });
              res.write(`data: ${JSON.stringify({ type: 'tool_call', ...event.data as object })}\n\n`);
              break;
              
            case 'tool_result':
              const resultData = event.data as { name: string; result: { success?: boolean; data?: unknown; error?: string } };
              toolCallsExecuted.push({
                name: resultData.name,
                args: {},
                result: resultData.result,
              });
              log.debug('Tool call completed', { 
                userId, 
                tool: resultData.name, 
                success: resultData.result?.success,
              });
              res.write(`data: ${JSON.stringify({ type: 'tool_result', ...resultData })}\n\n`);
              break;
              
            case 'content':
              fullResponse = event.data as string;
              res.write(`data: ${JSON.stringify({ type: 'content', content: fullResponse })}\n\n`);
              break;
              
            case 'done':
              // Save assistant response to database
              if (fullResponse) {
                await prisma.message.create({
                  data: {
                    userId,
                    role: 'assistant',
                    content: fullResponse,
                  },
                });
                log.info('Response saved', { userId, toolCallCount: toolCallsExecuted.length });
              }
              res.write(`data: ${JSON.stringify({ type: 'done', toolCalls: toolCallsExecuted })}\n\n`);
              break;
          }
        }
        
        res.end();
      } catch (error) {
        log.error('Stream error', error, { userId });
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
        res.write(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`);
        res.end();
      }
    } else {
      // Non-streaming response with agent loop
      const result = await runAgent(agentMessages, toolContext);

      // Save assistant response to database
      const assistantMessage = await prisma.message.create({
        data: {
          userId,
          role: 'assistant',
          content: result.response,
        },
      });

      res.json({
        message: {
          id: assistantMessage.id,
          role: 'assistant',
          content: result.response,
          createdAt: assistantMessage.createdAt,
        },
        toolCalls: result.toolCalls,
        usage: result.usage,
      });
    }
  } catch (error) {
    log.error('Chat error', error, { userId: req.user?.id });
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    res.status(500).json({ 
      error: 'Failed to process chat message',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    });
  }
});

export default router;
