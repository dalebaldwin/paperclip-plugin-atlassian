import { describe, expect, it } from "vitest";
import {
  isNestedCommentSurface,
  normalizeCommentEvent,
  parseAtlassianWebhook,
  stableHash,
} from "../src/intake.js";
import { extractText } from "../src/backfill.js";

describe("source comment intake", () => {
  it("normalizes top-level Jira comments", () => {
    const event = normalizeCommentEvent({
      companyId: "company-1",
      source: "jira",
      artifactKind: "jira_issue",
      artifactExternalId: "SJI-1216",
      surface: "jira_comments",
      externalCommentId: "14416",
      authorDisplayName: "Dale Baldwin",
      bodyText: "Please fix the report naming.",
    });

    expect(event.bodyHash).toBe(stableHash("Please fix the report naming."));
    expect(event.externalParentCommentId).toBeNull();
    expect(event.version).toBe("1");
  });

  it("requires parent ids for nested Confluence replies", () => {
    expect(() =>
      normalizeCommentEvent({
        companyId: "company-1",
        source: "confluence",
        artifactKind: "confluence_page",
        artifactExternalId: "109478250",
        surface: "confluence_inline_comment_replies",
        externalCommentId: "reply-1",
        bodyText: "This reply must be picked up.",
      }),
    ).toThrow(/externalParentCommentId/);
  });

  it("accepts nested Confluence replies when the parent id is present", () => {
    const event = normalizeCommentEvent({
      companyId: "company-1",
      source: "confluence",
      artifactKind: "confluence_page",
      artifactExternalId: "109478250",
      surface: "confluence_footer_comment_replies",
      externalCommentId: "reply-1",
      externalParentCommentId: "comment-1",
      bodyText: "This should become a source event.",
    });

    expect(isNestedCommentSurface(event.surface)).toBe(true);
    expect(event.externalParentCommentId).toBe("comment-1");
  });

  it("normalizes Atlassian webhook envelopes", () => {
    const envelope = parseAtlassianWebhook("jira", "request-1", {
      webhookEvent: "comment_created",
      webhookEventId: "event-1",
    });

    expect(envelope).toMatchObject({
      source: "jira",
      eventType: "comment_created",
      webhookEventId: "event-1",
    });
  });

  it("extracts comment text from Atlassian document bodies", () => {
    expect(
      extractText({
        content: [
          {
            content: [
              { text: "Please" },
              { text: " pick this up" },
            ],
          },
        ],
      }),
    ).toBe("Please pick this up");

    expect(
      extractText({
        storage: { value: "<p>Inline reply <strong>needed</strong></p>" },
      }),
    ).toBe("Inline reply needed");
  });
});
