# Paperclip Atlassian Source Intake

Paperclip plugin for tracking Jira, Jira Product Discovery, and Confluence
artifacts that agents need to keep watching for new comments, replies, and
review input.

The plugin gives Paperclip a durable source graph for Atlassian work. It does
not try to be the only Atlassian client in your system. Instead, your agents use
their own Atlassian credentials to read Jira and Confluence, then write the
artifacts, comment surfaces, lifecycle state, and source-comment events into
this plugin.

## What This Is For

Use this plugin when you want Paperclip agents to stop losing track of feedback
that appears after work has already started, moved to review, or recently
merged.

Common examples:

- A Jira Epic gets a new product comment after its child work has started.
- A Jira Bug is added under an active Epic and should be handled by the product
  engineering flow.
- A Confluence design spec receives footer comments, inline comments, nested
  replies, or comments on child pages.
- A generated Storybook or design-review page needs to stay attached to the
  source work until the feature is complete.
- An agent creates or discovers a Jira/Confluence artifact and needs to record
  that future comments on it must be checked.

The plugin is the registry and cursor store. Agents remain responsible for
external API reads and operational decisions.

## What It Provides

- A Paperclip plugin manifest for `paperclip.atlassian-source-intake`
- Plugin-owned database tables for source artifacts, edges, comment surfaces,
  lifecycle state, and source-comment events
- API routes agents can call to register tracked Atlassian content
- Managed Paperclip project, routine, skill, and agent declarations
- A sidebar page and dashboard/settings UI for inspecting tracked sources
- Jira and Confluence webhook endpoint declarations
- Normalization and test coverage for comment events, including nested replies

## What It Does Not Do

- It does not store Atlassian API tokens in plugin settings.
- It does not replace your agent credentials or your Atlassian app setup.
- It does not make routing decisions without an agent or routine reading the
  plugin events.
- It does not guarantee complete coverage unless your agents register every
  relevant artifact and surface they create, update, link, or discover.

## Install

Install from the Paperclip plugin UI using the npm package:

```text
paperclip-plugin-atlassian
```

Or install with the Paperclip CLI:

```bash
paperclipai plugin install paperclip-plugin-atlassian
paperclipai plugin inspect paperclip.atlassian-source-intake
```

For local development:

```bash
pnpm install
pnpm build
paperclipai plugin install <absolute-path-to-this-repo>
paperclipai plugin inspect paperclip.atlassian-source-intake
```

If `paperclipai` is not on `PATH`, use `npx paperclipai`.

## Plugin Settings

Configure the plugin with the Atlassian locations your agents should monitor:

```json
{
  "jiraBaseUrl": "https://example.atlassian.net",
  "confluenceBaseUrl": "https://example.atlassian.net/wiki",
  "projectKeys": ["ENG", "PD"],
  "confluenceSpaceKeys": ["PRODUCT", "DESIGN"],
  "ignoredAuthorPatterns": ["paperclip", "bot", "automation"]
}
```

These settings identify where to look. They are not credentials.

## Required Atlassian Credentials

Your scanning/routing agents need Atlassian credentials outside the plugin. Use
the credential mechanism your Paperclip deployment supports, such as environment
variables, a secret store, or an Atlassian app installation.

For an Atlassian API token based setup, agents usually need:

- `ATLASSIAN_SITE_URL`, for example `https://example.atlassian.net`
- `ATLASSIAN_EMAIL`, for the Atlassian account used with the token
- `ATLASSIAN_API_TOKEN`, or an equivalent secret reference

The account or app should be able to read:

- Jira projects, Epics, Stories, Bugs, Tasks, issue links, issue status, and
  issue comments
- Jira Product Discovery items and comments, if you use JPD
- Confluence pages, page trees, child pages, footer comments, inline comments,
  and nested replies

If your agents also create follow-up Jira work, grant only the write scopes
needed for issue creation and linking.

## Agent Setup

The plugin installs a managed agent declaration named `Atlassian Intake Monitor`
and an hourly reconciliation routine. The routine is intentionally a source sync
contract: the agent must use its Atlassian credentials, then write normalized
state into the plugin.

Adapt this example to your Paperclip agent configuration format:

```yaml
agent:
  name: Atlassian Intake Monitor
  role: operations
  schedule: hourly
  credentials:
    ATLASSIAN_SITE_URL: secret:atlassian-site-url
    ATLASSIAN_EMAIL: secret:atlassian-email
    ATLASSIAN_API_TOKEN: secret:atlassian-api-token
  instructions: |
    You own Atlassian source synchronization for Paperclip.

    On every heartbeat:
    1. Read configured Jira projects, active Epics, active child issues,
       recently completed issues, linked JPD items, and linked Confluence
       design/spec pages.
    2. Recursively read Confluence child pages and all footer comments, inline
       comments, footer-comment replies, and inline-comment replies.
    3. Register every discovered Jira, JPD, Confluence, and Storybook review
       artifact in paperclip.atlassian-source-intake.
    4. Register edges between related artifacts, such as Epic -> Story,
       Jira issue -> Confluence spec, and spec -> child page.
    5. Register comment surfaces for every artifact that can receive feedback.
    6. Record every new human source comment as a plugin event with durable
       source ids, parent ids, timestamps, author, URL, and body hash.
    7. Route actionable new events to the correct Paperclip owner or mark them
       ignored, blocked, or no-action with evidence.
    8. Never mark an Atlassian surface clear while a human comment exists in
       Atlassian but is missing from the plugin graph.
```

## Agent API Contract

Agents should call the plugin routes whenever they create, update, link,
discover, close, archive, or reopen Atlassian source content.

Supported actions:

- `register-artifact` / `POST /artifacts`
- `register-edge` / `POST /artifact-edges`
- `register-surface` / `POST /comment-surfaces`
- `set-lifecycle` / `POST /artifact-lifecycle`
- `active-surfaces` / `GET /active-surfaces`
- `tracked-artifacts` / `GET /tracked-artifacts`
- `source-events` / `GET /events`
- `set-event-status` / `POST /event-status`
- `coverage-audit` / `GET /coverage-audit`
- `record-comment-event` / `POST /comment-events`

Example artifact registration:

```json
{
  "companyId": "your-paperclip-company-id",
  "source": "jira",
  "artifactKind": "jira_issue",
  "externalId": "ENG-123",
  "url": "https://example.atlassian.net/browse/ENG-123",
  "title": "Checkout confirmation flow",
  "status": "active",
  "ownerLane": "product-engineering"
}
```

Example comment event:

```json
{
  "companyId": "your-paperclip-company-id",
  "source": "confluence",
  "artifactKind": "confluence_page",
  "artifactExternalId": "123456789",
  "artifactUrl": "https://example.atlassian.net/wiki/spaces/DESIGN/pages/123456789",
  "artifactTitle": "Checkout confirmation design",
  "surface": "confluence_inline_comment_replies",
  "externalCommentId": "987654321",
  "externalParentCommentId": "987654000",
  "authorDisplayName": "Product Reviewer",
  "authorType": "human",
  "createdAt": "2026-06-10T09:00:00.000Z",
  "bodyText": "The mobile confirmation state is still missing."
}
```

## Covered Surfaces

The plugin models these comment surfaces:

- `jira_comments`
- `confluence_footer_comments`
- `confluence_inline_comments`
- `confluence_footer_comment_replies`
- `confluence_inline_comment_replies`

Nested replies are first-class input surfaces, not edge cases.

## Lifecycle

Artifacts can be marked as:

- `registered`
- `active`
- `grace`
- `closed`
- `archived`
- `reopened`

Heartbeat scans should normally read `registered`, `active`, `grace`, and
`reopened` surfaces. `closed` and `archived` surfaces should not receive routine
polling, but newly observed source activity can reopen them.

## Development

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

## Trust Model

Paperclip alpha plugins are trusted local or npm-installed code. Do not install
this plugin from an untrusted source. Keep Atlassian tokens in your Paperclip
agent, host, or secret-store configuration rather than in plugin settings.
