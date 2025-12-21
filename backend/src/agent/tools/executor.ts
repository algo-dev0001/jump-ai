import { PrismaClient } from '@prisma/client';
import { ToolArgs } from './definitions';
import * as gmail from '../../services/gmail';
import * as calendar from '../../services/calendar';
import * as hubspot from '../../services/hubspot';
import * as rag from '../../services/rag';
import * as tasks from '../../services/tasks';
import * as instructions from '../../services/instructions';
import { startMeetingScheduling, getMeetingSchedulingStatus } from '../../workflows';
import { loggers } from '../../lib/logger';

const prisma = new PrismaClient();
const log = loggers.tools;

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

  // RAG search - vector similarity search
  async search_rag(args: ToolArgs['search_rag'], ctx: ToolContext): Promise<ToolResult> {
    console.log(`[TOOL] search_rag called for user ${ctx.userId}:`, args);
    
    try {
      // Determine sources to search
      let sources: rag.EmbeddingSource[] | undefined;
      if (args.sources && args.sources.length > 0 && !args.sources.includes('all')) {
        sources = args.sources.filter((s): s is rag.EmbeddingSource => s !== 'all');
      }

      // Perform vector search
      const results = await rag.searchRAG(ctx.userId, args.query, {
        sources,
        limit: args.limit || 5,
        minScore: 0.3,
      });

      if (results.length === 0) {
        // Fallback to basic text search in email cache
        const emails = await prisma.emailCache.findMany({
          where: {
            userId: ctx.userId,
            OR: [
              { from: { contains: args.query, mode: 'insensitive' } },
              { subject: { contains: args.query, mode: 'insensitive' } },
              { body: { contains: args.query, mode: 'insensitive' } },
            ],
          },
          orderBy: { date: 'desc' },
          take: args.limit || 5,
        });

        if (emails.length > 0) {
          return {
            success: true,
            data: {
              results: emails.map((e) => ({
                source: 'gmail',
                content: `Email from ${e.fromName || e.from}: "${e.subject}" - ${e.snippet}`,
                metadata: {
                  emailId: e.id,
                  from: e.from,
                  fromName: e.fromName,
                  subject: e.subject,
                  date: e.date.toISOString(),
                },
                score: 0.5,
              })),
              searchType: 'text_fallback',
              message: `Found ${emails.length} result(s) via text search for "${args.query}"`,
            },
          };
        }

        return {
          success: true,
          data: {
            results: [],
            message: `No results found for "${args.query}". Try indexing more emails or contacts.`,
          },
        };
      }

      // Format results
      const formattedResults = results.map((r) => {
        const meta = r.metadata as Record<string, unknown>;
        return {
          source: r.source,
          content: r.content.length > 500 ? r.content.substring(0, 500) + '...' : r.content,
          metadata: {
            ...(r.source === 'gmail' && {
              emailId: meta.emailId,
              from: meta.from,
              fromName: meta.fromName,
              subject: meta.subject,
              date: meta.date,
            }),
            ...(r.source === 'hubspot' && {
              contactId: meta.contactId,
              email: meta.email,
              firstName: meta.firstName,
              lastName: meta.lastName,
              company: meta.company,
            }),
          },
          score: Math.round(r.score * 100) / 100,
        };
      });

      return {
        success: true,
        data: {
          results: formattedResults,
          searchType: 'vector',
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

  // Task management - REAL IMPLEMENTATIONS with WORKFLOWS
  async store_task(args: ToolArgs['store_task'], ctx: ToolContext): Promise<ToolResult> {
    console.log(`[TOOL] store_task called for user ${ctx.userId}:`, args);
    
    try {
      // Special handling for meeting scheduling workflow
      if (args.type === 'meeting_scheduling' && args.data) {
        const data = args.data as {
          contactEmail?: string;
          contactName?: string;
          purpose?: string;
          duration?: number;
        };

        if (data.contactEmail && data.purpose) {
          // Start the meeting scheduling workflow
          const result = await startMeetingScheduling({
            userId: ctx.userId,
            contactEmail: data.contactEmail,
            contactName: data.contactName,
            purpose: data.purpose,
            durationMinutes: data.duration || 30,
          });

          return {
            success: result.success,
            data: {
              taskId: result.taskId,
              type: 'meeting_scheduling',
              status: result.waitingForReply ? 'waiting_reply' : 'in_progress',
              step: result.step,
              message: result.message,
              waitingForReply: result.waitingForReply,
              ...result.data,
            },
          };
        }
      }

      // Default task creation for other types
      const task = await tasks.createTask(
        ctx.userId,
        args.type,
        args.description,
        {
          ...args.data,
          triggerCondition: args.triggerCondition,
        }
      );

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
      // Get task to check type
      const existingTask = await tasks.getTask(args.taskId);
      if (!existingTask) {
        return {
          success: false,
          error: `Task ${args.taskId} not found`,
        };
      }

      // If it's a meeting scheduling task, get status
      if (existingTask.type === 'meeting_scheduling') {
        const status = await getMeetingSchedulingStatus(args.taskId);
        if (status) {
          // If cancelling
          if (args.status === 'cancelled') {
            await tasks.cancelTask(args.taskId);
            return {
              success: true,
              data: {
                taskId: args.taskId,
                status: 'cancelled',
                message: 'Meeting scheduling cancelled',
              },
            };
          }

          return {
            success: true,
            data: {
              taskId: args.taskId,
              status: status.status,
              step: status.step,
              waitingForReply: status.waitingForReply,
              contact: status.contact,
              meetingDetails: status.meetingDetails,
              message: status.waitingForReply 
                ? `Waiting for reply from ${status.contact.email}`
                : `Current step: ${status.step}`,
            },
          };
        }
      }

      // Default update
      const task = await tasks.updateTask(args.taskId, {
        status: args.status as tasks.TaskStatus,
        context: args.data,
        addMessage: args.notes ? { role: 'agent', content: args.notes } : undefined,
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

  // Instruction management tools
  async add_instruction(args: ToolArgs['add_instruction'], ctx: ToolContext): Promise<ToolResult> {
    console.log(`[TOOL] add_instruction called for user ${ctx.userId}:`, args);
    
    try {
      const instruction = await instructions.addInstruction(ctx.userId, args.instruction);

      return {
        success: true,
        data: {
          instructionId: instruction.id,
          content: instruction.content,
          active: instruction.active,
          message: `Instruction added: "${args.instruction.substring(0, 50)}${args.instruction.length > 50 ? '...' : ''}"`,
        },
      };
    } catch (error) {
      console.error('[TOOL] add_instruction error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add instruction',
      };
    }
  },

  async list_instructions(args: ToolArgs['list_instructions'], ctx: ToolContext): Promise<ToolResult> {
    console.log(`[TOOL] list_instructions called for user ${ctx.userId}:`, args);
    
    try {
      const instructionList = args.includeInactive
        ? await instructions.getAllInstructions(ctx.userId)
        : await instructions.getActiveInstructions(ctx.userId);

      return {
        success: true,
        data: {
          instructions: instructionList.map((inst) => ({
            id: inst.id,
            content: inst.content,
            active: inst.active,
            createdAt: inst.createdAt.toISOString(),
          })),
          total: instructionList.length,
          message: instructionList.length > 0
            ? `Found ${instructionList.length} instruction(s)`
            : 'No instructions found',
        },
      };
    } catch (error) {
      console.error('[TOOL] list_instructions error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list instructions',
      };
    }
  },

  async remove_instruction(args: ToolArgs['remove_instruction'], ctx: ToolContext): Promise<ToolResult> {
    console.log(`[TOOL] remove_instruction called for user ${ctx.userId}:`, args);
    
    try {
      if (args.permanent) {
        await instructions.deleteInstruction(args.instructionId);
        return {
          success: true,
          data: {
            instructionId: args.instructionId,
            action: 'deleted',
            message: 'Instruction permanently deleted',
          },
        };
      } else {
        const instruction = await instructions.deactivateInstruction(args.instructionId);
        return {
          success: true,
          data: {
            instructionId: instruction.id,
            action: 'deactivated',
            content: instruction.content,
            message: 'Instruction deactivated (can be reactivated later)',
          },
        };
      }
    } catch (error) {
      console.error('[TOOL] remove_instruction error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove instruction',
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
  const startTime = Date.now();
  const implementation = toolImplementations[toolName as ToolName];
  
  if (!implementation) {
    log.warn(`Unknown tool requested: ${toolName}`, { userId: context.userId });
    return {
      success: false,
      error: `Unknown tool: ${toolName}`,
    };
  }

  log.info(`Executing: ${toolName}`, { userId: context.userId, args: JSON.stringify(args).substring(0, 200) });

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await implementation(args as any, context);
    const duration = Date.now() - startTime;
    
    if (result.success) {
      log.info(`Completed: ${toolName} (${duration}ms)`, { 
        userId: context.userId, 
        duration,
        preview: JSON.stringify(result.data).substring(0, 100),
      });
    } else {
      log.warn(`Failed: ${toolName} (${duration}ms)`, { 
        userId: context.userId, 
        duration,
        error: result.error,
      });
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error(`Error executing ${toolName}`, error, { userId: context.userId, duration });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Tool execution failed',
    };
  }
}
