export interface OAuthProvider {
  key: string;
  name: string;
  appId: string;
  secret: string;
  enabled: boolean;
}

export interface Project {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  name: string;
  description: string;
  teamId: string;
  logo: string;
  url: string;
  legalName: string;
  legalCountry: string;
  legalState: string;
  legalCity: string;
  legalAddress: string;
  legalTaxId: string;

  authDuration: number;
  authLimit: number;
  authSessionsLimit: number;
  authPasswordHistory: number;
  authPasswordDictionary: boolean;
  authPersonalDataCheck: boolean;
  authMockNumbers: any[];
  authSessionAlerts: boolean;
  authMembershipsUserName: boolean;
  authMembershipsUserEmail: boolean;
  authMembershipsMfa: boolean;
  authInvalidateSessions: boolean;

  oAuthProviders: OAuthProvider[];

  platforms: any[];
  webhooks: any[];
  keys: any[];
  devKeys: any[];

  smtpEnabled: boolean;
  smtpSenderName: string;
  smtpSenderEmail: string;
  smtpReplyTo: string;
  smtpHost: string;
  smtpPort: string | number;
  smtpUsername: string;
  smtpPassword: string;
  smtpSecure: string;

  pingCount: number;
  pingedAt: string;

  authEmailPassword: boolean;
  authUsersAuthMagicURL: boolean;
  authEmailOtp: boolean;
  authAnonymous: boolean;
  authInvites: boolean;
  authJWT: boolean;
  authPhone: boolean;

  serviceStatusForAccount: boolean;
  serviceStatusForAvatars: boolean;
  serviceStatusForDatabases: boolean;
  serviceStatusForTablesdb: boolean;
  serviceStatusForLocale: boolean;
  serviceStatusForHealth: boolean;
  serviceStatusForStorage: boolean;
  serviceStatusForTeams: boolean;
  serviceStatusForUsers: boolean;
  serviceStatusForSites: boolean;
  serviceStatusForFunctions: boolean;
  serviceStatusForGraphql: boolean;
  serviceStatusForMessaging: boolean;

  region: string;
  status: string;

  billingLimits: Record<string, any>;
  blocks: any[];
}

export interface ProjectsResponse {
  total: number;
  projects: Project[];
}
