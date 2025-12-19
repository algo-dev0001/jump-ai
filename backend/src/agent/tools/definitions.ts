import { ChatCompletionTool } from 'openai/resources/chat/completions';

// Tool definitions for OpenAI function calling
export const toolDefinitions: ChatCompletionTool[] = [
  // Email tools
  {
    type: 'function',
    function: {
      name: 'send_email',
      description: 'Send an email to a recipient. Use this when the user wants to send an email to someone.',
      parameters: {
        type: 'object',
        properties: {
          to: {
            type: 'string',
            description: 'Email address of the recipient',
          },
          subject: {
            type: 'string',
            description: 'Subject line of the email',
          },
          body: {
            type: 'string',
            description: 'Body content of the email (plain text or HTML)',
          },
          cc: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional CC recipients',
          },
        },
        required: ['to', 'subject', 'body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_emails',
      description: 'Read recent emails from the inbox. Use this to check for new emails or find specific emails.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query to filter emails (e.g., "from:john@example.com" or "subject:meeting")',
          },
          maxResults: {
            type: 'number',
            description: 'Maximum number of emails to return (default: 10)',
          },
        },
        required: [],
      },
    },
  },

  // Calendar tools
  {
    type: 'function',
    function: {
      name: 'list_calendar_events',
      description: 'List calendar events within a date range. Use this to see upcoming meetings and appointments.',
      parameters: {
        type: 'object',
        properties: {
          startDate: {
            type: 'string',
            description: 'Start date for the range (ISO 8601 format)',
          },
          endDate: {
            type: 'string',
            description: 'End date for the range (ISO 8601 format)',
          },
          maxResults: {
            type: 'number',
            description: 'Maximum number of events to return (default: 10)',
          },
        },
        required: ['startDate', 'endDate'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_calendar_availability',
      description: 'Find available time slots in the calendar. Use this when scheduling meetings.',
      parameters: {
        type: 'object',
        properties: {
          startDate: {
            type: 'string',
            description: 'Start date for availability search (ISO 8601 format)',
          },
          endDate: {
            type: 'string',
            description: 'End date for availability search (ISO 8601 format)',
          },
          durationMinutes: {
            type: 'number',
            description: 'Required duration for the meeting in minutes',
          },
        },
        required: ['startDate', 'endDate', 'durationMinutes'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_calendar_event',
      description: 'Create a new calendar event. Use this to schedule meetings.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Title/summary of the event',
          },
          startTime: {
            type: 'string',
            description: 'Start time of the event (ISO 8601 format)',
          },
          endTime: {
            type: 'string',
            description: 'End time of the event (ISO 8601 format)',
          },
          attendees: {
            type: 'array',
            items: { type: 'string' },
            description: 'Email addresses of attendees',
          },
          description: {
            type: 'string',
            description: 'Description/notes for the event',
          },
          location: {
            type: 'string',
            description: 'Location or meeting link',
          },
        },
        required: ['title', 'startTime', 'endTime'],
      },
    },
  },

  // HubSpot CRM tools
  {
    type: 'function',
    function: {
      name: 'find_hubspot_contact',
      description: 'Search for a contact in HubSpot CRM. Use this to look up client information.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query (name, email, company, etc.)',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_hubspot_contact',
      description: 'Create a new contact in HubSpot CRM. Use this when adding a new client.',
      parameters: {
        type: 'object',
        properties: {
          email: {
            type: 'string',
            description: 'Email address of the contact',
          },
          firstName: {
            type: 'string',
            description: 'First name',
          },
          lastName: {
            type: 'string',
            description: 'Last name',
          },
          phone: {
            type: 'string',
            description: 'Phone number',
          },
          company: {
            type: 'string',
            description: 'Company name',
          },
        },
        required: ['email', 'firstName', 'lastName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_hubspot_note',
      description: 'Add a note to a HubSpot contact. Use this to log interactions or information about a client.',
      parameters: {
        type: 'object',
        properties: {
          contactEmail: {
            type: 'string',
            description: 'Email of the contact to add the note to',
          },
          content: {
            type: 'string',
            description: 'Content of the note',
          },
        },
        required: ['contactEmail', 'content'],
      },
    },
  },

  // RAG tool
  {
    type: 'function',
    function: {
      name: 'search_rag',
      description: 'Search through emails and CRM data using semantic search. Use this to find relevant information about clients or past communications.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Natural language search query',
          },
          sources: {
            type: 'array',
            items: { 
              type: 'string',
              enum: ['gmail', 'hubspot', 'all'],
            },
            description: 'Which sources to search (default: all)',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results (default: 5)',
          },
        },
        required: ['query'],
      },
    },
  },

  // Task management tools
  {
    type: 'function',
    function: {
      name: 'store_task',
      description: 'Create a new task that may require follow-up or async processing. Use this for tasks that cannot be completed immediately (e.g., waiting for email reply).',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['meeting_scheduling', 'email_followup', 'crm_update', 'reminder', 'other'],
            description: 'Type of task',
          },
          description: {
            type: 'string',
            description: 'Description of what needs to be done',
          },
          data: {
            type: 'object',
            description: 'Additional data needed to complete the task',
          },
          triggerCondition: {
            type: 'string',
            description: 'Condition that should trigger task resumption (e.g., "email_reply_from:john@example.com")',
          },
        },
        required: ['type', 'description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_task',
      description: 'Update an existing task status or data.',
      parameters: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'ID of the task to update',
          },
          status: {
            type: 'string',
            enum: ['pending', 'in_progress', 'completed', 'failed'],
            description: 'New status for the task',
          },
          data: {
            type: 'object',
            description: 'Updated task data',
          },
          notes: {
            type: 'string',
            description: 'Notes about the update',
          },
        },
        required: ['taskId'],
      },
    },
  },
];

// Get tool names for easy reference
export const toolNames = toolDefinitions.map((t) => t.function.name);

// Type for tool arguments
export interface ToolArgs {
  send_email: {
    to: string;
    subject: string;
    body: string;
    cc?: string[];
  };
  read_emails: {
    query?: string;
    maxResults?: number;
  };
  list_calendar_events: {
    startDate: string;
    endDate: string;
    maxResults?: number;
  };
  find_calendar_availability: {
    startDate: string;
    endDate: string;
    durationMinutes: number;
  };
  create_calendar_event: {
    title: string;
    startTime: string;
    endTime: string;
    attendees?: string[];
    description?: string;
    location?: string;
  };
  find_hubspot_contact: {
    query: string;
  };
  create_hubspot_contact: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    company?: string;
  };
  create_hubspot_note: {
    contactEmail: string;
    content: string;
  };
  search_rag: {
    query: string;
    sources?: ('gmail' | 'hubspot' | 'all')[];
    limit?: number;
  };
  store_task: {
    type: 'meeting_scheduling' | 'email_followup' | 'crm_update' | 'reminder' | 'other';
    description: string;
    data?: Record<string, unknown>;
    triggerCondition?: string;
  };
  update_task: {
    taskId: string;
    status?: 'pending' | 'in_progress' | 'completed' | 'failed';
    data?: Record<string, unknown>;
    notes?: string;
  };
}

