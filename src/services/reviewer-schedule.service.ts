/**
 * Reviewer Schedule Service
 *
 * Adds schedule-awareness to QC reviewer assignment.
 * Stores per-analyst schedules in the 'reviewer-schedules' Cosmos container.
 *
 * isAvailableNow(analystId) returns false when:
 *   - Outside configured working hours for the analyst's timezone
 *   - On a configured PTO block
 *
 * The QCReviewQueueService calls isAvailableNow() before selecting a reviewer.
 */

import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';

// ── Types ────────────────────────────────────────────────────────────────────

/** Day-of-week schedule (0=Sunday, 6=Saturday) with hour range in LOCAL time. */
export interface DaySchedule {
  /** Day of week 0 (Sun) through 6 (Sat). */
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Start hour in 24-hour format (0-23), e.g. 8 = 08:00. */
  startHour: number;
  /** End hour in 24-hour format (1-24), e.g. 17 = 17:00. Exclusive. */
  endHour: number;
}

export interface PtoBlock {
  id: string;
  /** ISO date string YYYY-MM-DD (start of PTO, inclusive). */
  startDate: string;
  /** ISO date string YYYY-MM-DD (end of PTO, inclusive). */
  endDate: string;
  note?: string;
}

export interface ReviewerSchedule {
  id: string;
  /** Same as analystId. */
  analystId: string;
  tenantId: string;
  /** IANA timezone string, e.g. 'America/New_York'. */
  timezone: string;
  /** Working hours per day-of-week. Days not listed = not working. */
  workingHours: DaySchedule[];
  /** PTO blocks (analyst unavailable for the full day). */
  ptoBlocks: PtoBlock[];
  /** Allow the QC queue to still assign even outside hours (emergency mode). */
  allowEmergencyAssignment: boolean;
  updatedAt: string;
  updatedBy: string;
  type: 'reviewer-schedule';
}

export type UpsertReviewerScheduleInput = Omit<ReviewerSchedule, 'id' | 'updatedAt' | 'type'>;

// ── Service ────────────────────────────────────────────────────────────────

export class ReviewerScheduleService {
  private readonly logger = new Logger('ReviewerScheduleService');

  constructor(private readonly dbService: CosmosDbService) {}

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async upsertSchedule(input: UpsertReviewerScheduleInput): Promise<ReviewerSchedule> {
    const schedule: ReviewerSchedule = {
      ...input,
      id: input.analystId, // use analystId as doc id for easy lookup
      updatedAt: new Date().toISOString(),
      type: 'reviewer-schedule',
    };
    await this.dbService.upsertDocument('reviewer-schedules', schedule);
    this.logger.info('Reviewer schedule upserted', { analystId: input.analystId });
    return schedule;
  }

  async getSchedule(analystId: string, tenantId: string): Promise<ReviewerSchedule | null> {
    const container = this.dbService.getContainer('reviewer-schedules');
    const { resources } = await container.items.query({
      query: `SELECT * FROM c WHERE c.analystId = @id AND c.tenantId = @tid AND c.type = 'reviewer-schedule'`,
      parameters: [
        { name: '@id', value: analystId },
        { name: '@tid', value: tenantId },
      ],
    }).fetchAll();
    return resources.length > 0 ? (resources[0] as ReviewerSchedule) : null;
  }

  async deleteSchedule(analystId: string, tenantId: string): Promise<void> {
    const container = this.dbService.getContainer('reviewer-schedules');
    await container.item(analystId, tenantId).delete();
    this.logger.info('Reviewer schedule deleted', { analystId });
  }

  // ── Availability check ────────────────────────────────────────────────────

  /**
   * Returns true if the analyst is available to accept assignments right now.
   *
   * Falls back to true when no schedule is configured — absence of a schedule
   * means "always available" (backward-compatible with existing behaviour).
   */
  async isAvailableNow(analystId: string, tenantId: string): Promise<boolean> {
    const schedule = await this.getSchedule(analystId, tenantId);
    if (!schedule) {
      // No schedule configured: treated as always available (legacy / no restrictions).
      return true;
    }
    return this.checkSchedule(schedule, new Date());
  }

  /**
   * Pure function — check a schedule against a given instant.
   * Exported for unit testing.
   */
  checkSchedule(schedule: ReviewerSchedule, now: Date): boolean {
    // Allow emergency overrides
    if (schedule.allowEmergencyAssignment) return true;

    // Convert `now` to the analyst's local time
    const localDateStr = now.toLocaleDateString('en-CA', { timeZone: schedule.timezone }); // YYYY-MM-DD
    const localHour = parseInt(
      now.toLocaleString('en-US', { timeZone: schedule.timezone, hour: 'numeric', hour12: false }),
      10,
    );
    // toLocaleString may return "24" for midnight; treat as 0
    const effectiveHour = localHour === 24 ? 0 : localHour;

    // Check PTO
    const onPto = schedule.ptoBlocks.some(
      (block) => localDateStr >= block.startDate && localDateStr <= block.endDate,
    );
    if (onPto) return false;

    // Get day of week in analyst's timezone (0=Sun, 6=Sat)
    const localDayOfWeekStr = now.toLocaleDateString('en-US', {
      timeZone: schedule.timezone,
      weekday: 'short',
    });
    const SHORT_DAY_TO_DOW: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    const dow = SHORT_DAY_TO_DOW[localDayOfWeekStr] ?? -1;

    // Check working hours
    const todaySchedule = schedule.workingHours.find((wh) => wh.dayOfWeek === dow);
    if (!todaySchedule) return false; // not a working day

    return effectiveHour >= todaySchedule.startHour && effectiveHour < todaySchedule.endHour;
  }

  /**
   * Add a PTO block to an existing schedule (or create a minimal schedule if none exists).
   */
  async addPtoBlock(
    analystId: string,
    tenantId: string,
    ptoBlock: Omit<PtoBlock, 'id'>,
    updatedBy: string,
  ): Promise<ReviewerSchedule> {
    let schedule = await this.getSchedule(analystId, tenantId);
    if (!schedule) {
      // Create a minimal default schedule (Mon–Fri 08:00–17:00 ET)
      schedule = {
        id: analystId,
        analystId,
        tenantId,
        timezone: 'America/New_York',
        workingHours: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
          dayOfWeek: dayOfWeek as DaySchedule['dayOfWeek'],
          startHour: 8,
          endHour: 17,
        })),
        ptoBlocks: [],
        allowEmergencyAssignment: false,
        updatedAt: new Date().toISOString(),
        updatedBy,
        type: 'reviewer-schedule',
      };
    }
    const newBlock: PtoBlock = { ...ptoBlock, id: uuidv4() };
    schedule.ptoBlocks.push(newBlock);
    schedule.updatedAt = new Date().toISOString();
    schedule.updatedBy = updatedBy;
    await this.dbService.upsertDocument('reviewer-schedules', schedule);
    return schedule;
  }
}
