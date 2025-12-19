# Quick Start Guide

Get the AI Advisor Agent running in 5 minutes.

## Prerequisites

- Node.js 18+ installed
- PostgreSQL 15+ installed and running
- Git installed

## Step 1: Clone & Install

```bash
# Install dependencies
npm install
```

## Step 2: Database Setup

```bash
# Create database
psql -U postgres
CREATE DATABASE ai_advisor_agent;
\c ai_advisor_agent
CREATE EXTENSION IF NOT EXISTS vector;
\q
```

## Step 3: Environment Variables

Create `backend/.env`:

```env
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/ai_advisor_agent?schema=public"
PORT=3001
NODE_ENV=development
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Step 4: Push Database Schema

```bash
cd backend
npm run db:push
cd ..
```

## Step 5: Run

```bash
npm run dev
```

This starts:
- Backend: http://localhost:3001
- Frontend: http://localhost:3000

## Verify It Works

1. **Backend**: Visit http://localhost:3001/health
   - Should return: `{"status":"ok","timestamp":"..."}`

2. **Frontend**: Visit http://localhost:3000
   - Should see the homepage

3. **Database**: 
   ```bash
   cd backend
   npm run db:studio
   ```
   - Opens Prisma Studio at http://localhost:5555

## What's Next?

You've completed **Milestone 0: Repo & Base Setup** ✓

Next up:
- **Milestone 1**: Add Google OAuth + HubSpot OAuth
- **Milestone 2**: Build AI agent with tool calling
- **Milestone 3**: Implement async meeting scheduling
- **Milestone 4**: Add RAG over emails and CRM
- **Milestone 5**: Add ongoing instructions

## Troubleshooting

### "Cannot connect to database"
- Check PostgreSQL is running: `pg_isready`
- Verify credentials in `backend/.env`

### "Port 3000 already in use"
- Kill the process: `npx kill-port 3000`
- Or change port in `frontend/package.json`

### "Module not found"
- Clean install: `rm -rf node_modules && npm install`

## Project Structure

```
/backend          Express API + Prisma + PostgreSQL
/frontend         Next.js + React + Tailwind CSS
package.json      Root workspace config
```

## Useful Commands

```bash
# Development
npm run dev              # Run both frontend & backend
npm run dev:backend      # Backend only
npm run dev:frontend     # Frontend only

# Code Quality
npm run lint             # Lint all code
npm run format           # Format with Prettier

# Database
cd backend
npm run db:push          # Push schema changes
npm run db:studio        # Open Prisma Studio
npm run db:generate      # Regenerate Prisma Client

# Production
npm run build            # Build both apps
```

## Need Help?

- Check `SETUP.md` for detailed setup instructions
- Check `ARCHITECTURE.md` for system design
- Check `DEPLOYMENT.md` for Render deployment

