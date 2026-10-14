// Shared rules for public suggestions.

export const MAX_WORDS = 500;
export const MAX_CHARS = 5000; // safety net on top of the word limit
export const MIN_WORDS = 3;
export const MAX_NAME_LENGTH = 60;
export const ANONYMOUS = "Anonymous";

// Spam protection
export const MAX_PER_HOUR = 5; // per connection
export const MAX_PER_DAY = 15; // per connection
export const MAX_PENDING = 200; // stop accepting if nobody has reviewed yet

export const STATUSES = ["pending", "approved", "rejected"];

// Removes invisible control characters (keeps normal line breaks if asked).
function stripControl(text, keepNewlines) {
  const pattern = keepNewlines
    ? /[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g
    : /[\u0000-\u001F\u007F​-‏‪-‮⁦-⁩]/g;

  return text.replace(pattern, "");
}

export function countWords(text) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

// Web links are the most common spam, so they are not accepted at all.
export function containsLink(text) {
  return /(https?:\/\/|www\.|\b[a-z0-9-]{2,}\.(com|net|org|info|biz|xyz|ru|top|site|online|link|ph)\b)/i.test(
    text
  );
}

// Returns { name, message } when valid, or { error } with a friendly message.
export function validateSuggestion(input) {
  const rawName = typeof input?.name === "string" ? input.name : "";
  const rawMessage = typeof input?.message === "string" ? input.message : "";

  let name = stripControl(rawName, false).replace(/\s+/g, " ").trim();

  if (name.length > MAX_NAME_LENGTH) {
    return { error: `Please keep the name under ${MAX_NAME_LENGTH} characters.` };
  }

  if (!name) name = ANONYMOUS;

  const message = stripControl(rawMessage.replace(/\r\n?/g, "\n"), true)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const words = countWords(message);

  if (words < MIN_WORDS) {
    return { error: "Please write a little more so we understand your idea." };
  }

  if (words > MAX_WORDS) {
    return {
      error: `Your suggestion is ${words} words. The limit is ${MAX_WORDS} words.`
    };
  }

  if (message.length > MAX_CHARS) {
    return { error: "Your suggestion is too long. Please shorten it." };
  }

  if (containsLink(message) || containsLink(name)) {
    return { error: "Please do not include web links in your suggestion." };
  }

  return { name, message };
}

// A short summary for the activity log.
export function summarize(row, length = 80) {
  const text = String(row.message ?? "").replace(/\s+/g, " ");
  const short = text.length > length ? `${text.slice(0, length)}...` : text;
  return `${row.name}: ${short}`;
}

export async function hashIp(ip, secret) {
  const data = new TextEncoder().encode(`${ip}|${secret || "sk-canawa"}`);
  const digest = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function parsePage(url) {
  const requested = Number.parseInt(url.searchParams.get("page") || "1", 10);
  return Number.isInteger(requested) && requested > 0 ? requested : 1;
}
