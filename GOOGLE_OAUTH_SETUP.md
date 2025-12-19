# Google OAuth Setup Guide

This guide walks you through setting up Google OAuth for the AI Advisor Agent.

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name it "AI Advisor Agent" (or similar)
4. Click "Create"

## Step 2: Enable APIs

1. Go to "APIs & Services" → "Library"
2. Search for and enable these APIs:
   - **Gmail API**
   - **Google Calendar API**
   - **Google+ API** (for user info)

## Step 3: Configure OAuth Consent Screen

1. Go to "APIs & Services" → "OAuth consent screen"
2. Select "External" (unless you have Google Workspace)
3. Fill in:
   - **App name**: AI Advisor Agent
   - **User support email**: Your email
   - **Developer contact email**: Your email
4. Click "Save and Continue"

### Add Scopes

1. Click "Add or Remove Scopes"
2. Add these scopes:
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/gmail.modify`
   - `https://www.googleapis.com/auth/calendar`
   - `https://www.googleapis.com/auth/calendar.events`
3. Click "Update" → "Save and Continue"

### Add Test Users

1. Click "Add Users"
2. Add: `webshookeng@gmail.com`
3. Add your own email for testing
4. Click "Save and Continue"

## Step 4: Create OAuth Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Select "Web application"
4. Configure:
   - **Name**: AI Advisor Agent Web Client
   - **Authorized JavaScript origins**:
     - `http://localhost:3000` (development)
     - `https://your-frontend.onrender.com` (production)
   - **Authorized redirect URIs**:
     - `http://localhost:3001/auth/google/callback` (development)
     - `https://your-backend.onrender.com/auth/google/callback` (production)
5. Click "Create"
6. Copy the **Client ID** and **Client Secret**

## Step 5: Configure Environment Variables

### Development (backend/.env)

```env
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3001/auth/google/callback
```

### Production

Update environment variables in Render with your production values.

## Step 6: Test the Flow

1. Start the development servers:
   ```bash
   npm run dev
   ```

2. Open http://localhost:3000

3. Click "Sign In"

4. You should see Google's OAuth consent screen with:
   - App name: AI Advisor Agent
   - Requested permissions: Gmail, Calendar

5. Sign in with a test user (webshookeng@gmail.com or your email)

6. You should be redirected to the dashboard

## Troubleshooting

### "Access Denied" Error

- Make sure your email is added as a test user
- App is in "Testing" mode, only test users can sign in

### "Invalid Redirect URI" Error

- Check GOOGLE_REDIRECT_URI matches exactly in:
  - Your .env file
  - Google Cloud Console credentials

### "Insufficient Scopes" Error

- Verify all scopes are added in OAuth consent screen
- Try revoking access at https://myaccount.google.com/permissions
- Sign in again

### No Refresh Token

- The `prompt: 'consent'` parameter forces Google to show consent screen
- This is required to get a refresh token
- If still missing, revoke app access and sign in again

## Publishing to Production

When ready for production:

1. Go to "OAuth consent screen"
2. Click "Publish App"
3. Complete the verification process (may take days/weeks)
4. This removes the test user limit

For MVP/testing, staying in "Testing" mode is fine.

## Security Notes

- Never commit OAuth credentials to git
- Use environment variables
- Rotate credentials if exposed
- Use separate credentials for dev/prod
- Store tokens encrypted in production database

## Scopes Reference

| Scope | Description |
|-------|-------------|
| `userinfo.email` | Read user's email address |
| `userinfo.profile` | Read user's profile info |
| `gmail.readonly` | Read email messages |
| `gmail.send` | Send emails |
| `gmail.modify` | Modify (archive, label) emails |
| `calendar` | Full calendar access |
| `calendar.events` | Create/modify calendar events |

