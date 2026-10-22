import { BusRepository } from '@/repositories/mock-bus'
import { GateEventRepository } from '@/repositories/mock-events'
import type {
  RawDetection,
  ProcessingResult,
  EventType,
  BusStatus,
} from '@/types/domain'
import { normalizeRegistrationNumber } from '@/utils/registration'

/**
 * Central gate event processing service.
 *
 * Rules:
 *  1. Normalize the plate text and match against registered buses.
 *  2. Route low confidence / unknown plates to the review queue instead of
 *     blindly creating gate events.
 *  3. Suppress duplicate events for the same bus within a cooldown window.
 *  4. Enforce status consistency — an EXIT when the bus is already outside
 *     gets flagged for review rather than silently corrupting history.
 */
export class EventProcessingService {
  private busRepo: BusRepository
  private eventRepo: GateEventRepository
  private nowFn: () => number

  /** Duplicate suppression window, in seconds. */
  duplicateCooldownSeconds = 60

  constructor(
    busRepo: BusRepository,
    eventRepo: GateEventRepository,
    nowFn: () => number = () => Date.now(),
  ) {
    this.busRepo = busRepo
    this.eventRepo = eventRepo
    this.nowFn = nowFn
  }

  async processGateDetection(detection: RawDetection): Promise<ProcessingResult> {
    const normalized = normalizeRegistrationNumber(detection.rawOcrText)
    const bus = await this.busRepo.getByNormalized(normalized)

    // ---------------------------------------------------------------
    // 1) Plate not recognised as any registered bus → review queue
    // ---------------------------------------------------------------
    if (!bus) {
      return this.routeToReview(detection, normalized, null, 'PLATE_NOT_REGISTERED')
    }

    // ---------------------------------------------------------------
    // 2) Confidence gate
    // ---------------------------------------------------------------
    if (detection.confidence < 0.5) {
      return this.routeToReview(detection, normalized, bus.id, 'LOW_CONFIDENCE')
    }

    // ---------------------------------------------------------------
    // 3) Determine event type from direction estimate. A detection with
    //    an unknown direction is never trusted to toggle bus state.
    // ---------------------------------------------------------------
    if (detection.directionEstimate !== 'INBOUND' && detection.directionEstimate !== 'OUTBOUND') {
      return this.routeToReview(detection, normalized, bus.id, 'DIRECTION_UNKNOWN')
    }
    const eventType: EventType =
      detection.directionEstimate === 'OUTBOUND' ? 'EXIT' : 'ENTRY'

    // ---------------------------------------------------------------
    // 4) Duplicate suppression — same bus + same event type inside
    //    the cooldown window.
    // ---------------------------------------------------------------
    const last = await this.eventRepo.getLastForBus(bus.id)
    if (last && last.eventType === eventType) {
      const lastTime = new Date(last.createdAt).getTime()
      const now = this.nowFn()
      if (now - lastTime < this.duplicateCooldownSeconds * 1000) {
        return {
          outcome: 'DUPLICATE_SUPPRESSED',
          event: null,
          bus,
          review: null,
          message: 'Duplicate detection within cooldown window. Event not recorded.',
          reasons: ['DUPLICATE'],
        }
      }
    }

    // ---------------------------------------------------------------
    // 5) Validate current bus state against the requested event.
    //    ENTRY requires bus OUTSIDE; EXIT requires bus INSIDE.
    // ---------------------------------------------------------------
    const expectedStatusBefore: BusStatus = eventType === 'ENTRY' ? 'OUTSIDE_CAMPUS' : 'INSIDE_CAMPUS'
    if (bus.currentStatus !== expectedStatusBefore) {
      return this.routeToReview(detection, normalized, bus.id, 'INVALID_STATE_TRANSITION')
    }

    // ---------------------------------------------------------------
    // 6) Create the gate event
    // ---------------------------------------------------------------
    const event = await this.eventRepo.create({
      busId: bus.id,
      eventType,
      source: detection.source,
      rawOcrText: detection.rawOcrText,
      normalizedOcrText: normalized,
      confidence: detection.confidence,
      cameraId: detection.cameraId,
      evidenceReference: detection.evidenceReference ?? null,
      reviewStatus: 'CONFIRMED',
    })

    // 7) Update bus status
    const newStatus: BusStatus = eventType === 'ENTRY' ? 'INSIDE_CAMPUS' : 'OUTSIDE_CAMPUS'
    await this.busRepo.upsert({ id: bus.id, currentStatus: newStatus })

    return {
      outcome: 'EVENT_CREATED',
      event,
      bus: { ...bus, currentStatus: newStatus },
      review: null,
      message: `Recorded ${eventType.toLowerCase()} for ${bus.registrationNumber}.`,
      reasons: [],
    }
  }

  /** Route a detection to the review queue. */
  private async routeToReview(
    detection: RawDetection,
    normalized: string,
    busId: string | null,
    reason: string,
  ): Promise<ProcessingResult> {
    // Create a pending event so it appears in the review queue.
    const event = await this.eventRepo.create({
      busId,
      eventType: detection.directionEstimate === 'OUTBOUND' ? 'EXIT' : 'ENTRY',
      source: detection.source,
      rawOcrText: detection.rawOcrText,
      normalizedOcrText: normalized,
      confidence: detection.confidence,
      cameraId: detection.cameraId,
      evidenceReference: detection.evidenceReference ?? null,
      reviewStatus: 'PENDING',
      notes: `Auto-flagged: ${reason}`,
    })

    return {
      outcome: 'ROUTED_TO_REVIEW',
      event,
      bus: null,
      review: null,
      message: `Detection flagged for review (${reason}).`,
      reasons: [reason],
    }
  }
}
