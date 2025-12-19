import { PrismaClient } from '@prisma/client';
import { ToolArgs } from './definitions';
import * as gmail from '../../services/gmail';
import * as calendar from '../../services/calendar';
import * as hubspot from '../../services/hubspot';

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

  // Calendar tools - REAL IMPLEMENTATIONS
  async list_calendar_events(
    args: ToolArgs['list_calendar_events'],
    ctx: ToolContext
  ): Promise<ToolResult> {
    console.log(`[TOOL] list_calendar_events called for user ${ctx.userId}:`, args);
    
    try {
      const startDate = new Date(args.startDate);
      const endDate = new Date(args.endDate);
      
      const events = await calendar.listEvents(ctx.userId, {
        startDate,
        endDate,
        maxResults: args.maxResults || 10,
      });

      if (events.length === 0) {
        return {
          success: true,
          data: {
            events: [],
            message: `No events found between ${startDate.toLocaleDateString()} and ${endDate.toLocaleDateString()}`,
          },
        };
      }

      const formattedEvents = events.map((event) => ({
        id: event.id,
        title: event.title,
        start: event.start.toISOString(),
        end: event.end.toISOString(),
        formatted: `${event.start.toLocaleDateString()} ${event.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${event.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}: ${event.title}`,
        location: event.location,
        attendees: event.attendees.map((a) => a.email),
        meetLink: event.meetLink,
        isAllDay: event.isAllDay,
      }));

      return {
        success: true,
        data: {
          events: formattedEvents,
          total: events.length,
          message: `Found ${events.length} event(s) between ${startDate.toLocaleDateString()} and ${endDate.toLocaleDateString()}`,
        },
      };
    } catch (error) {
      console.error('[TOOL] list_calendar_events error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list calendar events',
      };
    }
  },

  async find_calendar_availability(
    args: ToolArgs['find_calendar_availability'],
    ctx: ToolContext
  ): Promise<ToolResult> {
    console.log(`[TOOL] find_calendar_availability called for user ${ctx.userId}:`, args);
    
    try {
      const startDate = new Date(args.startDate);
      const endDate = new Date(args.endDate);
      
      const slots = await calendar.findAvailability(ctx.userId, {
        startDate,
        endDate,
        durationMinutes: args.durationMinutes,
      });

      if (slots.length === 0) {
        return {
          success: true,
          data: {
            availableSlots: [],
            message: `No available ${args.durationMinutes}-minute slots found between ${startDate.toLocaleDateString()} and ${endDate.toLocaleDateString()}`,
          },
        };
      }

      const formattedSlots = slots.map((slot) => ({
        start: slot.start.toISOString(),
        end: slot.end.toISOString(),
        formatted: `${slot.start.toLocaleDateString()} ${slot.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${slot.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      }));

      return {
        success: true,
        data: {
          availableSlots: formattedSlots,
          message: `Found ${slots.length} available ${args.durationMinutes}-minute slot(s)`,
        },
      };
    } catch (error) {
      console.error('[TOOL] find_calendar_availability error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to find availability',
      };
    }
  },

  async create_calendar_event(
    args: ToolArgs['create_calendar_event'],
    ctx: ToolContext
  ): Promise<ToolResult> {
    console.log(`[TOOL] create_calendar_event called for user ${ctx.userId}:`, args);
    
    try {
      const event = await calendar.createEvent(ctx.userId, {
        title: args.title,
        startTime: args.startTime,
        endTime: args.endTime,
        description: args.description,
        location: args.location,
        attendees: args.attendees,
        sendNotifications: true,
      });

      if (!event) {
        return {
          success: false,
          error: 'Failed to create calendar event. User may need to reconnect Google account.',
        };
      }

      return {
        success: true,
        data: {
          eventId: event.id,
          title: event.title,
          startTime: event.start.toISOString(),
          endTime: event.end.toISOString(),
          attendees: event.attendees.map((a) => a.email),
          meetLink: event.meetLink,
          calendarLink: event.htmlLink,
          message: `Calendar event "${event.title}" created for ${event.start.toLocaleString()}${event.meetLink ? ` with Google Meet link` : ''}`,
        },
      };
    } catch (error) {
      console.error('[TOOL] create_calendar_event error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create calendar event',
      };
    }
  },

  // HubSpot CRM tools - REAL IMPLEMENTATIONS
  async find_hubspot_contact(
    args: ToolArgs['find_hubspot_contact'],
    ctx: ToolContext
  ): Promise<ToolResult> {
    console.log(`[TOOL] find_hubspot_contact called for user ${ctx.userId}:`, args);
    
    try {
      // Check if HubSpot is connected
      const isConnected = await hubspot.isHubSpotConnected(ctx.userId);
      if (!isConnected) {
        return {
          success: false,
          error: 'HubSpot is not connected. Please connect your HubSpot account first.',
        };
      }

      const contacts = await hubspot.searchContacts(ctx.userId, args.query, 10);

      if (contacts.length === 0) {
        return {
          success: true,
          data: {
            contacts: [],
            total: 0,
            message: `No contacts found matching "${args.query}"`,
          },
        };
      }

      return {
        success: true,
        data: {
          contacts: contacts.map((c) => ({
            id: c.id,
            email: c.email,
            firstName: c.firstName,
            lastName: c.lastName,
            fullName: `${c.firstName || ''} ${c.lastName || ''}`.trim(),
            phone: c.phone,
            company: c.company,
            jobTitle: c.jobTitle,
            createdAt: c.createdAt.toISOString(),
          })),
          total: contacts.length,
          message: `Found ${contacts.length} contact(s) matching "${args.query}"`,
        },
      };
    } catch (error) {
      console.error('[TOOL] find_hubspot_contact error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search contacts',
      };
    }
  },

  async create_hubspot_contact(
    args: ToolArgs['create_hubspot_contact'],
    ctx: ToolContext
  ): Promise<ToolResult> {
    console.log(`[TOOL] create_hubspot_contact called for user ${ctx.userId}:`, args);
    
    try {
      // Check if HubSpot is connected
      const isConnected = await hubspot.isHubSpotConnected(ctx.userId);
      if (!isConnected) {
        return {
          success: false,
          error: 'HubSpot is not connected. Please connect your HubSpot account first.',
        };
      }

      // Check if contact already exists
      const existing = await hubspot.getContactByEmail(ctx.userId, args.email);
      if (existing) {
        return {
          success: false,
          error: `A contact with email ${args.email} already exists (ID: ${existing.id})`,
        };
      }

      const contact = await hubspot.createContact(ctx.userId, {
        email: args.email,
        firstName: args.firstName,
        lastName: args.lastName,
        phone: args.phone,
        company: args.company,
      });

      if (!contact) {
        return {
          success: false,
          error: 'Failed to create contact in HubSpot',
        };
      }

      return {
        success: true,
        data: {
          contactId: contact.id,
          email: contact.email,
          firstName: contact.firstName,
          lastName: contact.lastName,
          fullName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
          message: `Contact ${args.firstName} ${args.lastName} (${args.email}) created in HubSpot`,
        },
      };
    } catch (error) {
      console.error('[TOOL] create_hubspot_contact error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create contact',
      };
    }
  },

  async create_hubspot_note(
    args: ToolArgs['create_hubspot_note'],
    ctx: ToolContext
  ): Promise<ToolResult> {
    console.log(`[TOOL] create_hubspot_note called for user ${ctx.userId}:`, args);
    
    try {
      // Check if HubSpot is connected
      const isConnected = await hubspot.isHubSpotConnected(ctx.userId);
      if (!isConnected) {
        return {
          success: false,
          error: 'HubSpot is not connected. Please connect your HubSpot account first.',
        };
      }

      // Find the contact by email
      const contact = await hubspot.getContactByEmail(ctx.userId, args.contactEmail);
      if (!contact) {
        return {
          success: false,
          error: `No contact found with email ${args.contactEmail}`,
        };
      }

      // Create the note
      const note = await hubspot.createContactNote(ctx.userId, contact.id, args.content);

      if (!note) {
        return {
          success: false,
          error: 'Failed to create note in HubSpot',
        };
      }

      return {
        success: true,
        data: {
          noteId: note.id,
          contactId: contact.id,
          contactEmail: args.contactEmail,
          contactName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
          preview: args.content.substring(0, 100) + (args.content.length > 100 ? '...' : ''),
          message: `Note added to ${contact.firstName || contact.email}'s contact record`,
        },
      };
    } catch (error) {
      console.error('[TOOL] create_hubspot_note error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create note',
      };
    }
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
