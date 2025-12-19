import { PrismaClient } from '@prisma/client';
import { ToolArgs } from './definitions';
import * as gmail from '../../services/gmail';

const prisma = new PrismaClient();

// Tool result type
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// Context passed to tools
export interface ToolContext {
  userId: string;
}

// Individual tool implementations
const toolImplementations = {
  // Email tools - REAL IMPLEMENTATIONS
  async send_email(args: ToolArgs['send_email'], ctx: ToolContext): Promise<ToolResult> {
    console.log(`[TOOL] send_email called for user ${ctx.userId}:`, args);
    
    try {
      const result = await gmail.sendEmail(ctx.userId, {
        to: args.to,
        subject: args.subject,
        body: args.body,
        cc: args.cc,
      });

      if (!result) {
        return {
          success: false,
          error: 'Failed to send email. User may need to reconnect Google account.',
        };
      }

      return {
        success: true,
        data: {
          messageId: result.id,
          threadId: result.threadId,
          to: args.to,
          subject: args.subject,
          message: `Email sent successfully to ${args.to}`,
        },
      };
    } catch (error) {
      console.error('[TOOL] send_email error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email',
      };
    }
  },

  async read_emails(args: ToolArgs['read_emails'], ctx: ToolContext): Promise<ToolResult> {
    console.log(`[TOOL] read_emails called for user ${ctx.userId}:`, args);
    
    try {
      // First try to get from cache
      const cachedEmails = await prisma.emailCache.findMany({
        where: {
          userId: ctx.userId,
          ...(args.query && {
            OR: [
              { from: { contains: args.query, mode: 'insensitive' } },
              { subject: { contains: args.query, mode: 'insensitive' } },
              { body: { contains: args.query, mode: 'insensitive' } },
            ],
          }),
        },
        orderBy: { date: 'desc' },
        take: args.maxResults || 10,
      });

      if (cachedEmails.length > 0) {
        return {
          success: true,
          data: {
            emails: cachedEmails.map((e) => ({
              id: e.id,
              threadId: e.threadId,
              from: e.from,
              fromName: e.fromName,
              to: e.to,
              subject: e.subject,
              snippet: e.snippet,
              date: e.date.toISOString(),
              isRead: e.isRead,
            })),
            total: cachedEmails.length,
            source: 'cache',
            message: `Found ${cachedEmails.length} email(s)${args.query ? ` matching "${args.query}"` : ''}`,
          },
        };
      }

      // If no cache, fetch from Gmail
      const emails = await gmail.listEmails(ctx.userId, {
        query: args.query,
        maxResults: args.maxResults || 10,
      });

      return {
        success: true,
        data: {
          emails: emails.map((e) => ({
            id: e.id,
            threadId: e.threadId,
            from: e.from,
            fromName: e.fromName,
            to: e.to,
            subject: e.subject,
            snippet: e.snippet,
            date: e.date.toISOString(),
            isRead: e.isRead,
          })),
          total: emails.length,
          source: 'gmail',
          message: `Found ${emails.length} email(s)${args.query ? ` matching "${args.query}"` : ''}`,
        },
      };
    } catch (error) {
      console.error('[TOOL] read_emails error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read emails',
      };
    }
  },

  // Calendar tools - MOCKED (will implement with Google Calendar later)
  async find_calendar_availability(
    args: ToolArgs['find_calendar_availability'],
    ctx: ToolContext
  ): Promise<ToolResult> {
    console.log(`[TOOL] find_calendar_availability called for user ${ctx.userId}:`, args);
    // TODO: Implement with Google Calendar API
    const startDate = new Date(args.startDate);
    const slots = [];
    
    for (let i = 0; i < 3; i++) {
      const slotDate = new Date(startDate);
      slotDate.setDate(slotDate.getDate() + i);
      slotDate.setHours(10 + i, 0, 0, 0);
      
      const endSlot = new Date(slotDate);
      endSlot.setMinutes(endSlot.getMinutes() + args.durationMinutes);
      
      slots.push({
        start: slotDate.toISOString(),
        end: endSlot.toISOString(),
      });
    }
    
    return {
      success: true,
      data: {
        availableSlots: slots,
        message: `Found ${slots.length} available slots for ${args.durationMinutes} minute meetings`,
      },
    };
  },

  async create_calendar_event(
    args: ToolArgs['create_calendar_event'],
    ctx: ToolContext
  ): Promise<ToolResult> {
    console.log(`[TOOL] create_calendar_event called for user ${ctx.userId}:`, args);
    // TODO: Implement with Google Calendar API
    return {
      success: true,
      data: {
        eventId: `event-${Date.now()}`,
        title: args.title,
        startTime: args.startTime,
        endTime: args.endTime,
        attendees: args.attendees || [],
        link: 'https://calendar.google.com/event/mock',
        message: `Calendar event "${args.title}" created for ${new Date(args.startTime).toLocaleString()}`,
      },
    };
  },

  // HubSpot CRM tools - MOCKED (will implement with HubSpot API later)
  async find_hubspot_contact(
    args: ToolArgs['find_hubspot_contact'],
    ctx: ToolContext
  ): Promise<ToolResult> {
    console.log(`[TOOL] find_hubspot_contact called for user ${ctx.userId}:`, args);
    // TODO: Implement with HubSpot API
    return {
      success: true,
      data: {
        contacts: [
          {
            id: 'contact-1',
            email: 'john.smith@example.com',
            firstName: 'John',
            lastName: 'Smith',
            company: 'Acme Corp',
            phone: '+1-555-123-4567',
            lastActivity: new Date(Date.now() - 172800000).toISOString(),
          },
        ],
        total: 1,
        message: `Found 1 contact matching "${args.query}"`,
      },
    };
  },

  async create_hubspot_contact(
    args: ToolArgs['create_hubspot_contact'],
    ctx: ToolContext
  ): Promise<ToolResult> {
    console.log(`[TOOL] create_hubspot_contact called for user ${ctx.userId}:`, args);
    // TODO: Implement with HubSpot API
    return {
      success: true,
      data: {
        contactId: `contact-${Date.now()}`,
        email: args.email,
        firstName: args.firstName,
        lastName: args.lastName,
        message: `Contact ${args.firstName} ${args.lastName} (${args.email}) created in HubSpot`,
      },
    };
  },

  async create_hubspot_note(
    args: ToolArgs['create_hubspot_note'],
    ctx: ToolContext
  ): Promise<ToolResult> {
    console.log(`[TOOL] create_hubspot_note called for user ${ctx.userId}:`, args);
    // TODO: Implement with HubSpot API
    return {
      success: true,
      data: {
        noteId: `note-${Date.now()}`,
        contactEmail: args.contactEmail,
        preview: args.content.substring(0, 100),
        message: `Note added to contact ${args.contactEmail}`,
      },
    };
  },

  // RAG search - searches email cache for now
  async search_rag(args: ToolArgs['search_rag'], ctx: ToolContext): Promise<ToolResult> {
    console.log(`[TOOL] search_rag called for user ${ctx.userId}:`, args);
    
    try {
      // Search email cache
      const emails = await prisma.emailCache.findMany({
        where: {
          userId: ctx.userId,
          OR: [
            { from: { contains: args.query, mode: 'insensitive' } },
            { subject: { contains: args.query, mode: 'insensitive' } },
            { body: { contains: args.query, mode: 'insensitive' } },
            { snippet: { contains: args.query, mode: 'insensitive' } },
          ],
        },
        orderBy: { date: 'desc' },
        take: args.limit || 5,
      });

      const results = emails.map((e) => ({
        source: 'gmail',
        content: `Email from ${e.fromName || e.from}: "${e.subject}" - ${e.snippet}`,
        metadata: {
          emailId: e.id,
          from: e.from,
          fromName: e.fromName,
          subject: e.subject,
          date: e.date.toISOString(),
        },
        score: 1.0, // TODO: Add real scoring with embeddings
      }));

      return {
        success: true,
        data: {
          results,
          message: `Found ${results.length} relevant result(s) for "${args.query}"`,
        },
      };
    } catch (error) {
      console.error('[TOOL] search_rag error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed',
      };
    }
  },

  // Task management - REAL IMPLEMENTATIONS
  async store_task(args: ToolArgs['store_task'], ctx: ToolContext): Promise<ToolResult> {
    console.log(`[TOOL] store_task called for user ${ctx.userId}:`, args);
    
    try {
      const task = await prisma.task.create({
        data: {
          userId: ctx.userId,
          type: args.type,
          status: 'pending',
          description: args.description,
          data: {
            ...args.data,
            triggerCondition: args.triggerCondition,
          },
        },
      });

      return {
        success: true,
        data: {
          taskId: task.id,
          type: task.type,
          status: task.status,
          description: task.description,
          message: `Task created: ${args.description}`,
        },
      };
    } catch (error) {
      console.error('[TOOL] store_task error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create task',
      };
    }
  },

  async update_task(args: ToolArgs['update_task'], ctx: ToolContext): Promise<ToolResult> {
    console.log(`[TOOL] update_task called for user ${ctx.userId}:`, args);
    
    try {
      const task = await prisma.task.update({
        where: { id: args.taskId },
        data: {
          ...(args.status && { status: args.status }),
          ...(args.data && { data: args.data }),
          ...(args.status === 'completed' && { completedAt: new Date() }),
        },
      });

      return {
        success: true,
        data: {
          taskId: task.id,
          status: task.status,
          message: `Task ${args.taskId} updated${args.status ? ` to ${args.status}` : ''}`,
        },
      };
    } catch (error) {
      console.error('[TOOL] update_task error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update task',
      };
    }
  },
};

// Type for tool names
type ToolName = keyof typeof toolImplementations;

// Execute a tool by name
export async function executeTool(
  toolName: string,
  args: unknown,
  context: ToolContext
): Promise<ToolResult> {
  const implementation = toolImplementations[toolName as ToolName];
  
  if (!implementation) {
    return {
      success: false,
      error: `Unknown tool: ${toolName}`,
    };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await implementation(args as any, context);
  } catch (error) {
    console.error(`[TOOL] Error executing ${toolName}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Tool execution failed',
    };
  }
}
