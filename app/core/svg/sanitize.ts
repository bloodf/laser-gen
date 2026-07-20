/**
 * SVG sanitization for untrusted file imports.
 *
 * Strips `<script>`, `<foreignObject>`, event-handler attributes (`on*`),
 * and `javascript:` / external `href` references (only `data:` URLs and
 * in-document `#fragment` references survive). Uses the platform `DOMParser`
 * (browser global; tests run under happy-dom) — no Vue/Nuxt imports.
 */

const REMOVE_TAGS = new Set(['script', 'foreignObject', 'iframe', 'object', 'embed', 'handler', 'listener'])

/**
 * Sanitize an SVG string for safe import.
 *
 * @param svgText - Raw SVG file contents.
 * @returns Sanitized SVG string (serialization of the cleaned document).
 * @throws {Error} When the input is not parseable XML or has no `<svg>` root.
 */
export function sanitizeSvg(svgText: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgText, 'image/svg+xml')
  const root = doc.documentElement
  if (!root || root.tagName.toLowerCase() !== 'svg' || root.querySelector('parsererror')) {
    throw new Error('Not a valid SVG document')
  }
  cleanElement(root)
  return new XMLSerializer().serializeToString(root)
}

function cleanElement(el: Element): void {
  // Strip event handlers and dangerous URL attributes.
  for (const attr of [...el.attributes]) {
    const name = attr.name.toLowerCase()
    if (name.startsWith('on')) {
      el.removeAttribute(attr.name)
      continue
    }
    if (name === 'href' || name.endsWith(':href')) {
      const value = attr.value.trim()
      const ok = value.startsWith('data:') || value.startsWith('#')
      if (!ok) el.removeAttribute(attr.name)
    }
  }
  for (const child of [...el.children]) {
    if (REMOVE_TAGS.has(child.tagName) || REMOVE_TAGS.has(child.tagName.toLowerCase())) {
      child.remove()
      continue
    }
    cleanElement(child)
  }
}
