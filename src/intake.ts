import { createHash } from "node:crypto";
import type {
  NormalizedSourceCommentEvent,
  SourceCommentEventInput,
  SourceSurface,
  SourceSystem,
  WebhookEnvelope,
} from "./types.js";

const KNOWN_SURFACES = new Set<SourceSurface>([
  "jira_comments",
  "confluence_footer_comments",
  "confluence_inline_comments",
  "confluence_footer_comment_replies",
  "confluence_inline_comment_replies",
  "github_pr_comments",
  "github_review_threads",
]);

export function stableHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function isNestedCommentSurface(surface: SourceSurface): boolean {
  return (
    surface === "confluence_footer_comment_replies" ||
    surface === "confluence_inline_comment_replies" ||
    surface === "github_review_threads"
  );
}

export function normalizeCommentEvent(
  input: SourceCommentEventInput,
): NormalizedSourceCommentEvent {
  const missing = [
    ["companyId", input.companyId],
    ["source", input.source],
    ["artifactKind", input.artifactKind],
    ["artifactExternalId", input.artifactExternalId],
    ["surface", input.surface],
    ["externalCommentId", input.externalCommentId],
  ].filter(([, value]) => typeof value !== "string" || value.trim() === "");

  if (missing.length > 0) {
    throw new Error(
      `Missing required source comment event field(s): ${missing
        .map(([key]) => key)
        .join(", ")}`,
    );
  }

  if (!KNOWN_SURFACES.has(input.surface)) {
    throw new Error(`Unsupported comment surface: ${input.surface}`);
  }

  if (isNestedCommentSurface(input.surface) && !input.externalParentCommentId) {
    throw new Error(
      `${input.surface} events must include externalParentCommentId`,
    );
  }

  const bodyText = input.bodyText?.trim() || null;
  const bodyHash = input.bodyHash || stableHash(bodyText ?? "");

  return {
    companyId: input.companyId.trim(),
    source: input.source,
    artifactKind: input.artifactKind,
    artifactExternalId: input.artifactExternalId.trim(),
    artifactUrl: input.artifactUrl?.trim() || null,
    artifactTitle: input.artifactTitle?.trim() || null,
    surface: input.surface,
    externalCommentId: input.externalCommentId.trim(),
    externalParentCommentId: input.externalParentCommentId?.trim() || null,
    version: String(input.version ?? "1"),
    authorDisplayName: input.authorDisplayName?.trim() || null,
    authorAccountId: input.authorAccountId?.trim() || null,
    authorType: input.authorType ?? "unknown",
    createdAt: input.createdAt ?? null,
    updatedAt: input.updatedAt ?? null,
    bodyText,
    bodyHash,
    raw: input.raw ?? null,
  };
}

export function parseAtlassianWebhook(
  endpointKey: string,
  requestId: string,
  parsedBody: unknown,
): WebhookEnvelope {
  if (endpointKey !== "jira" && endpointKey !== "confluence") {
    throw new Error(`Unsupported Atlassian webhook endpoint: ${endpointKey}`);
  }

  const body = isRecord(parsedBody) ? parsedBody : {};
  const eventType = stringField(
    body.webhookEvent,
    body.eventType,
    body.event,
    body.type,
  );

  return {
    source: endpointKey,
    eventType: eventType || "unknown",
    webhookEventId:
      stringField(body.webhookEventId, body.id, body.eventId) || requestId,
    payload: parsedBody ?? null,
  };
}

export function stringField(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
