import { google, calendar_v3 } from 'googleapis';
import { createAuthenticatedClient } from './google-oauth';
import { getValidGoogleTokens } from './token-manager';

// Normalized calendar event
export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  location?: string;
  attendees: Array<{
    email: string;
    name?: string;
    responseStatus?: string;
  }>;
  meetLink?: string;
  htmlLink?: string;
  isAllDay: boolean;
}

// Available time slot
export interface TimeSlot {
  start: Date;
  end: Date;
}

// Create event options
export interface CreateEventOptions {
  title: string;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  description?: string;
  location?: string;
  attendees?: string[]; // Email addresses
  sendNotifications?: boolean;
}

// Get Calendar client for a user
async function getCalendarClient(userId: string): Promise<calendar_v3.Calendar | null> {
  const tokens = await getValidGoogleTokens(userId);
  if (!tokens || tokens.needsReauth) {
    console.error(`[Calendar] No valid tokens for user ${userId}`);
    return null;
  }

  const auth = createAuthenticatedClient(tokens.accessToken, tokens.refreshToken);
  return google.calendar({ version: 'v3', auth });
}

// Normalize a Google Calendar event
function normalizeEvent(event: calendar_v3.Schema$Event): CalendarEvent {
  const start = event.start?.dateTime 
    ? new Date(event.start.dateTime) 
    : new Date(event.start?.date || Date.now());
  
  const end = event.end?.dateTime 
    ? new Date(event.end.dateTime) 
    : new Date(event.end?.date || Date.now());

  const isAllDay = !event.start?.dateTime;

  return {
    id: event.id!,
    title: event.summary || '(No title)',
    description: event.description,
    start,
    end,
    location: event.location,
    attendees: (event.attendees || []).map((a) => ({
      email: a.email!,
      name: a.displayName,
      responseStatus: a.responseStatus,
    })),
    meetLink: event.hangoutLink,
    htmlLink: event.htmlLink,
    isAllDay,
  };
}

/**
 * List calendar events within a time range
 */
export async function listEvents(
  userId: string,
  options: {
    startDate: Date;
    endDate: Date;
    maxResults?: number;
  }
): Promise<CalendarEvent[]> {
  const calendar = await getCalendarClient(userId);
  if (!calendar) return [];

  try {
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: options.startDate.toISOString(),
      timeMax: options.endDate.toISOString(),
      maxResults: options.maxResults || 50,
      singleEvents: true,
      orderBy: 'startTime',
    });

    if (!response.data.items) {
      return [];
    }

    return response.data.items.map(normalizeEvent);
  } catch (error) {
    console.error('[Calendar] Error listing events:', error);
    throw error;
  }
}

/**
 * Get a single event by ID
 */
export async function getEvent(userId: string, eventId: string): Promise<CalendarEvent | null> {
  const calendar = await getCalendarClient(userId);
  if (!calendar) return null;

  try {
    const response = await calendar.events.get({
      calendarId: 'primary',
      eventId,
    });

    return normalizeEvent(response.data);
  } catch (error) {
    console.error('[Calendar] Error getting event:', error);
    return null;
  }
}

/**
 * Create a new calendar event
 */
export async function createEvent(
  userId: string,
  options: CreateEventOptions
): Promise<CalendarEvent | null> {
  const calendar = await getCalendarClient(userId);
  if (!calendar) return null;

  try {
    const response = await calendar.events.insert({
      calendarId: 'primary',
      sendUpdates: options.sendNotifications ? 'all' : 'none',
      requestBody: {
        summary: options.title,
        description: options.description,
        location: options.location,
        start: {
          dateTime: options.startTime,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: options.endTime,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        attendees: options.attendees?.map((email) => ({ email })),
        conferenceData: {
          createRequest: {
            requestId: `meet-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      },
      conferenceDataVersion: 1,
    });

    console.log(`[Calendar] Event created: ${response.data.id}`);
    return normalizeEvent(response.data);
  } catch (error) {
    console.error('[Calendar] Error creating event:', error);
    throw error;
  }
}

/**
 * Delete a calendar event
 */
export async function deleteEvent(userId: string, eventId: string): Promise<boolean> {
  const calendar = await getCalendarClient(userId);
  if (!calendar) return false;

  try {
    await calendar.events.delete({
      calendarId: 'primary',
      eventId,
    });
    return true;
  } catch (error) {
    console.error('[Calendar] Error deleting event:', error);
    return false;
  }
}

/**
 * Find available time slots within a date range
 */
export async function findAvailability(
  userId: string,
  options: {
    startDate: Date;
    endDate: Date;
    durationMinutes: number;
    workingHoursStart?: number; // Hour of day (0-23), default 9
    workingHoursEnd?: number; // Hour of day (0-23), default 17
  }
): Promise<TimeSlot[]> {
  const calendar = await getCalendarClient(userId);
  if (!calendar) return [];

  const {
    startDate,
    endDate,
    durationMinutes,
    workingHoursStart = 9,
    workingHoursEnd = 17,
  } = options;

  try {
    // Get all events in the range
    const events = await listEvents(userId, { startDate, endDate });

    // Build list of busy times
    const busyTimes: Array<{ start: Date; end: Date }> = events.map((e) => ({
      start: e.start,
      end: e.end,
    }));

    // Sort by start time
    busyTimes.sort((a, b) => a.start.getTime() - b.start.getTime());

    // Find available slots
    const availableSlots: TimeSlot[] = [];
    const durationMs = durationMinutes * 60 * 1000;

    // Iterate through each day
    const currentDate = new Date(startDate);
    while (currentDate < endDate) {
      // Skip weekends
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      // Set working hours for this day
      const dayStart = new Date(currentDate);
      dayStart.setHours(workingHoursStart, 0, 0, 0);

      const dayEnd = new Date(currentDate);
      dayEnd.setHours(workingHoursEnd, 0, 0, 0);

      // Skip if day is in the past
      if (dayEnd < new Date()) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      // Adjust start if it's today and past working hours start
      const now = new Date();
      if (dayStart < now && dayEnd > now) {
        // Round up to next 30-minute slot
        dayStart.setTime(now.getTime());
        dayStart.setMinutes(Math.ceil(dayStart.getMinutes() / 30) * 30, 0, 0);
      }

      // Get busy times for this day
      const dayBusy = busyTimes.filter(
        (b) => b.start < dayEnd && b.end > dayStart
      );

      // Find gaps
      let slotStart = dayStart;
      for (const busy of dayBusy) {
        // Check if there's a gap before this busy time
        if (busy.start > slotStart) {
          const gapDuration = busy.start.getTime() - slotStart.getTime();
          if (gapDuration >= durationMs) {
            // Add available slots in this gap
            let slotTime = new Date(slotStart);
            while (slotTime.getTime() + durationMs <= busy.start.getTime()) {
              availableSlots.push({
                start: new Date(slotTime),
                end: new Date(slotTime.getTime() + durationMs),
              });
              // Move to next slot (30-min increments)
              slotTime.setMinutes(slotTime.getMinutes() + 30);
              
              // Limit slots per day
              if (availableSlots.length >= 10) break;
            }
          }
        }
        // Move past this busy time
        if (busy.end > slotStart) {
          slotStart = busy.end;
        }
      }

      // Check for gap after last busy time
      if (slotStart < dayEnd) {
        const gapDuration = dayEnd.getTime() - slotStart.getTime();
        if (gapDuration >= durationMs) {
          let slotTime = new Date(slotStart);
          while (slotTime.getTime() + durationMs <= dayEnd.getTime()) {
            availableSlots.push({
              start: new Date(slotTime),
              end: new Date(slotTime.getTime() + durationMs),
            });
            slotTime.setMinutes(slotTime.getMinutes() + 30);
            
            if (availableSlots.length >= 10) break;
          }
        }
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
      
      // Limit total slots
      if (availableSlots.length >= 10) break;
    }

    return availableSlots.slice(0, 10);
  } catch (error) {
    console.error('[Calendar] Error finding availability:', error);
    return [];
  }
}

/**
 * Get free/busy information (alternative method using FreeBusy API)
 */
export async function getFreeBusy(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<Array<{ start: Date; end: Date }>> {
  const calendar = await getCalendarClient(userId);
  if (!calendar) return [];

  try {
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        items: [{ id: 'primary' }],
      },
    });

    const busy = response.data.calendars?.primary?.busy || [];
    return busy.map((b) => ({
      start: new Date(b.start!),
      end: new Date(b.end!),
    }));
  } catch (error) {
    console.error('[Calendar] Error getting free/busy:', error);
    return [];
  }
}

