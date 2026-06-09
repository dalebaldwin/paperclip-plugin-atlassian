import type {
  ListActiveSurfacesInput,
  RegisterSourceArtifactEdgeInput,
  RegisterSourceArtifactInput,
  RegisterSourceCommentSurfaceInput,
  SetSourceArtifactLifecycleInput,
  SourceArtifactKind,
  SourceArtifactLifecycleStatus,
  SourceArtifactRef,
  SourceSurface,
  SourceSystem,
} from "./types.js";

export const DEFAULT_ACTIVE_LIFECYCLE_STATUSES: SourceArtifactLifecycleStatus[] =
  ["registered", "active", "grace", "reopened"];

export const LIFECYCLE_STATUSES = new Set<SourceArtifactLifecycleStatus>([
  "registered",
  "active",
  "grace",
  "closed",
  "archived",
  "reopened",
]);

export const ATLASSIAN_COMMENT_SURFACES = new Set<SourceSurface>([
  "jira_comments",
  "confluence_footer_comments",
  "confluence_inline_comments",
  "confluence_footer_comment_replies",
  "confluence_inline_comment_replies",
]);

export function normalizeArtifactInput(
  input: RegisterSourceArtifactInput,
): RegisterSourceArtifactInput {
  const companyId = requiredString(input.companyId, "companyId");
  const source = input.source;
  const artifactKind = input.artifactKind;
  const externalId = requiredString(input.externalId, "externalId");
  const status = input.status ?? "active";

  validateLifecycleStatus(status);
  validateArtifactKind(source, artifactKind);

  return {
    companyId,
    source,
    artifactKind,
    externalId,
    url: optionalString(input.url),
    title: optionalString(input.title),
    status,
    ownerLane: optionalString(input.ownerLane),
    discoveredFrom: optionalString(input.discoveredFrom),
  };
}

export function normalizeArtifactRef(ref: SourceArtifactRef): SourceArtifactRef {
  if (optionalString(ref.id)) {
    return { id: optionalString(ref.id) };
  }

  const source = ref.source;
  const artifactKind = ref.artifactKind;
  const externalId = requiredString(ref.externalId, "artifact.externalId");

  validateArtifactKind(source, artifactKind);

  return {
    source,
    artifactKind,
    externalId,
  };
}

export function normalizeEdgeInput(
  input: RegisterSourceArtifactEdgeInput,
): RegisterSourceArtifactEdgeInput {
  return {
    companyId: requiredString(input.companyId, "companyId"),
    from: normalizeArtifactRef(input.from),
    to: normalizeArtifactRef(input.to),
    relationship: requiredString(input.relationship, "relationship"),
  };
}

export function normalizeSurfaceInput(
  input: RegisterSourceCommentSurfaceInput,
): RegisterSourceCommentSurfaceInput {
  validateSurface(input.surface);
  return {
    companyId: requiredString(input.companyId, "companyId"),
    artifact: normalizeArtifactRef(input.artifact),
    surface: input.surface,
    cursorCommentId: optionalString(input.cursorCommentId),
    cursorVersion:
      input.cursorVersion === undefined ? undefined : String(input.cursorVersion),
    lastScanAt: optionalString(input.lastScanAt),
  };
}

export function normalizeLifecycleInput(
  input: SetSourceArtifactLifecycleInput,
): SetSourceArtifactLifecycleInput {
  validateLifecycleStatus(input.status);
  return {
    companyId: requiredString(input.companyId, "companyId"),
    artifact: normalizeArtifactRef(input.artifact),
    status: input.status,
    reason: optionalString(input.reason),
  };
}

export function normalizeListActiveSurfacesInput(
  input: ListActiveSurfacesInput,
): ListActiveSurfacesInput {
  const statuses = input.statuses?.length
    ? input.statuses
    : DEFAULT_ACTIVE_LIFECYCLE_STATUSES;
  for (const status of statuses) {
    validateLifecycleStatus(status);
  }
  return {
    companyId: requiredString(input.companyId, "companyId"),
    statuses,
  };
}

export function expectedSurfacesForArtifact(
  source: SourceSystem,
  artifactKind: SourceArtifactKind,
): SourceSurface[] {
  if (source === "jira" || artifactKind === "jira_issue" || artifactKind === "jpd_item") {
    return ["jira_comments"];
  }

  if (artifactKind === "confluence_page" || artifactKind === "storybook_build") {
    return [
      "confluence_footer_comments",
      "confluence_inline_comments",
      "confluence_footer_comment_replies",
      "confluence_inline_comment_replies",
    ];
  }

  return [];
}

function validateArtifactKind(
  source: SourceSystem | undefined,
  artifactKind: SourceArtifactKind | undefined,
) {
  if (source !== "jira" && source !== "confluence") {
    throw new Error("source must be jira or confluence");
  }
  if (
    artifactKind !== "jira_issue" &&
    artifactKind !== "jpd_item" &&
    artifactKind !== "confluence_page" &&
    artifactKind !== "storybook_build"
  ) {
    throw new Error("unsupported artifactKind");
  }
}

function validateLifecycleStatus(status: SourceArtifactLifecycleStatus) {
  if (!LIFECYCLE_STATUSES.has(status)) {
    throw new Error(`unsupported artifact lifecycle status: ${status}`);
  }
}

function validateSurface(surface: SourceSurface) {
  if (!ATLASSIAN_COMMENT_SURFACES.has(surface)) {
    throw new Error(`unsupported source comment surface: ${surface}`);
  }
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} is required`);
  }
  return value.trim();
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}
