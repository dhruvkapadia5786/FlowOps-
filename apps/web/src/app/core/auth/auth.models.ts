export type OrgRole =
  | 'admin'
  | 'devops'
  | 'developer'
  | 'release_manager'
  | 'viewer';

export interface AuthUserSummary {
  id: string;
  email: string;
  fullName: string;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
}

export interface Membership {
  role: OrgRole;
  organization: OrganizationSummary;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: AuthUserSummary;
  organization?: OrganizationSummary | null;
  role?: OrgRole | null;
}

export interface MeResponse {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  createdAt: string;
  memberships: Membership[];
}

export interface LoginRequest {
  email: string;
  password: string;
}
