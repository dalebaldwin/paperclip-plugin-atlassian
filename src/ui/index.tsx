import * as React from "react";
import {
  useHostContext,
  useHostNavigation,
  usePluginAction,
  usePluginData,
} from "@paperclipai/plugin-sdk/ui";
import type { PluginSidebarProps } from "@paperclipai/plugin-sdk/ui";

type StatusData = {
  artifactCount: number;
  eventCounts: Record<string, number>;
  webhookDeliveryCounts: Record<string, number>;
};

type TrackedArtifact = {
  id: string;
  source: string;
  artifactKind: string;
  externalId: string;
  url: string | null;
  title: string | null;
  status: string | null;
  ownerLane: string | null;
  updatedAt: string | null;
  surfaces: Array<{
    id: string;
    surface: string;
    cursorCommentId: string | null;
    cursorVersion: string | null;
    lastScanAt: string | null;
  }>;
  eventCounts: Record<string, number>;
};

type TrackedArtifactsData = {
  artifacts: TrackedArtifact[];
};

type CoverageData = {
  checkedArtifacts: number;
  missingSurfaces: Array<{
    artifactId: string;
    source: string;
    artifactKind: string;
    externalId: string;
    title: string | null;
    missingSurface: string;
  }>;
};

type SourceCommentEvent = {
  id: string;
  artifactKind: string;
  artifactExternalId: string;
  artifactTitle: string | null;
  artifactUrl: string | null;
  surface: string;
  externalCommentId: string;
  authorDisplayName: string | null;
  bodyText: string | null;
  status: string;
  createdAt: string;
};

type SourceEventsData = {
  events: SourceCommentEvent[];
};

const pageStyle: React.CSSProperties = {
  maxWidth: 1180,
  padding: 24,
  display: "grid",
  gap: 24,
};

const sectionStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const cellStyle: React.CSSProperties = {
  borderTop: "1px solid #e5e7eb",
  padding: "8px 10px",
  textAlign: "left",
  verticalAlign: "top",
};

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
};

function formatCounts(counts: Record<string, number>) {
  return (
    Object.entries(counts)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ") || "none"
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString();
}

function StatusSummary() {
  const host = useHostContext();
  const status = usePluginData<StatusData>("status", {
    companyId: host.companyId,
  });

  if (status.loading) {
    return <div>Loading Atlassian intake status...</div>;
  }

  if (status.error) {
    return <div>Failed to load Atlassian intake status.</div>;
  }

  const data = status.data ?? {
    artifactCount: 0,
    eventCounts: {},
    webhookDeliveryCounts: {},
  };

  return (
    <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
      <div>
        <strong>Artifacts</strong>
        <div>{data.artifactCount}</div>
      </div>
      <div>
        <strong>Comment events</strong>
        <div>{formatCounts(data.eventCounts)}</div>
      </div>
      <div>
        <strong>Webhook deliveries</strong>
        <div>{formatCounts(data.webhookDeliveryCounts)}</div>
      </div>
    </div>
  );
}

export function AtlassianSidebarLink({ context }: PluginSidebarProps) {
  const hostNavigation = useHostNavigation();
  const href = hostNavigation.resolveHref("/atlassian-intake");
  const isActive =
    typeof window !== "undefined" && window.location.pathname === href;

  if (!context.companyId) {
    return null;
  }

  return (
    <a
      {...hostNavigation.linkProps("/atlassian-intake")}
      aria-current={isActive ? "page" : undefined}
      className={[
        "flex items-center gap-2.5 px-3 py-2 pointer-coarse:py-1.5 text-[13px] font-medium transition-colors",
        isActive
          ? "bg-accent text-foreground"
          : "text-foreground/80 hover:bg-accent/50 hover:text-foreground",
      ].join(" ")}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v6A2.5 2.5 0 0 1 17.5 16H10l-4 3v-3.2A2.5 2.5 0 0 1 4 13.3Z" />
        <path d="M8 9h8" />
        <path d="M8 12h5" />
      </svg>
      <span className="flex-1 truncate">Atlassian Intake</span>
    </a>
  );
}

function BackfillControls() {
  const host = useHostContext();
  const backfillJiraIssue = usePluginAction("backfill-jira-issue");
  const backfillConfluencePage = usePluginAction("backfill-confluence-page");
  const reconcileActiveSurfaces = usePluginAction("reconcile-active-surfaces");
  const [issueKey, setIssueKey] = React.useState("");
  const [pageId, setPageId] = React.useState("");
  const [includeChildren, setIncludeChildren] = React.useState(true);
  const [message, setMessage] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  function run(action: Promise<unknown>, success: string) {
    setBusy(true);
    setMessage("");
    action
      .then(() => setMessage(success))
      .catch(() => setMessage("Backfill failed. Check plugin logs and credentials."))
      .finally(() => setBusy(false));
  }

  return (
    <section style={sectionStyle}>
      <h2>Backfill Inputs</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          aria-label="Jira issue key"
          placeholder="SJI-1216"
          value={issueKey}
          onChange={(event) => setIssueKey(event.currentTarget.value)}
        />
        <button
          type="button"
          disabled={busy || !issueKey.trim()}
          onClick={() =>
            run(
              backfillJiraIssue({
                companyId: host.companyId,
                issueKey,
              }),
              "Jira issue backfill completed.",
            )
          }
        >
          Backfill Jira issue
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          aria-label="Confluence page id"
          placeholder="Confluence page id"
          value={pageId}
          onChange={(event) => setPageId(event.currentTarget.value)}
        />
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={includeChildren}
            onChange={(event) => setIncludeChildren(event.currentTarget.checked)}
          />
          Include child pages
        </label>
        <button
          type="button"
          disabled={busy || !pageId.trim()}
          onClick={() =>
            run(
              backfillConfluencePage({
                companyId: host.companyId,
                pageId,
                includeChildren,
                maxChildPages: 25,
              }),
              "Confluence page backfill completed.",
            )
          }
        >
          Backfill Confluence page
        </button>
      </div>
      <div>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(
              reconcileActiveSurfaces({ companyId: host.companyId }),
              "Active Atlassian surface reconciliation completed.",
            )
          }
        >
          Reconcile active surfaces
        </button>
      </div>
      {message ? <p>{message}</p> : null}
    </section>
  );
}

function LifecycleButtons({
  artifact,
  onResult,
}: {
  artifact: TrackedArtifact;
  onResult: (message: string) => void;
}) {
  const host = useHostContext();
  const setLifecycle = usePluginAction("set-lifecycle");
  const statuses = ["active", "grace", "closed", "archived"];

  return (
    <div style={buttonRowStyle}>
      {statuses.map((status) => (
        <button
          key={status}
          type="button"
          disabled={artifact.status === status}
          onClick={() => {
            setLifecycle({
              companyId: host.companyId,
              artifact: { id: artifact.id },
              status,
              reason: "Updated from Atlassian Source Intake plugin UI",
            })
              .then(() => onResult(`Lifecycle set to ${status}.`))
              .catch(() => onResult("Lifecycle update failed."));
          }}
        >
          {status}
        </button>
      ))}
    </div>
  );
}

function TrackedArtifacts() {
  const host = useHostContext();
  const artifacts = usePluginData<TrackedArtifactsData>("tracked-artifacts", {
    companyId: host.companyId,
  });
  const [message, setMessage] = React.useState("");

  if (artifacts.loading) {
    return <section style={sectionStyle}>Loading tracked Atlassian artifacts...</section>;
  }

  if (artifacts.error) {
    return <section style={sectionStyle}>Failed to load tracked artifacts.</section>;
  }

  const rows = artifacts.data?.artifacts ?? [];

  return (
    <section style={sectionStyle}>
      <h2>Tracked Artifacts</h2>
      {message ? <p>{message}</p> : null}
      {rows.length === 0 ? (
        <p>No active Atlassian artifacts are being tracked.</p>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={cellStyle}>Artifact</th>
              <th style={cellStyle}>Status</th>
              <th style={cellStyle}>Surfaces</th>
              <th style={cellStyle}>Events</th>
              <th style={cellStyle}>Lifecycle</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((artifact) => (
              <tr key={artifact.id}>
                <td style={cellStyle}>
                  <div>
                    <strong>{artifact.title ?? artifact.externalId}</strong>
                  </div>
                  <div>
                    {artifact.source} / {artifact.artifactKind}
                  </div>
                  {artifact.url ? <a href={artifact.url}>{artifact.externalId}</a> : artifact.externalId}
                </td>
                <td style={cellStyle}>
                  <div>{artifact.status ?? "registered"}</div>
                  <div>{artifact.ownerLane ?? "-"}</div>
                  <div>{formatDate(artifact.updatedAt)}</div>
                </td>
                <td style={cellStyle}>
                  {artifact.surfaces.length === 0
                    ? "none"
                    : artifact.surfaces.map((surface) => (
                        <div key={surface.id}>
                          {surface.surface}
                          {surface.lastScanAt ? ` (${formatDate(surface.lastScanAt)})` : ""}
                        </div>
                      ))}
                </td>
                <td style={cellStyle}>{formatCounts(artifact.eventCounts)}</td>
                <td style={cellStyle}>
                  <LifecycleButtons artifact={artifact} onResult={setMessage} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function CoverageGaps() {
  const host = useHostContext();
  const coverage = usePluginData<CoverageData>("coverage-audit", {
    companyId: host.companyId,
  });

  if (coverage.loading) {
    return <section style={sectionStyle}>Loading coverage audit...</section>;
  }

  if (coverage.error) {
    return <section style={sectionStyle}>Failed to load coverage audit.</section>;
  }

  const gaps = coverage.data?.missingSurfaces ?? [];
  return (
    <section style={sectionStyle}>
      <h2>Coverage Gaps</h2>
      {gaps.length === 0 ? (
        <p>No missing active surfaces.</p>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={cellStyle}>Artifact</th>
              <th style={cellStyle}>Missing surface</th>
            </tr>
          </thead>
          <tbody>
            {gaps.map((gap) => (
              <tr key={`${gap.artifactId}:${gap.missingSurface}`}>
                <td style={cellStyle}>{gap.title ?? gap.externalId}</td>
                <td style={cellStyle}>{gap.missingSurface}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function RecentEvents() {
  const host = useHostContext();
  const events = usePluginData<SourceEventsData>("source-events", {
    companyId: host.companyId,
    limit: 25,
  });
  const setEventStatus = usePluginAction("set-event-status");
  const [message, setMessage] = React.useState("");

  if (events.loading) {
    return <section style={sectionStyle}>Loading recent comment events...</section>;
  }

  if (events.error) {
    return <section style={sectionStyle}>Failed to load recent comment events.</section>;
  }

  const rows = events.data?.events ?? [];
  return (
    <section style={sectionStyle}>
      <h2>Recent Events</h2>
      {message ? <p>{message}</p> : null}
      {rows.length === 0 ? (
        <p>No comment events have been recorded.</p>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={cellStyle}>Event</th>
              <th style={cellStyle}>Artifact</th>
              <th style={cellStyle}>Status</th>
              <th style={cellStyle}>Route</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((event) => (
              <tr key={event.id}>
                <td style={cellStyle}>
                  <div>{event.surface}</div>
                  <div>{event.authorDisplayName ?? "unknown"}</div>
                  <div>{formatDate(event.createdAt)}</div>
                  <div>{event.bodyText?.slice(0, 160) ?? ""}</div>
                </td>
                <td style={cellStyle}>
                  {event.artifactUrl ? (
                    <a href={event.artifactUrl}>
                      {event.artifactTitle ?? event.artifactExternalId}
                    </a>
                  ) : (
                    event.artifactTitle ?? event.artifactExternalId
                  )}
                </td>
                <td style={cellStyle}>{event.status}</td>
                <td style={cellStyle}>
                  <div style={buttonRowStyle}>
                    {["routed", "ignored", "blocked"].map((status) => (
                      <button
                        key={status}
                        type="button"
                        disabled={event.status === status}
                        onClick={() => {
                          setEventStatus({
                            companyId: host.companyId,
                            eventId: event.id,
                            status,
                            reason: "Updated from Atlassian Source Intake plugin UI",
                          })
                            .then(() => setMessage(`Event marked ${status}.`))
                            .catch(() => setMessage("Event status update failed."));
                        }}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export function DashboardWidget() {
  return (
    <section style={{ display: "grid", gap: 12 }}>
      <h3>Atlassian Intake</h3>
      <StatusSummary />
    </section>
  );
}

export function AtlassianIntakePage() {
  return (
    <main style={pageStyle}>
      <h1>Atlassian Source Intake</h1>
      <StatusSummary />
      <BackfillControls />
      <TrackedArtifacts />
      <CoverageGaps />
      <RecentEvents />
    </main>
  );
}

export function SettingsPage() {
  const host = useHostContext();
  const setupCompany = usePluginAction("setup-company");
  const [status, setStatus] = React.useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  return (
    <main style={{ maxWidth: 760, padding: 24 }}>
      <h1>Atlassian Intake Settings</h1>
      <p>
        Configure Jira and Confluence credentials in the plugin instance
        settings, then reconcile managed Paperclip resources for each company.
      </p>
      <button
        type="button"
        onClick={() => {
          setStatus("loading");
          setupCompany({ companyId: host.companyId })
            .then(() => setStatus("success"))
            .catch(() => setStatus("error"));
        }}
      >
        Reconcile managed resources
      </button>
      {status === "loading" ? <p>Reconciling...</p> : null}
      {status === "error" ? <p>Reconciliation failed.</p> : null}
      {status === "success" ? <p>Managed resources reconciled.</p> : null}
    </main>
  );
}
