# Paperclip Atlassian Source Intake

Reliable Jira and Confluence source-comment intake for Paperclip.

This plugin is intended to make Atlassian comments first-class Paperclip source
events. It exists because agent prompts and hourly heuristics are not reliable
enough for comments added to Jira issues, Confluence design specs, child pages,
inline comments, or nested comment replies after work is already in progress.

## Current Status

This repository is an initial scaffold. It defines:

- a Paperclip plugin manifest
- Jira and Confluence webhook endpoints
- hourly and daily reconciliation jobs
- a plugin-owned database namespace
- a canonical artifact/comment event schema
- managed Paperclip project, agent, routine, and skill declarations
- minimal dashboard/settings UI
- tests for source-comment event normalization, including nested replies

The full Atlassian REST scanners are intentionally next-step work.

## Why This Exists

Paperclip agents should not each rediscover where Atlassian comments might live.
The plugin should own the reliable integration layer:

```text
Atlassian webhook or reconciliation scan
  -> artifact graph
  -> source comment surface cursor
  -> source comment event
  -> Paperclip issue or wakeup
  -> owning agent
```

## Covered Source Surfaces

The model explicitly includes:

- `jira_comments`
- `confluence_footer_comments`
- `confluence_inline_comments`
- `confluence_footer_comment_replies`
- `confluence_inline_comment_replies`

Nested replies are treated as required surfaces, not edge cases.

## Development

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

For local Paperclip development:

```bash
pnpm dev
paperclipai plugin install <absolute-path-to-plugin>
paperclipai plugin inspect paperclip.atlassian-source-intake
```

If `paperclipai` is not on `PATH`, use `npx paperclipai`.

For a published package install, use the package name instead of a local path:

```bash
paperclipai plugin install paperclip-plugin-atlassian
paperclipai plugin inspect paperclip.atlassian-source-intake
```

## Planned MVP

1. Implement Jira REST client with service-account secret refs.
2. Implement Confluence REST client with footer comments, inline comments, and
   child reply traversal.
3. Convert Jira/Confluence webhook payloads into source-comment events.
4. Add hourly scanner for active artifacts and recently completed artifacts.
5. Add daily graph coverage audit for missing child pages/comment surfaces.
6. Route new human comments into Paperclip issues with durable origin ids.
7. Add settings UI for project keys, Confluence spaces, and ignored authors.

## Trust Model

Paperclip alpha plugins are trusted local or npm-installed code. Do not install
this plugin from an untrusted source. Store secrets as Paperclip secret
references and resolve them at runtime; never persist resolved secret values.
