import { describe, expect, it } from "vitest";
import { isSafeWebhookUrl } from "../delivery/webhook";

describe("isSafeWebhookUrl", () => {
  it("accepts a well-formed HTTPS URL", () => {
    expect(isSafeWebhookUrl("https://hooks.slack.com/services/T00/B00/xyz").safe).toBe(true);
  });

  it("rejects HTTP (non-TLS) URLs", () => {
    const result = isSafeWebhookUrl("http://hooks.slack.com/services/T00/B00/xyz");
    expect(result.safe).toBe(false);
    expect(result.reason).toMatch(/https/i);
  });

  it("rejects malformed URLs", () => {
    expect(isSafeWebhookUrl("not-a-url").safe).toBe(false);
  });

  it("rejects loopback addresses", () => {
    expect(isSafeWebhookUrl("https://127.0.0.1/hook").safe).toBe(false);
    expect(isSafeWebhookUrl("https://localhost/hook").safe).toBe(false);
  });

  it("rejects private network ranges", () => {
    expect(isSafeWebhookUrl("https://10.0.0.5/hook").safe).toBe(false);
    expect(isSafeWebhookUrl("https://192.168.1.1/hook").safe).toBe(false);
    expect(isSafeWebhookUrl("https://172.16.0.1/hook").safe).toBe(false);
  });
});
