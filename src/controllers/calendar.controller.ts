/**
 * Calendar Controller
 *
 * Routes:
 *   GET /api/calendar/ical   — RFC 5545 iCal feed of order due dates + inspection dates
 *                              Returns text/calendar; compatible with Apple Calendar, Outlook, Google Calendar
 */

import express, { Request, Response } from 'express';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { Logger } from '../utils/logger.js';

const router = express.Router();
const logger = new Logger('CalendarController');

// ─── RFC 5545 helpers ─────────────────────────────────────────────────────────

/** Format a JS Date (or ISO string) as YYYYMMDDTHHMMSSZ */
function toICalDate(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  // Guard against invalid dates
  if (isNaN(d.getTime())) return '';
  return d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/** Escape special chars per RFC 5545 §3.3.11 */
function esc(value: string | undefined | null): string {
  if (!value) return '';
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

/** Fold long lines per RFC 5545 §3.1 (max 75 octets) */
function fold(line: string): string {
  const octets = Buffer.from(line, 'utf8');
  if (octets.length <= 75) return line;
  const parts: string[] = [];
  let offset = 0;
  while (offset < octets.length) {
    // Take up to 75 bytes on the first chunk, 74 on continuation (1 byte for space)
    const max = parts.length === 0 ? 75 : 74;
    parts.push(octets.slice(offset, offset + max).toString('utf8'));
    offset += max;
  }
  return parts.join('\r\n ');
}

function buildVEvent(params: {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  start: Date | string;
  end?: Date | string;
  allDay?: boolean;
  dtstamp: string;
}): string[] {
  const { uid, summary, description, location, start, end, allDay, dtstamp } = params;
  const startStr = toICalDate(start);
  if (!startStr) return [];
  const endStr = end ? toICalDate(end) : startStr;

  const lines = ['BEGIN:VEVENT'];

  if (allDay) {
    // DATE-only value (no time component)
    const dtDate = (start instanceof Date ? start : new Date(start))
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, '');
    lines.push(`DTSTART;VALUE=DATE:${dtDate}`);
    lines.push(`DTEND;VALUE=DATE:${dtDate}`);
  } else {
    lines.push(`DTSTART:${startStr}`);
    lines.push(`DTEND:${endStr}`);
  }

  lines.push(`DTSTAMP:${dtstamp}`);
  lines.push(fold(`UID:${esc(uid)}`));
  lines.push(fold(`SUMMARY:${esc(summary)}`));
  if (description) lines.push(fold(`DESCRIPTION:${esc(description)}`));
  if (location) lines.push(fold(`LOCATION:${esc(location)}`));
  lines.push('STATUS:CONFIRMED');
  lines.push('END:VEVENT');
  return lines;
}

// ─── Route ────────────────────────────────────────────────────────────────────

/**
 * GET /ical
 *
 * Generates an RFC 5545 iCalendar feed for:
 *   1. Order due dates  — one VEVENT per order that has a dueDate and is not cancelled
 *   2. Inspection dates — one VEVENT per inspection record that has a scheduledDate
 *
 * Query params:
 *   tenantId  — override tenant (dev helper; production reads from JWT)
 *   days      — look-ahead window in days (default 90, max 365)
 */
router.get('/ical', async (req: Request, res: Response) => {
  try {
    const tenantId: string = (req as any).user?.tenantId
      || req.query['tenantId'] as string
      || 'default-tenant';

    const daysRaw = parseInt(String(req.query['days'] ?? '90'), 10);
    const lookAheadDays = isNaN(daysRaw) || daysRaw < 1 ? 90 : Math.min(daysRaw, 365);

    const now = new Date();
    const windowEnd = new Date(now.getTime() + lookAheadDays * 24 * 60 * 60 * 1000);
    const dtstamp = toICalDate(now);

    logger.info('Generating iCal feed', { tenantId, lookAheadDays });

    const dbService = new CosmosDbService();

    // ── 1. Order due dates ────────────────────────────────────────────────────
    const orderQuery = {
      query: `SELECT c.id, c.orderNumber, c.propertyAddress, c.dueDate, c.status, c.clientName
              FROM c
              WHERE c.tenantId = @tenantId
                AND c.dueDate >= @from
                AND c.dueDate <= @to
                AND c.status NOT IN ('CANCELLED', 'DELIVERED', 'CLOSED')`,
      parameters: [
        { name: '@tenantId', value: tenantId },
        { name: '@from', value: now.toISOString() },
        { name: '@to', value: windowEnd.toISOString() },
      ],
    };

    const orders = await dbService.queryItems<{
      id: string;
      orderNumber: string;
      propertyAddress?: string;
      dueDate: string;
      status: string;
      clientName?: string;
    }>('orders', orderQuery.query, orderQuery.parameters);

    // ── 2. Inspection dates ───────────────────────────────────────────────────
    const inspectionQuery = {
      query: `SELECT c.id, c.orderId, c.scheduledDate, c.propertyAddress, c.appraiserName, c.status
              FROM c
              WHERE c.tenantId = @tenantId
                AND c.scheduledDate >= @from
                AND c.scheduledDate <= @to
                AND c.status NOT IN ('CANCELLED', 'COMPLETED')`,
      parameters: [
        { name: '@tenantId', value: tenantId },
        { name: '@from', value: now.toISOString() },
        { name: '@to', value: windowEnd.toISOString() },
      ],
    };

    const inspections = await dbService.queryItems<{
      id: string;
      orderId: string;
      scheduledDate: string;
      propertyAddress?: string;
      appraiserName?: string;
      status: string;
    }>('inspections', inspectionQuery.query, inspectionQuery.parameters);

    // ── Build calendar ────────────────────────────────────────────────────────
    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//VisionOne//Appraisal Management//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      fold(`X-WR-CALNAME:VisionOne Appraisal Calendar`),
      'X-WR-TIMEZONE:UTC',
    ];

    for (const order of (orders.data ?? [])) {
      const events = buildVEvent({
        uid: `order-due-${order.id}@visionone`,
        summary: `Appraisal Due: ${order.orderNumber ?? order.id}`,
        description: order.clientName
          ? `Client: ${order.clientName} | Status: ${order.status}`
          : `Status: ${order.status}`,
        ...(order.propertyAddress !== undefined && { location: order.propertyAddress }),
        start: order.dueDate,
        allDay: true,
        dtstamp,
      });
      lines.push(...events);
    }

    for (const insp of (inspections.data ?? [])) {
      const events = buildVEvent({
        uid: `inspection-${insp.id}@visionone`,
        summary: `Inspection: Order ${insp.orderId}`,
        description: insp.appraiserName
          ? `Appraiser: ${insp.appraiserName} | Status: ${insp.status}`
          : `Status: ${insp.status}`,
        ...(insp.propertyAddress !== undefined && { location: insp.propertyAddress }),
        start: insp.scheduledDate,
        // Inspections: 2-hour block
        end: new Date(new Date(insp.scheduledDate).getTime() + 2 * 60 * 60 * 1000),
        dtstamp,
      });
      lines.push(...events);
    }

    lines.push('END:VCALENDAR');

    const body = lines.join('\r\n') + '\r\n';

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="visionone-appraisals.ics"');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.status(200).send(body);

    logger.info('iCal feed generated', {
      tenantId,
      orderEvents: orders.data?.length ?? 0,
      inspectionEvents: inspections.data?.length ?? 0,
    });
  } catch (error) {
    logger.error('Failed to generate iCal feed', { error });
    res.status(500).json({ success: false, error: 'Failed to generate calendar feed' });
  }
});

export { router as calendarRouter };
