import { LAYOUT } from './layout'

// Anton's average advance, in em; a line is 1.08 em tall
const EM = 0.5
const LEADING = 1.08

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const wrap = (words: string[], perLine: number) => {
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    if (line && line.length + 1 + word.length > perLine) {
      lines.push(line)
      line = word
    } else line = line ? `${line} ${word}` : word
  }
  return [...lines, line]
}

// the largest size from 72 down to 12 whose wrapped lines fit the box
const fit = (text: string, width: number, height: number): [number, string[]] => {
  const words = text.toUpperCase().split(/\s+/).filter(Boolean)
  for (let size = 72; size >= 12; size--) {
    const lines = wrap(words, Math.max(1, Math.floor(width / (size * EM))))
    if (lines.length * size * LEADING <= height && lines.every(l => l.length * size * EM <= width)) return [size, lines]
  }
  return [12, wrap(words, Math.max(1, Math.floor(width / (12 * EM))))]
}

// a caption only English and the punctuation Anton draws; curly quotes and dashes become plain
export const plainCaption = (caption: string): string | undefined => {
  const plain = caption.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...').replace(/[–—]/g, '-')
  return /^[\x20-\x7e]*$/.test(plain) ? plain : undefined
}

// the caption's panels, one per box: missing ones stay blank, extra ones join the last box
export const panels = (meme: string, caption: string): string[] => {
  const count = LAYOUT[meme]?.length ?? 0
  const parts = caption.split(' / ').map(p => p.trim())
  return parts.length <= count ? parts : [...parts.slice(0, count - 1), parts.slice(count - 1).join(' ')]
}

// the picture at `href` (resolved under resvg's resources dir) with each panel drawn in its box
export const svgOf = (meme: string, href: string, width: number, height: number, caption: string): string => {
  const out = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`,
    `<image href="${href}" width="${width}" height="${height}"/>`,
  ]
  const parts = panels(meme, caption)
  LAYOUT[meme]!.forEach(([x, y, w, h, align, color, { rotate, bubble } = {}], n) => {
    const part = parts[n]
    if (!part) return
    const [ox, oy, ow, oh] = [x * width, y * height, w * width, h * height]
    if (rotate) out.push(`<g transform="rotate(${rotate} ${(ox + ow / 2).toFixed(1)} ${(oy + oh / 2).toFixed(1)})">`)
    if (bubble) out.push(`<rect x="${ox.toFixed(1)}" y="${oy.toFixed(1)}" width="${ow.toFixed(1)}" height="${oh.toFixed(1)}" rx="${(oh / 3).toFixed(1)}" fill="white" stroke="black" stroke-width="1.5"/>`)
    // inside a bubble the text keeps off its outline
    const [bx, by, bw, bh] = bubble ? [ox + 5, oy + 3, ow - 10, oh - 6] : [ox, oy, ow, oh]
    const [size, lines] = fit(part, bw, bh)
    const top = by + (bh - lines.length * size * LEADING) / 2 + size * 0.86
    const left = align === 'start' ? bx : align === 'middle' ? bx + bw / 2 : bx + bw
    const paint =
      color === 'white'
        ? `fill="white" stroke="black" stroke-width="${Math.max(2, size / 9).toFixed(1)}" stroke-linejoin="round" paint-order="stroke"`
        : 'fill="black"'
    lines.forEach((line, i) =>
      out.push(
        `<text x="${left.toFixed(1)}" y="${(top + i * size * LEADING).toFixed(1)}" font-family="Anton" font-size="${size}" ` +
          `text-anchor="${align}" ${paint}>${escape(line)}</text>`,
      ),
    )
    if (rotate) out.push('</g>')
  })
  out.push('</svg>')
  return out.join('\n')
}
