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

export interface TrainingExerciseData {
  name: string;
  sets?: number | null;
  reps?: number | null;
  weight_kg?: number | null;
  duration_min?: number | null;
  notes?: string | null;
}

export interface TrainingSessionData {
  day: string;
  activity: string;
  duration_min: number;
  exercises?: TrainingExerciseData[];
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

export interface User {
  id: string;
  email: string;
  created_at?: string | null;
}

export interface LoginPayload {
  email: string;
  password: string;
  remember_me?: boolean;
}

export interface RegisterPayload extends LoginPayload {}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
}

export interface AuthSession {
  id: string;
  user_agent?: string | null;
  created_at?: string | null;
  last_used_at?: string | null;
  expires_at?: string | null;
  is_current: boolean;
}

export interface ProfilePayload {
  goal?: string | null;
  age?: number | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  experience_level?: ExperienceLevel | null;
  days_per_week?: number | null;
  minutes_per_session?: number | null;
  limitations?: string[];
}

export interface Profile extends ProfilePayload {
  goal: string | null;
  age: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  experience_level: ExperienceLevel | null;
  days_per_week: number | null;
  minutes_per_session: number | null;
  limitations: string[];
  created_at?: string | null;
  updated_at?: string | null;
}

export type ProgramStatus = "active" | "archived";

export interface PlannedExercise {
  name: string;
  position: number;
  planned: Record<string, unknown>;
  notes?: string | null;
}

export interface PlannedWorkout {
  id: string;
  position: number;
  day?: string | null;
  title: string;
  description?: string | null;
  duration_min?: number | null;
  scheduled_date?: string | null;
  exercises: PlannedExercise[];
  completed_sessions_count: number;
  last_completed_at?: string | null;
  in_progress_session_id?: string | null;
}

export interface ProgramSummary {
  id: string;
  name: string;
  description?: string | null;
  goal?: string | null;
  status: string;
  source_run_id?: string | null;
  planned_workouts_count: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ProgramDetail extends ProgramSummary {
  assumptions: string[];
  limitations: string[];
  workouts: PlannedWorkout[];
}

export interface ProgramList {
  items: ProgramSummary[];
  total: number;
}

export interface ProgramCreatePayload {
  run_id: string;
  name?: string;
  description?: string;
  activate?: boolean;
}

export interface ProgramUpdatePayload {
  name?: string;
  description?: string;
  status?: ProgramStatus;
}

export interface ProgramListParams {
  status?: ProgramStatus;
  limit?: number;
  offset?: number;
}

export type WorkoutStatus =
  | "in_progress"
  | "completed"
  | "skipped"
  | "cancelled";

export interface WorkoutSet {
  id: string;
  position: number;
  reps?: number | null;
  weight_kg?: number | null;
  duration_sec?: number | null;
  distance_m?: number | null;
  skipped: boolean;
}

export interface ExerciseResult {
  id: string;
  name: string;
  position: number;
  planned?: Record<string, unknown> | null;
  comment?: string | null;
  sets: WorkoutSet[];
}

export interface WorkoutSummary {
  id: string;
  title: string;
  status: string;
  program_id?: string | null;
  planned_workout_id?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  created_at?: string | null;
}

export interface WorkoutDetail extends WorkoutSummary {
  perceived_exertion?: number | null;
  comment?: string | null;
  exercises: ExerciseResult[];
}

export interface WorkoutList {
  items: WorkoutSummary[];
  total: number;
}

export interface WorkoutSetPayload {
  reps?: number | null;
  weight_kg?: number | null;
  duration_sec?: number | null;
  distance_m?: number | null;
  skipped?: boolean;
}

export interface ExerciseResultPayload {
  name: string;
  comment?: string | null;
  sets: WorkoutSetPayload[];
}

export interface WorkoutCreatePayload {
  planned_workout_id?: string;
  program_id?: string;
  title?: string;
}

export interface WorkoutUpdatePayload {
  status?: WorkoutStatus;
  comment?: string | null;
  perceived_exertion?: number | null;
}

export interface WorkoutExercisesPayload {
  exercises: ExerciseResultPayload[];
}

export interface WorkoutListParams {
  status?: WorkoutStatus;
  program_id?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface ProgramStat {
  program_id: string;
  name: string;
  completed_count: number;
}

export interface WorkoutStats {
  completed_total: number;
  completed_last_7_days: number;
  completed_last_30_days: number;
  by_program: ProgramStat[];
  recent_dates: string[];
}

export interface ExerciseNameStat {
  name: string;
  completed_sessions: number;
}

export interface ExerciseNameList {
  items: ExerciseNameStat[];
}

export interface ExerciseProgressPoint {
  date: string;
  top_weight_kg: number;
  total_reps: number;
  total_volume_kg: number;
}
