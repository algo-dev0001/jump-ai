import OpenAI from 'openai';
import { config } from '../config';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: config.OPENAI_API_KEY,
});

// System prompt defining the AI agent's role
export const SYSTEM_PROMPT = `You are an AI assistant for financial advisors. Your name is Advisor AI.

Your role is to help financial advisors:
- Manage client relationships and communications
- Draft and review emails to clients
- Schedule meetings and manage calendars
- Track and update CRM data
- Answer questions about clients based on available data
- Provide helpful suggestions for client outreach

Guidelines:
- Be professional, helpful, and concise
- When you don't have enough information, ask clarifying questions
- Never make up client data - only reference information you've been given
- Respect client confidentiality
- If asked to perform an action (send email, schedule meeting, etc.), confirm the details before proceeding

You currently have access to:
- Conversation history with the advisor
- (More capabilities will be added: Gmail, Calendar, HubSpot CRM)

Always be helpful and proactive in assisting the financial advisor with their work.`;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Generate a chat completion
export async function generateChatResponse(
  messages: ChatMessage[],
  options?: {
    maxTokens?: number;
    temperature?: number;
  }
): Promise<string> {
  const { maxTokens = 1000, temperature = 0.7 } = options || {};

  // Prepend system prompt if not already present
  const messagesWithSystem: ChatMessage[] = 
    messages[0]?.role === 'system' 
      ? messages 
      : [{ role: 'system', content: SYSTEM_PROMPT }, ...messages];

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: messagesWithSystem,
    max_tokens: maxTokens,
    temperature,
  });

  const content = response.choices[0]?.message?.content;
  
  if (!content) {
    throw new Error('No response content from OpenAI');
  }

  return content;
}

// Generate a streaming chat completion
export async function* generateChatResponseStream(
  messages: ChatMessage[],
  options?: {
    maxTokens?: number;
    temperature?: number;
  }
): AsyncGenerator<string> {
  const { maxTokens = 1000, temperature = 0.7 } = options || {};

  const messagesWithSystem: ChatMessage[] = 
    messages[0]?.role === 'system' 
      ? messages 
      : [{ role: 'system', content: SYSTEM_PROMPT }, ...messages];

  const stream = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: messagesWithSystem,
    max_tokens: maxTokens,
    temperature,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}

