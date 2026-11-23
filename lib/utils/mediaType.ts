/**
 * Some browsers leave `File.type` empty for media they don't recognise
 * (e.g. Brave on Linux with an iPhone `.MOV`), and some report
 * `application/octet-stream`. Fall back to the file extension so a real
 * video isn't silently skipped by `type.startsWith("video/")` checks.
 */
const MIME_TYPES_BY_EXTENSION: Record<string, string> = {
  mov: "video/quicktime",
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  webm: "video/webm",
  "3gp": "video/3gpp",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

export function mediaMimeType(file: { name: string; type: string }): string {
  if (file.type && file.type !== "application/octet-stream") return file.type;
  const dot = file.name.lastIndexOf(".");
  const extension = dot > 0 ? file.name.slice(dot + 1).toLowerCase() : "";
  return MIME_TYPES_BY_EXTENSION[extension] ?? file.type;
}

export function mediaKind(file: { name: string; type: string }): "image" | "video" | null {
  const type = mediaMimeType(file);
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("image/")) return "image";
  return null;
}

/**
 * Returns the file with a usable MIME type. When the browser left it empty,
 * re-wraps the bytes with the type inferred from the extension so the upload
 * carries it (no copy: a File built from a File shares the same data).
 */
export function withMediaType(file: File): File {
  const type = mediaMimeType(file);
  if (!type || type === file.type) return file;
  return new File([file], file.name, { type, lastModified: file.lastModified });
}
