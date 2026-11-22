export type ExperienceLevel = "beginner" | "intermediate" | "advanced";

export interface UserProfileData {
  goal?: string | null;
  age?: number | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  experience_level?: ExperienceLevel | null;
  days_per_week?: number | null;
  minutes_per_session?: number | null;
  limitations?: string[];
}

export interface TrainingSessionData {
  day: string;
  activity: string;
  duration_min: number;
}

export interface TrainingPlanData {
  goal: string;
  sessions: TrainingSessionData[];
  assumptions?: string[];
  limitations?: string[];
}

export type SafetySeverity = "info" | "warning" | "error";

export interface SafetyIssueData {
  severity: SafetySeverity;
  message: string;
}

export interface FinalAnswer {
  message?: string;
  error?: string;
  missing_data?: string[];
  warnings?: string[];
  profile?: UserProfileData;
  plan?: TrainingPlanData;
  safety?: { issues?: SafetyIssueData[] };
  safety_issues?: SafetyIssueData[];
}

export interface WorkflowResponse {
  run_id: string;
  status: string;
  request: string;
  final_answer?: FinalAnswer | null;
  missing_data?: string[];
  error?: string | null;
  user_data?: Record<string, unknown>;
  created_at?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
}

export interface WorkflowListItem {
  run_id: string;
  status: string;
  request: string;
  created_at?: string | null;
  finished_at?: string | null;
  error?: string | null;
}

export interface WorkflowList {
  items: WorkflowListItem[];
  total: number;
}

export interface WorkflowPayload {
  request: string;
  user_data: Record<string, unknown>;
}

export interface ReadyResponse {
  status: "ok" | "degraded" | string;
  checks: Record<string, string>;
}
