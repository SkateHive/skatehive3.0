import { uploadErrorMessage } from "../ipfsUpload";

let hasFailures = false;
function check(name: string, actual: string, expected: string) {
  if (actual === expected) {
    console.log(`  ok ${name}`);
  } else {
    console.error(`  fail ${name}\n     expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    hasFailures = true;
  }
}

console.log("\nuploadErrorMessage");
check("413 says the file is too large", uploadErrorMessage(413, ""), "File is too large to upload.");
check("429 asks to wait", uploadErrorMessage(429, "{}"), "Too many uploads in a short time. Wait a minute and try again.");
check(
  "uses the proxy's { error } string",
  uploadErrorMessage(500, JSON.stringify({ error: "Pinata credentials not configured" })),
  "Upload failed (500): Pinata credentials not configured"
);
check(
  "uses Pinata's { error: { details } }",
  uploadErrorMessage(403, JSON.stringify({ error: { reason: "NO_SCOPES_FOUND", details: "This key does not have the required scopes" } })),
  "Upload failed (403): This key does not have the required scopes"
);
check("falls back to the status when the body is not JSON", uploadErrorMessage(502, "<html>Bad Gateway</html>"), "Upload failed (502).");

if (hasFailures) process.exit(1);
console.log("\nAll uploadErrorMessage tests passed");
