'use client';

import { memo } from 'react';

interface ToolCallDisplayProps {
  name: string;
  status: 'calling' | 'complete' | 'error';
  args?: Record<string, unknown>;
  result?: {
    success?: boolean;
    data?: unknown;
    error?: string;
  };
}

const toolLabels: Record<string, { label: string; activeLabel: string; icon: string; color: string }> = {
  send_email: { 
    label: 'Email sent', 
    activeLabel: 'Sending email', 
    icon: '✉️',
    color: 'blue',
  },
  read_emails: { 
    label: 'Emails retrieved', 
    activeLabel: 'Reading emails', 
    icon: '📬',
    color: 'blue',
  },
  list_calendar_events: { 
    label: 'Calendar checked', 
    activeLabel: 'Checking calendar', 
    icon: '📅',
    color: 'purple',
  },
  find_calendar_availability: { 
    label: 'Availability found', 
    activeLabel: 'Finding availability', 
    icon: '🕐',
    color: 'purple',
  },
  create_calendar_event: { 
    label: 'Event created', 
    activeLabel: 'Creating event', 
    icon: '📆',
    color: 'purple',
  },
  find_hubspot_contact: { 
    label: 'Contact found', 
    activeLabel: 'Searching contacts', 
    icon: '👤',
    color: 'orange',
  },
  create_hubspot_contact: { 
    label: 'Contact created', 
    activeLabel: 'Creating contact', 
    icon: '➕',
    color: 'orange',
  },
  create_hubspot_note: { 
    label: 'Note added', 
    activeLabel: 'Adding CRM note', 
    icon: '📝',
    color: 'orange',
  },
  search_rag: { 
    label: 'Data searched', 
    activeLabel: 'Searching your data', 
    icon: '🔍',
    color: 'teal',
  },
  store_task: { 
    label: 'Task created', 
    activeLabel: 'Creating task', 
    icon: '✅',
    color: 'green',
  },
  update_task: { 
    label: 'Task updated', 
    activeLabel: 'Updating task', 
    icon: '🔄',
    color: 'green',
  },
  add_instruction: { 
    label: 'Instruction saved', 
    activeLabel: 'Saving instruction', 
    icon: '📋',
    color: 'indigo',
  },
  list_instructions: { 
    label: 'Instructions listed', 
    activeLabel: 'Listing instructions', 
    icon: '📋',
    color: 'indigo',
  },
  remove_instruction: { 
    label: 'Instruction removed', 
    activeLabel: 'Removing instruction', 
    icon: '🗑️',
    color: 'indigo',
  },
};

const colorClasses: Record<string, { bg: string; border: string; text: string }> = {
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
  teal: { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700' },
  green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
  indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' },
  gray: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700' },
};

function getResultPreview(result?: ToolCallDisplayProps['result']): string | null {
  if (!result?.data) return null;
  
  const data = result.data as Record<string, unknown>;
  
  // Common result fields to display
  if (data.message) return String(data.message);
  if (data.total !== undefined) return `Found ${data.total} result(s)`;
  if (data.eventId) return 'Event scheduled';
  if (data.contactId) return 'Contact saved';
  if (data.noteId) return 'Note created';
  if (data.taskId) return `Task ${data.status || 'created'}`;
  if (data.instructionId) return 'Instruction active';
  
  return null;
}

function ToolCallDisplayComponent({ name, status, args, result }: ToolCallDisplayProps) {
  const tool = toolLabels[name] || { label: name, activeLabel: name, icon: '🔧', color: 'gray' };
  const colors = colorClasses[tool.color] || colorClasses.gray;
  const preview = status === 'complete' ? getResultPreview(result) : null;
  
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${colors.bg} ${colors.border} my-2 transition-all duration-200`}>
      <span className="text-xl shrink-0">{tool.icon}</span>
      <div className="flex-1 min-w-0">
        <span className={`font-medium ${colors.text}`}>
          {status === 'calling' ? tool.activeLabel : tool.label}
        </span>
        {preview && status === 'complete' && (
          <p className="text-sm text-gray-500 truncate">{preview}</p>
        )}
        {result?.error && status === 'error' && (
          <p className="text-sm text-red-600 truncate">{result.error}</p>
        )}
      </div>
      <div className="shrink-0">
        {status === 'calling' && (
          <span className="flex items-center gap-1.5 text-blue-600 text-sm font-medium">
            <span className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
          </span>
        )}
        {status === 'complete' && (
          <span className="flex items-center justify-center w-6 h-6 bg-green-100 rounded-full">
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </span>
        )}
        {status === 'error' && (
          <span className="flex items-center justify-center w-6 h-6 bg-red-100 rounded-full">
            <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </span>
        )}
      </div>
    </div>
  );
}

export const ToolCallDisplay = memo(ToolCallDisplayComponent);
