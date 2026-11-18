export interface User {
  id: string;
  name: string;
  email?: string;
  school: string;
  major: string;
  skills: string[];
  skillLevels?: SkillLevel[];
  reputation?: Reputation;
  match?: Match;
  interests: string[];
  experience: string;
  portfolio: string;
  hours: number;
  availability?: string;
  bio: string;
  role: string;
  status: string;
  reasons?: string[];
  blocked?: boolean;
  projects?: Project[];
  portfolioEntries?: Portfolio[];
}
export interface Project {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  category: string;
  project_type: string;
  goal: string;
  duration: number;
  capacity: number;
  skills: string[];
  roles: string[];
  roleRequirements?: RoleRequirement[];
  completed_at?: string | null;
  match?: Match;
  hours: number;
  availability?: string;
  status: string;
  visibility: string;
  created_at: string;
  member_count: number;
  owner: User;
  members?: Member[];
  application?: Application[];
  reasons?: string[];
}
export interface Member {
  id: string;
  user_id: string;
  role: string;
  user: User;
}
export interface Application {
  id: string;
  project_id: string;
  user_id: string;
  role: string;
  introduction: string;
  status: string;
  question: string;
  answer: string;
  reason: string;
  created_at: string;
  project: Project;
  user: User;
}
export interface Portfolio {
  id: string;
  title: string;
  url: string;
  contribution: string;
}
export interface Notification {
  id: string;
  title: string;
  link: string;
  is_read: number;
  created_at: string;
}
export interface Message {
  id: string;
  user_id: string;
  body: string;
  user: User;
  created_at: string;
  attachments: { id: string; name: string; size: number }[];
}
export interface Report {
  id: string;
  user_id: string;
  target_type: string;
  target_id: string;
  reason: string;
  description: string;
  status: string;
  decision: string;
  created_at: string;
}
export interface Audit {
  id: string;
  admin_id: string;
  action: string;
  reason: string;
  created_at: string;
  target_type: string;
  target_id: string;
  before_state: string;
  after_state: string;
}
export interface Page<T> {
  items: T[];
  total: number;
  pages: number;
  page: number;
}

export interface SkillLevel { skill: string; level: number }
export interface SkillRequirement { skill: string; minLevel: number; weight: number; required: boolean }
export interface RoleRequirement {
  role: string; hours: number; hoursRequired: boolean; configured?: boolean; skills: SkillRequirement[];
}
export interface Reputation {
  count: number; reviewers: number; average: number | null; adjusted: number; confidence: number;
  dimensions: { quality: number | null; reliability: number | null; communication: number | null };
}
export interface Match {
  score: number; role: string; projectId: string; projectName: string; reasons: string[];
  breakdown: { skills: number; availability: number; interest: number; reputation: number };
  ungradedSkills: number;
}
export interface PeerReview {
  id: string; project_id: string; author_id: string; author_name: string; project_name: string;
  target_role: string; quality: number; reliability: number; communication: number; comment: string; created_at: string;
}

