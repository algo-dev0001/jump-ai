# Architecture Overview

## System Design

This is a **single-agent** AI system with tool calling capabilities, designed for Financial Advisors.

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│  Next.js + React + TypeScript + Tailwind CSS                │
│  - Chat Interface                                            │
│  - OAuth Flow UI                                             │
│  - Dashboard                                                 │
└──────────────────────┬──────────────────────────────────────┘
                       │ REST API
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                         Backend                              │
│  Node.js + Express + TypeScript + Prisma                    │
│  ┌────────────────────────────────────────────────────┐    │
│  │              AI Agent (OpenAI GPT-4)               │    │
│  │  - Tool Calling (not hardcoded logic)             │    │
│  │  - RAG over emails & CRM data                      │    │
│  │  - Task memory & resumption                        │    │
│  │  - Ongoing instructions                            │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │                    Tools                           │    │
│  │  - send_email (Gmail API)                          │    │
│  │  - schedule_meeting (Google Calendar API)          │    │
│  │  - update_crm (HubSpot API)                        │    │
│  │  - search_emails (RAG + pgvector)                  │    │
│  │  - search_contacts (RAG + pgvector)                │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │              OAuth Management                      │    │
│  │  - Google OAuth (Gmail + Calendar)                 │    │
│  │  - HubSpot OAuth (CRM)                             │    │
│  │  - Token refresh                                   │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │              Background Jobs                       │    │
│  │  - Poll for new emails                             │    │
│  │  - Poll for calendar events                        │    │
│  │  - Poll for CRM updates                            │    │
│  │  - Resume pending tasks                            │    │
│  └────────────────────────────────────────────────────┘    │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    PostgreSQL + pgvector                     │
│  - Users & OAuth tokens                                      │
│  - Chat messages                                             │
│  - Tasks (async, resumable)                                  │
│  - Instructions (ongoing)                                    │
│  - Embeddings (emails, contacts, CRM data)                   │
└──────────────────────────────────────────────────────────────┘
```

## Core Principles

### 1. Single Agent
- ONE AI agent handles everything
- No multiple specialized agents
- Agent uses tools to accomplish tasks

### 2. Tool Calling
- Agent decides which tools to use
- No hardcoded if/else logic
- Tools are functions the agent can invoke

### 3. Memory & Context
- Chat history stored in database
- Tasks can be paused and resumed
- Ongoing instructions persist across sessions

### 4. Proactive Behavior
- Polls for new events (emails, calendar, CRM)
- Agent can initiate actions based on events
- Resumes tasks when conditions are met

### 5. RAG (Retrieval Augmented Generation)
- Embeddings stored in pgvector
- Semantic search over emails and CRM data
- Agent retrieves relevant context before answering

## Data Models

### User
- OAuth tokens (Google, HubSpot)
- Token expiry & refresh

### Message
- Chat history
- Role: user | assistant | system

### Task
- Type: meeting_scheduling, email_followup, etc.
- Status: pending, in_progress, completed, failed
- Data: JSON with task-specific info

### Instruction
- Ongoing user instructions
- Active/inactive flag
- Always included in agent context

### Embedding
- Source: gmail, hubspot
- Content: email body, contact info, etc.
- Vector: pgvector embedding
- Metadata: JSON with source-specific data

## Agent Flow

### Chat Request
```
1. User sends message
2. Backend retrieves:
   - Recent chat history
   - Active instructions
   - Relevant embeddings (RAG)
3. Backend calls OpenAI with:
   - System prompt
   - Context (history + instructions + RAG results)
   - Available tools
4. Agent responds with:
   - Text response, OR
   - Tool calls
5. If tool calls:
   - Execute tools
   - Send results back to agent
   - Agent generates final response
6. Store message in database
7. Return to frontend
```

### Async Task Flow (Example: Meeting Scheduling)
```
1. User: "Schedule a meeting with John next week"
2. Agent calls: search_contacts("John")
3. Agent calls: check_calendar(next_week)
4. Agent calls: send_email(john, "meeting request")
5. Task created: type=meeting_scheduling, status=pending
6. Background job polls for John's reply
7. When reply arrives:
   - Job resumes task
   - Agent reads reply
   - Agent calls: schedule_meeting(time, attendees)
   - Task status=completed
8. Agent notifies user
```

## Technology Choices

### Why Prisma?
- Type-safe database access
- Easy migrations
- Works well with TypeScript

### Why pgvector?
- Native PostgreSQL extension
- Fast similarity search
- No separate vector database needed

### Why Polling over Webhooks?
- Simpler to implement
- No webhook endpoint security
- Easier to debug
- Good enough for MVP

### Why OpenAI?
- Best tool calling support
- Reliable function calling
- Good documentation

## Security

### OAuth Tokens
- Stored encrypted in database
- Refreshed automatically
- Never exposed to frontend

### API Keys
- Environment variables only
- Never in code or logs
- Separate for dev/prod

### Sessions
- JWT tokens
- HTTP-only cookies
- Secure in production

## Scalability Considerations

### Current (MVP)
- Single server
- Polling every 60 seconds
- Synchronous tool execution

### Future
- Queue for background jobs (Bull, BullMQ)
- Webhooks for real-time updates
- Caching layer (Redis)
- Horizontal scaling with load balancer
- Separate worker processes

## File Structure

```
/backend
  /prisma
    schema.prisma          # Database schema
  /src
    /routes
      /auth               # OAuth flows
      /chat               # Chat endpoints
      /tasks              # Task management
    /services
      /agent              # AI agent logic
      /tools              # Tool implementations
      /oauth              # OAuth token management
      /embeddings         # RAG & vector search
      /jobs               # Background polling
    /middleware           # Auth, error handling
    config.ts             # Environment config
    index.ts              # Server entry

/frontend
  /src
    /app
      /login              # Auth UI
      /dashboard          # Main app
      /chat               # Chat interface
    /components           # Reusable components
    /lib
      api.ts              # API client
```

## Next Milestones

1. **Milestone 1**: OAuth (Google + HubSpot)
2. **Milestone 2**: Agent + Tool Calling
3. **Milestone 3**: Async Task Flow (meeting scheduling)
4. **Milestone 4**: RAG (embeddings + search)
5. **Milestone 5**: Ongoing Instructions

