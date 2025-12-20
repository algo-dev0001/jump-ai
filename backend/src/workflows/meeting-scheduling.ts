import { 
  createTask, 
  updateTask, 
  getTask, 
  TypedTask,
  MeetingSchedulingContext 
} from '../services/tasks';
import { sendEmail, NormalizedEmail } from '../services/gmail';
import { createEvent, findAvailability } from '../services/calendar';
import { getContactByEmail, createContactNote } from '../services/hubspot';

/**
 * Meeting Scheduling Workflow
 * 
 * Steps:
 * 1. initial → Send meeting request email
 * 2. sent_request → Wait for reply (paused)
 * 3. received_reply → Process reply, find time, create event
 * 4. scheduled → Add note to CRM
 * 5. noted → Send confirmation email
 * 6. confirmed → Complete
 */

export interface StartMeetingSchedulingParams {
  userId: string;
  contactEmail: string;
  contactName?: string;
  purpose: string;
  durationMinutes: number;
  preferredTimes?: string[];
}

export interface WorkflowResult {
  success: boolean;
  taskId: string;
  step: string;
  message: string;
  waitingForReply?: boolean;
  data?: Record<string, unknown>;
}

/**
 * Start the meeting scheduling workflow
 */
export async function startMeetingScheduling(
  params: StartMeetingSchedulingParams
): Promise<WorkflowResult> {
  const { userId, contactEmail, contactName, purpose, durationMinutes, preferredTimes } = params;

  // Create initial context
  const context: MeetingSchedulingContext = {
    step: 'initial',
    contact: {
      email: contactEmail,
      name: contactName,
    },
    meetingDetails: {
      purpose,
      duration: durationMinutes,
      preferredTimes,
    },
    messages: [{
      role: 'system',
      content: `Workflow started: Schedule ${durationMinutes} min meeting with ${contactName || contactEmail} for "${purpose}"`,
      timestamp: new Date().toISOString(),
    }],
  };

  // Create the task
  const task = await createTask(
    userId,
    'meeting_scheduling',
    `Schedule meeting with ${contactName || contactEmail}: ${purpose}`,
    context
  );

  // Execute first step
  return await executeStep(userId, task);
}

/**
 * Resume workflow from a reply
 */
export async function resumeFromReply(
  userId: string,
  taskId: string,
  replyEmail: NormalizedEmail
): Promise<WorkflowResult> {
  const task = await getTask(taskId);
  if (!task) {
    return { success: false, taskId, step: 'unknown', message: 'Task not found' };
  }

  const context = task.data as MeetingSchedulingContext;
  
  // Update context with reply info
  await updateTask(taskId, {
    status: 'in_progress',
    context: {
      step: 'received_reply',
      lastEmailId: replyEmail.id,
    },
    addMessage: {
      role: 'system',
      content: `Received reply from ${replyEmail.from}: "${replyEmail.snippet}"`,
    },
  });

  // Get updated task
  const updatedTask = await getTask(taskId);
  if (!updatedTask) {
    return { success: false, taskId, step: 'unknown', message: 'Task not found after update' };
  }

  // Continue execution
  return await executeStep(userId, updatedTask);
}

/**
 * Execute the current step of the workflow
 */
async function executeStep(userId: string, task: TypedTask): Promise<WorkflowResult> {
  const context = task.data as MeetingSchedulingContext;
  const taskId = task.id;

  try {
    switch (context.step) {
      case 'initial':
        return await stepSendRequest(userId, task);
      
      case 'sent_request':
        // This shouldn't happen - we're waiting for reply
        return {
          success: true,
          taskId,
          step: 'sent_request',
          message: 'Waiting for reply',
          waitingForReply: true,
        };
      
      case 'received_reply':
        return await stepProcessReplyAndSchedule(userId, task);
      
      case 'scheduled':
        return await stepAddCRMNote(userId, task);
      
      case 'noted':
        return await stepSendConfirmation(userId, task);
      
      case 'confirmed':
        return {
          success: true,
          taskId,
          step: 'confirmed',
          message: 'Meeting scheduling completed!',
        };
      
      default:
        return {
          success: false,
          taskId,
          step: context.step,
          message: `Unknown step: ${context.step}`,
        };
    }
  } catch (error) {
    console.error(`[Workflow] Error in step ${context.step}:`, error);
    
    await updateTask(taskId, {
      status: 'failed',
      addMessage: {
        role: 'system',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
    });

    return {
      success: false,
      taskId,
      step: context.step,
      message: error instanceof Error ? error.message : 'Workflow failed',
    };
  }
}

/**
 * Step 1: Send meeting request email
 */
async function stepSendRequest(userId: string, task: TypedTask): Promise<WorkflowResult> {
  const context = task.data as MeetingSchedulingContext;
  const { contact, meetingDetails } = context;

  // Find available times
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 7); // Next 7 days

  const availability = await findAvailability(userId, {
    startDate,
    endDate,
    durationMinutes: meetingDetails.duration,
  });

  // Format available times for email
  const timeOptions = availability.slice(0, 3).map((slot, i) => {
    const date = new Date(slot.start);
    return `${i + 1}. ${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  }).join('\n');

  // Compose email
  const emailBody = `Hi ${contact.name || 'there'},

I'd like to schedule a ${meetingDetails.duration}-minute meeting with you to discuss: ${meetingDetails.purpose}

Here are some times that work for me:

${timeOptions}

Please let me know which time works best for you, or suggest an alternative.

Best regards`;

  // Send email
  const result = await sendEmail(userId, {
    to: contact.email,
    subject: `Meeting Request: ${meetingDetails.purpose}`,
    body: emailBody,
  });

  if (!result) {
    throw new Error('Failed to send meeting request email');
  }

  // Update task
  await updateTask(task.id, {
    status: 'waiting_reply',
    context: {
      step: 'sent_request',
      emailThreadId: result.threadId,
      lastEmailId: result.id,
      waitingForReplyFrom: contact.email,
      meetingDetails: {
        ...meetingDetails,
        preferredTimes: availability.slice(0, 3).map(s => s.start.toISOString()),
      },
    },
    addMessage: {
      role: 'agent',
      content: `Sent meeting request email to ${contact.email}. Waiting for reply...`,
    },
  });

  return {
    success: true,
    taskId: task.id,
    step: 'sent_request',
    message: `Meeting request sent to ${contact.email}. I'll process their reply when it arrives.`,
    waitingForReply: true,
    data: {
      emailId: result.id,
      threadId: result.threadId,
    },
  };
}

/**
 * Step 2: Process reply and schedule meeting
 */
async function stepProcessReplyAndSchedule(userId: string, task: TypedTask): Promise<WorkflowResult> {
  const context = task.data as MeetingSchedulingContext;
  const { contact, meetingDetails } = context;

  // For now, use the first preferred time
  // In a real scenario, we'd use the agent to parse the reply
  const meetingTime = meetingDetails.preferredTimes?.[0] || new Date(Date.now() + 86400000).toISOString();
  const startTime = new Date(meetingTime);
  const endTime = new Date(startTime.getTime() + meetingDetails.duration * 60000);

  // Create calendar event
  const event = await createEvent(userId, {
    title: `Meeting: ${meetingDetails.purpose}`,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    description: `Meeting with ${contact.name || contact.email}\n\nPurpose: ${meetingDetails.purpose}`,
    attendees: [contact.email],
    sendNotifications: true,
  });

  if (!event) {
    throw new Error('Failed to create calendar event');
  }

  // Update task
  await updateTask(task.id, {
    context: {
      step: 'scheduled',
      calendarEventId: event.id,
      meetingDetails: {
        ...meetingDetails,
        proposedTime: startTime.toISOString(),
      },
    },
    addMessage: {
      role: 'agent',
      content: `Created calendar event for ${startTime.toLocaleString()}`,
    },
  });

  // Continue to next step
  const updatedTask = await getTask(task.id);
  return await executeStep(userId, updatedTask!);
}

/**
 * Step 3: Add note to CRM
 */
async function stepAddCRMNote(userId: string, task: TypedTask): Promise<WorkflowResult> {
  const context = task.data as MeetingSchedulingContext;
  const { contact, meetingDetails, calendarEventId } = context;

  // Try to add CRM note if HubSpot is connected
  let hubspotNoteId: string | undefined;
  
  try {
    const hubspotContact = await getContactByEmail(userId, contact.email);
    
    if (hubspotContact) {
      const meetingTime = meetingDetails.proposedTime 
        ? new Date(meetingDetails.proposedTime).toLocaleString() 
        : 'TBD';
      
      const note = await createContactNote(
        userId,
        hubspotContact.id,
        `Scheduled meeting: ${meetingDetails.purpose}\nTime: ${meetingTime}\nDuration: ${meetingDetails.duration} minutes\nCalendar Event ID: ${calendarEventId}`
      );
      
      if (note) {
        hubspotNoteId = note.id;
        context.contact.hubspotId = hubspotContact.id;
      }
    }
  } catch (error) {
    console.log('[Workflow] HubSpot note creation skipped:', error);
    // Continue without HubSpot note
  }

  // Update task
  await updateTask(task.id, {
    context: {
      step: 'noted',
      hubspotNoteId,
      contact: context.contact,
    },
    addMessage: {
      role: 'agent',
      content: hubspotNoteId 
        ? `Added note to ${contact.name || contact.email}'s CRM record`
        : 'Skipped CRM note (contact not found or HubSpot not connected)',
    },
  });

  // Continue to next step
  const updatedTask = await getTask(task.id);
  return await executeStep(userId, updatedTask!);
}

/**
 * Step 4: Send confirmation email
 */
async function stepSendConfirmation(userId: string, task: TypedTask): Promise<WorkflowResult> {
  const context = task.data as MeetingSchedulingContext;
  const { contact, meetingDetails, emailThreadId } = context;

  const meetingTime = meetingDetails.proposedTime 
    ? new Date(meetingDetails.proposedTime) 
    : new Date();

  const emailBody = `Hi ${contact.name || 'there'},

This confirms our meeting:

📅 Date: ${meetingTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
🕐 Time: ${meetingTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
⏱️ Duration: ${meetingDetails.duration} minutes
📋 Topic: ${meetingDetails.purpose}

A calendar invite has been sent separately. Looking forward to speaking with you!

Best regards`;

  // Send confirmation (as reply to thread if available)
  const result = await sendEmail(userId, {
    to: contact.email,
    subject: `Confirmed: ${meetingDetails.purpose}`,
    body: emailBody,
    threadId: emailThreadId,
  });

  if (!result) {
    throw new Error('Failed to send confirmation email');
  }

  // Mark task as completed
  await updateTask(task.id, {
    status: 'completed',
    context: {
      step: 'confirmed',
    },
    addMessage: {
      role: 'agent',
      content: `Sent confirmation email. Meeting scheduling complete!`,
    },
  });

  return {
    success: true,
    taskId: task.id,
    step: 'confirmed',
    message: `Meeting scheduled with ${contact.name || contact.email} for ${meetingTime.toLocaleString()}. Calendar invite and confirmation email sent!`,
    data: {
      meetingTime: meetingTime.toISOString(),
      calendarEventId: context.calendarEventId,
    },
  };
}

/**
 * Get workflow status
 */
export async function getMeetingSchedulingStatus(taskId: string): Promise<{
  taskId: string;
  step: string;
  status: string;
  contact: { email: string; name?: string };
  meetingDetails: {
    purpose: string;
    duration: number;
    proposedTime?: string;
  };
  waitingForReply: boolean;
  messages: Array<{ role: string; content: string; timestamp: string }>;
} | null> {
  const task = await getTask(taskId);
  if (!task || task.type !== 'meeting_scheduling') {
    return null;
  }

  const context = task.data as MeetingSchedulingContext;
  
  return {
    taskId: task.id,
    step: context.step,
    status: task.status,
    contact: context.contact,
    meetingDetails: context.meetingDetails,
    waitingForReply: task.status === 'waiting_reply',
    messages: context.messages || [],
  };
}

