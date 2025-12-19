import { google, gmail_v1 } from 'googleapis';
import { createAuthenticatedClient } from './google-oauth';
import { getValidGoogleTokens } from './token-manager';

// Normalized email format
export interface NormalizedEmail {
  id: string;
  threadId: string;
  from: string;
  fromName?: string;
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  bodyHtml?: string;
  snippet: string;
  date: Date;
  isRead: boolean;
  labels: string[];
}

// Email send options
export interface SendEmailOptions {
  to: string;
  subject: string;
  body: string;
  cc?: string[];
  bcc?: string[];
  threadId?: string; // For replies
  inReplyTo?: string; // Message-ID for threading
}

// Get Gmail client for a user
async function getGmailClient(userId: string): Promise<gmail_v1.Gmail | null> {
  const tokens = await getValidGoogleTokens(userId);
  if (!tokens || tokens.needsReauth) {
    console.error(`[Gmail] No valid tokens for user ${userId}`);
    return null;
  }

  const auth = createAuthenticatedClient(tokens.accessToken, tokens.refreshToken);
  return google.gmail({ version: 'v1', auth });
}

// Parse email address from "Name <email@example.com>" format
function parseEmailAddress(raw: string): { email: string; name?: string } {
  const match = raw.match(/^(?:"?([^"]*)"?\s)?<?([^>]+)>?$/);
  if (match) {
    return {
      name: match[1]?.trim(),
      email: match[2].trim(),
    };
  }
  return { email: raw.trim() };
}

// Get header value from message headers
function getHeader(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  if (!headers) return '';
  const header = headers.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return header?.value || '';
}

// Decode base64url encoded content
function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf-8');
}

// Extract body from message parts
function extractBody(payload: gmail_v1.Schema$MessagePart): { text: string; html?: string } {
  let text = '';
  let html: string | undefined;

  function processpart(part: gmail_v1.Schema$MessagePart) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      text = decodeBase64Url(part.body.data);
    } else if (part.mimeType === 'text/html' && part.body?.data) {
      html = decodeBase64Url(part.body.data);
    } else if (part.parts) {
      part.parts.forEach(processpart);
    }
  }

  if (payload.body?.data) {
    text = decodeBase64Url(payload.body.data);
  } else if (payload.parts) {
    payload.parts.forEach(processpart);
  }

  // If we only have HTML, strip tags for plain text
  if (!text && html) {
    text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  return { text, html };
}

// Normalize a Gmail message to our format
function normalizeMessage(message: gmail_v1.Schema$Message): NormalizedEmail {
  const headers = message.payload?.headers;
  const fromRaw = getHeader(headers, 'From');
  const parsed = parseEmailAddress(fromRaw);

  const toRaw = getHeader(headers, 'To');
  const toAddresses = toRaw.split(',').map((t) => parseEmailAddress(t.trim()).email);

  const ccRaw = getHeader(headers, 'Cc');
  const ccAddresses = ccRaw ? ccRaw.split(',').map((c) => parseEmailAddress(c.trim()).email) : undefined;

  const dateStr = getHeader(headers, 'Date');
  const internalDate = message.internalDate 
    ? new Date(parseInt(message.internalDate)) 
    : new Date(dateStr || Date.now());

  const body = extractBody(message.payload!);

  return {
    id: message.id!,
    threadId: message.threadId!,
    from: parsed.email,
    fromName: parsed.name,
    to: toAddresses,
    cc: ccAddresses,
    subject: getHeader(headers, 'Subject'),
    body: body.text,
    bodyHtml: body.html,
    snippet: message.snippet || '',
    date: internalDate,
    isRead: !message.labelIds?.includes('UNREAD'),
    labels: message.labelIds || [],
  };
}

/**
 * List recent emails from inbox
 */
export async function listEmails(
  userId: string,
  options: {
    query?: string;
    maxResults?: number;
    labelIds?: string[];
  } = {}
): Promise<NormalizedEmail[]> {
  const gmail = await getGmailClient(userId);
  if (!gmail) return [];

  const { query, maxResults = 10, labelIds = ['INBOX'] } = options;

  try {
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults,
      labelIds,
    });

    if (!response.data.messages) {
      return [];
    }

    // Fetch full message details for each
    const emails: NormalizedEmail[] = [];
    for (const msg of response.data.messages) {
      const fullMessage = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id!,
        format: 'full',
      });
      emails.push(normalizeMessage(fullMessage.data));
    }

    return emails;
  } catch (error) {
    console.error('[Gmail] Error listing emails:', error);
    throw error;
  }
}

/**
 * Get a single email by ID
 */
export async function getEmail(userId: string, emailId: string): Promise<NormalizedEmail | null> {
  const gmail = await getGmailClient(userId);
  if (!gmail) return null;

  try {
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: emailId,
      format: 'full',
    });
    return normalizeMessage(response.data);
  } catch (error) {
    console.error('[Gmail] Error getting email:', error);
    return null;
  }
}

/**
 * Get all messages in a thread
 */
export async function getThread(userId: string, threadId: string): Promise<NormalizedEmail[]> {
  const gmail = await getGmailClient(userId);
  if (!gmail) return [];

  try {
    const response = await gmail.users.threads.get({
      userId: 'me',
      id: threadId,
      format: 'full',
    });

    if (!response.data.messages) {
      return [];
    }

    return response.data.messages.map(normalizeMessage);
  } catch (error) {
    console.error('[Gmail] Error getting thread:', error);
    return [];
  }
}

/**
 * Send an email
 */
export async function sendEmail(
  userId: string,
  options: SendEmailOptions
): Promise<{ id: string; threadId: string } | null> {
  const gmail = await getGmailClient(userId);
  if (!gmail) return null;

  const { to, subject, body, cc, bcc, threadId, inReplyTo } = options;

  // Get user's email for From field
  const profile = await gmail.users.getProfile({ userId: 'me' });
  const fromEmail = profile.data.emailAddress;

  // Build email headers
  const headers: string[] = [
    `From: ${fromEmail}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
  ];

  if (cc?.length) {
    headers.push(`Cc: ${cc.join(', ')}`);
  }

  if (bcc?.length) {
    headers.push(`Bcc: ${bcc.join(', ')}`);
  }

  if (inReplyTo) {
    headers.push(`In-Reply-To: ${inReplyTo}`);
    headers.push(`References: ${inReplyTo}`);
  }

  // Build raw email
  const rawEmail = `${headers.join('\r\n')}\r\n\r\n${body}`;
  const encodedEmail = Buffer.from(rawEmail)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  try {
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail,
        threadId: threadId,
      },
    });

    console.log(`[Gmail] Email sent: ${response.data.id}`);
    return {
      id: response.data.id!,
      threadId: response.data.threadId!,
    };
  } catch (error) {
    console.error('[Gmail] Error sending email:', error);
    throw error;
  }
}

/**
 * Mark email as read
 */
export async function markAsRead(userId: string, emailId: string): Promise<boolean> {
  const gmail = await getGmailClient(userId);
  if (!gmail) return false;

  try {
    await gmail.users.messages.modify({
      userId: 'me',
      id: emailId,
      requestBody: {
        removeLabelIds: ['UNREAD'],
      },
    });
    return true;
  } catch (error) {
    console.error('[Gmail] Error marking as read:', error);
    return false;
  }
}

/**
 * Get user's Gmail profile
 */
export async function getProfile(userId: string): Promise<{ email: string; messagesTotal: number } | null> {
  const gmail = await getGmailClient(userId);
  if (!gmail) return null;

  try {
    const response = await gmail.users.getProfile({ userId: 'me' });
    return {
      email: response.data.emailAddress!,
      messagesTotal: response.data.messagesTotal || 0,
    };
  } catch (error) {
    console.error('[Gmail] Error getting profile:', error);
    return null;
  }
}

/**
 * Watch for new emails (get history ID for polling)
 */
export async function getHistoryId(userId: string): Promise<string | null> {
  const gmail = await getGmailClient(userId);
  if (!gmail) return null;

  try {
    const response = await gmail.users.getProfile({ userId: 'me' });
    return response.data.historyId || null;
  } catch (error) {
    console.error('[Gmail] Error getting history ID:', error);
    return null;
  }
}

/**
 * Get new emails since a history ID
 */
export async function getNewEmailsSince(
  userId: string,
  startHistoryId: string
): Promise<{ emails: NormalizedEmail[]; newHistoryId: string | null }> {
  const gmail = await getGmailClient(userId);
  if (!gmail) return { emails: [], newHistoryId: null };

  try {
    const response = await gmail.users.history.list({
      userId: 'me',
      startHistoryId,
      historyTypes: ['messageAdded'],
      labelId: 'INBOX',
    });

    const newHistoryId = response.data.historyId || null;

    if (!response.data.history) {
      return { emails: [], newHistoryId };
    }

    // Collect all new message IDs
    const messageIds = new Set<string>();
    for (const history of response.data.history) {
      if (history.messagesAdded) {
        for (const added of history.messagesAdded) {
          if (added.message?.id) {
            messageIds.add(added.message.id);
          }
        }
      }
    }

    // Fetch full details for new messages
    const emails: NormalizedEmail[] = [];
    for (const id of messageIds) {
      const email = await getEmail(userId, id);
      if (email) {
        emails.push(email);
      }
    }

    return { emails, newHistoryId };
  } catch (error: unknown) {
    // If history ID is too old, return empty and let caller refresh
    if (error && typeof error === 'object' && 'code' in error && error.code === 404) {
      console.log('[Gmail] History ID expired, need full refresh');
      return { emails: [], newHistoryId: null };
    }
    console.error('[Gmail] Error getting history:', error);
    return { emails: [], newHistoryId: null };
  }
}

