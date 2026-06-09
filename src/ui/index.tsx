import * as React from "react";
import {
  MarkdownBlock,
  useHostContext,
  usePluginAction,
  usePluginData,
} from "@paperclipai/plugin-sdk/ui";

type StatusData = {
  artifactCount: number;
  eventCounts: Record<string, number>;
  webhookDeliveryCounts: Record<string, number>;
};

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
    <div style={{ display: "grid", gap: 8 }}>
      <div>
        <strong>Artifacts:</strong> {data.artifactCount}
      </div>
      <div>
        <strong>Comment events:</strong>{" "}
        {Object.entries(data.eventCounts)
          .map(([key, value]) => `${key}: ${value}`)
          .join(", ") || "none"}
      </div>
      <div>
        <strong>Webhook deliveries:</strong>{" "}
        {Object.entries(data.webhookDeliveryCounts)
          .map(([key, value]) => `${key}: ${value}`)
          .join(", ") || "none"}
      </div>
    </div>
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
    <main style={{ maxWidth: 960, padding: 24 }}>
      <h1>Atlassian Source Intake</h1>
      <StatusSummary />
      <MarkdownBlock
        content={[
          "## Covered surfaces",
          "",
          "- Jira issue comments",
          "- Confluence footer comments",
          "- Confluence inline comments",
          "- Confluence footer comment replies",
          "- Confluence inline comment replies",
          "",
          "Webhook intake and reconciliation scanners write to the same source-comment event tables.",
        ].join("\n")}
      />
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
