# AI Advisor Agent

Production-ready AI agent web app for Financial Advisors.

## Features

- Google OAuth (Gmail + Calendar access)
- HubSpot CRM integration
- ChatGPT-like interface with tool calling
- RAG over emails and CRM data
- Async task management
- Proactive agent capabilities

## Tech Stack

- **Backend**: Node.js + Express + TypeScript + Prisma
- **Frontend**: Next.js + React + TypeScript
- **Database**: PostgreSQL + pgvector
- **LLM**: OpenAI GPT-4
- **Deployment**: Render

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 15+ with pgvector extension
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Set up database
cd backend
npm run db:push

# Run development servers
cd ..
npm run dev
```

### Development

```bash
# Run both backend and frontend
npm run dev

# Run individually
npm run dev:backend
npm run dev:frontend

# Lint
npm run lint

# Format
npm run format
```

## Project Structure

```
/backend      - Express API + Prisma
/frontend     - Next.js App Router
```

## Milestones

- [x] Milestone 0: Repo & Base Setup
- [ ] Milestone 1: OAuth & Auth
- [ ] Milestone 2: Agent & Tool Calling
- [ ] Milestone 3: Async Task Flow
- [ ] Milestone 4: RAG Implementation
- [ ] Milestone 5: Ongoing Instructions

## License

MIT

