import type { PluginContext } from "@paperclipai/plugin-sdk";
import type { SourceCommentEventInput } from "./types.js";

type RecordCommentEvent = (input: SourceCommentEventInput) => Promise<unknown>;

export type BackfillJiraIssueInput = {
  companyId: string;
  issueKey: string;
};

export type BackfillConfluencePageInput = {
  companyId: string;
  pageId: string;
  includeChildren?: boolean;
  maxChildPages?: number;
};

type BackfillResult = {
  artifact: string;
  scannedSurfaces: string[];
  recordedEvents: number;
  scannedChildren?: number;
};

type AtlassianConfig = {
  jiraBaseUrl?: string;
  confluenceBaseUrl?: string;
  jiraEmailSecretRef?: string;
  jiraApiTokenSecretRef?: string;
};

type RequestAuth = {
  authorization: string;
};

export async function backfillJiraIssue(
  ctx: PluginContext,
  input: BackfillJiraIssueInput,
  record: RecordCommentEvent,
): Promise<BackfillResult> {
  const companyId = required(input.companyId, "companyId");
  const issueKey = required(input.issueKey, "issueKey").toUpperCase();
  const { config, auth } = await atlassianContext(ctx);
  const jiraBaseUrl = required(config.jiraBaseUrl, "jiraBaseUrl");

  const issue = await fetchJson<Record<string, unknown>>(
    ctx,
    `${trimSlash(jiraBaseUrl)}/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=summary,issuetype`,
    auth,
  );
  const fields = recordValue(issue.fields);
  const summary = stringValue(fields.summary) ?? issueKey;
  const comments = await fetchJiraComments(ctx, jiraBaseUrl, issueKey, auth);

  let recordedEvents = 0;
  for (const comment of comments) {
    const id = required(stringValue(comment.id), "comment.id");
    await record({
      companyId,
      source: "jira",
      artifactKind: "jira_issue",
      artifactExternalId: issueKey,
      artifactUrl: `${trimSlash(jiraBaseUrl)}/browse/${encodeURIComponent(issueKey)}`,
      artifactTitle: summary,
      surface: "jira_comments",
      externalCommentId: id,
      version: stringValue(comment.updated) ?? stringValue(comment.created) ?? "1",
      authorDisplayName: stringValue(recordValue(comment.author).displayName) ?? undefined,
      authorAccountId: stringValue(recordValue(comment.author).accountId) ?? undefined,
      authorType: "human",
      createdAt: stringValue(comment.created) ?? undefined,
      updatedAt: stringValue(comment.updated) ?? undefined,
      bodyText: extractText(comment.body),
      raw: comment,
    });
    recordedEvents += 1;
  }

  return {
    artifact: issueKey,
    scannedSurfaces: ["jira_comments"],
    recordedEvents,
  };
}

export async function backfillConfluencePage(
  ctx: PluginContext,
  input: BackfillConfluencePageInput,
  record: RecordCommentEvent,
): Promise<BackfillResult> {
  const companyId = required(input.companyId, "companyId");
  const pageId = required(input.pageId, "pageId");
  const { config, auth } = await atlassianContext(ctx);
  const confluenceBaseUrl = required(config.confluenceBaseUrl, "confluenceBaseUrl");

  const result = await backfillSingleConfluencePage(
    ctx,
    { companyId, pageId, confluenceBaseUrl, auth },
    record,
  );

  let scannedChildren = 0;
  if (input.includeChildren) {
    const maxChildPages = Math.max(0, Math.min(input.maxChildPages ?? 25, 100));
    const children = await fetchConfluenceChildPages(
      ctx,
      confluenceBaseUrl,
      pageId,
      auth,
      maxChildPages,
    );
    for (const child of children) {
      const childId = stringValue(child.id);
      if (!childId) continue;
      await backfillSingleConfluencePage(
        ctx,
        { companyId, pageId: childId, confluenceBaseUrl, auth },
        record,
      );
      scannedChildren += 1;
    }
  }

  return {
    ...result,
    scannedChildren,
  };
}

async function backfillSingleConfluencePage(
  ctx: PluginContext,
  input: {
    companyId: string;
    pageId: string;
    confluenceBaseUrl: string;
    auth: RequestAuth;
  },
  record: RecordCommentEvent,
): Promise<BackfillResult> {
  const baseUrl = trimSlash(input.confluenceBaseUrl);
  const page = await fetchJson<Record<string, unknown>>(
    ctx,
    `${baseUrl}/wiki/api/v2/pages/${encodeURIComponent(input.pageId)}`,
    input.auth,
  );
  const pageTitle = stringValue(page.title) ?? input.pageId;
  const pageUrl = webUrl(baseUrl, page);
  const footerComments = await fetchConfluenceComments(
    ctx,
    baseUrl,
    `/wiki/api/v2/pages/${encodeURIComponent(input.pageId)}/footer-comments?body-format=storage&limit=50`,
    input.auth,
  );
  const inlineComments = await fetchConfluenceComments(
    ctx,
    baseUrl,
    `/wiki/api/v2/pages/${encodeURIComponent(input.pageId)}/inline-comments?body-format=storage&limit=50`,
    input.auth,
    true,
  );

  let recordedEvents = 0;
  for (const comment of footerComments) {
    recordedEvents += await recordConfluenceComment(ctx, input, record, {
      comment,
      surface: "confluence_footer_comments",
      pageTitle,
      pageUrl,
    });
    const children = await fetchConfluenceComments(
      ctx,
      baseUrl,
      `/wiki/api/v2/footer-comments/${encodeURIComponent(required(stringValue(comment.id), "comment.id"))}/children?body-format=storage&limit=50`,
      input.auth,
      true,
    );
    for (const child of children) {
      recordedEvents += await recordConfluenceComment(ctx, input, record, {
        comment: child,
        parentCommentId: stringValue(comment.id) ?? undefined,
        surface: "confluence_footer_comment_replies",
        pageTitle,
        pageUrl,
      });
    }
  }

  for (const comment of inlineComments) {
    recordedEvents += await recordConfluenceComment(ctx, input, record, {
      comment,
      surface: "confluence_inline_comments",
      pageTitle,
      pageUrl,
    });
    const children = await fetchConfluenceComments(
      ctx,
      baseUrl,
      `/wiki/api/v2/inline-comments/${encodeURIComponent(required(stringValue(comment.id), "comment.id"))}/children?body-format=storage&limit=50`,
      input.auth,
      true,
    );
    for (const child of children) {
      recordedEvents += await recordConfluenceComment(ctx, input, record, {
        comment: child,
        parentCommentId: stringValue(comment.id) ?? undefined,
        surface: "confluence_inline_comment_replies",
        pageTitle,
        pageUrl,
      });
    }
  }

  return {
    artifact: input.pageId,
    scannedSurfaces: [
      "confluence_footer_comments",
      "confluence_inline_comments",
      "confluence_footer_comment_replies",
      "confluence_inline_comment_replies",
    ],
    recordedEvents,
  };
}

async function recordConfluenceComment(
  _ctx: PluginContext,
  input: {
    companyId: string;
    pageId: string;
  },
  record: RecordCommentEvent,
  options: {
    comment: Record<string, unknown>;
    surface:
      | "confluence_footer_comments"
      | "confluence_inline_comments"
      | "confluence_footer_comment_replies"
      | "confluence_inline_comment_replies";
    parentCommentId?: string;
    pageTitle: string;
    pageUrl: string | null;
  },
) {
  const id = required(stringValue(options.comment.id), "comment.id");
  await record({
    companyId: input.companyId,
    source: "confluence",
    artifactKind: "confluence_page",
    artifactExternalId: input.pageId,
    artifactUrl: options.pageUrl ?? undefined,
    artifactTitle: options.pageTitle,
    surface: options.surface,
    externalCommentId: id,
    externalParentCommentId: options.parentCommentId,
    version:
      stringValue(recordValue(options.comment.version).number) ??
      stringValue(recordValue(options.comment.version).createdAt) ??
      "1",
    authorDisplayName:
      stringValue(recordValue(options.comment.version).authorId) ?? undefined,
    authorAccountId:
      stringValue(recordValue(options.comment.version).authorId) ?? undefined,
    authorType: "human",
    createdAt: stringValue(recordValue(options.comment.version).createdAt) ?? undefined,
    updatedAt: stringValue(recordValue(options.comment.version).createdAt) ?? undefined,
    bodyText: extractText(recordValue(options.comment.body)),
    raw: options.comment,
  });
  return 1;
}

async function atlassianContext(ctx: PluginContext) {
  const config = (await ctx.config.get()) as AtlassianConfig;
  const emailRef = required(config.jiraEmailSecretRef, "jiraEmailSecretRef");
  const tokenRef = required(config.jiraApiTokenSecretRef, "jiraApiTokenSecretRef");
  const email = await ctx.secrets.resolve(emailRef);
  const token = await ctx.secrets.resolve(tokenRef);
  return {
    config,
    auth: {
      authorization: `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`,
    },
  };
}

async function fetchJiraComments(
  ctx: PluginContext,
  jiraBaseUrl: string,
  issueKey: string,
  auth: RequestAuth,
) {
  const comments: Record<string, unknown>[] = [];
  let startAt = 0;
  for (;;) {
    const page = await fetchJson<Record<string, unknown>>(
      ctx,
      `${trimSlash(jiraBaseUrl)}/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment?startAt=${startAt}&maxResults=100&orderBy=created`,
      auth,
    );
    const values = arrayValue(page.comments);
    comments.push(...values);
    startAt += values.length;
    const total = Number(page.total ?? comments.length);
    if (values.length === 0 || startAt >= total) break;
  }
  return comments;
}

async function fetchConfluenceComments(
  ctx: PluginContext,
  baseUrl: string,
  path: string,
  auth: RequestAuth,
  optional = false,
) {
  const comments: Record<string, unknown>[] = [];
  let nextPath: string | null = path;
  while (nextPath) {
    const page = await fetchJson<Record<string, unknown> | null>(
      ctx,
      `${baseUrl}${nextPath}`,
      auth,
      optional,
    );
    if (!page) break;
    comments.push(...arrayValue(page.results));
    nextPath = stringValue(recordValue(page._links).next);
  }
  return comments;
}

async function fetchConfluenceChildPages(
  ctx: PluginContext,
  baseUrl: string,
  pageId: string,
  auth: RequestAuth,
  maxPages: number,
) {
  if (maxPages === 0) return [];
  const children: Record<string, unknown>[] = [];
  let nextPath: string | null = `/wiki/api/v2/pages/${encodeURIComponent(pageId)}/children?limit=${Math.min(maxPages, 50)}`;
  while (nextPath && children.length < maxPages) {
    const page = await fetchJson<Record<string, unknown> | null>(
      ctx,
      `${baseUrl}${nextPath}`,
      auth,
      true,
    );
    if (!page) break;
    children.push(
      ...arrayValue(page.results).filter((entry) => {
        const type = stringValue(entry.type);
        return !type || type === "page";
      }),
    );
    nextPath = stringValue(recordValue(page._links).next);
  }
  return children.slice(0, maxPages);
}

async function fetchJson<T>(
  ctx: PluginContext,
  url: string,
  auth: RequestAuth,
  optional = false,
): Promise<T> {
  const response = await ctx.http.fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: auth.authorization,
    },
  });
  if (optional && response.status === 404) {
    return null as T;
  }
  if (!response.ok) {
    throw new Error(`Atlassian request failed (${response.status}): ${url}`);
  }
  return (await response.json()) as T;
}

export function extractText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  if (typeof record.value === "string") {
    return stripHtml(record.value);
  }
  if (typeof record.text === "string") {
    return record.text;
  }
  const parts: string[] = [];
  for (const child of Object.values(record)) {
    if (Array.isArray(child)) {
      parts.push(...child.map(extractText));
    } else if (child && typeof child === "object") {
      parts.push(extractText(child));
    }
  }
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function webUrl(baseUrl: string, value: Record<string, unknown>): string | null {
  const webui = stringValue(recordValue(value._links).webui);
  return webui ? `${baseUrl}${webui}` : null;
}

function required(value: unknown, field: string): string {
  const result = stringValue(value);
  if (!result) throw new Error(`${field} is required`);
  return result;
}

function stringValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function arrayValue(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => {
        return item && typeof item === "object" && !Array.isArray(item);
      })
    : [];
}

function trimSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
