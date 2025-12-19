# HubSpot OAuth Setup Guide

This guide walks you through setting up HubSpot OAuth for the AI Advisor Agent.

## Step 1: Create a HubSpot Developer Account

1. Go to [HubSpot Developer Portal](https://developers.hubspot.com/)
2. Click "Create a developer account" (or sign in if you have one)
3. Complete the registration

## Step 2: Create a HubSpot App

1. In the Developer Portal, go to "Apps"
2. Click "Create app"
3. Fill in:
   - **App name**: AI Advisor Agent
   - **Description**: AI assistant for financial advisors

## Step 3: Configure OAuth

1. In your app settings, go to "Auth"
2. Under "OAuth", configure:

### Redirect URLs

Add these redirect URLs:
- `http://localhost:3001/auth/hubspot/callback` (development)
- `https://your-backend.onrender.com/auth/hubspot/callback` (production)

### Scopes

Select these scopes:
- `crm.objects.contacts.read` - Read contacts
- `crm.objects.contacts.write` - Create/update contacts
- `crm.objects.companies.read` - Read companies (for contact company info)
- `crm.objects.deals.read` - Read deals (for future use)
- `crm.schemas.contacts.read` - Read contact properties
- `oauth` - Basic OAuth

## Step 4: Get Credentials

In the "Auth" tab, you'll find:
- **Client ID**: Copy this
- **Client Secret**: Copy this (click "Show" first)

## Step 5: Configure Environment Variables

Add to `backend/.env`:

```env
HUBSPOT_CLIENT_ID=your-client-id
HUBSPOT_CLIENT_SECRET=your-client-secret
HUBSPOT_REDIRECT_URI=http://localhost:3001/auth/hubspot/callback
```

## Step 6: Test the Integration

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Login with Google at http://localhost:3000

3. On the dashboard, click "Connect" next to HubSpot

4. You'll be redirected to HubSpot to authorize the app

5. After authorization, you'll be redirected back to the dashboard

## Using HubSpot in Chat

Once connected, try these prompts:
- "Search for John in my CRM"
- "Find contacts at Acme Corp"
- "Create a contact for jane@example.com"
- "Add a note to john@example.com's record"

## Troubleshooting

### "HubSpot integration not configured"

- Check that `HUBSPOT_CLIENT_ID` and `HUBSPOT_CLIENT_SECRET` are set
- Restart the backend server after adding env vars

### "Invalid redirect URI"

- Make sure the redirect URI in your HubSpot app matches exactly:
  - `http://localhost:3001/auth/hubspot/callback` (dev)
  - Include the `/auth/hubspot/callback` path

### "Insufficient scopes"

- Go to your HubSpot app settings
- Add any missing scopes
- Users may need to reconnect to get new scopes

### "Contact not found"

- The contact must exist in HubSpot before adding notes
- Use `create_hubspot_contact` first if needed

## HubSpot API Limits

Free HubSpot accounts have API limits:
- 100 requests per 10 seconds
- 250,000 requests per day

The app handles rate limiting gracefully.

## Security Notes

- Never commit HubSpot credentials to git
- Use environment variables
- Rotate secrets if exposed
- Use separate credentials for dev/prod

## Scopes Reference

| Scope | Description |
|-------|-------------|
| `crm.objects.contacts.read` | Read contact records |
| `crm.objects.contacts.write` | Create/update contacts |
| `crm.objects.companies.read` | Read company info |
| `crm.objects.deals.read` | Read deals |
| `crm.schemas.contacts.read` | Read contact properties |
| `oauth` | Basic OAuth operations |

