import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "paperclip.atlassian-source-intake",
  apiVersion: 1,
  version: "0.1.14",
  displayName: "Atlassian Source Intake",
  description:
    "Builds a canonical Jira/Confluence artifact graph and routes new source comments into Paperclip.",
  author: "Dale Baldwin",
  categories: ["connector", "automation", "ui"],
  capabilities: [
    "api.routes.register",
    "companies.read",
    "database.namespace.migrate",
    "database.namespace.read",
    "database.namespace.write",
    "webhooks.receive",
    "issues.read",
    "issues.create",
    "issues.wakeup",
    "issue.relations.read",
    "issue.relations.write",
    "activity.log.write",
    "projects.managed",
    "routines.managed",
    "agents.managed",
    "skills.managed",
    "instance.settings.register",
    "ui.dashboardWidget.register",
    "ui.page.register",
    "ui.sidebar.register",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      jiraBaseUrl: {
        type: "string",
        title: "Jira base URL",
        description: "Example: https://example.atlassian.net",
      },
      confluenceBaseUrl: {
        type: "string",
        title: "Confluence base URL",
        description: "Example: https://example.atlassian.net/wiki",
      },
      projectKeys: {
        type: "array",
        title: "Jira project keys",
        items: { type: "string" },
        default: [],
      },
      confluenceSpaceKeys: {
        type: "array",
        title: "Confluence space keys",
        items: { type: "string" },
        default: [],
      },
      ignoredAuthorPatterns: {
        type: "array",
        title: "Ignored author patterns",
        items: { type: "string" },
        default: ["paperclip", "bot", "automation", "codex", "coderabbit"],
      },
    },
    required: ["jiraBaseUrl", "confluenceBaseUrl"],
  },
  database: {
    namespaceSlug: "atlassian_source_intake",
    migrationsDir: "migrations",
    coreReadTables: ["issues", "issue_comments", "agents", "projects"],
  },
  webhooks: [
    {
      endpointKey: "jira",
      displayName: "Jira webhook",
      description: "Receives Jira issue and comment webhook events.",
    },
    {
      endpointKey: "confluence",
      displayName: "Confluence webhook",
      description: "Receives Confluence page and comment webhook events.",
    },
  ],
  jobs: [],
  apiRoutes: [
    {
      routeKey: "status",
      method: "GET",
      path: "/status",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "query", key: "companyId" },
    },
    {
      routeKey: "ingest-comment",
      method: "POST",
      path: "/comment-events",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "body", key: "companyId" },
    },
    {
      routeKey: "register-artifact",
      method: "POST",
      path: "/artifacts",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "body", key: "companyId" },
    },
    {
      routeKey: "register-edge",
      method: "POST",
      path: "/artifact-edges",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "body", key: "companyId" },
    },
    {
      routeKey: "register-surface",
      method: "POST",
      path: "/comment-surfaces",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "body", key: "companyId" },
    },
    {
      routeKey: "set-lifecycle",
      method: "POST",
      path: "/artifact-lifecycle",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "body", key: "companyId" },
    },
    {
      routeKey: "active-surfaces",
      method: "GET",
      path: "/active-surfaces",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "query", key: "companyId" },
    },
    {
      routeKey: "tracked-artifacts",
      method: "GET",
      path: "/tracked-artifacts",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "query", key: "companyId" },
    },
    {
      routeKey: "source-events",
      method: "GET",
      path: "/events",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "query", key: "companyId" },
    },
    {
      routeKey: "set-event-status",
      method: "POST",
      path: "/event-status",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "body", key: "companyId" },
    },
    {
      routeKey: "coverage-audit",
      method: "GET",
      path: "/coverage-audit",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "query", key: "companyId" },
    },
  ],
  projects: [
    {
      projectKey: "atlassian-intake",
      displayName: "Atlassian Intake",
      description:
        "Operational work created by the Atlassian Source Intake plugin.",
      status: "in_progress",
    },
  ],
  agents: [
    {
      agentKey: "atlassian-intake-monitor",
      displayName: "Atlassian Intake Monitor",
      role: "operations",
      title: "Atlassian Intake Monitor",
      capabilities:
        "Uses agent-owned Atlassian credentials to discover Jira/JPD/Confluence comments, writes normalized source events into the plugin graph, routes actionable feedback, and audits missed comment surfaces.",
      adapterPreference: ["codex_local", "claude_local", "process"],
      instructions: {
        content:
          "You own Atlassian source synchronization for this plugin. On each heartbeat, use your normal Atlassian credentials to scan configured Jira/JPD issues, Confluence pages, child pages, footer comments, inline comments, and nested replies. Register artifacts, surfaces, lifecycle, and normalized source-comment events through the Atlassian Source Intake plugin APIs, then route actionable events to the correct Paperclip owner while preserving source comment ids.",
      },
    },
  ],
  routines: [
    {
      routineKey: "hourly-atlassian-comment-reconciliation",
      title: "Hourly Atlassian comment reconciliation",
      description:
        "Synchronize Jira/JPD/Confluence source-comment surfaces into the plugin graph, then route missed actionable feedback.",
      assigneeRef: {
        resourceKind: "agent",
        resourceKey: "atlassian-intake-monitor",
      },
      projectRef: {
        resourceKind: "project",
        resourceKey: "atlassian-intake",
      },
      priority: "high",
      triggers: [
        {
          kind: "schedule",
          label: "Hourly",
          cronExpression: "5 * * * *",
          timezone: "UTC",
          enabled: false,
          signingMode: null,
          replayWindowSec: null,
        },
      ],
    },
  ],
  skills: [
    {
      skillKey: "atlassian-source-event-routing",
      displayName: "Atlassian Source Event Routing",
      description:
        "Classify Jira and Confluence source-comment events without losing nested replies or child-page context.",
    },
  ],
  ui: {
    slots: [
      {
        type: "dashboardWidget",
        id: "atlassian-intake-health",
        displayName: "Atlassian Intake",
        exportName: "DashboardWidget",
      },
      {
        type: "page",
        id: "atlassian-intake",
        displayName: "Atlassian Intake",
        exportName: "AtlassianIntakePage",
        routePath: "atlassian-intake",
      },
      {
        type: "sidebar",
        id: "atlassian-intake-sidebar",
        displayName: "Atlassian Intake",
        exportName: "AtlassianSidebarLink",
      },
      {
        type: "settingsPage",
        id: "settings",
        displayName: "Atlassian Intake",
        exportName: "SettingsPage",
      },
    ],
  },
};

export default manifest;
