import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import { ingestEmail, ingestContact, getRAGStats, clearUserEmbeddings, searchRAG } from '../services/rag';
import { listEmails } from '../services/gmail';
import { searchContacts, getContactNotes } from '../services/hubspot';

const router = Router();
const prisma = new PrismaClient();

// Get RAG stats
router.get('/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const stats = await getRAGStats(req.user!.id);
    res.json(stats);
  } catch (error) {
    console.error('RAG stats error:', error);
    res.status(500).json({ error: 'Failed to get RAG stats' });
  }
});

// Index emails
router.post('/index/emails', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  
  try {
    // Get cached emails
    const emails = await prisma.emailCache.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 50, // Limit to prevent timeout
    });

    let indexed = 0;
    for (const email of emails) {
      const chunks = await ingestEmail(userId, {
        id: email.id,
        threadId: email.threadId,
        from: email.from,
        fromName: email.fromName || undefined,
        to: email.to,
        cc: email.cc,
        subject: email.subject,
        body: email.body,
        bodyHtml: undefined,
        snippet: email.snippet,
        date: email.date,
        isRead: email.isRead,
        labels: email.labels,
      });
      if (chunks > 0) indexed++;
    }

    res.json({
      success: true,
      indexed,
      total: emails.length,
      message: `Indexed ${indexed} emails`,
    });
  } catch (error) {
    console.error('Index emails error:', error);
    res.status(500).json({ error: 'Failed to index emails' });
  }
});

// Index HubSpot contacts
router.post('/index/contacts', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  
  try {
    // Search for all contacts (empty query gets all)
    const contacts = await searchContacts(userId, '', 100);

    let indexed = 0;
    for (const contact of contacts) {
      // Get notes for the contact
      const notes = await getContactNotes(userId, contact.id, 10);
      
      const chunks = await ingestContact(userId, contact, notes);
      if (chunks > 0) indexed++;
    }

    res.json({
      success: true,
      indexed,
      total: contacts.length,
      message: `Indexed ${indexed} contacts`,
    });
  } catch (error) {
    console.error('Index contacts error:', error);
    res.status(500).json({ error: 'Failed to index contacts' });
  }
});

// Clear all embeddings
router.delete('/clear', requireAuth, async (req: Request, res: Response) => {
  try {
    await clearUserEmbeddings(req.user!.id);
    res.json({ success: true, message: 'Embeddings cleared' });
  } catch (error) {
    console.error('Clear embeddings error:', error);
    res.status(500).json({ error: 'Failed to clear embeddings' });
  }
});

// Test search
router.post('/search', requireAuth, async (req: Request, res: Response) => {
  try {
    const { query, sources, limit } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query required' });
    }

    const results = await searchRAG(req.user!.id, query, {
      sources,
      limit: limit || 5,
    });

    res.json({
      query,
      results,
      count: results.length,
    });
  } catch (error) {
    console.error('RAG search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;

