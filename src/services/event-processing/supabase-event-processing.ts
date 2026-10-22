import { supabase } from '@/services/supabase/client'
import type {
  RawDetection,
  ProcessingResult,
} from '@/types/domain'
import { normalizeRegistrationNumber } from '@/utils/registration'

/**
 * Supabase-based event processing service
 * Uses the server-side process_gate_detection function for secure processing
 */
export class SupabaseEventProcessingService {
  async processGateDetection(detection: RawDetection): Promise<ProcessingResult> {
    if (!supabase) throw new Error('Supabase client not configured')

    try {
      // Call the secure server-side function
      const { data, error } = await supabase.rpc('process_gate_detection', {
        p_raw_ocr_text: detection.rawOcrText,
        p_confidence: detection.confidence,
        p_camera_id: detection.cameraId,
        p_source: detection.source,
        p_direction_estimate: detection.directionEstimate,
        p_evidence_reference: detection.evidenceReference ?? null,
      })

      if (error) throw new Error(`Failed to process detection: ${error.message}`)

      // Parse the result
      const result = data as any
      
      return {
        outcome: result.outcome === 'ROUTED_TO_REVIEW' ? 'ROUTED_TO_REVIEW' : 'EVENT_CREATED',
        event: result.event_id ? {
          id: result.event_id,
          busId: result.bus_id ?? null,
          eventType: detection.directionEstimate === 'OUTBOUND' ? 'EXIT' : 'ENTRY',
          eventTime: new Date().toISOString(),
          source: detection.source,
          rawOcrText: detection.rawOcrText,
          normalizedOcrText: normalizeRegistrationNumber(detection.rawOcrText),
          confidence: detection.confidence,
          cameraId: detection.cameraId,
          evidenceReference: detection.evidenceReference ?? null,
          reviewStatus: result.review_status,
          notes: null,
          createdAt: new Date().toISOString(),
        } : null,
        bus: null, // We'll fetch the full bus later if needed
        review: null,
        message: result.message,
        reasons: result.review_status === 'PENDING' ? ['Low confidence'] : [],
      }
    } catch (error) {
      console.error('[SupabaseEventProcessingService] Failed to process detection:', error)
      return {
        outcome: 'IGNORED',
        event: null,
        bus: null,
        review: null,
        message: 'Failed to process detection',
        reasons: ['Processing error'],
      }
    }
  }
}