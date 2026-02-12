/**
 * Safely serialize a JSON-LD object for embedding in a <script> tag.
 *
 * User-controlled values (post titles, descriptions, usernames) can contain
 * sequences like `</script>` or `<!--` that would prematurely close the
 * script block and allow HTML injection. This function escapes those
 * sequences after JSON.stringify so the resulting string is safe for
 * dangerouslySetInnerHTML.
 */
export function safeJsonLdStringify(data: unknown): string {
    const raw = JSON.stringify(data);
    return raw
        .replace(/<\/script/gi, "<\\/script")
        .replace(/<!--/g, "<\\!--");
}
