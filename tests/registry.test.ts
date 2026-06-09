import { describe, expect, it } from "vitest";
import {
  expectedSurfacesForArtifact,
  normalizeArtifactInput,
  normalizeEdgeInput,
  normalizeLifecycleInput,
  normalizeListActiveSurfacesInput,
  normalizeSurfaceInput,
} from "../src/registry.js";

describe("source artifact registry", () => {
  it("normalizes artifact registration with active lifecycle default", () => {
    const artifact = normalizeArtifactInput({
      companyId: " company-1 ",
      source: "confluence",
      artifactKind: "confluence_page",
      externalId: " 109478250 ",
      title: " PD-86 tech spec ",
    });

    expect(artifact).toMatchObject({
      companyId: "company-1",
      source: "confluence",
      artifactKind: "confluence_page",
      externalId: "109478250",
      title: "PD-86 tech spec",
      status: "active",
    });
  });

  it("normalizes edges between registered artifact refs", () => {
    const edge = normalizeEdgeInput({
      companyId: "company-1",
      from: {
        source: "jira",
        artifactKind: "jira_issue",
        externalId: "SJI-1216",
      },
      to: {
        source: "confluence",
        artifactKind: "confluence_page",
        externalId: "109478250",
      },
      relationship: "technical_spec",
    });

    expect(edge.relationship).toBe("technical_spec");
    expect(edge.to.externalId).toBe("109478250");
  });

  it("requires valid comment surfaces", () => {
    expect(() =>
      normalizeSurfaceInput({
        companyId: "company-1",
        artifact: {
          source: "confluence",
          artifactKind: "confluence_page",
          externalId: "109478250",
        },
        surface: "jira_comments",
      }),
    ).not.toThrow();

    expect(() =>
      normalizeSurfaceInput({
        companyId: "company-1",
        artifact: {
          source: "confluence",
          artifactKind: "confluence_page",
          externalId: "109478250",
        },
        surface: "github_pr_comments" as never,
      }),
    ).toThrow(/unsupported source comment surface/);
  });

  it("normalizes lifecycle updates", () => {
    const lifecycle = normalizeLifecycleInput({
      companyId: "company-1",
      artifact: {
        source: "jira",
        artifactKind: "jira_issue",
        externalId: "SJI-1216",
      },
      status: "grace",
      reason: "Epic completed; keep a late-comment grace window.",
    });

    expect(lifecycle.status).toBe("grace");
  });

  it("defaults active surface listing to watchable lifecycle states", () => {
    const input = normalizeListActiveSurfacesInput({ companyId: "company-1" });

    expect(input.statuses).toEqual([
      "registered",
      "active",
      "grace",
      "reopened",
    ]);
  });

  it("declares expected Atlassian surfaces by artifact kind", () => {
    expect(expectedSurfacesForArtifact("jira", "jira_issue")).toEqual([
      "jira_comments",
    ]);
    expect(
      expectedSurfacesForArtifact("confluence", "confluence_page"),
    ).toEqual([
      "confluence_footer_comments",
      "confluence_inline_comments",
      "confluence_footer_comment_replies",
      "confluence_inline_comment_replies",
    ]);
  });
});
