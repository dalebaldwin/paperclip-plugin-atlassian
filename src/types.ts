export type SourceSystem = "jira" | "confluence";

export type SourceArtifactKind =
  | "jira_issue"
  | "jpd_item"
  | "confluence_page"
  | "storybook_build";

export type SourceSurface =
  | "jira_comments"
  | "confluence_footer_comments"
  | "confluence_inline_comments"
  | "confluence_footer_comment_replies"
  | "confluence_inline_comment_replies";

export type SourceCommentEventStatus =
  | "new"
  | "routed"
  | "ignored"
  | "blocked";

export type SourceArtifactLifecycleStatus =
  | "registered"
  | "active"
  | "grace"
  | "closed"
  | "archived"
  | "reopened";

export interface SourceArtifactRef {
  id?: string;
  source?: SourceSystem;
  artifactKind?: SourceArtifactKind;
  externalId?: string;
}

export interface RegisterSourceArtifactInput {
  companyId: string;
  source: SourceSystem;
  artifactKind: SourceArtifactKind;
  externalId: string;
  url?: string;
  title?: string;
  status?: SourceArtifactLifecycleStatus;
  ownerLane?: string;
  discoveredFrom?: string;
}

export interface RegisterSourceArtifactEdgeInput {
  companyId: string;
  from: SourceArtifactRef;
  to: SourceArtifactRef;
  relationship: string;
}

export interface RegisterSourceCommentSurfaceInput {
  companyId: string;
  artifact: SourceArtifactRef;
  surface: SourceSurface;
  cursorCommentId?: string;
  cursorVersion?: string | number;
  lastScanAt?: string;
}

export interface SetSourceArtifactLifecycleInput {
  companyId: string;
  artifact: SourceArtifactRef;
  status: SourceArtifactLifecycleStatus;
  reason?: string;
}

export interface ListActiveSurfacesInput {
  companyId: string;
  statuses?: SourceArtifactLifecycleStatus[];
}

export interface SourceSurfaceCoverageFinding {
  artifactId: string;
  source: SourceSystem;
  artifactKind: SourceArtifactKind;
  externalId: string;
  title: string | null;
  missingSurface: SourceSurface;
}

export interface SourceCommentEventInput {
  companyId: string;
  source: SourceSystem;
  artifactKind: SourceArtifactKind;
  artifactExternalId: string;
  artifactUrl?: string;
  artifactTitle?: string;
  surface: SourceSurface;
  externalCommentId: string;
  externalParentCommentId?: string;
  version?: string | number;
  authorDisplayName?: string;
  authorAccountId?: string;
  authorType?: "human" | "agent" | "bot" | "unknown";
  createdAt?: string;
  updatedAt?: string;
  bodyText?: string;
  bodyHash?: string;
  raw?: unknown;
}

export interface NormalizedSourceCommentEvent {
  companyId: string;
  source: SourceSystem;
  artifactKind: SourceArtifactKind;
  artifactExternalId: string;
  artifactUrl: string | null;
  artifactTitle: string | null;
  surface: SourceSurface;
  externalCommentId: string;
  externalParentCommentId: string | null;
  version: string;
  authorDisplayName: string | null;
  authorAccountId: string | null;
  authorType: "human" | "agent" | "bot" | "unknown";
  createdAt: string | null;
  updatedAt: string | null;
  bodyText: string | null;
  bodyHash: string;
  raw: unknown;
}

export interface WebhookEnvelope {
  source: SourceSystem;
  eventType: string;
  webhookEventId: string;
  payload: unknown;
}
