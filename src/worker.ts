import {
  definePlugin,
  runWorker,
  type PluginApiRequestInput,
  type PluginContext,
  type PluginWebhookInput,
} from "@paperclipai/plugin-sdk";
import {
  isRecord,
  normalizeCommentEvent,
  parseAtlassianWebhook,
  stringField,
} from "./intake.js";
import type { NormalizedSourceCommentEvent, SourceCommentEventInput } from "./types.js";

type JsonObject = Record<string, unknown>;

function table(namespace: string, name: string): string {
  return `${namespace}.${name}`;
}

async function upsertArtifact(
  ctx: PluginContext,
  event: NormalizedSourceCommentEvent,
): Promise<string> {
  const rows = await ctx.db.query<{ id: string }>(
    `INSERT INTO ${table(ctx.db.namespace, "source_artifacts")}
      (company_id, source, artifact_kind, external_id, url, title, last_seen_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (company_id, source, artifact_kind, external_id)
     DO UPDATE SET
       url = COALESCE(EXCLUDED.url, ${table(ctx.db.namespace, "source_artifacts")}.url),
       title = COALESCE(EXCLUDED.title, ${table(ctx.db.namespace, "source_artifacts")}.title),
       last_seen_at = now(),
       updated_at = now()
     RETURNING id`,
    [
      event.companyId,
      event.source,
      event.artifactKind,
      event.artifactExternalId,
      event.artifactUrl,
      event.artifactTitle,
    ],
  );

  const id = rows[0]?.id;
  if (!id) {
    throw new Error("source_artifacts upsert returned no id");
  }
  return id;
}

async function upsertSurface(
  ctx: PluginContext,
  artifactId: string,
  event: NormalizedSourceCommentEvent,
): Promise<string> {
  const rows = await ctx.db.query<{ id: string }>(
    `INSERT INTO ${table(ctx.db.namespace, "source_comment_surfaces")}
      (artifact_id, surface, cursor_comment_id, last_scan_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (artifact_id, surface)
     DO UPDATE SET
       cursor_comment_id = EXCLUDED.cursor_comment_id,
       last_scan_at = now(),
       updated_at = now()
     RETURNING id`,
    [artifactId, event.surface, event.externalCommentId],
  );

  const id = rows[0]?.id;
  if (!id) {
    throw new Error("source_comment_surfaces upsert returned no id");
  }
  return id;
}

async function recordCommentEvent(
  ctx: PluginContext,
  input: SourceCommentEventInput,
): Promise<{ eventId: string; artifactId: string; inserted: boolean }> {
  const event = normalizeCommentEvent(input);
  const artifactId = await upsertArtifact(ctx, event);
  const surfaceId = await upsertSurface(ctx, artifactId, event);

  const rows = await ctx.db.query<{ id: string; inserted: boolean }>(
    `WITH inserted AS (
       INSERT INTO ${table(ctx.db.namespace, "source_comment_events")}
         (
           company_id,
           artifact_id,
           surface_id,
           source,
           surface,
           external_comment_id,
           external_parent_comment_id,
           version,
           author_display_name,
           author_account_id,
           author_type,
           created_at_external,
           updated_at_external,
           body_text,
           body_hash,
           raw_payload,
           status
         )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::timestamptz, $13::timestamptz, $14, $15, $16::jsonb, 'new')
       ON CONFLICT (company_id, source, surface, external_comment_id, version)
       DO NOTHING
       RETURNING id, true AS inserted
     )
     SELECT id, inserted FROM inserted
     UNION ALL
     SELECT id, false AS inserted
     FROM ${table(ctx.db.namespace, "source_comment_events")}
     WHERE company_id = $1
       AND source = $4
       AND surface = $5
       AND external_comment_id = $6
       AND version = $8
     LIMIT 1`,
    [
      event.companyId,
      artifactId,
      surfaceId,
      event.source,
      event.surface,
      event.externalCommentId,
      event.externalParentCommentId,
      event.version,
      event.authorDisplayName,
      event.authorAccountId,
      event.authorType,
      event.createdAt,
      event.updatedAt,
      event.bodyText,
      event.bodyHash,
      JSON.stringify(event.raw),
    ],
  );

  const row = rows[0];
  if (!row) {
    throw new Error("source_comment_events upsert returned no row");
  }

  return { eventId: row.id, artifactId, inserted: row.inserted };
}

async function recordWebhookDelivery(
  ctx: PluginContext,
  input: PluginWebhookInput,
): Promise<void> {
  const envelope = parseAtlassianWebhook(
    input.endpointKey,
    input.requestId,
    input.parsedBody,
  );

  await ctx.db.execute(
    `INSERT INTO ${table(ctx.db.namespace, "webhook_deliveries")}
      (request_id, endpoint_key, source, event_type, external_event_id, raw_body, parsed_body, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'received')
     ON CONFLICT (request_id) DO NOTHING`,
    [
      input.requestId,
      input.endpointKey,
      envelope.source,
      envelope.eventType,
      envelope.webhookEventId,
      input.rawBody,
      JSON.stringify(envelope.payload),
    ],
  );
}

async function intakeStatus(ctx: PluginContext, companyId?: string | null) {
  const params = companyId ? [companyId] : [];
  const where = companyId ? "WHERE company_id = $1" : "";
  const eventRows = await ctx.db.query<{
    status: string;
    count: string;
  }>(
    `SELECT status, count(*)::text AS count
     FROM ${table(ctx.db.namespace, "source_comment_events")}
     ${where}
     GROUP BY status
     ORDER BY status`,
    params,
  );
  const artifactRows = await ctx.db.query<{ count: string }>(
    `SELECT count(*)::text AS count
     FROM ${table(ctx.db.namespace, "source_artifacts")}
     ${where}`,
    params,
  );
  const deliveryRows = await ctx.db.query<{ status: string; count: string }>(
    `SELECT status, count(*)::text AS count
     FROM ${table(ctx.db.namespace, "webhook_deliveries")}
     GROUP BY status
     ORDER BY status`,
  );

  return {
    artifactCount: Number(artifactRows[0]?.count ?? 0),
    eventCounts: Object.fromEntries(
      eventRows.map((row) => [row.status, Number(row.count)]),
    ),
    webhookDeliveryCounts: Object.fromEntries(
      deliveryRows.map((row) => [row.status, Number(row.count)]),
    ),
  };
}

const plugin = definePlugin({
  async setup(ctx) {
    setupContext = ctx;

    ctx.actions.register("setup-company", async (params) => {
      const companyId = stringField(params.companyId);
      if (!companyId) {
        throw new Error("companyId is required");
      }
      const project = await ctx.projects.managed.reconcile(
        "atlassian-intake",
        companyId,
      );
      const agent = await ctx.agents.managed.reconcile(
        "atlassian-intake-monitor",
        companyId,
      );
      const routine = await ctx.routines.managed.reconcile(
        "hourly-atlassian-comment-reconciliation",
        companyId,
      );
      const skill = await ctx.skills.managed.reconcile(
        "atlassian-source-event-routing",
        companyId,
      );
      return { project, agent, routine, skill };
    });

    ctx.actions.register("record-comment-event", async (params) => {
      return recordCommentEvent(ctx, params as unknown as SourceCommentEventInput);
    });

    ctx.data.register("status", async (params) => {
      return intakeStatus(ctx, stringField(params.companyId));
    });

    ctx.jobs.register("hourly-reconcile", async (job) => {
      ctx.logger.info("Atlassian hourly reconciliation job fired", {
        runId: job.runId,
        status: "scanner-pending",
      });
    });

    ctx.jobs.register("daily-deep-scan", async (job) => {
      ctx.logger.info("Atlassian daily deep scan job fired", {
        runId: job.runId,
        status: "coverage-audit-pending",
      });
    });
  },

  async onApiRequest(input: PluginApiRequestInput) {
    if (input.routeKey === "status") {
      return {
        body: await intakeStatus(
          currentContext(),
          stringField(input.query.companyId),
        ),
      };
    }

    if (input.routeKey === "ingest-comment") {
      if (!isRecord(input.body)) {
        return { status: 400, body: { error: "JSON object body required" } };
      }
      const result = await recordCommentEvent(
        currentContext(),
        input.body as unknown as SourceCommentEventInput,
      );
      return { status: result.inserted ? 201 : 200, body: result };
    }

    return { status: 404, body: { error: `Unknown route ${input.routeKey}` } };
  },

  async onWebhook(input: PluginWebhookInput) {
    await recordWebhookDelivery(currentContext(), input);
  },

  async onHealth() {
    return {
      status: "ok",
      message: "Atlassian Source Intake worker is running",
      details: {
        surfaces: [
          "jira_comments",
          "confluence_footer_comments",
          "confluence_inline_comments",
          "confluence_footer_comment_replies",
          "confluence_inline_comment_replies",
        ],
      },
    };
  },
});

let setupContext: PluginContext | null = null;

function currentContext(): PluginContext {
  if (!setupContext) {
    throw new Error("Plugin context is not ready");
  }
  return setupContext;
}

export default plugin;
export { recordCommentEvent, recordWebhookDelivery, intakeStatus };
runWorker(plugin, import.meta.url);
