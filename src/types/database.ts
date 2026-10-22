/**
 * Supabase Database Type Definitions
 * Maps PostgreSQL schema to TypeScript types
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      buses: {
        Row: {
          id: string
          bus_code: string
          registration_number: string
          normalized_registration_number: string
          display_name: string | null
          route_name: string
          driver_name: string | null
          driver_contact: string | null
          current_status: 'INSIDE_CAMPUS' | 'OUTSIDE_CAMPUS'
          registration_date: string
          is_active: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          bus_code: string
          registration_number: string
          normalized_registration_number: string
          display_name?: string | null
          route_name: string
          driver_name?: string | null
          driver_contact?: string | null
          current_status?: 'INSIDE_CAMPUS' | 'OUTSIDE_CAMPUS'
          registration_date?: string
          is_active?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          bus_code?: string
          registration_number?: string
          normalized_registration_number?: string
          display_name?: string | null
          route_name?: string
          driver_name?: string | null
          driver_contact?: string | null
          current_status?: 'INSIDE_CAMPUS' | 'OUTSIDE_CAMPUS'
          registration_date?: string
          is_active?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      cameras: {
        Row: {
          id: string
          name: string
          camera_code: string
          gate_name: string
          lane_name: string
          enabled: boolean
          connection_status: 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'UNKNOWN' | 'SIMULATED'
          last_heartbeat_at: string | null
          last_frame_at: string | null
          processing_status: 'IDLE' | 'PROCESSING' | 'ERROR' | 'DISABLED'
          direction_configuration: 'INBOUND' | 'OUTBOUND' | 'BIDIRECTIONAL'
          simulated: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          camera_code: string
          gate_name: string
          lane_name: string
          enabled?: boolean
          connection_status?: 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'UNKNOWN' | 'SIMULATED'
          last_heartbeat_at?: string | null
          last_frame_at?: string | null
          processing_status?: 'IDLE' | 'PROCESSING' | 'ERROR' | 'DISABLED'
          direction_configuration?: 'INBOUND' | 'OUTBOUND' | 'BIDIRECTIONAL'
          simulated?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          camera_code?: string
          gate_name?: string
          lane_name?: string
          enabled?: boolean
          connection_status?: 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'UNKNOWN' | 'SIMULATED'
          last_heartbeat_at?: string | null
          last_frame_at?: string | null
          processing_status?: 'IDLE' | 'PROCESSING' | 'ERROR' | 'DISABLED'
          direction_configuration?: 'INBOUND' | 'OUTBOUND' | 'BIDIRECTIONAL'
          simulated?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      gate_events: {
        Row: {
          id: string
          bus_id: string | null
          event_type: 'ENTRY' | 'EXIT'
          event_time: string
          source: 'CAMERA' | 'MANUAL' | 'DEMO'
          raw_ocr_text: string | null
          normalized_ocr_text: string | null
          confidence: number | null
          camera_id: string | null
          evidence_reference: string | null
          review_status: 'PENDING' | 'CONFIRMED' | 'REJECTED'
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          bus_id?: string | null
          event_type: 'ENTRY' | 'EXIT'
          event_time?: string
          source: 'CAMERA' | 'MANUAL' | 'DEMO'
          raw_ocr_text?: string | null
          normalized_ocr_text?: string | null
          confidence?: number | null
          camera_id?: string | null
          evidence_reference?: string | null
          review_status?: 'PENDING' | 'CONFIRMED' | 'REJECTED'
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          bus_id?: string | null
          event_type?: 'ENTRY' | 'EXIT'
          event_time?: string
          source?: 'CAMERA' | 'MANUAL' | 'DEMO'
          raw_ocr_text?: string | null
          normalized_ocr_text?: string | null
          confidence?: number | null
          camera_id?: string | null
          evidence_reference?: string | null
          review_status?: 'PENDING' | 'CONFIRMED' | 'REJECTED'
          notes?: string | null
          created_at?: string
        }
      }
      detection_reviews: {
        Row: {
          id: string
          gate_event_id: string
          suggested_bus_id: string | null
          raw_ocr_text: string | null
          normalized_ocr_text: string | null
          confidence: number | null
          review_status: 'PENDING' | 'CONFIRMED' | 'REJECTED'
          reviewer_id: string | null
          review_reason: string | null
          reviewed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          gate_event_id: string
          suggested_bus_id?: string | null
          raw_ocr_text?: string | null
          normalized_ocr_text?: string | null
          confidence?: number | null
          review_status?: 'PENDING' | 'CONFIRMED' | 'REJECTED'
          reviewer_id?: string | null
          review_reason?: string | null
          reviewed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          gate_event_id?: string
          suggested_bus_id?: string | null
          raw_ocr_text?: string | null
          normalized_ocr_text?: string | null
          confidence?: number | null
          review_status?: 'PENDING' | 'CONFIRMED' | 'REJECTED'
          reviewer_id?: string | null
          review_reason?: string | null
          reviewed_at?: string | null
          created_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          display_name: string
          role: 'ADMIN' | 'SECURITY_OFFICER' | 'VIEWER'
          email: string | null
          created_at: string
        }
        Insert: {
          id: string
          display_name: string
          role?: 'ADMIN' | 'SECURITY_OFFICER' | 'VIEWER'
          email?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          display_name?: string
          role?: 'ADMIN' | 'SECURITY_OFFICER' | 'VIEWER'
          email?: string | null
          created_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          actor_id: string | null
          action: string
          entity_type: string
          entity_id: string | null
          reason: string | null
          before_data: Json | null
          after_data: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          actor_id?: string | null
          action: string
          entity_type: string
          entity_id?: string | null
          reason?: string | null
          before_data?: Json | null
          after_data?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          actor_id?: string | null
          action?: string
          entity_type?: string
          entity_id?: string | null
          reason?: string | null
          before_data?: Json | null
          after_data?: Json | null
          created_at?: string
        }
      }
    }
    Functions: {
      process_gate_detection: {
        Args: {
          p_raw_ocr_text: string
          p_confidence: number
          p_camera_id: string
          p_source: string
          p_direction_estimate: string
          p_evidence_reference?: string | null
        }
        Returns: Json
      }
      user_role: {
        Args: Record<string, never>
        Returns: string
      }
    }
  }
}

/** Helper type to map database rows to domain models */
export type DbBus = Database['public']['Tables']['buses']['Row']
export type DbCamera = Database['public']['Tables']['cameras']['Row']
export type DbGateEvent = Database['public']['Tables']['gate_events']['Row']
export type DbDetectionReview = Database['public']['Tables']['detection_reviews']['Row']
export type DbProfile = Database['public']['Tables']['profiles']['Row']
export type DbAuditLog = Database['public']['Tables']['audit_logs']['Row']
