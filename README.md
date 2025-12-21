# AI Advisor Agent

A production-ready AI agent web app for Financial Advisors. Connects Gmail, Google Calendar, and HubSpot CRM with an intelligent assistant that can send emails, schedule meetings, manage contacts, and follow ongoing instructions automatically.

![Demo](https://img.shields.io/badge/Status-Demo%20Ready-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)
![Next.js](https://img.shields.io/badge/Next.js-14-black)

## ✨ Features

### Core Capabilities
- **🤖 AI Agent** - GPT-4o-mini powered assistant with tool calling
- **📧 Gmail Integration** - Send, read, and search emails
- **📅 Calendar** - Find availability and schedule meetings
- **👥 HubSpot CRM** - Search contacts, create notes
- **🔍 RAG Search** - Vector search across emails and CRM data
- **📋 Ongoing Instructions** - Set rules the agent follows automatically
- **⏳ Async Tasks** - Long-running workflows that resume on events

### Demo Scenarios
1. "Send an email to john@example.com about our meeting"
2. "Find available time slots next week"
3. "Search for clients who mentioned retirement"
4. "Schedule a meeting with Sarah Jones"
5. "Always notify me when VIP clients email"

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ with pgvector extension
- Google Cloud Console project (for OAuth)
- OpenAI API key
- HubSpot developer account (optional)

### 1. Clone and Install

```bash
git clone <repository-url>
cd Jump

# Install all dependencies
npm install
```

### 2. Database Setup

```bash
# Create PostgreSQL database with pgvector
psql -U postgres -c "CREATE DATABASE advisor_agent;"
psql -U postgres -d advisor_agent -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 3. Environment Variables

Create `backend/.env`:

```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/advisor_agent"

# Server
PORT=3001
FRONTEND_URL=http://localhost:3000
JWT_SECRET=your-secure-jwt-secret-here

# OpenAI
OPENAI_API_KEY=sk-your-openai-key

# Google OAuth (see GOOGLE_OAUTH_SETUP.md)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/auth/google/callback

# HubSpot OAuth (optional, see HUBSPOT_SETUP.md)
HUBSPOT_CLIENT_ID=your-hubspot-client-id
HUBSPOT_CLIENT_SECRET=your-hubspot-client-secret
HUBSPOT_REDIRECT_URI=http://localhost:3001/auth/hubspot/callback
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 4. Initialize Database

```bash
cd backend
npm run db:push
npm run db:generate
```

### 5. Start Development Servers

```bash
# From project root
npm run dev
```

This starts:
- Backend: http://localhost:3001
- Frontend: http://localhost:3000

### 6. Seed Demo Data (Optional)

```bash
cd backend
npm run db:seed
```

## 🔧 Configuration

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Gmail API and Google Calendar API
4. Configure OAuth consent screen
5. Create OAuth 2.0 credentials
6. Add authorized redirect URI: `http://localhost:3001/auth/google/callback`

See [GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md) for detailed instructions.

### HubSpot OAuth Setup

1. Go to [HubSpot Developer Portal](https://developers.hubspot.com/)
2. Create a new app
3. Configure OAuth scopes: `crm.objects.contacts.read`, `crm.objects.contacts.write`
4. Add redirect URL: `http://localhost:3001/auth/hubspot/callback`

See [HUBSPOT_SETUP.md](./HUBSPOT_SETUP.md) for detailed instructions.

## 📁 Project Structure

```
Jump/
├── backend/                 # Express + TypeScript API
│   ├── src/
│   │   ├── agent/          # AI agent loop and tools
│   │   │   ├── loop.ts     # Core agent execution
│   │   │   ├── proactive.ts # Event-driven actions
│   │   │   └── tools/      # Tool definitions & executor
│   │   ├── jobs/           # Background jobs (email polling)
│   │   ├── lib/            # Utilities (logger)
│   │   ├── middleware/     # Auth middleware
│   │   ├── routes/         # API routes
│   │   ├── services/       # External API integrations
│   │   └── workflows/      # Multi-step workflows
│   ├── prisma/
│   │   └── schema.prisma   # Database schema
│   └── scripts/
│       └── seed-demo.ts    # Demo data seeder
├── frontend/               # Next.js 14 + React
│   ├── src/
│   │   ├── app/           # App router pages
│   │   ├── components/    # React components
│   │   └── lib/           # API client & auth
│   └── tailwind.config.ts
└── package.json           # Monorepo scripts
```

## 🛠 Available Tools

The AI agent has access to these tools:

| Tool | Description |
|------|-------------|
| `send_email` | Send an email via Gmail |
| `read_emails` | Read recent emails from inbox |
| `find_calendar_availability` | Find free time slots |
| `create_calendar_event` | Schedule a meeting |
| `list_calendar_events` | View upcoming events |
| `find_hubspot_contact` | Search CRM contacts |
| `create_hubspot_contact` | Add new contact |
| `create_hubspot_note` | Add note to contact |
| `search_rag` | Vector search emails/CRM |
| `store_task` | Create async task |
| `update_task` | Update task status |
| `add_instruction` | Add ongoing rule |
| `list_instructions` | View active rules |
| `remove_instruction` | Delete a rule |

## 🔄 How It Works

### Agent Loop
1. User sends message
2. Agent receives message with tool definitions
3. LLM decides which tools to call
4. Tools execute and return results
5. LLM processes results and responds
6. Repeat until no more tool calls needed

### Ongoing Instructions
1. User says "Always reply to VIP clients quickly"
2. Agent stores instruction in database
3. Email poller detects new email
4. Proactive agent evaluates: "Should I act?"
5. If yes, executes appropriate action

### Async Workflows
1. User: "Schedule meeting with John"
2. Agent sends availability email, creates task
3. Task status: `waiting_reply`
4. Email poller detects John's reply
5. Workflow resumes, creates calendar event

## 🚢 Deployment

### Render.com

1. Create Web Services for backend and frontend
2. Create PostgreSQL database with pgvector
3. Configure environment variables
4. Deploy from GitHub

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

### Health Check

```bash
curl https://your-backend.onrender.com/health
# {"status":"ok","timestamp":"..."}
```

## 📊 API Endpoints

### Authentication
- `GET /auth/google` - Start Google OAuth flow
- `GET /auth/google/callback` - OAuth callback
- `GET /auth/hubspot` - Start HubSpot OAuth
- `GET /auth/me` - Get current user
- `POST /auth/logout` - Logout

### Chat
- `GET /chat/history` - Get message history
- `POST /chat` - Send message (supports streaming)
- `DELETE /chat/history` - Clear history

### Instructions
- `GET /instructions` - List instructions
- `POST /instructions` - Add instruction
- `PATCH /instructions/:id/deactivate` - Pause
- `DELETE /instructions/:id` - Delete

### RAG
- `GET /rag/stats` - Index statistics
- `POST /rag/index` - Manual reindex

## 🧪 Testing

```bash
# Run linting
npm run lint

# Type checking
npm run build
```

## 📝 License

MIT

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open pull request
