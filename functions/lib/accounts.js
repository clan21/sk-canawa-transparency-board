// Shared rules for admin (SK member) accounts.

export const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/;
export const DISPLAY_NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} .'’-]{0,59}$/u;
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 1024;

// Letters and digits without look-alikes (no 0/O, 1/l/I).
const PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

// Example result: kT7m-Qx3N-pR9w-Ze4b (16 random characters).
export function generatePassword() {
  const limit = 256 - (256 % PASSWORD_ALPHABET.length); // avoids a biased pick
  const groups = [];

  for (let g = 0; g < 4; g++) {
    let group = "";

    while (group.length < 4) {
      const bytes = crypto.getRandomValues(new Uint8Array(8));

      for (const byte of bytes) {
        if (byte < limit && group.length < 4) {
          group += PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length];
        }
      }
    }

    groups.push(group);
  }

  return groups.join("-");
}

// Reads the optional "password" field of a request.
// Typed by the superadmin -> used as given (after the length check).
// Left empty -> a strong random one is generated.
// Returns { password } or { error }.
export function chooseNewPassword(body) {
  const given = body.password;

  if (given === undefined || given === null || given === "") {
    return { password: generatePassword() };
  }

  if (
    typeof given !== "string" ||
    given.length < MIN_PASSWORD_LENGTH ||
    given.length > MAX_PASSWORD_LENGTH
  ) {
    return {
      error: `The password must be at least ${MIN_PASSWORD_LENGTH} characters.`
    };
  }

  return { password: given };
}

export function parseAccountId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// What the dashboard is allowed to see about an account (never the hash).
export function publicAccount(row) {
  return {
    id: row.id,
    username: row.username,
    display_name: row.display_name,
    role: row.role,
    is_active: row.is_active === 1 ? 1 : 0
  };
}

// Text saved in the activity log for account actions.
export function accountLabel(row) {
  return `${row.display_name} (${row.username})`;
}
