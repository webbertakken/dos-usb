/**
 * The optional birthday message that travels on the stick, in `gift.json`
 * beside the app: `{ recipientName?, message?, from? }`, every field text.
 * No file, or nothing usable in it, means no message.
 */

import path from "path";

export const GIFT_FILE_NAME = "gift.json";

const GIFT_FIELDS = ["recipientName", "message", "from"];
const MAX_FIELD_LENGTH = 2000;
const BYTE_ORDER_MARK = /^\uFEFF/;

const cleanText = (value) =>
  typeof value === "string" ? value.trim().slice(0, MAX_FIELD_LENGTH) : "";

const parseJson = (text) => {
  try {
    return JSON.parse(text.replace(BYTE_ORDER_MARK, ""));
  } catch {
    return null;
  }
};

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** The gift message in `text`, or null when it holds none. */
export function parseGiftMessage(text) {
  const parsed = parseJson(text);
  if (!isPlainObject(parsed)) return null;

  const entries = GIFT_FIELDS.map((field) => [field, cleanText(parsed[field])]).filter(
    ([, value]) => value !== "",
  );
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

/** Read `gift.json` from the portable root; null when absent or unusable. */
export function readGiftMessage({ root, readFile, logger }) {
  const giftPath = path.join(root, GIFT_FILE_NAME);
  let text;
  try {
    text = readFile(giftPath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      logger.info(`[gift] no gift message at ${giftPath}`);
    } else {
      logger.warn(`[gift] could not read ${giftPath}: ${error?.message}`);
    }
    return null;
  }

  const gift = parseGiftMessage(text);
  if (gift) {
    logger.info(`[gift] read a gift message from ${giftPath}`);
  } else {
    logger.warn(`[gift] ${giftPath} has no usable gift message`);
  }
  return gift;
}
