// Text chunking utility for RAG
// Target: 300-500 tokens per chunk (~1200-2000 characters)

const DEFAULT_CHUNK_SIZE = 1500; // characters (~375 tokens)
const DEFAULT_CHUNK_OVERLAP = 200; // characters overlap between chunks

interface ChunkOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  minChunkSize?: number;
}

interface TextChunk {
  content: string;
  index: number;
  startChar: number;
  endChar: number;
}

/**
 * Split text into overlapping chunks
 */
export function chunkText(text: string, options: ChunkOptions = {}): TextChunk[] {
  const {
    chunkSize = DEFAULT_CHUNK_SIZE,
    chunkOverlap = DEFAULT_CHUNK_OVERLAP,
    minChunkSize = 100,
  } = options;

  if (!text || text.length < minChunkSize) {
    return text ? [{ content: text, index: 0, startChar: 0, endChar: text.length }] : [];
  }

  const chunks: TextChunk[] = [];
  let startIndex = 0;
  let chunkIndex = 0;

  while (startIndex < text.length) {
    let endIndex = startIndex + chunkSize;

    // If not at the end, try to break at a natural boundary
    if (endIndex < text.length) {
      // Look for paragraph break first
      const paragraphBreak = text.lastIndexOf('\n\n', endIndex);
      if (paragraphBreak > startIndex + chunkSize / 2) {
        endIndex = paragraphBreak;
      } else {
        // Look for sentence break
        const sentenceBreak = findSentenceBreak(text, startIndex + chunkSize / 2, endIndex);
        if (sentenceBreak > 0) {
          endIndex = sentenceBreak;
        } else {
          // Look for word break
          const wordBreak = text.lastIndexOf(' ', endIndex);
          if (wordBreak > startIndex + chunkSize / 2) {
            endIndex = wordBreak;
          }
        }
      }
    } else {
      endIndex = text.length;
    }

    const content = text.slice(startIndex, endIndex).trim();
    
    if (content.length >= minChunkSize) {
      chunks.push({
        content,
        index: chunkIndex++,
        startChar: startIndex,
        endChar: endIndex,
      });
    }

    // Move to next chunk with overlap
    startIndex = endIndex - chunkOverlap;
    
    // Ensure we make progress
    if (startIndex <= chunks[chunks.length - 1]?.startChar) {
      startIndex = endIndex;
    }
  }

  return chunks;
}

/**
 * Find a sentence break (., !, ?) between start and end positions
 */
function findSentenceBreak(text: string, start: number, end: number): number {
  const sentenceEnders = ['. ', '! ', '? ', '.\n', '!\n', '?\n'];
  let bestBreak = -1;

  for (const ender of sentenceEnders) {
    const pos = text.lastIndexOf(ender, end);
    if (pos > start && pos > bestBreak) {
      bestBreak = pos + ender.length;
    }
  }

  return bestBreak;
}

/**
 * Chunk an email into searchable pieces
 */
export function chunkEmail(email: {
  from: string;
  fromName?: string;
  to: string[];
  subject: string;
  body: string;
  date: Date;
}): TextChunk[] {
  // Build a structured text representation
  const header = [
    `From: ${email.fromName || email.from}`,
    `To: ${email.to.join(', ')}`,
    `Subject: ${email.subject}`,
    `Date: ${email.date.toLocaleDateString()}`,
  ].join('\n');

  const fullText = `${header}\n\n${email.body}`;
  
  return chunkText(fullText, {
    chunkSize: 1500,
    chunkOverlap: 200,
  });
}

/**
 * Chunk a HubSpot contact with notes
 */
export function chunkContact(contact: {
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  phone?: string;
  jobTitle?: string;
  notes?: Array<{ content: string; createdAt: Date }>;
}): TextChunk[] {
  // Build contact info text
  const name = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Unknown';
  const header = [
    `Contact: ${name}`,
    `Email: ${contact.email}`,
    contact.company && `Company: ${contact.company}`,
    contact.phone && `Phone: ${contact.phone}`,
    contact.jobTitle && `Title: ${contact.jobTitle}`,
  ].filter(Boolean).join('\n');

  // Add notes if present
  const notesText = contact.notes?.map((n) => 
    `Note (${n.createdAt.toLocaleDateString()}): ${n.content}`
  ).join('\n\n') || '';

  const fullText = notesText ? `${header}\n\nNotes:\n${notesText}` : header;

  // For short contact info, return as single chunk
  if (fullText.length < 500) {
    return [{ content: fullText, index: 0, startChar: 0, endChar: fullText.length }];
  }

  return chunkText(fullText, {
    chunkSize: 1500,
    chunkOverlap: 200,
  });
}

export { DEFAULT_CHUNK_SIZE, DEFAULT_CHUNK_OVERLAP };

