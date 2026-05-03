// Shared types used across the API, components, and DB layer.
// Kept deliberately small for v1 — extend as we evolve toward etasks integration.

export type Stage = "idea" | "design" | "build" | "test" | "ship";

export const STAGES: Stage[] = ["idea", "design", "build", "test", "ship"];

export const STAGE_LABELS: Record<Stage, string> = {
  idea: "Idea",
  design: "Design",
  build: "Build",
  test: "Test",
  ship: "Ship",
};

// Card category — the area of the business an idea relates to. Now editable
// by admins via /admin/taxonomy, so the value is just a string (the name).
export type Category = string;

// Card type — the nature of the work. Same: dynamically managed.
export type CardType = string;

// Shared shape for editable-taxonomy items.
export interface TaxonomyItem {
  id: number;
  name: string;
  color: string | null;
  archived: number;
  sort_order: number;
  created_at: string;
}

export type EmploymentType = "FTE" | "Consulting" | "Gig" | "Intern" | "Other";
export type WorkMode = "Inhouse" | "Remote" | "Hybrid";
export type AccessPolicy = "standard" | "restricted";

export const EMPLOYMENT_TYPES: EmploymentType[] = ["FTE", "Consulting", "Gig", "Intern", "Other"];
export const WORK_MODES: WorkMode[] = ["Inhouse", "Remote", "Hybrid"];

export interface User {
  id: number;
  username: string;
  email: string | null;
  display_name: string;
  role: "admin" | "tech" | "non_tech";
  must_change_password: number; // 0 or 1
  phone: string | null;
  title: string | null;            // job title (e.g. "COO")
  bio: string | null;
  employment_type: EmploymentType | null;
  work_mode: WorkMode | null;
  profile_picture_url: string | null;
  access_policy: AccessPolicy;
  created_at: string;
}

export type ProjectVisibility = "public" | "private";

export interface Project {
  id: number;
  name: string;
  description: string | null;
  color: string | null; // ColorToken (see lib/colors.ts) or null
  visibility: ProjectVisibility;
  created_by: number | null;
  archived: number; // SQLite bool: 0/1 — also used as "hidden" in the UI
  created_at: string;
}

export interface ProjectMember {
  project_id: number;
  user_id: number;
  role: "member" | "lead";
  granted_by: number;
  granted_at: string;
  display_name?: string; // populated from JOIN
  email?: string | null;
}

export interface Card {
  id: number;
  project_id: number;
  title: string;
  description: string | null;
  // What the originator imagines / desired outcome — useful for non-tech ideators.
  imagined_outcome: string | null;
  stage: Stage;
  position: number; // ordering within a column
  category: Category | null;
  card_type: CardType | null;
  deadline: string | null; // ISO date (YYYY-MM-DD) or YYYY-MM-DDTHH:MM
  created_by: number; // user id
  assignee_id: number | null;
  // External form submission fields
  external_submitter_name: string | null;
  external_submitter_email: string | null;
  from_form_id: number | null;
  suggested_project_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShareableForm {
  id: number;
  token: string;
  name: string;
  project_id: number | null;
  allow_suggest_new_project: number;
  default_category: string | null;
  thank_you_message: string | null;
  submit_button_label: string | null;
  active: number;
  created_by: number;
  created_at: string;
  expires_at: string | null;
}

export interface StageHistoryEntry {
  id: number;
  card_id: number;
  stage: Stage;
  entered_at: string;
}

export interface Invitation {
  token: string;
  email: string;
  display_name: string;
  role: User["role"];
  invited_by: number;
  created_at: string;
  expires_at: string;
  used: number;
  used_at: string | null;
}

export interface CardWithMeta extends Card {
  project_name: string;
  created_by_name: string;
  assignee_name: string | null;
  comment_count: number;
  attachment_count: number;
  collaborator_count: number;
  current_stage_entered_at: string | null; // when the card entered its current stage
}

export interface Collaborator {
  user_id: number;
  display_name: string;
  username: string;
  email: string | null;
  added_at: string;
  added_by_name: string;
}

export interface Comment {
  id: number;
  card_id: number;
  author_id: number;
  author_name: string;
  body: string;
  created_at: string;
}

export interface Attachment {
  id: number;
  card_id: number;
  label: string;
  // For v1, attachments are URL pointers (Box, Drive, GitHub link, local file path, etc.)
  url: string;
  added_by: number;
  created_at: string;
}

export interface SessionUser {
  id: number;
  username: string;
  display_name: string;
  role: User["role"];
  must_change_password: number;
}
