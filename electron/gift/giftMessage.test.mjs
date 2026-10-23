import { describe, it, expect, vi } from "vitest";
import { parseGiftMessage, readGiftMessage, GIFT_FILE_NAME } from "./giftMessage.mjs";

describe("parseGiftMessage", () => {
  it("keeps the recipient, message and sender, trimmed", () => {
    const text = JSON.stringify({
      recipientName: "  Sam ",
      message: " Happy birthday! ",
      from: "Webber",
    });

    expect(parseGiftMessage(text)).toEqual({
      recipientName: "Sam",
      message: "Happy birthday!",
      from: "Webber",
    });
  });

  it("keeps only the fields that are present", () => {
    expect(parseGiftMessage('{"message":"Enjoy"}')).toEqual({ message: "Enjoy" });
  });

  it("drops fields that are not text or are blank", () => {
    expect(parseGiftMessage('{"recipientName":42,"message":"  ","from":"Ann"}')).toEqual({
      from: "Ann",
    });
  });

  it("caps very long text so the welcome stays readable", () => {
    const parsed = parseGiftMessage(JSON.stringify({ message: "a".repeat(5000) }));

    expect(parsed.message).toHaveLength(2000);
  });

  it("answers null for a file with nothing to say", () => {
    expect(parseGiftMessage('{"other":"x"}')).toBeNull();
  });

  it("answers null for JSON that is not an object", () => {
    expect(parseGiftMessage('["Sam"]')).toBeNull();
    expect(parseGiftMessage("null")).toBeNull();
  });

  it("answers null for text that is not JSON", () => {
    expect(parseGiftMessage("{not json")).toBeNull();
  });

  it("accepts a byte order mark, as Windows Notepad writes one", () => {
    expect(parseGiftMessage('\uFEFF{"from":"Mum"}')).toEqual({ from: "Mum" });
  });
});

describe("readGiftMessage", () => {
  const log = () => ({ info: vi.fn(), warn: vi.fn() });

  it("reads gift.json beside the app", () => {
    const readFile = vi.fn(() => '{"recipientName":"Sam"}');
    const logger = log();

    const gift = readGiftMessage({ root: "/stick", readFile, logger });

    expect(readFile).toHaveBeenCalledWith(`/stick/${GIFT_FILE_NAME}`);
    expect(gift).toEqual({ recipientName: "Sam" });
    expect(logger.info).toHaveBeenCalled();
  });

  it("answers null quietly when there is no gift.json", () => {
    const missing = Object.assign(new Error("missing"), { code: "ENOENT" });
    const logger = log();

    const gift = readGiftMessage({
      root: "/stick",
      readFile: () => {
        throw missing;
      },
      logger,
    });

    expect(gift).toBeNull();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("no gift message"));
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("warns and answers null when gift.json cannot be read", () => {
    const logger = log();

    const gift = readGiftMessage({
      root: "/stick",
      readFile: () => {
        throw Object.assign(new Error("denied"), { code: "EACCES" });
      },
      logger,
    });

    expect(gift).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("denied"));
  });

  it("warns when gift.json holds nothing usable", () => {
    const logger = log();

    const gift = readGiftMessage({ root: "/stick", readFile: () => "{oops", logger });

    expect(gift).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("no usable"));
  });
});
