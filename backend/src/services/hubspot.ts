import { PrismaClient } from '@prisma/client';
import { refreshHubSpotToken } from './hubspot-oauth';

const prisma = new PrismaClient();
const HUBSPOT_API_URL = 'https://api.hubapi.com';

// Normalized contact format
export interface HubSpotContact {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Normalized note format
export interface HubSpotNote {
  id: string;
  contactId: string;
  content: string;
  createdAt: Date;
}

// Get valid HubSpot tokens for a user
async function getValidTokens(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      hubspotAccessToken: true,
      hubspotRefreshToken: true,
      hubspotTokenExpiry: true,
    },
  });

  if (!user?.hubspotAccessToken || !user?.hubspotRefreshToken) {
    return null;
  }

  // Check if token is expired (with 5-minute buffer)
  const now = new Date();
  const expiry = user.hubspotTokenExpiry;
  const bufferMs = 5 * 60 * 1000;

  if (expiry && now.getTime() > expiry.getTime() - bufferMs) {
    try {
      // Refresh the token
      const newTokens = await refreshHubSpotToken(user.hubspotRefreshToken);
      
      // Update in database
      await prisma.user.update({
        where: { id: userId },
        data: {
          hubspotAccessToken: newTokens.accessToken,
          hubspotRefreshToken: newTokens.refreshToken,
          hubspotTokenExpiry: new Date(Date.now() + newTokens.expiresIn * 1000),
        },
      });

      return newTokens.accessToken;
    } catch (error) {
      console.error('[HubSpot] Token refresh failed:', error);
      return null;
    }
  }

  return user.hubspotAccessToken;
}

// Make authenticated HubSpot API request
async function hubspotRequest<T>(
  userId: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<T | null> {
  const accessToken = await getValidTokens(userId);
  if (!accessToken) {
    console.error('[HubSpot] No valid access token for user:', userId);
    return null;
  }

  const response = await fetch(`${HUBSPOT_API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`[HubSpot] API error (${response.status}):`, error);
    throw new Error(`HubSpot API error: ${response.status}`);
  }

  return response.json();
}

// Normalize HubSpot contact response
function normalizeContact(contact: Record<string, unknown>): HubSpotContact {
  const props = contact.properties as Record<string, string>;
  return {
    id: contact.id as string,
    email: props?.email || '',
    firstName: props?.firstname,
    lastName: props?.lastname,
    phone: props?.phone,
    company: props?.company,
    jobTitle: props?.jobtitle,
    createdAt: new Date(props?.createdate || Date.now()),
    updatedAt: new Date(props?.lastmodifieddate || Date.now()),
  };
}

/**
 * Search for contacts
 */
export async function searchContacts(
  userId: string,
  query: string,
  limit: number = 10
): Promise<HubSpotContact[]> {
  try {
    const response = await hubspotRequest<{
      results: Array<Record<string, unknown>>;
    }>(userId, '/crm/v3/objects/contacts/search', {
      method: 'POST',
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [
              { propertyName: 'email', operator: 'CONTAINS_TOKEN', value: query },
            ],
          },
          {
            filters: [
              { propertyName: 'firstname', operator: 'CONTAINS_TOKEN', value: query },
            ],
          },
          {
            filters: [
              { propertyName: 'lastname', operator: 'CONTAINS_TOKEN', value: query },
            ],
          },
          {
            filters: [
              { propertyName: 'company', operator: 'CONTAINS_TOKEN', value: query },
            ],
          },
        ],
        properties: ['email', 'firstname', 'lastname', 'phone', 'company', 'jobtitle', 'createdate', 'lastmodifieddate'],
        limit,
      }),
    });

    if (!response?.results) {
      return [];
    }

    return response.results.map(normalizeContact);
  } catch (error) {
    console.error('[HubSpot] Search contacts error:', error);
    return [];
  }
}

/**
 * Get a contact by ID
 */
export async function getContact(
  userId: string,
  contactId: string
): Promise<HubSpotContact | null> {
  try {
    const response = await hubspotRequest<Record<string, unknown>>(
      userId,
      `/crm/v3/objects/contacts/${contactId}?properties=email,firstname,lastname,phone,company,jobtitle,createdate,lastmodifieddate`
    );

    if (!response) {
      return null;
    }

    return normalizeContact(response);
  } catch (error) {
    console.error('[HubSpot] Get contact error:', error);
    return null;
  }
}

/**
 * Get a contact by email
 */
export async function getContactByEmail(
  userId: string,
  email: string
): Promise<HubSpotContact | null> {
  try {
    const response = await hubspotRequest<{
      results: Array<Record<string, unknown>>;
    }>(userId, '/crm/v3/objects/contacts/search', {
      method: 'POST',
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [
              { propertyName: 'email', operator: 'EQ', value: email },
            ],
          },
        ],
        properties: ['email', 'firstname', 'lastname', 'phone', 'company', 'jobtitle', 'createdate', 'lastmodifieddate'],
        limit: 1,
      }),
    });

    if (!response?.results?.length) {
      return null;
    }

    return normalizeContact(response.results[0]);
  } catch (error) {
    console.error('[HubSpot] Get contact by email error:', error);
    return null;
  }
}

/**
 * Create a new contact
 */
export async function createContact(
  userId: string,
  data: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    company?: string;
  }
): Promise<HubSpotContact | null> {
  try {
    const response = await hubspotRequest<Record<string, unknown>>(
      userId,
      '/crm/v3/objects/contacts',
      {
        method: 'POST',
        body: JSON.stringify({
          properties: {
            email: data.email,
            firstname: data.firstName,
            lastname: data.lastName,
            ...(data.phone && { phone: data.phone }),
            ...(data.company && { company: data.company }),
          },
        }),
      }
    );

    if (!response) {
      return null;
    }

    console.log(`[HubSpot] Contact created: ${response.id}`);
    return normalizeContact(response);
  } catch (error) {
    console.error('[HubSpot] Create contact error:', error);
    throw error;
  }
}

/**
 * Get notes for a contact
 */
export async function getContactNotes(
  userId: string,
  contactId: string,
  limit: number = 10
): Promise<HubSpotNote[]> {
  try {
    // First, get associated note IDs
    const associations = await hubspotRequest<{
      results: Array<{ id: string }>;
    }>(
      userId,
      `/crm/v3/objects/contacts/${contactId}/associations/notes`
    );

    if (!associations?.results?.length) {
      return [];
    }

    // Fetch note details
    const noteIds = associations.results.slice(0, limit).map((a) => a.id);
    const notes: HubSpotNote[] = [];

    for (const noteId of noteIds) {
      const note = await hubspotRequest<{
        id: string;
        properties: { hs_note_body?: string; hs_createdate?: string };
      }>(userId, `/crm/v3/objects/notes/${noteId}?properties=hs_note_body,hs_createdate`);

      if (note) {
        notes.push({
          id: note.id,
          contactId,
          content: note.properties?.hs_note_body || '',
          createdAt: new Date(note.properties?.hs_createdate || Date.now()),
        });
      }
    }

    return notes;
  } catch (error) {
    console.error('[HubSpot] Get contact notes error:', error);
    return [];
  }
}

/**
 * Create a note for a contact
 */
export async function createContactNote(
  userId: string,
  contactId: string,
  content: string
): Promise<HubSpotNote | null> {
  try {
    // Create the note
    const note = await hubspotRequest<{
      id: string;
      properties: { hs_note_body?: string; hs_createdate?: string };
    }>(userId, '/crm/v3/objects/notes', {
      method: 'POST',
      body: JSON.stringify({
        properties: {
          hs_note_body: content,
          hs_timestamp: new Date().toISOString(),
        },
      }),
    });

    if (!note) {
      return null;
    }

    // Associate the note with the contact
    await hubspotRequest(
      userId,
      `/crm/v3/objects/notes/${note.id}/associations/contacts/${contactId}/note_to_contact`,
      { method: 'PUT' }
    );

    console.log(`[HubSpot] Note created and associated: ${note.id}`);
    return {
      id: note.id,
      contactId,
      content,
      createdAt: new Date(),
    };
  } catch (error) {
    console.error('[HubSpot] Create contact note error:', error);
    throw error;
  }
}

/**
 * Check if HubSpot is connected for a user
 */
export async function isHubSpotConnected(userId: string): Promise<boolean> {
  const token = await getValidTokens(userId);
  return !!token;
}

