export type SourceSystem = "jira" | "confluence";

export type SourceArtifactKind =
  | "jira_issue"
  | "jpd_item"
  | "confluence_page"
  | "github_pr"
  | "storybook_build";

export type SourceSurface =
  | "jira_comments"
  | "confluence_footer_comments"
  | "confluence_inline_comments"
  | "confluence_footer_comment_replies"
  | "confluence_inline_comment_replies"
  | "github_pr_comments"
  | "github_review_threads";

export type SourceCommentEventStatus =
  | "new"
  | "routed"
  | "ignored"
  | "blocked";

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
