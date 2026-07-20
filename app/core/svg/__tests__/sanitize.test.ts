// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'

import { sanitizeSvg } from '../sanitize'

describe('sanitizeSvg', () => {
  it('strips <script> elements', () => {
    const out = sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="5" height="5"/></svg>')
    expect(out).not.toContain('script')
    expect(out).toContain('<rect')
  })

  it('strips <foreignObject>', () => {
    const out = sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><body xmlns="http://www.w3.org/1999/xhtml">x</body></foreignObject><rect width="5" height="5"/></svg>')
    expect(out).not.toContain('foreignObject')
  })

  it('strips event handler attributes', () => {
    const out = sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg"><rect width="5" height="5" onclick="evil()" onload="evil()"/></svg>')
    expect(out).not.toContain('onclick')
    expect(out).not.toContain('onload')
  })

  it('strips javascript: and external hrefs, keeps data: and #refs', () => {
    const out = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg">'
      + '<image href="javascript:alert(1)"/>'
      + '<image href="https://evil.example/x.png"/>'
      + '<image href="data:image/png;base64,AAAA"/>'
      + '<use href="#ok"/>'
      + '</svg>',
    )
    expect(out).not.toContain('javascript:')
    expect(out).not.toContain('evil.example')
    expect(out).toContain('data:image/png;base64,AAAA')
    expect(out).toContain('href="#ok"')
  })

  it('throws on non-SVG input', () => {
    expect(() => sanitizeSvg('hello world')).toThrow()
  })
})
