import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder",
);

export type CheckinStatus = "present" | "late" | "duplicate" | "questioned" | "excused";

export type LineProfile = {
  userId: string;
  displayName: string;
  pictureUrl?: string;
};

export type Student = {
  id: string;
  school_id?: string | null;
  line_user_id: string;
  student_no: string;
  name: string;
  class_name: string | null;
};

export type AgencyCountryCode = "VN" | "ID" | "OTHER";

export type Agency = {
  id: string;
  school_id?: string | null;
  country_code: AgencyCountryCode;
  name: string;
  contact_name: string | null;
  contact_line_user_id: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AgencyStudent = {
  id: string;
  agency_id: string;
  student_id: string | null;
  interview_record_id: string | null;
  country_code: AgencyCountryCode;
  student_name: string;
  student_no: string | null;
  line_user_id: string | null;
  status: "prospect" | "applied" | "interviewing" | "accepted" | "arrived" | "inactive";
  notes: string | null;
  created_at: string;
  updated_at: string;
  agencies?: Pick<Agency, "name" | "country_code"> | null;
  students?: Pick<Student, "name" | "student_no" | "class_name" | "line_user_id"> | null;
  interview_records?: Pick<InterviewRecord, "student_name" | "country" | "target_department" | "readiness_status"> | null;
};

export type School = {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean;
};

export type Teacher = {
  id: string;
  school_id?: string | null;
  line_user_id: string;
  name: string;
  email: string | null;
  role?: "admin" | "teacher" | null;
  is_active: boolean;
};

export type ResearchProject = {
  id: string;
  school_id?: string | null;
  name: string;
  research_type: string;
  department: string | null;
  principal_teacher_name: string;
  description: string | null;
  is_active: boolean;
};

export type Course = {
  id: string;
  school_id?: string | null;
  research_project_id?: string | null;
  course_type?: "attendance" | "research_training" | "mixed" | null;
  name: string;
  classroom: string;
  teacher_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  late_after_minutes: number;
};

export type Checkin = {
  id: string;
  school_id?: string | null;
  research_project_id?: string | null;
  course_id: string | null;
  student_id: string | null;
  line_user_id: string;
  student_no: string;
  student_name: string;
  class_name: string | null;
  classroom: string;
  photo_path: string;
  photo_url: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  status: CheckinStatus;
  note: string | null;
  checked_in_at: string;
  courses?: Pick<Course, "name" | "classroom" | "starts_at" | "ends_at"> | null;
};

export type InterviewRecord = {
  id: string;
  school_id?: string | null;
  student_name: string;
  country: string;
  target_department: string;
  motivation: string | null;
  chinese_level: string;
  interview_date: string | null;
  taiwan_arrival_date: string | null;
  intro_script: string;
  checkin_code: string;
  readiness_status: string;
  course_id: string | null;
  assigned_teacher_id: string | null;
  created_by_teacher_id: string | null;
  created_at: string;
  updated_at: string;
  courses?: Pick<Course, "name" | "classroom"> | null;
};

export type RosterImport = {
  id: string;
  school_id?: string | null;
  teacher_id: string | null;
  teacher_name: string;
  teacher_line_user_id: string | null;
  source_name: string;
  course_source_name: string;
  total_rows: number;
  imported_rows: number;
  skipped_rows: number;
  pending_line_rows: number;
  missing_data_rows: number;
  submitted_at: string;
  created_at: string;
};

export type AdEvent = {
  id: string;
  ad_key: string;
  event_type: "view" | "click";
  line_user_id: string | null;
  display_name: string | null;
  entry_mode: string | null;
  created_at: string;
};

export type AppUsageEvent = {
  id: string;
  line_user_id: string;
  display_name: string | null;
  entry_mode: string | null;
  created_at: string;
};
