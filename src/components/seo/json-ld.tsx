/**
 * Renders a schema.org JSON-LD block (server component).
 *
 * Every "<" is emitted as the unicode escape sequence backslash-u003c so
 * user-authored content (titles, FAQ answers…) can never close the
 * script tag and inject markup.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
