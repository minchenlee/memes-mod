import type { EngineInterface } from 'claude-code'
import { SOURCES } from './sources'

// what assets/ holds once installed: the originals in orig/, and where resvg runs, the 480-wide
// <slug>.png, bin/resvg and fonts/Anton-Regular.ttf. `resvg` is null where resvg has no build
export type Ready = { version: number; resvg: string | null }

const VERSION = 1
const RESVG = 'https://github.com/linebender/resvg/releases/download/v0.47.0/'
// `uname -sm` (or Windows) -> the release archive and its sha256, as GitHub lists them
const RESVG_BUILDS: Record<string, [string, string]> = {
  'Darwin arm64': ['resvg-macos-aarch64.zip', '049f8cc5666ff6395987798feae04f7f31525b0047b063d8e07fcbb8d22f3675'],
  'Darwin x86_64': ['resvg-macos-x86_64.zip', '3f6d9ffb72ea347f964770b38a71b2f181209190e77278bbb9f179c0d05a0eaa'],
  'Linux x86_64': ['resvg-linux-x86_64.tar.gz', '5c84dcbcd032fe7e8d96e616fd6807a2f9df6561d2e6582b37e91e63c6cb4fe7'],
  Windows: ['resvg-win64.zip', '5684e59ceaa53ce720b49efb441b0918ae99d04e8ce3f6f753664524592d67f1'],
}
const FONT = 'https://raw.githubusercontent.com/google/fonts/e0a8124cf36bb7c32ca68e5d46d6acdbc3df866a/ofl/anton/Anton-Regular.ttf'
const FONT_SHA256 = 'a4ba3a92350ebb031da0cb47630ac49eb265082ca1bc0450442f4a83ab947cab'

export function assetsOf($: EngineInterface) {
  return `${$.plugin.root}/assets`
}

// the original's path under assets/, its extension Imgflip's
export const origOf = (slug: string) => `orig/${slug}.${SOURCES[slug]!.split('.').pop()}`

export const mimeOf = (file: string) => (file.endsWith('.png') ? 'image/png' : 'image/jpeg')

export async function readReady($: EngineInterface): Promise<Ready | undefined> {
  const path = `${assetsOf($)}/ready.json`
  if (!(await $.fs.exists(path))) return undefined
  const ready = JSON.parse(await $.fs.read(path)) as Ready
  return ready.version === VERSION ? ready : undefined
}

async function platformOf($: EngineInterface) {
  if ((await $.env.get('OS')) === 'Windows_NT') return 'Windows'
  const { exitCode, stdout } = await $.process.run(['uname', '-sm'])
  return exitCode === 0 ? stdout.trim() : undefined
}

async function fetchTo($: EngineInterface, url: string, path: string) {
  const { exitCode, stderr } = await $.process.run(['curl', '-fsSL', '--retry', '2', '--create-dirs', '-o', path, url], {
    timeoutMs: 120_000,
  })
  if (exitCode !== 0) throw new Error(`curl ${url}: ${stderr.trim()}`)
}

async function sha256Of($: EngineInterface, path: string) {
  const { base64 } = await $.fs.read(path, { as: 'bytes' })
  const digest = await crypto.subtle.digest('SHA-256', Uint8Array.from(atob(base64), c => c.charCodeAt(0)))
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}

async function fetchChecked($: EngineInterface, url: string, path: string, sha256: string) {
  await fetchTo($, url, path)
  if ((await sha256Of($, path)) !== sha256) throw new Error(`${url} is not the file this version of memes expects`)
}

// runs `task` over `items`, `width` at a time
const eachLimited = async <T>(items: T[], width: number, task: (item: T) => Promise<void>) => {
  const queue = [...items]
  await Promise.all(Array.from({ length: width }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) await task(item)
  }))
}

// resvg over an svg on stdin; `orig/...` hrefs resolve under assets/
export async function runResvg($: EngineInterface, resvg: string, svg: string, out: string) {
  const assets = assetsOf($)
  await $.fs.write(out, '') // makes the png's folder
  const { exitCode, stderr } = await $.process.run(
    [resvg, '--resources-dir', assets, '--use-fonts-dir', `${assets}/fonts`, '--skip-system-fonts', '-', out],
    { stdin: svg, timeoutMs: 10_000 },
  )
  if (exitCode !== 0) throw new Error(`resvg: ${stderr.trim()}`)
}

// the tool sees only templates whose files are all there: ready.json is written last
// sizes: slug -> the width and height the pictures are drawn at
async function install($: EngineInterface, sizes: Record<string, [number, number]>): Promise<Ready> {
  const assets = assetsOf($)
  await eachLimited(Object.entries(SOURCES), 6, ([slug, file]) => fetchTo($, `https://i.imgflip.com/${file}`, `${assets}/${origOf(slug)}`))

  const build = RESVG_BUILDS[(await platformOf($)) ?? '']
  let resvg: string | null = null
  if (build) {
    const [archive, sha256] = build
    await fetchChecked($, RESVG + archive, `${assets}/download/${archive}`, sha256)
    await $.fs.write(`${assets}/bin/.keep`, '') // tar wants the folder there
    const { exitCode, stderr } = await $.process.run(['tar', '-xf', `${assets}/download/${archive}`, '-C', `${assets}/bin`])
    if (exitCode !== 0) throw new Error(`tar ${archive}: ${stderr.trim()}`)
    await fetchChecked($, FONT, `${assets}/fonts/Anton-Regular.ttf`, FONT_SHA256)
    resvg = `${assets}/bin/${archive.includes('win64') ? 'resvg.exe' : 'resvg'}`
    const bin = resvg
    await eachLimited(Object.keys(SOURCES), 4, slug => {
      const [width, height] = sizes[slug]!
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><image href="${origOf(slug)}" width="${width}" height="${height}"/></svg>`
      return runResvg($, bin, svg, `${assets}/${slug}.png`)
    })
  }

  const ready: Ready = { version: VERSION, resvg }
  await $.fs.write(`${assets}/ready.json`, JSON.stringify(ready))
  return ready
}

let installing: Promise<Ready> | undefined

// reads ready.json each time; installs once at a time, and a failed install is tried again on the next call
export async function ensureInstalled($: EngineInterface, sizes: Record<string, [number, number]>): Promise<Ready> {
  const ready = await readReady($)
  if (ready) return ready
  installing ??= install($, sizes).finally(() => {
    installing = undefined
  })
  return installing
}
