import { describe, expect, test } from "bun:test";
import { buildSlackBlocks } from "../../src/providers/slack";

describe("buildSlackBlocks", () => {
  test("splits metadata into Slack-safe sections and hides internal fields", () => {
    const metadata = Object.fromEntries(
      Array.from({ length: 12 }, (_, index) => [`field${index}`, index]),
    );
    const blocks = buildSlackBlocks({
      title: "Notification received",
      message: "A delivery event occurred.",
      metadata: {
        ...metadata,
        internalId: "internal-resource-id",
      },
    });

    const fieldSections = blocks.filter((block) => block.fields);
    expect(fieldSections).toHaveLength(2);
    expect(fieldSections[0]?.fields).toHaveLength(10);
    expect(fieldSections[1]?.fields).toHaveLength(2);
    expect(JSON.stringify(blocks)).not.toContain("internal-resource-id");
  });

  test("bounds header and message length before calling Slack", () => {
    const blocks = buildSlackBlocks({
      title: "T".repeat(200),
      message: "M".repeat(4000),
    });

    expect(blocks[0]?.text?.text.length).toBe(150);
    expect(blocks[1]?.text?.text.length).toBe(2900);
  });

  test("keeps large payloads within Slack's 50-block limit", () => {
    const blocks = buildSlackBlocks({
      title: "Notification received",
      message: "A notification is ready.",
      metadata: Object.fromEntries(
        Array.from({ length: 1000 }, (_, index) => [`field${index}`, index]),
      ),
      priority: "urgent",
    });

    expect(blocks).toHaveLength(50);
    expect(blocks.at(-1)?.type).toBe("context");
    expect(blocks.at(-1)?.elements?.[0]?.text).toContain("URGENT");
  });
});
