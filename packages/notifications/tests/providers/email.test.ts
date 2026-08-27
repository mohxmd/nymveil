import { describe, expect, mock, test } from "bun:test";
import type { EmailPayload } from "../../src/types";
import { EmailProvider } from "../../src/providers/email";

describe("EmailProvider", () => {
  test("builds plain text and hides internal metadata from recipients", async () => {
    let delivered: EmailPayload | undefined;
    const sendEmailAction = mock(async (payload: EmailPayload) => {
      delivered = payload;
    });
    const provider = new EmailProvider({
      defaultTo: "recipient@example.com",
      sendEmailAction,
    });

    const result = await provider.send({
      title: "Delivery alert",
      message: "A delivery event failed.",
      metadata: {
        detailsUrl: "https://example.com/details/1",
        internalId: "internal-resource-id",
      },
    });

    expect(result).toEqual({ success: true, channel: "email" });
    expect(delivered?.text).toContain("Details Url:");
    expect(delivered?.text).not.toContain("internal-resource-id");
  });

  test("returns a failed channel result when delivery throws", async () => {
    const provider = new EmailProvider({
      defaultTo: "recipient@example.com",
      sendEmailAction: async () => {
        throw new Error("Email delivery failed: provider unavailable");
      },
    });

    const result = await provider.send({
      title: "Delivery alert",
      message: "A delivery event failed.",
    });

    expect(result).toEqual({
      success: false,
      channel: "email",
      error: "Email delivery failed: provider unavailable",
    });
  });
});
