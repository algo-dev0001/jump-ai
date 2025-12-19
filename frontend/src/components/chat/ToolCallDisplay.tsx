'use client';

import { memo } from 'react';

interface ToolCallDisplayProps {
  name: string;
  status: 'calling' | 'complete' | 'error';
  result?: unknown;
}

const toolLabels: Record<string, { label: string; icon: string }> = {
  send_email: { label: 'Sending email', icon: '✉️' },
  read_emails: { label: 'Reading emails', icon: '📬' },
  list_calendar_events: { label: 'Checking calendar', icon: '📅' },
  find_calendar_availability: { label: 'Finding availability', icon: '🕐' },
  create_calendar_event: { label: 'Creating event', icon: '📆' },
  find_hubspot_contact: { label: 'Searching contacts', icon: '👤' },
  create_hubspot_contact: { label: 'Creating contact', icon: '➕' },
  create_hubspot_note: { label: 'Adding note', icon: '📝' },
  search_rag: { label: 'Searching data', icon: '🔍' },
  store_task: { label: 'Creating task', icon: '✅' },
  update_task: { label: 'Updating task', icon: '🔄' },
};

function ToolCallDisplayComponent({ name, status, result }: ToolCallDisplayProps) {
  const tool = toolLabels[name] || { label: name, icon: '🔧' };
  
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm my-2">
      <span className="text-lg">{tool.icon}</span>
      <span className="text-gray-700">{tool.label}</span>
      {status === 'calling' && (
        <span className="ml-auto flex items-center gap-1 text-blue-600">
          <span className="animate-spin h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full" />
          Running...
        </span>
      )}
      {status === 'complete' && (
        <span className="ml-auto text-green-600 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Done
        </span>
      )}
      {status === 'error' && (
        <span className="ml-auto text-red-600 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Failed
        </span>
      )}
    </div>
  );
}

export const ToolCallDisplay = memo(ToolCallDisplayComponent);

