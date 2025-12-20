import { PrismaClient, Task } from '@prisma/client';

const prisma = new PrismaClient();

// Task types
export type TaskType = 
  | 'meeting_scheduling'
  | 'email_followup'
  | 'crm_update'
  | 'reminder'
  | 'other';

// Task status
export type TaskStatus = 
  | 'pending'        // Just created
  | 'waiting_reply'  // Waiting for external event (email reply)
  | 'in_progress'    // Being processed
  | 'completed'      // Successfully finished
  | 'failed'         // Failed
  | 'cancelled';     // Cancelled by user

// Meeting scheduling context
export interface MeetingSchedulingContext {
  step: 'initial' | 'sent_request' | 'received_reply' | 'scheduled' | 'noted' | 'confirmed';
  contact: {
    email: string;
    name?: string;
    hubspotId?: string;
  };
  meetingDetails: {
    purpose: string;
    duration: number; // minutes
    preferredTimes?: string[];
    proposedTime?: string;
  };
  emailThreadId?: string;
  lastEmailId?: string;
  waitingForReplyFrom?: string;
  calendarEventId?: string;
  hubspotNoteId?: string;
  messages: Array<{
    role: 'system' | 'agent';
    content: string;
    timestamp: string;
  }>;
}

// Generic task context
export type TaskContext = MeetingSchedulingContext | Record<string, unknown>;

// Task with typed context
export interface TypedTask extends Omit<Task, 'data'> {
  data: TaskContext | null;
}

/**
 * Create a new task
 */
export async function createTask(
  userId: string,
  type: TaskType,
  description: string,
  context: TaskContext
): Promise<TypedTask> {
  const task = await prisma.task.create({
    data: {
      userId,
      type,
      status: 'pending',
      description,
      data: context as object,
    },
  });

  console.log(`[Tasks] Created task ${task.id}: ${type}`);
  return task as TypedTask;
}

/**
 * Get a task by ID
 */
export async function getTask(taskId: string): Promise<TypedTask | null> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
  });
  return task as TypedTask | null;
}

/**
 * Get tasks by status
 */
export async function getTasksByStatus(
  userId: string,
  status: TaskStatus | TaskStatus[]
): Promise<TypedTask[]> {
  const statuses = Array.isArray(status) ? status : [status];
  const tasks = await prisma.task.findMany({
    where: {
      userId,
      status: { in: statuses },
    },
    orderBy: { updatedAt: 'desc' },
  });
  return tasks as TypedTask[];
}

/**
 * Get tasks waiting for email reply
 */
export async function getTasksWaitingForReply(userId: string): Promise<TypedTask[]> {
  const tasks = await prisma.task.findMany({
    where: {
      userId,
      status: 'waiting_reply',
    },
    orderBy: { updatedAt: 'asc' },
  });
  return tasks as TypedTask[];
}

/**
 * Update task status and context
 */
export async function updateTask(
  taskId: string,
  updates: {
    status?: TaskStatus;
    context?: Partial<TaskContext>;
    addMessage?: { role: 'system' | 'agent'; content: string };
  }
): Promise<TypedTask> {
  const existing = await prisma.task.findUnique({
    where: { id: taskId },
  });

  if (!existing) {
    throw new Error(`Task ${taskId} not found`);
  }

  const existingData = (existing.data || {}) as TaskContext;
  
  // Merge context
  let newData = existingData;
  if (updates.context) {
    newData = { ...existingData, ...updates.context };
  }

  // Add message if provided
  if (updates.addMessage && 'messages' in newData) {
    (newData as MeetingSchedulingContext).messages.push({
      ...updates.addMessage,
      timestamp: new Date().toISOString(),
    });
  }

  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...(updates.status && { status: updates.status }),
      data: newData as object,
      ...(updates.status === 'completed' && { completedAt: new Date() }),
    },
  });

  console.log(`[Tasks] Updated task ${taskId}: status=${updates.status || 'unchanged'}`);
  return task as TypedTask;
}

/**
 * Find task waiting for reply from specific email
 */
export async function findTaskWaitingForEmail(
  userId: string,
  fromEmail: string,
  threadId?: string
): Promise<TypedTask | null> {
  const tasks = await getTasksWaitingForReply(userId);
  
  for (const task of tasks) {
    const context = task.data as MeetingSchedulingContext;
    
    // Check if waiting for this sender
    if (context?.waitingForReplyFrom?.toLowerCase() === fromEmail.toLowerCase()) {
      // If thread ID matches, it's definitely the right task
      if (threadId && context.emailThreadId === threadId) {
        return task;
      }
      // If no thread ID specified, match by email
      if (!threadId) {
        return task;
      }
    }
  }

  return null;
}

/**
 * Get user's active tasks summary
 */
export async function getTasksSummary(userId: string): Promise<{
  pending: number;
  waiting: number;
  inProgress: number;
  completed: number;
  failed: number;
}> {
  const tasks = await prisma.task.groupBy({
    by: ['status'],
    where: { userId },
    _count: { id: true },
  });

  const counts = tasks.reduce((acc, t) => {
    acc[t.status as TaskStatus] = t._count.id;
    return acc;
  }, {} as Record<string, number>);

  return {
    pending: counts.pending || 0,
    waiting: counts.waiting_reply || 0,
    inProgress: counts.in_progress || 0,
    completed: counts.completed || 0,
    failed: counts.failed || 0,
  };
}

/**
 * Cancel a task
 */
export async function cancelTask(taskId: string): Promise<TypedTask> {
  return updateTask(taskId, {
    status: 'cancelled',
    addMessage: { role: 'system', content: 'Task cancelled by user' },
  });
}

