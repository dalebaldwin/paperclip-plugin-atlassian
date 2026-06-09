import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "paperclip.atlassian-source-intake",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Atlassian Source Intake",
  description:
    "Builds a canonical Jira/Confluence artifact graph and routes new source comments into Paperclip.",
  author: "Dale Baldwin",
  categories: ["connector", "automation", "ui"],
  capabilities: [
    "api.routes.register",
    "database.namespace.migrate",
    "database.namespace.read",
    "database.namespace.write",
    "http.outbound",
    "secrets.read-ref",
    "jobs.schedule",
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
      jiraEmailSecretRef: {
        type: "string",
        title: "Jira email secret ref",
      },
      jiraApiTokenSecretRef: {
        type: "string",
        title: "Jira API token secret ref",
      },
      webhookSecretRef: {
        type: "string",
        title: "Webhook verification secret ref",
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
  jobs: [
    {
      jobKey: "hourly-reconcile",
      displayName: "Hourly Atlassian reconciliation",
      description:
        "Reconciles active Jira/Confluence artifact comments and replies.",
      schedule: "0 * * * *",
    },
    {
      jobKey: "daily-deep-scan",
      displayName: "Daily Atlassian deep scan",
      description:
        "Audits artifact graph coverage, child pages, and missed comment surfaces.",
      schedule: "17 3 * * *",
    },
  ],
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
        "Reviews Atlassian source-comment events, routes actionable feedback, and audits missed Jira/Confluence comment surfaces.",
      adapterPreference: ["codex_local", "claude_local", "process"],
      instructions: {
        content:
          "You monitor normalized Jira and Confluence source-comment events created by the Atlassian Source Intake plugin. Do not crawl Atlassian independently unless the plugin asks for a reconciliation check. Route actionable events to the correct Paperclip owner and preserve source comment ids.",
      },
    },
  ],
  routines: [
    {
      routineKey: "hourly-atlassian-comment-reconciliation",
      title: "Hourly Atlassian comment reconciliation",
      description:
        "Review plugin-detected Jira and Confluence source-comment events and route any missed actionable feedback.",
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
        type: "settingsPage",
        id: "settings",
        displayName: "Atlassian Intake",
        exportName: "SettingsPage",
      },
    ],
  },
};

export default manifest;
