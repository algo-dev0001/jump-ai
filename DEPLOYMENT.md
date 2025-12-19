# Deployment Guide (Render)

This guide covers deploying the AI Advisor Agent to Render.

## Prerequisites

1. [Render account](https://render.com/) (free tier available)
2. GitHub repository with your code
3. OAuth credentials (Google, HubSpot)
4. OpenAI API key

## Before Deploying

### 1. Enable pgvector in Render Database

After creating the database in Render, you'll need to enable pgvector:

1. Go to your Render database dashboard
2. Click "Connect" and copy the External Database URL
3. Use a PostgreSQL client to connect:
   ```bash
   psql "your-external-database-url"
   ```
4. Enable the extension:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

## Deployment Options

### Option 1: Using render.yaml (Recommended)

1. Push your code to GitHub
2. In Render Dashboard, click "New +" → "Blueprint"
3. Connect your GitHub repository
4. Render will detect `render.yaml` and create all services
5. Set the environment variables marked as `sync: false`:
   - `OPENAI_API_KEY`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI`
   - `HUBSPOT_CLIENT_ID`
   - `HUBSPOT_CLIENT_SECRET`
   - `HUBSPOT_REDIRECT_URI`

### Option 2: Manual Setup

#### Database

1. New + → PostgreSQL
2. Name: `ai-advisor-db`
3. Database: `ai_advisor_agent`
4. Region: Choose closest to you
5. Plan: Starter (free)
6. Click "Create Database"
7. Enable pgvector (see above)

#### Backend

1. New + → Web Service
2. Connect your repository
3. Configure:
   - Name: `ai-advisor-backend`
   - Root Directory: (leave empty)
   - Environment: Node
   - Region: Same as database
   - Branch: main
   - Build Command: `cd backend && npm install && npm run db:generate && npm run build`
   - Start Command: `cd backend && npm start`
4. Add Environment Variables:
   - `NODE_ENV` = `production`
   - `PORT` = `3001`
   - `DATABASE_URL` = (from database, use Internal URL)
   - `OPENAI_API_KEY` = your key
   - `GOOGLE_CLIENT_ID` = your client ID
   - `GOOGLE_CLIENT_SECRET` = your secret
   - `GOOGLE_REDIRECT_URI` = `https://your-backend-url.onrender.com/auth/google/callback`
   - `HUBSPOT_CLIENT_ID` = your client ID
   - `HUBSPOT_CLIENT_SECRET` = your secret
   - `HUBSPOT_REDIRECT_URI` = `https://your-backend-url.onrender.com/auth/hubspot/callback`
   - `SESSION_SECRET` = (generate random string)
   - `JWT_SECRET` = (generate random string)
5. Click "Create Web Service"

#### Frontend

1. New + → Web Service
2. Connect your repository
3. Configure:
   - Name: `ai-advisor-frontend`
   - Root Directory: (leave empty)
   - Environment: Node
   - Region: Same as backend
   - Branch: main
   - Build Command: `cd frontend && npm install && npm run build`
   - Start Command: `cd frontend && npm start`
4. Add Environment Variables:
   - `NODE_ENV` = `production`
   - `NEXT_PUBLIC_API_URL` = `https://your-backend-url.onrender.com`
5. Click "Create Web Service"

## Post-Deployment

### 1. Update OAuth Redirect URIs

In Google Cloud Console and HubSpot:
- Update redirect URIs to use your production backend URL
- Example: `https://ai-advisor-backend.onrender.com/auth/google/callback`

### 2. Verify Deployment

1. Check backend health:
   ```bash
   curl https://your-backend-url.onrender.com/health
   ```

2. Visit frontend:
   ```
   https://your-frontend-url.onrender.com
   ```

### 3. Run Database Migrations

Database schema should be automatically pushed during build.
If needed, you can manually push:

```bash
# Using Render Shell
cd backend
npx prisma db push
```

## Monitoring

1. Render Dashboard shows:
   - Service logs
   - Metrics
   - Errors

2. Database Dashboard shows:
   - Connections
   - Query performance
   - Storage usage

## Troubleshooting

### Build Failures

Check build logs in Render dashboard. Common issues:
- Missing dependencies: Check package.json
- Environment variables: Ensure all required vars are set

### Database Connection Issues

- Verify DATABASE_URL is set correctly (use Internal URL for Render services)
- Check pgvector extension is enabled
- Verify database is in same region as backend

### Frontend Can't Connect to Backend

- Verify NEXT_PUBLIC_API_URL is set correctly
- Check CORS settings in backend
- Ensure backend is deployed and running

## Cost Considerations

Free tier includes:
- Database: 256MB storage
- Web Services: 750 hours/month (2 services = ~15 days each)
- Services sleep after 15 min inactivity

For production:
- Upgrade to paid plan ($7/month for web service)
- Prevents sleeping
- More resources

## Security Checklist

- [ ] All secrets use environment variables
- [ ] No `.env` files in repository
- [ ] OAuth redirect URIs are production URLs
- [ ] Database uses internal URL from backend
- [ ] SESSION_SECRET and JWT_SECRET are strong random strings
- [ ] CORS is configured to allow only your frontend

