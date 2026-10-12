
const ITERATIONS = 100000;
const HASH_LENGTH = 32;

function toBase64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value) {
  return Uint8Array.from(atob(value), (char) =>
    char.charCodeAt(0)
  );
}

async function deriveHash(password, salt, iterations) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256"
    },
    keyMaterial,
    HASH_LENGTH * 8
  );

  return new Uint8Array(bits);
}

export async function hashPassword(password) {
  if (typeof password !== "string" || password.length < 12) {
    throw new Error("Password must be at least 12 characters.");
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveHash(password, salt, ITERATIONS);

  return [
    "pbkdf2",
    ITERATIONS,
    toBase64(salt),
    toBase64(hash)
  ].join("$");
}


export async function verifyPassword(password, storedHash) {
  try {
    if (
      typeof password !== "string" ||
      typeof storedHash !== "string"
    ) {
      return false;
    }

    const parts = storedHash.split("$");

    if (parts.length !== 4 || parts[0] !== "pbkdf2") {
      return false;
    }

    const iterations = Number(parts[1]);

    if (
      !Number.isInteger(iterations) ||
      iterations < 100000 ||
      iterations > 1000000
    ) {
      return false;
    }

    const salt = fromBase64(parts[2]);
    const expectedHash = fromBase64(parts[3]);

    if (
      salt.length !== 16 ||
      expectedHash.length !== HASH_LENGTH
    ) {
      return false;
    }

    const actualHash = await deriveHash(
      password,
      salt,
      iterations
    );

    // Compare every byte, even if an earlier byte differs.
    let difference = 0;

    for (let i = 0; i < HASH_LENGTH; i++) {
      difference |= actualHash[i] ^ expectedHash[i];
    }

    return difference === 0;
  } catch {
    return false;
  }
}
