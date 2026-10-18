import { expect, test, type TestBody } from 'claude-code/testing'
import type { On } from 'claude-code'
import { panels, plainCaption, svgOf } from '../hooks/compose'

const TOOL = 'mcp__memes__meme'
const DRAKE = { meme: 'drake-hotline-bling', name: 'Drake Hotline Bling', caption: 'tests first' }

const PNG_1PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
const RAN = { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false }

type Run = { argv: readonly string[]; stdin?: string }

// the test has no files, no commands and no engine drawing: answer them beneath the plugin.
// `resvg` is what ready.json says; false leaves the mod uninstalled
const stand = (on: On, resvg: string | null | false = '/m/assets/bin/resvg', uname = 'Linux aarch64') => {
  const runs: Run[] = []
  const reads: string[] = []
  const writes: string[] = []
  let installed = resvg !== false
  on('env.get', () => ({ value: undefined }))
  on('fs.exists', ($, e) => ({ value: installed && e.path.endsWith('/ready.json') }))
  on('fs.read', ($, e) => {
    reads.push(e.path)
    if (e.path.endsWith('/ready.json')) return { value: JSON.stringify({ version: 1, resvg }) }
    return { value: e.as === 'bytes' ? { base64: PNG_1PX } : '⣿⣿⣿\n⣿⣿⣿\n' }
  })
  on('fs.write', ($, e) => {
    writes.push(e.path)
    if (e.path.endsWith('/ready.json')) {
      installed = true
      resvg = JSON.parse(e.text).resvg
    }
    return { value: undefined }
  })
  on('process.run', ($, e) => {
    runs.push({ argv: e.argv, stdin: e.init?.stdin })
    return { value: e.argv[0] === 'uname' ? { ...RAN, stdout: `${uname}\n` } : RAN }
  })
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  return { runs, reads, writes }
}

type Answer = [{ text: string }, { type: string; source: { media_type: string; data: string } }]

test('the tool answers a known meme with its plain png and refuses an unknown one', async ($, on) => {
  const { reads, runs } = stand(on)
  const ok = await $.tool.call({ tool: TOOL, meme: 'drake-hotline-bling' })
  const [text, image] = ok.result as Answer
  expect(JSON.parse(text.text)).toEqual({ meme: DRAKE.meme, name: DRAKE.name })
  expect(image.type).toBe('image')
  expect(image.source.media_type).toBe('image/png')
  expect(image.source.data).toBe(PNG_1PX)
  expect(reads.at(-1)).toMatch(/assets\/drake-hotline-bling\.png$/)
  expect(runs.length).toBe(0)

  const bad = await $.tool.call({ tool: TOOL, meme: 'nyan-cat' })
  expect(bad.isError ?? bad.deny !== undefined).toBe(true)
})

test('a caption that is not English is sent back to be rewritten', async ($, on) => {
  stand(on)
  const bad = await $.tool.call({ tool: TOOL, meme: 'drake-hotline-bling', caption: '先寫測試' })
  expect(bad.deny).toContain('English')
})

test('with resvg the caption is drawn on the original and the png goes out', async ($, on) => {
  const { runs } = stand(on)
  const ok = await $.tool.call({ tool: TOOL, meme: 'drake-hotline-bling', caption: ' tests after / tests “first” ' })
  const [text, image] = ok.result as Answer
  expect(JSON.parse(text.text).caption).toBe('tests after / tests "first"')
  expect(image.source.media_type).toBe('image/png')
  expect(runs.length).toBe(1)
  expect(runs[0]!.argv[0]).toBe('/m/assets/bin/resvg')
  expect(runs[0]!.argv).toContain('--skip-system-fonts')
  expect(runs[0]!.argv.at(-1)).toMatch(/assets\/drawn\/drake-hotline-bling\.png$/)
  expect(runs[0]!.stdin).toContain('href="orig/drake-hotline-bling.jpg"')
  expect(runs[0]!.stdin).toContain('&quot;FIRST&quot;')
})

test('where resvg has no build the original goes out as it is', async ($, on) => {
  const { runs, reads } = stand(on, null)
  const ok = await $.tool.call({ tool: TOOL, meme: 'drake-hotline-bling', caption: 'tests first' })
  const [, image] = ok.result as Answer
  expect(image.source.media_type).toBe('image/jpeg')
  expect(reads.at(-1)).toMatch(/assets\/orig\/drake-hotline-bling\.jpg$/)
  expect(runs.length).toBe(0)
})

test('the first meme fetches every picture, then writes ready.json', async ($, on) => {
  const { runs, writes } = stand(on, false, 'Linux aarch64')
  const ok = await $.tool.call({ tool: TOOL, meme: 'drake-hotline-bling', caption: 'tests first' })
  const curls = runs.filter(r => r.argv[0] === 'curl')
  expect(curls.length).toBe(58)
  expect(curls.some(r => r.argv.at(-1) === 'https://i.imgflip.com/30b1gx.jpg')).toBe(true)
  expect(curls.every(r => r.argv.at(-1)!.startsWith('https://i.imgflip.com/'))).toBe(true)
  expect(writes.at(-1)).toMatch(/assets\/ready\.json$/)
  expect((ok.result as Answer)[1].source.media_type).toBe('image/jpeg')
})

test('a resvg download that does not match its sha256 stops the install', async ($, on) => {
  const { runs, writes } = stand(on, false, 'Darwin arm64')
  const bad = await $.tool.call({ tool: TOOL, meme: 'drake-hotline-bling' })
  expect(bad.deny).toContain('not the file this version of memes expects')
  expect(runs.some(r => r.argv[0] === 'tar')).toBe(false)
  expect(writes.some(w => w.endsWith('/ready.json'))).toBe(false)
})

test('panels fill the boxes in order; extra ones join the last box', async () => {
  expect(panels('drake-hotline-bling', 'a / b / c')).toEqual(['a', 'b c'])
  expect(panels('drake-hotline-bling', 'only')).toEqual(['only'])
  expect(plainCaption('it’s fine…')).toBe("it's fine...")
  expect(plainCaption('café')).toBeUndefined()
  const svg = svgOf('drake-hotline-bling', 'orig/drake-hotline-bling.jpg', 480, 480, 'a <b> & c / d')
  expect(svg).toContain('&lt;B&gt;')
  expect(svg).toContain('&amp;')
  expect(svg).not.toContain('<b>')
  expect(svg).toContain('>D</text>')
})

const result = (surface: 'terminal' | 'desktop' | 'mobile' | 'vscode') => ({
  plugin: 'memes',
  surface,
  component: 'ToolResult' as const,
  props: { tool_use_id: 't1', tool: TOOL, output: [{ type: 'text', text: JSON.stringify(DRAKE) }, { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: PNG_1PX } }], isErrored: false },
  viewport: { columns: 120, rows: 40 },
})

test('the terminal draws the image with the 80-wide braille as its alt', async ($, on) => {
  stand(on)
  const ui = await $.ui.mount(result('terminal'))
  const image = await ui.find({ type: 'Image' })
  expect(image).toBeDefined()
  const drawn = JSON.stringify(await ui.drawn())
  expect(drawn).toContain('⣿')
  expect(drawn).toContain('"columns":80')
  expect(await ui.find({ type: 'Text', text: /Drake Hotline Bling — tests first/ })).toBeDefined()
})

test('the terminal draws the png the tool answered with, the caption on it', async ($, on) => {
  // no png among the assets: the picture can only come from the tool's answer
  on('fs.read', ($, e) => (e.as === 'bytes' ? { deny: 'no png in the test' } : { value: '⣿⣿⣿\n' }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  const drawn = { ...result('terminal') }
  drawn.props = { ...drawn.props, output: [drawn.props.output[0]!, { type: 'image', source: { type: 'base64', media_type: 'image/png', data: PNG_1PX } }] }
  const ui = await $.ui.mount(drawn)
  expect(await ui.find({ type: 'Image' })).toBeDefined()
})

test('with no png at all the terminal shows the braille', async ($, on) => {
  on('fs.read', ($, e) => (e.as === 'bytes' ? { deny: 'no png in the test' } : { value: '⣿⣿⣿\n' }))
  const ui = await $.ui.mount(result('terminal'))
  expect(await ui.find({ type: 'Image' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /⣿/ })).toBeDefined()
})

test('the apps draw the result themselves: its image block', async ($, on) => {
  stand(on)
  for (const surface of ['desktop', 'mobile'] as const) {
    const ui = await $.ui.mount(result(surface))
    expect(await ui.find({ type: 'Text', text: 'engine' })).toBeDefined()
  }
})

test('another tool result is left to the engine', async ($, on) => {
  stand(on)
  const ui = await $.ui.mount({ ...result('terminal'), props: { tool_use_id: 't2', tool: 'Bash', output: { stdout: 'hi', stderr: '' }, isErrored: false } })
  expect(await ui.find({ type: 'Image' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'engine' })).toBeDefined()
})

const row = (surface: 'terminal' | 'desktop' | 'mobile') => ({
  plugin: 'memes',
  surface,
  component: 'ToolUse' as const,
  props: {
    tool_use_id: 't3',
    tool: TOOL,
    input: { meme: DRAKE.meme, caption: DRAKE.caption },
    output: JSON.stringify(DRAKE),
    isRunning: false,
    isErrored: false,
    isInterrupted: false,
  },
  viewport: { columns: 120, rows: 40 },
})

test('the tool row is left to the engine on every surface', async ($, on) => {
  stand(on)
  for (const surface of ['terminal', 'desktop', 'mobile'] as const) {
    const ui = await $.ui.mount(row(surface))
    expect(await ui.find({ type: 'Svg' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: 'engine' })).toBeDefined()
  }
})

const group = (tools: string[], isExpanded = false) => ({
  plugin: 'memes',
  surface: 'desktop' as const,
  component: 'ToolGroup' as const,
  props: {
    calls: tools.map((tool, i) => ({ tool_use_id: `g${i}`, tool, input: {}, isRunning: false, isErrored: false, isInterrupted: false })),
    isActive: false,
    isExpanded,
  },
  viewport: { columns: 120, rows: 40 },
})

// the engine draws whether the group unfolds
const unfolds = async ($: Parameters<TestBody>[0], on: On, g: ReturnType<typeof group>) => {
  on('ui.render', { component: 'ToolGroup' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{e.props.isExpanded ? 'unfolded' : 'folded'}</Text>
  })
  const ui = await $.ui.mount(g)
  return (await ui.find({ type: 'Text', text: 'unfolded' })) !== undefined
}

test('a run of tool calls with a meme in it unfolds', async ($, on) => {
  expect(await unfolds($, on, group(['Read', TOOL, 'Grep']))).toBe(true)
})

test('a run of tool calls without a meme stays folded', async ($, on) => {
  expect(await unfolds($, on, group(['Read', 'Grep']))).toBe(false)
})

test('a group already unfolded is left as it is', async ($, on) => {
  expect(await unfolds($, on, group(['Read'], true))).toBe(true)
})

test('the system prompt asks for a sentence before the meme, so it is not folded with other calls', async ($, on) => {
  stand(on)
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'You are Claude Code.', scope: 'shared' }] }))
  const { sections } = await $.prompt.compose({ ...COMPOSE, tools: [TOOL] })
  expect(sections.find(s => s.id === 'memes:policy')!.text).toMatch(/sentence of text before the meme call/)
})

const COMPOSE = { model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: [], outputStyle: null, traits: [] }

test('the system prompt tells Claude to post memes on its own, even in work an agent handed over', async ($, on) => {
  stand(on)
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'You are Claude Code.', scope: 'shared' }] }))
  const { sections } = await $.prompt.compose({ ...COMPOSE, tools: [TOOL] })
  const mine = sections.find(s => s.id === 'memes:policy')
  expect(mine).toBeDefined()
  expect(mine!.scope).toBe('session')
  expect(mine!.text).toContain(TOOL)
  expect(mine!.text).toMatch(/another agent/i)
  expect(sections[0]!.id).toBe('intro')
})

test('without the meme tool in the request the system prompt is left alone', async ($, on) => {
  stand(on)
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'You are Claude Code.', scope: 'shared' }] }))
  const { sections } = await $.prompt.compose({ ...COMPOSE, tools: ['Bash'] })
  expect(sections.map(s => s.id)).toEqual(['intro'])
})

const policyOf = async ($: Parameters<TestBody>[0], on: On) => {
  stand(on)
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'You are Claude Code.', scope: 'shared' }] }))
  const { sections } = await $.prompt.compose({ ...COMPOSE, tools: [TOOL] })
  return sections.find(s => s.id === 'memes:policy')?.text
}

test('frequency off: Claude posts no meme on its own', { options: { frequency: 'off' } }, async ($, on) => {
  expect(await policyOf($, on)).toBeUndefined()
})

test('frequency rare: only the big moments', { options: { frequency: 'rare' } }, async ($, on) => {
  const text = await policyOf($, on)
  expect(text).toContain(TOOL)
  expect(text).toMatch(/rarely/i)
  expect(text).not.toMatch(/every few turns/i)
})

test('frequency often: whenever a moment fits', { options: { frequency: 'often' } }, async ($, on) => {
  const text = await policyOf($, on)
  expect(text).toMatch(/whenever/i)
  expect(text).not.toMatch(/every few turns/i)
})

test('with no setting the frequency is normal: about one every few turns', async ($, on) => {
  expect(await policyOf($, on)).toMatch(/every few turns/i)
})

test('every frequency but off still says to skip a meme when something serious broke', async ($, on) => {
  expect(await policyOf($, on)).toMatch(/security/i)
})

const fontSizes = (svg: string) => [...svg.matchAll(/font-size="(\d+)"/g)].map(m => Number(m[1]))

test('text on a tilted sign is turned with it', async () => {
  const svg = svgOf('two-buttons', 'orig/two-buttons.jpg', 317, 480, 'ship it / write tests')
  expect(svg.match(/rotate\(-\d+/g)?.length).toBe(2)
})

test('the small boardroom bubbles get a bubble big enough to read', async () => {
  const svg = svgOf('boardroom-suggestion', 'orig/boardroom-suggestion.jpg', 370, 480, 'how do we fix CI / add retries / more retries / fix the flaky test')
  const sizes = fontSizes(svg)
  expect(sizes.length).toBeGreaterThanOrEqual(4)
  expect(Math.min(...sizes)).toBeGreaterThanOrEqual(14)
  expect(svg.match(/<rect /g)?.length).toBe(3)
})
