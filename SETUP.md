# Setup Guide

## Prerequisites

1. **Node.js 18+**
   - Download from [nodejs.org](https://nodejs.org/)

2. **PostgreSQL 15+ with pgvector**
   - Windows: Use [PostgreSQL installer](https://www.postgresql.org/download/windows/)
   - After installation, enable pgvector:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

3. **Git**
   - Download from [git-scm.com](https://git-scm.com/)

## Installation Steps

### 1. Install Dependencies

```bash
# Install all dependencies (root + workspaces)
npm install
```

### 2. Set Up Environment Variables

Create `.env` file in root:
```bash
cp .env.example .env
```

Create `backend/.env`:
```bash
cp backend/.env.example backend/.env
```

Create `frontend/.env.local`:
```bash
cp frontend/.env.example frontend/.env.local
```

### 3. Configure Database

Edit `backend/.env` and update the DATABASE_URL:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/ai_advisor_agent?schema=public"
```

Replace `postgres:password` with your PostgreSQL credentials.

### 4. Create Database

```bash
# Create the database (run in psql or pgAdmin)
CREATE DATABASE ai_advisor_agent;

# Enable pgvector extension
\c ai_advisor_agent
CREATE EXTENSION IF NOT EXISTS vector;
```

### 5. Push Database Schema

```bash
cd backend
npm run db:push
```

This will create all tables in PostgreSQL.

### 6. Run Development Servers

```bash
# From root directory
npm run dev
```

This starts both:
- Backend: http://localhost:3001
- Frontend: http://localhost:3000

Or run individually:
```bash
# Backend only
npm run dev:backend

# Frontend only
npm run dev:frontend
```

## Verification

1. **Backend Health Check**
   - Visit: http://localhost:3001/health
   - Should return: `{"status":"ok","timestamp":"..."}`

2. **Frontend**
   - Visit: http://localhost:3000
   - Should see the homepage

3. **Database**
   ```bash
   cd backend
   npm run db:studio
   ```
   Opens Prisma Studio to view database

## Troubleshooting

### PostgreSQL Connection Issues

If you get connection errors:
1. Verify PostgreSQL is running
2. Check credentials in `.env`
3. Ensure database exists: `psql -l`

### Port Already in Use

If ports 3000 or 3001 are in use:
1. Edit `backend/.env` to change PORT
2. Update `frontend/.env.local` NEXT_PUBLIC_API_URL accordingly

### Module Not Found

If you see module errors:
```bash
# Clean install
rm -rf node_modules backend/node_modules frontend/node_modules
npm install
```

## Next Steps

After Milestone 0 is working:
- Milestone 1: Implement Google OAuth
- Milestone 2: Add AI agent with tool calling
- Milestone 3: Build async task flow
- Milestone 4: Implement RAG over emails/CRM
- Milestone 5: Add ongoing instructions

## Useful Commands

```bash
# Format all code
npm run format

# Lint all code
npm run lint

# Build for production
npm run build

# Database operations
cd backend
npm run db:push      # Push schema changes
npm run db:studio    # Open Prisma Studio
npm run db:generate  # Regenerate Prisma Client
```

