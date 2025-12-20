import OpenAI from 'openai';
import { ChatCompletionMessageParam, ChatCompletionMessage } from 'openai/resources/chat/completions';
import { config } from '../config';
import { toolDefinitions, executeTool, ToolContext } from './tools';

const openai = new OpenAI({
  apiKey: config.OPENAI_API_KEY,
});

// System prompt for the agent
export const AGENT_SYSTEM_PROMPT = `You are an AI assistant for financial advisors. Your name is Advisor AI.

Your role is to help financial advisors:
- Manage client relationships and communications
- Draft and send emails to clients
- Schedule meetings and manage calendars  
- Track and update CRM data in HubSpot
- Answer questions about clients using available data
- Create and manage follow-up tasks
- Follow ongoing instructions automatically

You have access to tools that let you:
- Send and read emails via Gmail
- Check calendar availability and create events
- Search and create contacts in HubSpot CRM
- Add notes to client records
- Search through past emails and CRM data
- Create tasks for follow-up actions
- Add, list, and remove ongoing instructions

ONGOING INSTRUCTIONS:
Users can give you instructions to follow automatically. When they say things like:
- "Always reply to emails from @vip.com within 1 hour"
- "Notify me when a client mentions retirement"
- "Flag emails about quarterly reports"
- "Remember to follow up with leads that don't respond"

Use add_instruction to save these. You can list_instructions to show active ones, and remove_instruction to delete them.

These instructions are evaluated automatically whenever events happen (new emails, calendar events, etc.) - you don't need to manually check them.

Guidelines:
- Be professional, helpful, and concise
- When you need information, use the search_rag tool first
- Before sending emails or creating events, confirm details with the user unless they've explicitly approved
- For actions that can't be completed immediately (waiting for replies), use store_task
- Never make up client data - only use information from tool results
- If a tool fails, explain what happened and suggest alternatives
- When a user asks to "always" or "automatically" do something, use add_instruction

When the user asks you to do something:
1. Think about which tools you need
2. Execute tools as needed
3. Provide a clear summary of what was done

Always be proactive and helpful!`;

// Message types for the agent
export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: string;
  }>;
}

// Result from running the agent
export interface AgentResult {
  response: string;
  toolCalls: Array<{
    name: string;
    args: unknown;
    result: unknown;
  }>;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// Configuration for the agent run
export interface AgentConfig {
  maxIterations?: number;
  temperature?: number;
  maxTokens?: number;
}

// Convert our messages to OpenAI format
function toOpenAIMessages(messages: AgentMessage[]): ChatCompletionMessageParam[] {
  return messages.map((msg) => {
    if (msg.role === 'tool') {
      return {
        role: 'tool' as const,
        content: msg.content,
        tool_call_id: msg.toolCallId!,
      };
    }
    
    if (msg.role === 'assistant' && msg.toolCalls) {
      return {
        role: 'assistant' as const,
        content: msg.content || null,
        tool_calls: msg.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.name,
            arguments: tc.arguments,
          },
        })),
      };
    }
    
    return {
      role: msg.role,
      content: msg.content,
    };
  });
}

// Extract tool calls from assistant message
function extractToolCalls(message: ChatCompletionMessage) {
  if (!message.tool_calls) return null;
  
  return message.tool_calls.map((tc) => ({
    id: tc.id,
    name: tc.function.name,
    arguments: tc.function.arguments,
  }));
}

/**
 * Run the agent loop
 * 
 * 1. Send messages to LLM with tool definitions
 * 2. If tool call → execute tool
 * 3. Feed tool result back to LLM
 * 4. Repeat until done (no more tool calls)
 */
export async function runAgent(
  messages: AgentMessage[],
  context: ToolContext,
  config: AgentConfig = {}
): Promise<AgentResult> {
  const { maxIterations = 10, temperature = 0.7, maxTokens = 2000 } = config;
  
  // Ensure system prompt is first
  const conversationMessages: AgentMessage[] = [
    { role: 'system', content: AGENT_SYSTEM_PROMPT },
    ...messages.filter((m) => m.role !== 'system'),
  ];
  
  const executedToolCalls: Array<{
    name: string;
    args: unknown;
    result: unknown;
  }> = [];
  
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let iteration = 0;
  
  while (iteration < maxIterations) {
    iteration++;
    console.log(`[AGENT] Iteration ${iteration}/${maxIterations}`);
    
    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: toOpenAIMessages(conversationMessages),
      tools: toolDefinitions,
      tool_choice: 'auto',
      temperature,
      max_tokens: maxTokens,
    });
    
    // Track usage
    if (response.usage) {
      totalPromptTokens += response.usage.prompt_tokens;
      totalCompletionTokens += response.usage.completion_tokens;
    }
    
    const assistantMessage = response.choices[0].message;
    const toolCalls = extractToolCalls(assistantMessage);
    
    // Add assistant message to conversation
    conversationMessages.push({
      role: 'assistant',
      content: assistantMessage.content || '',
      toolCalls: toolCalls || undefined,
    });
    
    // If no tool calls, we're done
    if (!toolCalls || toolCalls.length === 0) {
      console.log('[AGENT] No more tool calls, returning response');
      return {
        response: assistantMessage.content || '',
        toolCalls: executedToolCalls,
        usage: {
          promptTokens: totalPromptTokens,
          completionTokens: totalCompletionTokens,
          totalTokens: totalPromptTokens + totalCompletionTokens,
        },
      };
    }
    
    // Execute each tool call
    console.log(`[AGENT] Executing ${toolCalls.length} tool call(s)`);
    
    for (const toolCall of toolCalls) {
      console.log(`[AGENT] Calling tool: ${toolCall.name}`);
      
      let args: unknown;
      try {
        args = JSON.parse(toolCall.arguments);
      } catch {
        args = {};
      }
      
      // Execute the tool
      const result = await executeTool(toolCall.name, args, context);
      
      // Track executed tool calls
      executedToolCalls.push({
        name: toolCall.name,
        args,
        result: result.data || result.error,
      });
      
      // Add tool result to conversation
      conversationMessages.push({
        role: 'tool',
        content: JSON.stringify(result),
        toolCallId: toolCall.id,
      });
    }
  }
  
  // Max iterations reached
  console.warn('[AGENT] Max iterations reached');
  const lastAssistantMessage = conversationMessages
    .filter((m) => m.role === 'assistant')
    .pop();
    
  return {
    response: lastAssistantMessage?.content || 'I apologize, but I was unable to complete the request. Please try again.',
    toolCalls: executedToolCalls,
    usage: {
      promptTokens: totalPromptTokens,
      completionTokens: totalCompletionTokens,
      totalTokens: totalPromptTokens + totalCompletionTokens,
    },
  };
}

/**
 * Run the agent with streaming (for real-time UI updates)
 * Yields intermediate results as they happen
 */
export async function* runAgentStream(
  messages: AgentMessage[],
  context: ToolContext,
  config: AgentConfig = {}
): AsyncGenerator<{
  type: 'thinking' | 'tool_call' | 'tool_result' | 'content' | 'done';
  data: unknown;
}> {
  const { maxIterations = 10, temperature = 0.7, maxTokens = 2000 } = config;
  
  const conversationMessages: AgentMessage[] = [
    { role: 'system', content: AGENT_SYSTEM_PROMPT },
    ...messages.filter((m) => m.role !== 'system'),
  ];
  
  const executedToolCalls: Array<{
    name: string;
    args: unknown;
    result: unknown;
  }> = [];
  
  let iteration = 0;
  
  while (iteration < maxIterations) {
    iteration++;
    yield { type: 'thinking', data: { iteration } };
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: toOpenAIMessages(conversationMessages),
      tools: toolDefinitions,
      tool_choice: 'auto',
      temperature,
      max_tokens: maxTokens,
    });
    
    const assistantMessage = response.choices[0].message;
    const toolCalls = extractToolCalls(assistantMessage);
    
    conversationMessages.push({
      role: 'assistant',
      content: assistantMessage.content || '',
      toolCalls: toolCalls || undefined,
    });
    
    // If no tool calls, stream the final content
    if (!toolCalls || toolCalls.length === 0) {
      if (assistantMessage.content) {
        yield { type: 'content', data: assistantMessage.content };
      }
      yield { type: 'done', data: { toolCalls: executedToolCalls } };
      return;
    }
    
    // Execute tool calls
    for (const toolCall of toolCalls) {
      let args: unknown;
      try {
        args = JSON.parse(toolCall.arguments);
      } catch {
        args = {};
      }
      
      yield { type: 'tool_call', data: { name: toolCall.name, args } };
      
      const result = await executeTool(toolCall.name, args, context);
      
      executedToolCalls.push({
        name: toolCall.name,
        args,
        result: result.data || result.error,
      });
      
      yield { type: 'tool_result', data: { name: toolCall.name, result } };
      
      conversationMessages.push({
        role: 'tool',
        content: JSON.stringify(result),
        toolCallId: toolCall.id,
      });
    }
  }
  
  yield { type: 'done', data: { toolCalls: executedToolCalls, maxIterationsReached: true } };
}

