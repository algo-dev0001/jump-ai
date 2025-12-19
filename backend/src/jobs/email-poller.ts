import { PrismaClient } from '@prisma/client';
import { listEmails, getHistoryId, getNewEmailsSince, NormalizedEmail } from '../services/gmail';

const prisma = new PrismaClient();

// Polling interval in milliseconds (90 seconds)
const POLL_INTERVAL = 90 * 1000;

// Store new email in cache
async function cacheEmail(userId: string, email: NormalizedEmail): Promise<void> {
  await prisma.emailCache.upsert({
    where: { id: email.id },
    update: {
      isRead: email.isRead,
      labels: email.labels,
      updatedAt: new Date(),
    },
    create: {
      id: email.id,
      threadId: email.threadId,
      userId,
      from: email.from,
      fromName: email.fromName,
      to: email.to,
      cc: email.cc || [],
      subject: email.subject,
      snippet: email.snippet,
      body: email.body,
      date: email.date,
      isRead: email.isRead,
      labels: email.labels,
    },
  });
}

// Poll emails for a single user
async function pollUserEmails(userId: string): Promise<number> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        gmailHistoryId: true,
        googleAccessToken: true,
      },
    });

    if (!user?.googleAccessToken) {
      return 0;
    }

    let newEmails: NormalizedEmail[] = [];

    if (user.gmailHistoryId) {
      // Incremental sync using history API
      const result = await getNewEmailsSince(userId, user.gmailHistoryId);
      newEmails = result.emails;

      if (result.newHistoryId) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            gmailHistoryId: result.newHistoryId,
            gmailLastSync: new Date(),
          },
        });
      } else {
        // History ID expired, do full sync
        const historyId = await getHistoryId(userId);
        if (historyId) {
          // Fetch recent emails for initial cache
          const emails = await listEmails(userId, { maxResults: 20 });
          for (const email of emails) {
            await cacheEmail(userId, email);
          }
          newEmails = emails.filter((e) => !e.isRead);

          await prisma.user.update({
            where: { id: userId },
            data: {
              gmailHistoryId: historyId,
              gmailLastSync: new Date(),
            },
          });
        }
      }
    } else {
      // First sync - get history ID and recent emails
      const historyId = await getHistoryId(userId);
      if (historyId) {
        const emails = await listEmails(userId, { maxResults: 20 });
        for (const email of emails) {
          await cacheEmail(userId, email);
        }
        newEmails = emails.filter((e) => !e.isRead);

        await prisma.user.update({
          where: { id: userId },
          data: {
            gmailHistoryId: historyId,
            gmailLastSync: new Date(),
          },
        });
      }
    }

    // Cache any new emails
    for (const email of newEmails) {
      await cacheEmail(userId, email);
    }

    if (newEmails.length > 0) {
      console.log(`[EmailPoller] User ${userId}: ${newEmails.length} new email(s)`);
    }

    return newEmails.length;
  } catch (error) {
    console.error(`[EmailPoller] Error polling user ${userId}:`, error);
    return 0;
  }
}

// Poll all users with Google connected
async function pollAllUsers(): Promise<void> {
  try {
    const users = await prisma.user.findMany({
      where: {
        googleAccessToken: { not: null },
      },
      select: { id: true, email: true },
    });

    if (users.length === 0) {
      return;
    }

    console.log(`[EmailPoller] Polling ${users.length} user(s)...`);

    let totalNewEmails = 0;
    for (const user of users) {
      const count = await pollUserEmails(user.id);
      totalNewEmails += count;
    }

    if (totalNewEmails > 0) {
      console.log(`[EmailPoller] Total new emails: ${totalNewEmails}`);
    }
  } catch (error) {
    console.error('[EmailPoller] Error in poll cycle:', error);
  }
}

// Interval reference for cleanup
let pollInterval: NodeJS.Timeout | null = null;

// Start the email poller
export function startEmailPoller(): void {
  console.log(`[EmailPoller] Starting (interval: ${POLL_INTERVAL / 1000}s)`);

  // Run immediately on start
  pollAllUsers();

  // Then poll at interval
  pollInterval = setInterval(pollAllUsers, POLL_INTERVAL);
}

// Stop the email poller
export function stopEmailPoller(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    console.log('[EmailPoller] Stopped');
  }
}

// Manual poll for a specific user (e.g., after OAuth)
export async function pollUserNow(userId: string): Promise<number> {
  console.log(`[EmailPoller] Manual poll for user ${userId}`);
  return pollUserEmails(userId);
}

