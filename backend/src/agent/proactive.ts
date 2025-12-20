import OpenAI from 'openai';
import { config } from '../config';
import { getActiveInstructions, formatInstructionsForPrompt } from '../services/instructions';
import { runAgent, AgentMessage } from './loop';
import { NormalizedEmail } from '../services/gmail';
import { CalendarEvent } from '../services/calendar';
import { HubSpotContact, HubSpotNote } from '../services/hubspot';

const openai = new OpenAI({
  apiKey: config.OPENAI_API_KEY,
});

// Event types that can trigger proactive behavior
export type ProactiveEvent = 
  | { type: 'new_email'; data: NormalizedEmail }
  | { type: 'calendar_event_soon'; data: CalendarEvent }
  | { type: 'crm_contact_updated'; data: HubSpotContact }
  | { type: 'crm_note_added'; data: { contact: HubSpotContact; note: HubSpotNote } };

// Result of proactive evaluation
export interface ProactiveResult {
  shouldAct: boolean;
  reasoning: string;
  suggestedAction?: string;
  executed?: boolean;
  executionResult?: string;
}

// Format event for the prompt
function formatEvent(event: ProactiveEvent): string {
  switch (event.type) {
    case 'new_email':
      return `NEW EMAIL RECEIVED:
From: ${event.data.fromName || event.data.from} <${event.data.from}>
Subject: ${event.data.subject}
Date: ${event.data.date.toLocaleString()}
Preview: ${event.data.snippet}

Full Body:
${event.data.body.substring(0, 1000)}${event.data.body.length > 1000 ? '...' : ''}`;

    case 'calendar_event_soon':
      return `UPCOMING CALENDAR EVENT:
Title: ${event.data.title}
Start: ${event.data.start.toLocaleString()}
End: ${event.data.end.toLocaleString()}
Attendees: ${event.data.attendees.map(a => a.email).join(', ') || 'None'}
Location: ${event.data.location || 'Not specified'}`;

    case 'crm_contact_updated':
      return `CRM CONTACT UPDATED:
Name: ${event.data.firstName} ${event.data.lastName}
Email: ${event.data.email}
Company: ${event.data.company || 'Not specified'}
Phone: ${event.data.phone || 'Not specified'}`;

    case 'crm_note_added':
      return `CRM NOTE ADDED:
Contact: ${event.data.contact.firstName} ${event.data.contact.lastName} <${event.data.contact.email}>
Note: ${event.data.note.content.substring(0, 500)}`;
  }
}

/**
 * Evaluate if the agent should act on an event based on instructions
 */
export async function evaluateEvent(
  userId: string,
  event: ProactiveEvent
): Promise<ProactiveResult> {
  // Get active instructions
  const instructions = await getActiveInstructions(userId);
  
  if (instructions.length === 0) {
    return {
      shouldAct: false,
      reasoning: 'No active instructions to evaluate against.',
    };
  }

  const formattedInstructions = formatInstructionsForPrompt(instructions);
  const formattedEvent = formatEvent(event);

  // Ask the model if it should act
  const evaluationPrompt = `You are an AI assistant for a financial advisor. You have been given ongoing instructions to follow.

ACTIVE INSTRUCTIONS:
${formattedInstructions}

EVENT THAT JUST OCCURRED:
${formattedEvent}

Based on the instructions above, should you take any action in response to this event?

Respond in this exact JSON format:
{
  "shouldAct": true/false,
  "reasoning": "Brief explanation of your decision",
  "suggestedAction": "If shouldAct is true, describe the specific action to take"
}

IMPORTANT:
- Only act if the event clearly matches one of the instructions
- Don't act on every email - only if an instruction specifically applies
- Be conservative - when in doubt, don't act
- The suggestedAction should be specific and actionable`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You evaluate events against user instructions and decide whether to act. Respond only with valid JSON.' },
        { role: 'user', content: evaluationPrompt },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content || '';
    
    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[Proactive] Failed to parse evaluation response:', content);
      return {
        shouldAct: false,
        reasoning: 'Failed to evaluate - could not parse response',
      };
    }

    const result = JSON.parse(jsonMatch[0]) as {
      shouldAct: boolean;
      reasoning: string;
      suggestedAction?: string;
    };

    console.log(`[Proactive] Evaluation: shouldAct=${result.shouldAct}, reason="${result.reasoning}"`);

    return {
      shouldAct: result.shouldAct,
      reasoning: result.reasoning,
      suggestedAction: result.suggestedAction,
    };
  } catch (error) {
    console.error('[Proactive] Evaluation error:', error);
    return {
      shouldAct: false,
      reasoning: `Evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Execute a proactive action using the agent
 */
export async function executeProactiveAction(
  userId: string,
  event: ProactiveEvent,
  suggestedAction: string
): Promise<ProactiveResult> {
  const formattedEvent = formatEvent(event);
  const instructions = await getActiveInstructions(userId);
  const formattedInstructions = formatInstructionsForPrompt(instructions);

  // Build the action prompt
  const actionPrompt = `An event occurred and based on my instructions, I need to take action.

MY INSTRUCTIONS:
${formattedInstructions}

EVENT THAT OCCURRED:
${formattedEvent}

ACTION TO TAKE:
${suggestedAction}

Please execute this action now. Use the appropriate tools to complete it.`;

  const messages: AgentMessage[] = [
    { role: 'user', content: actionPrompt },
  ];

  try {
    const result = await runAgent(messages, { userId }, { maxIterations: 5 });

    console.log(`[Proactive] Action executed: ${result.toolCalls.length} tool(s) called`);

    return {
      shouldAct: true,
      reasoning: suggestedAction,
      executed: true,
      executionResult: result.response,
    };
  } catch (error) {
    console.error('[Proactive] Action execution error:', error);
    return {
      shouldAct: true,
      reasoning: suggestedAction,
      executed: false,
      executionResult: `Failed to execute: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Process an event: evaluate and optionally execute
 */
export async function processEvent(
  userId: string,
  event: ProactiveEvent,
  autoExecute: boolean = true
): Promise<ProactiveResult> {
  // Evaluate if we should act
  const evaluation = await evaluateEvent(userId, event);

  if (!evaluation.shouldAct || !evaluation.suggestedAction) {
    return evaluation;
  }

  // If auto-execute is enabled, execute the action
  if (autoExecute) {
    return await executeProactiveAction(userId, event, evaluation.suggestedAction);
  }

  return evaluation;
}

