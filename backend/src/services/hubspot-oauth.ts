import { config } from '../config';

// HubSpot OAuth scopes
export const HUBSPOT_SCOPES = [
  'crm.objects.contacts.read',
  'crm.objects.contacts.write',
  'crm.objects.companies.read',
  'crm.objects.deals.read',
  'crm.schemas.contacts.read',
  'oauth',
];

// HubSpot OAuth URLs
const HUBSPOT_AUTH_URL = 'https://app.hubspot.com/oauth/authorize';
const HUBSPOT_TOKEN_URL = 'https://api.hubapi.com/oauth/v1/token';

// Generate HubSpot authorization URL
export function getHubSpotAuthUrl(state?: string): string {
  const params = new URLSearchParams({
    client_id: config.HUBSPOT_CLIENT_ID!,
    redirect_uri: config.HUBSPOT_REDIRECT_URI!,
    scope: HUBSPOT_SCOPES.join(' '),
    ...(state && { state }),
  });

  return `${HUBSPOT_AUTH_URL}?${params.toString()}`;
}

// Exchange authorization code for tokens
export async function getHubSpotTokens(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const response = await fetch(HUBSPOT_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.HUBSPOT_CLIENT_ID!,
      client_secret: config.HUBSPOT_CLIENT_SECRET!,
      redirect_uri: config.HUBSPOT_REDIRECT_URI!,
      code,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[HubSpot] Token exchange error:', error);
    throw new Error('Failed to exchange HubSpot authorization code');
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

// Refresh HubSpot access token
export async function refreshHubSpotToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const response = await fetch(HUBSPOT_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.HUBSPOT_CLIENT_ID!,
      client_secret: config.HUBSPOT_CLIENT_SECRET!,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[HubSpot] Token refresh error:', error);
    throw new Error('Failed to refresh HubSpot token');
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

// Get token info (to check validity)
export async function getHubSpotTokenInfo(accessToken: string): Promise<{
  user: string;
  hubId: number;
  appId: number;
  expiresIn: number;
} | null> {
  try {
    const response = await fetch(
      `https://api.hubapi.com/oauth/v1/access-tokens/${accessToken}`
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return {
      user: data.user,
      hubId: data.hub_id,
      appId: data.app_id,
      expiresIn: data.expires_in,
    };
  } catch {
    return null;
  }
}

