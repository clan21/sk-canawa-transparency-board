// Creates a new admin (SK member) account.
//
// Run it from the project folder:
//
//     node scripts/create-admin.mjs
//
// It asks for a username, a display name and a password, then writes a small
// SQL file (.wrangler/new-admin.sql) and prints the exact commands to run.
// The password is never stored anywhere: only a salted hash goes in the file.
// It uses the same hashing code as the login (functions/lib/password.js).

import { randomInt } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { hashPassword } from "../functions/lib/password.js";

const DB_NAME = "sk-canawa-transparency-db";
const ROLE = "admin"; // the superadmin account is only created by hand
const SQL_PATH = ".wrangler/new-admin.sql";

// Letters and digits without look-alikes (no 0/O, 1/l/I).
const PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

// ---------------------------------------------------------------------------
// Reading what the user types (the password is hidden while typing)
// ---------------------------------------------------------------------------
let queuedLines = null; // used only when input is piped in (testing)

function askFromPipe(question) {
  if (queuedLines === null) {
    queuedLines = readFileSync(0, "utf8").split(/\r?\n/);
  }

  if (queuedLines.length === 0) {
    console.error("\nNo more input was provided.");
    process.exit(1);
  }

  process.stdout.write(question + "\n");
  return Promise.resolve(queuedLines.shift());
}

function ask(question, { hidden = false } = {}) {
  if (!process.stdin.isTTY) return askFromPipe(question);

  return new Promise((resolve) => {
    const stdin = process.stdin;
    let value = "";
    let inEscape = false;

    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    const finish = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
      process.stdout.write("\n");
      resolve(value);
    };

    const onData = (chunk) => {
      for (const char of chunk) {
        // Ignore arrow keys and other escape sequences.
        if (inEscape) {
          if (/[A-Za-z~]/.test(char)) inEscape = false;
          continue;
        }

        if (char === "\u001b") {
          inEscape = true;
          continue;
        }

        if (char === "\r" || char === "\n") return finish();

        if (char === "\u0003") {
          // Ctrl+C
          process.stdout.write("\n");
          process.exit(130);
        }

        if (char === "\u007f" || char === "\b") {
          if (value.length > 0) {
            value = value.slice(0, -1);
            if (!hidden) process.stdout.write("\b \b");
          }
          continue;
        }

        if (char < " ") continue;

        value += char;
        if (!hidden) process.stdout.write(char);
      }
    };

    stdin.on("data", onData);
  });
}

// ---------------------------------------------------------------------------
// Rules for each answer
// ---------------------------------------------------------------------------
function checkUsername(value) {
  return /^[a-z0-9._-]{3,30}$/.test(value)
    ? null
    : "Use 3 to 30 lowercase letters, numbers, dots, dashes or underscores (no spaces).";
}

function checkDisplayName(value) {
  return /^[\p{L}\p{M}][\p{L}\p{M} .'’-]{0,59}$/u.test(value)
    ? null
    : "Use letters, spaces and . ' - only (1 to 60 characters).";
}

function generatePassword() {
  const groups = [];

  for (let g = 0; g < 4; g++) {
    let group = "";
    for (let i = 0; i < 4; i++) {
      group += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
    }
    groups.push(group);
  }

  return groups.join("-"); // for example: kT7m-Qx3N-pR9w-Ze4b
}

const sqlText = (value) => `'${String(value).replace(/'/g, "''")}'`;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("\nCreate a new admin account (SK member)\n");

  let username;
  while (true) {
    username = (await ask("Username (lowercase, for example juan.delacruz): "))
      .trim()
      .toLowerCase();
    const problem = checkUsername(username);
    if (!problem) break;
    console.log("  " + problem);
  }

  let displayName;
  while (true) {
    displayName = (await ask("Display name (shown on the dashboard): "))
      .trim()
      .replace(/\s+/g, " ");
    const problem = checkDisplayName(displayName);
    if (!problem) break;
    console.log("  " + problem);
  }

  let password;
  let generated = false;

  while (true) {
    const first = await ask(
      "Password (press Enter to generate a strong one, or type 12+ characters): ",
      { hidden: true }
    );

    if (first === "") {
      password = generatePassword();
      generated = true;
      break;
    }

    if (first.length < 12) {
      console.log("  The password must be at least 12 characters.");
      continue;
    }

    const again = await ask("Type the password again: ", { hidden: true });

    if (again !== first) {
      console.log("  The two passwords did not match. Try again.");
      continue;
    }

    password = first;
    break;
  }

  const passwordHash = await hashPassword(password);

  // The WHERE NOT EXISTS part makes sure the same username is never added twice.
  const sql =
    `INSERT INTO admins (username, display_name, password_hash, role, is_active, must_change_password)\n` +
    `SELECT ${sqlText(username)}, ${sqlText(displayName)}, ${sqlText(passwordHash)}, ${sqlText(ROLE)}, 1, 1\n` +
    `WHERE NOT EXISTS (SELECT 1 FROM admins WHERE username = ${sqlText(username)});\n`;

  mkdirSync(new URL("../.wrangler/", import.meta.url), { recursive: true });
  writeFileSync(new URL("../" + SQL_PATH, import.meta.url), sql);

  console.log("\n----------------------------------------------------");
  console.log(" Account details");
  console.log("----------------------------------------------------");
  console.log(` Username : ${username}`);
  console.log(` Name     : ${displayName}`);
  console.log(` Role     : ${ROLE}`);

  if (generated) {
    console.log(` Password : ${password}`);
    console.log("\n The password is shown ONLY NOW and is not saved anywhere.");
    console.log(" Send it to the member privately (not in a group chat).");
  } else {
    console.log(" Password : (the one you typed)");
  }

  console.log("\n The member will be asked to choose their own password at the first login.");

  console.log("\n----------------------------------------------------");
  console.log(" Next: run these commands, one at a time");
  console.log("----------------------------------------------------");
  console.log(` 1) Add it to your TEST database (your computer):\n`);
  console.log(`    npx wrangler d1 execute ${DB_NAME} --local --file=${SQL_PATH}\n`);
  console.log(` 2) Add it to the LIVE database (the real website):\n`);
  console.log(`    npx wrangler d1 execute ${DB_NAME} --remote --file=${SQL_PATH}\n`);
  console.log(` 3) Delete the temporary file:\n`);
  console.log(`    Remove-Item ${SQL_PATH}\n`);
}

main().catch((error) => {
  console.error("\nSomething went wrong:", error.message);
  process.exit(1);
});
