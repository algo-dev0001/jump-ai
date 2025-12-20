import { PrismaClient } from '@prisma/client';
import { generateEmbedding, generateEmbeddings, EMBEDDING_DIMENSIONS } from './embeddings';
import { chunkEmail, chunkContact } from './chunking';
import { NormalizedEmail } from './gmail';
import { HubSpotContact, HubSpotNote } from './hubspot';

const prisma = new PrismaClient();

// Source types
export type EmbeddingSource = 'gmail' | 'hubspot';

// Metadata types
interface EmailMetadata {
  emailId: string;
  threadId: string;
  from: string;
  fromName?: string;
  to: string[];
  subject: string;
  date: string;
  chunkIndex: number;
  totalChunks: number;
}

interface ContactMetadata {
  contactId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  hasNotes: boolean;
  chunkIndex: number;
  totalChunks: number;
}

// Search result
export interface RAGSearchResult {
  id: string;
  source: EmbeddingSource;
  sourceId: string;
  content: string;
  metadata: EmailMetadata | ContactMetadata;
  score: number;
}

/**
 * Ingest an email into the RAG system
 */
export async function ingestEmail(userId: string, email: NormalizedEmail): Promise<number> {
  try {
    // Check if already indexed
    const existing = await prisma.embedding.findFirst({
      where: {
        userId,
        source: 'gmail',
        sourceId: email.id,
      },
    });

    if (existing) {
      console.log(`[RAG] Email ${email.id} already indexed, skipping`);
      return 0;
    }

    // Chunk the email
    const chunks = chunkEmail({
      from: email.from,
      fromName: email.fromName,
      to: email.to,
      subject: email.subject,
      body: email.body,
      date: email.date,
    });

    if (chunks.length === 0) {
      return 0;
    }

    // Generate embeddings for all chunks
    const embeddings = await generateEmbeddings(chunks.map((c) => c.content));

    // Store each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddings[i];

      const metadata: EmailMetadata = {
        emailId: email.id,
        threadId: email.threadId,
        from: email.from,
        fromName: email.fromName,
        to: email.to,
        subject: email.subject,
        date: email.date.toISOString(),
        chunkIndex: i,
        totalChunks: chunks.length,
      };

      // Use raw SQL to insert with vector
      await prisma.$executeRaw`
        INSERT INTO embeddings (id, "userId", source, "sourceId", content, metadata, embedding, "createdAt")
        VALUES (
          ${`emb_${email.id}_${i}`},
          ${userId},
          'gmail',
          ${email.id},
          ${chunk.content},
          ${JSON.stringify(metadata)}::jsonb,
          ${`[${embedding.join(',')}]`}::vector,
          NOW()
        )
        ON CONFLICT (source, "sourceId") 
        DO UPDATE SET
          content = EXCLUDED.content,
          metadata = EXCLUDED.metadata,
          embedding = EXCLUDED.embedding
      `;
    }

    console.log(`[RAG] Indexed email ${email.id} (${chunks.length} chunks)`);
    return chunks.length;
  } catch (error) {
    console.error('[RAG] Error ingesting email:', error);
    return 0;
  }
}

/**
 * Ingest a HubSpot contact into the RAG system
 */
export async function ingestContact(
  userId: string,
  contact: HubSpotContact,
  notes: HubSpotNote[] = []
): Promise<number> {
  try {
    // Chunk the contact with notes
    const chunks = chunkContact({
      email: contact.email,
      firstName: contact.firstName,
      lastName: contact.lastName,
      company: contact.company,
      phone: contact.phone,
      jobTitle: contact.jobTitle,
      notes: notes.map((n) => ({
        content: n.content,
        createdAt: n.createdAt,
      })),
    });

    if (chunks.length === 0) {
      return 0;
    }

    // Generate embeddings for all chunks
    const embeddings = await generateEmbeddings(chunks.map((c) => c.content));

    // Delete old embeddings for this contact
    await prisma.$executeRaw`
      DELETE FROM embeddings 
      WHERE "userId" = ${userId} 
      AND source = 'hubspot' 
      AND "sourceId" = ${contact.id}
    `;

    // Store each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddings[i];

      const metadata: ContactMetadata = {
        contactId: contact.id,
        email: contact.email,
        firstName: contact.firstName,
        lastName: contact.lastName,
        company: contact.company,
        hasNotes: notes.length > 0,
        chunkIndex: i,
        totalChunks: chunks.length,
      };

      await prisma.$executeRaw`
        INSERT INTO embeddings (id, "userId", source, "sourceId", content, metadata, embedding, "createdAt")
        VALUES (
          ${`emb_hs_${contact.id}_${i}`},
          ${userId},
          'hubspot',
          ${contact.id},
          ${chunk.content},
          ${JSON.stringify(metadata)}::jsonb,
          ${`[${embedding.join(',')}]`}::vector,
          NOW()
        )
      `;
    }

    console.log(`[RAG] Indexed contact ${contact.id} (${chunks.length} chunks)`);
    return chunks.length;
  } catch (error) {
    console.error('[RAG] Error ingesting contact:', error);
    return 0;
  }
}

/**
 * Search for relevant content using vector similarity
 */
export async function searchRAG(
  userId: string,
  query: string,
  options: {
    sources?: EmbeddingSource[];
    limit?: number;
    minScore?: number;
  } = {}
): Promise<RAGSearchResult[]> {
  const { sources, limit = 5, minScore = 0.3 } = options;

  try {
    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(query);
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    // Build source filter
    let sourceFilter = '';
    if (sources && sources.length > 0 && !sources.includes('gmail' as EmbeddingSource) || !sources?.includes('hubspot' as EmbeddingSource)) {
      const sourceList = sources.map((s) => `'${s}'`).join(',');
      sourceFilter = `AND source IN (${sourceList})`;
    }

    // Vector similarity search using pgvector
    const results = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        source: string;
        sourceId: string;
        content: string;
        metadata: unknown;
        score: number;
      }>
    >(`
      SELECT 
        id,
        source,
        "sourceId",
        content,
        metadata,
        1 - (embedding <=> '${embeddingStr}'::vector) as score
      FROM embeddings
      WHERE "userId" = $1
      ${sourceFilter}
      AND embedding IS NOT NULL
      ORDER BY embedding <=> '${embeddingStr}'::vector
      LIMIT $2
    `, userId, limit);

    // Filter by minimum score and format results
    return results
      .filter((r) => r.score >= minScore)
      .map((r) => ({
        id: r.id,
        source: r.source as EmbeddingSource,
        sourceId: r.sourceId,
        content: r.content,
        metadata: r.metadata as EmailMetadata | ContactMetadata,
        score: r.score,
      }));
  } catch (error) {
    console.error('[RAG] Search error:', error);
    return [];
  }
}

/**
 * Get RAG stats for a user
 */
export async function getRAGStats(userId: string): Promise<{
  totalEmbeddings: number;
  emailChunks: number;
  contactChunks: number;
}> {
  const stats = await prisma.$queryRaw<
    Array<{ source: string; count: bigint }>
  >`
    SELECT source, COUNT(*) as count
    FROM embeddings
    WHERE "userId" = ${userId}
    GROUP BY source
  `;

  const emailChunks = Number(stats.find((s) => s.source === 'gmail')?.count || 0);
  const contactChunks = Number(stats.find((s) => s.source === 'hubspot')?.count || 0);

  return {
    totalEmbeddings: emailChunks + contactChunks,
    emailChunks,
    contactChunks,
  };
}

/**
 * Delete all embeddings for a user
 */
export async function clearUserEmbeddings(userId: string): Promise<void> {
  await prisma.$executeRaw`
    DELETE FROM embeddings WHERE "userId" = ${userId}
  `;
}

export { EMBEDDING_DIMENSIONS };

