export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
export const CATEGORIES = ["budget", "expenses", "projects", "accomplishments"];

// Columns the public is allowed to see (never file_key or uploaded_by).
export const PUBLIC_COLUMNS =
  "id, title, category, description, publication_date, original_filename, mime_type, file_size";

export function parseId(value) {
  return typeof value === "string" && /^\d{1,10}$/.test(value)
    ? Number(value)
    : null;
}

export function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function isFile(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof value.arrayBuffer === "function" &&
    typeof value.size === "number"
  );
}

// Identify the file by its first bytes. The browser's file type and the
// file extension can be faked, the first bytes cannot.
export function detectFileType(bytes) {
  const startsWith = (signature) =>
    signature.every((byte, index) => bytes[index] === byte);

  if (startsWith([0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return { mime: "application/pdf", ext: "pdf" };
  }

  if (startsWith([0xff, 0xd8, 0xff])) {
    return { mime: "image/jpeg", ext: "jpg" };
  }

  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mime: "image/png", ext: "png" };
  }

  return null;
}

export function cleanFilename(name) {
  const cleaned = String(name || "")
    .replace(/[\\/\u0000-\u001f\u007f"]/g, "_")
    .trim()
    .slice(0, 150);

  return cleaned || "document";
}

// kind is "inline" (open in the browser) or "attachment" (download).
export function contentDisposition(kind, filename) {
  const fallback = filename
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_");

  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (char) => "%" + char.charCodeAt(0).toString(16).toUpperCase()
  );

  return `${kind}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

// Reads and checks the text fields of the upload/edit form.
export function readFields(form) {
  const text = (name) => {
    const value = form.get(name);
    return typeof value === "string" ? value.trim() : "";
  };

  const title = text("title");
  const category = text("category");
  const description = text("description");
  const publicationDate = text("publication_date");

  if (title.length < 1 || title.length > 150) {
    return { error: "The title must be 1 to 150 characters." };
  }

  if (!CATEGORIES.includes(category)) {
    return { error: "Please choose a valid category." };
  }

  if (!isValidDate(publicationDate)) {
    return { error: "Please choose a valid publication date." };
  }

  if (description.length > 500) {
    return { error: "The description must be 500 characters or fewer." };
  }

  return {
    values: {
      title,
      category,
      description,
      publicationDate,
      isPublished: text("is_published") === "1" ? 1 : 0
    }
  };
}

// Reads the multipart form from the request.
export async function readMultipart(request) {
  const length = Number(request.headers.get("Content-Length") || 0);

  // Allow a little extra room for the other form fields.
  if (length > MAX_FILE_SIZE + 1024 * 1024) {
    return { error: "That file is larger than 10 MB.", status: 413 };
  }

  const type = (request.headers.get("Content-Type") || "").toLowerCase();

  if (!type.includes("multipart/form-data")) {
    return { error: "Invalid request.", status: 415 };
  }

  try {
    return { form: await request.formData() };
  } catch {
    return { error: "Invalid request.", status: 400 };
  }
}

// Checks the uploaded file. When required is false, a missing file is fine
// (editing a document without replacing its file).
export async function readFile(form, required) {
  const file = form.get("file");
  const present = isFile(file) && !(file.size === 0 && !file.name);

  if (!present) {
    return required
      ? { error: "Please choose a file to upload.", status: 400 }
      : { none: true };
  }

  if (file.size === 0) {
    return { error: "That file is empty.", status: 400 };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { error: "That file is larger than 10 MB.", status: 413 };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectFileType(bytes);

  if (!type) {
    return {
      error: "Only PDF, JPG and PNG files are allowed.",
      status: 415
    };
  }

  return { bytes, type, filename: cleanFilename(file.name) };
}
