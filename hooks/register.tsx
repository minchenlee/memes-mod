import type { EngineInterface, Register } from 'claude-code'
import { plainCaption, svgOf } from './compose'
import { assetsOf, ensureInstalled, mimeOf, origOf, runResvg, type Ready } from './install'

// slug -> [name, width and height the picture is drawn at, when to post it and the caption's panels, for the model]
// braille/<slug>.txt ships with the mod; the pictures, resvg and the font are fetched into assets/ (install.ts)
const MEMES: Record<string, [string, number, number, string]> = {
  'drake-hotline-bling': ['Drake Hotline Bling', 480, 480, 'rejecting one thing for another: "worse / better"'],
  'two-buttons': ['Two Buttons', 317, 480, 'torn between two bad options: "option A / option B"'],
  'distracted-boyfriend': ['Distracted Boyfriend', 480, 320, 'ditching the current thing for a shiny new one: "new shiny / me / current thing"'],
  'uno-draw-25-cards': ['UNO Draw 25', 480, 474, 'would rather suffer than do the obvious thing (the card already says "or draw 25"): "the obvious thing / me"'],
  'bernie-i-am-once-again-asking-for-your-support': ['Bernie Asking Again', 480, 480, 'asking for the same thing yet again (the picture already says "I am once again asking"): "for …"'],
  'left-exit-12-off-ramp': ['Left Exit 12', 480, 458, 'swerving from the sensible path: "sensible path / tempting exit / me"'],
  'running-away-balloon': ['Running Away Balloon', 357, 480, 'pulled away from what you want: "me / the goal / the thing in the way"'],
  'anakin-padme-4-panel': ['Anakin and Padmé', 480, 480, 'a confident plan, then an ominous silence: "plan / you will do it right, right? / … / right?"'],
  'epic-handshake': ['Epic Handshake', 480, 344, 'two unlikely sides agree on something: "side A / side B / what they agree on"'],
  'always-has-been': ['Always Has Been', 480, 270, 'a realisation that it was always so: "wait, it was X all along? / always has been"'],
  'waiting-skeleton': ['Waiting Skeleton', 298, 403, 'waiting forever (CI, a build, a reply): "me waiting for …"'],
  'gru-s-plan': ["Gru's Plan", 480, 308, 'a plan whose last step backfires: "step 1 / step 2 / oops / oops"'],
  'disaster-girl': ['Disaster Girl', 480, 360, 'calmly causing chaos: "the disaster / me"'],
  'sad-pablo-escobar': ['Sad Pablo Escobar', 480, 473, 'waiting alone, nothing happens: "waiting for …"'],
  'x-x-everywhere': ['X, X Everywhere', 480, 326, 'something shows up everywhere: "X / X everywhere"'],
  'this-is-fine': ['This Is Fine', 480, 233, 'everything is on fire but carrying on (the picture already says "this is fine"): "what is on fire"'],
  'surprised-pikachu': ['Surprised Pikachu', 480, 480, 'shocked by an entirely predictable result: "did the risky thing / it broke / :O"'],
  'mocking-spongebob': ['Mocking Spongebob', 480, 338, 'mocking a claim by repeating it: "the claim / tHe ClAiM"'],
  'change-my-mind': ['Change My Mind', 480, 360, 'a hot take (the sign already says "change my mind"): "the hot take"'],
  'woman-yelling-at-cat': ['Woman Yelling At Cat', 480, 309, 'an angry accusation met with a smug reply: "accusation / smug reply"'],
  'batman-slapping-robin': ['Batman Slapping Robin', 400, 387, 'shutting down a bad idea mid-sentence: "bad idea… / NO"'],
  'is-this-a-pigeon': ['Is This A Pigeon', 480, 431, 'confidently misnaming something: "me / the thing / is this …?"'],
  'buff-doge-vs-cheems': ['Buff Doge vs. Cheems', 480, 369, 'the strong past vs the weak present: "then / now"'],
  'expanding-brain': ['Expanding Brain', 342, 480, 'ever more absurd "smarter" solutions: "idea 1 / idea 2 / idea 3 / idea 4"'],
  'theyre-the-same-picture': ["They're The Same Picture", 429, 480, 'two things that are identical (the picture already says "they\'re the same picture"): "A / B"'],
  'marked-safe-from': ['Marked Safe From', 480, 388, 'escaped a disaster (the picture already says "marked safe from"): "the disaster"'],
  'zero-days-without': ['0 Days Without', 480, 313, 'the same mistake happened again (the sign already says "0 days without"): "the mistake"'],
  'squidward-window': ['Squidward Window', 480, 337, 'watching others have fun while stuck: "others / me stuck with …"'],
  'megamind-peeking': ['Megamind Peeking', 480, 480, 'sly "no X?" question: "no …?"'],
  'tuxedo-winnie-the-pooh': ['Tuxedo Winnie The Pooh', 480, 349, 'the same thing, but with a fancy name: "plain name / fancy name"'],
  'one-does-not-simply': ['One Does Not Simply', 480, 283, 'something that is never simple: "one does not simply …"'],
  'roll-safe': ['Roll Safe', 480, 270, 'galaxy-brained loophole: "can\'t have bugs if …"'],
  'hide-the-pain-harold': ['Hide the Pain Harold', 383, 480, 'smiling through pain: "when … / and you smile anyway"'],
  'monkey-puppet': ['Monkey Puppet', 480, 399, 'awkward look away after getting caught: "when someone asks about …"'],
  'clown-applying-makeup': ['Clown Applying Makeup', 451, 480, 'step-by-step self-delusion: "belief 1 / belief 2 / belief 3 / clown"'],
  'spiderman-pointing': ['Spider-Man Pointing', 480, 270, 'two of the same blaming each other: "A / B"'],
  'panik-kalm-panik': ['Panik Kalm Panik', 349, 480, 'panic, relief, then worse panic: "bad news / it\'s fine / it\'s not fine"'],
  'scooby-doo-mask-reveal': ['Scooby-Doo Mask Reveal', 360, 480, 'root cause revealed: "the mystery bug / let\'s see who this really is / it was …"'],
  'flex-tape': ['Flex Tape', 428, 480, 'a quick patch over a big problem: "the problem / the patch"'],
  'evil-kermit': ['Evil Kermit', 480, 223, 'tempted by the bad idea: "me / me: do the bad thing"'],
  'bike-fall': ['Bike Fall', 353, 480, 'sabotaging yourself, then blaming something else: "me / my own mistake / blaming the tool"'],
  'trade-offer': ['Trade Offer', 367, 480, 'a lopsided deal (the picture already says "I receive / you receive"): "what I receive / what you receive"'],
  'yall-got-any-more': ["Y'all Got Any More", 480, 377, 'craving more of something: "y\'all got any more of that …"'],
  'absolute-cinema': ['Absolute Cinema', 480, 372, 'something went perfectly: "absolute cinema"'],
  'bell-curve': ['Bell Curve', 480, 355, 'novice and expert agree, the midwit overthinks: "simple / overthought / simple"'],
  'leonardo-cheers': ['Leonardo Cheers', 480, 320, 'a toast to something good: "cheers to …"'],
  'futurama-fry': ['Futurama Fry', 480, 360, 'unsure between two readings: "not sure if … / or …"'],
  'grim-reaper-knocking': ['Grim Reaper Knocking', 480, 300, 'one by one things die: "thing 1 / thing 2 / next victim"'],
  'domino-effect': ['Domino Effect', 480, 331, 'a tiny cause, a huge effect: "tiny cause / huge effect"'],
  'ancient-aliens': ['Ancient Aliens', 480, 419, 'blaming an absurd cause: "…? aliens"'],
  'sleeping-shaq': ['Sleeping Shaq', 480, 473, 'ignoring a real problem, alarmed by a trivial one: "real problem / trivial thing"'],
  'laughing-leo': ['Laughing Leo', 470, 470, 'smug laughter at a situation: "when …"'],
  'two-guys-on-a-bus': ['Two Guys On A Bus', 480, 425, 'the gloomy view next to the cheerful one: "gloomy side / bright side"'],
  'scroll-of-truth': ['Scroll Of Truth', 480, 464, 'an unwelcome truth rejected (the picture already says "NYEH"): "the truth"'],
  'im-the-captain-now': ["I'm The Captain Now", 478, 350, 'taking over control: "I\'m the … now"'],
  'we-are-not-the-same': ['We Are Not The Same', 336, 480, 'a smug comparison: "you … / I … / we are not the same"'],
  'mother-ignoring-kid': ['Mother Ignoring Kid', 364, 480, 'doting on the new thing while the old one drowns: "new thing / old thing"'],
  'boardroom-suggestion': ['Boardroom Suggestion', 370, 480, 'the one sensible idea gets thrown out: "question / idea / idea / the sensible idea"'],
}
const TOOL = 'mcp__memes__meme'
const BRAILLE_COLUMNS = 80
// a cell's height over its width; the engine does not say it, so err tall: where cells are
// flatter the picture fits the rows and leaves room at its right, never bands above and below
// (Ghostty with its line height raised measures 30 / 10.9 = 2.75)
const CELL_ASPECT = 2.75

type Shown = { meme: string; name: string; caption?: string }

const isShown = (v: unknown): v is Shown =>
  typeof v === 'object' && v !== null && typeof (v as Shown).meme === 'string' && (v as Shown).meme in MEMES

// a registered tool answers with a string (or text blocks), so the result travels as JSON
const parseShown = (output: unknown): Shown | undefined => {
  const text =
    typeof output === 'string'
      ? output
      : Array.isArray(output)
        ? output.map(b => (b && typeof b.text === 'string' ? b.text : '')).join('')
        : undefined
  if (text === undefined) return isShown(output) ? output : undefined
  try {
    const v: unknown = JSON.parse(text)
    return isShown(v) ? v : undefined
  } catch {
    return undefined
  }
}

const DESCRIPTION =
  "Post a reaction meme. You are the person's slightly unhinged coding buddy: reach for a meme whenever a moment is " +
  'meme-worthy — you broke something, a fix finally works, a bug turns out to be a typo, tests pass on the fifth try, ' +
  'CI takes forever, the person picks the obviously worse option, a choice between two things, a hot take. ' +
  'Roughly once every few turns when something happens; at most once per turn. ' +
  "Write the caption about the actual situation, short and specific, in English only (the picture's font has no other " +
  "script), even when the person writes another language; ' / ' between panels in the order the template's hint gives. " +
  'Roasting yourself beats roasting the person. ' +
  'Skip it when the person is upset or something serious broke (data loss, production down). ' +
  'After posting, do not describe or explain the meme; carry on as if it were a reaction GIF. ' +
  'The caption is drawn on the picture; the person sees it (braille art where the screen cannot draw images), and you see it too.'

const labelOf = (shown: Shown) => (shown.caption ? `${shown.name} — ${shown.caption}` : shown.name)

const sizes = Object.fromEntries(Object.entries(MEMES).map(([slug, m]) => [slug, [m[1], m[2]] as [number, number]]))

// the picture as an image block's source: the caption drawn on where resvg runs (one png per template,
// overwritten each time), else the plain picture: its 480-wide png, or where resvg has no build, the original
const pictureOf = async ($: EngineInterface, ready: Ready, meme: string, caption: string | undefined) => {
  const assets = assetsOf($)
  const read = async (path: string) => (await $.fs.read(path, { as: 'bytes' })).base64
  if (!ready.resvg) return { media_type: mimeOf(origOf(meme)), data: await read(`${assets}/${origOf(meme)}`) }
  if (caption) {
    const [, width, height] = MEMES[meme]!
    const out = `${assets}/drawn/${meme}.png`
    const drawn = await runResvg($, ready.resvg, svgOf(meme, origOf(meme), width, height, caption), out).then(() => read(out), () => undefined)
    if (drawn) return { media_type: 'image/png', data: drawn }
  }
  return { media_type: 'image/png', data: await read(`${assets}/${meme}.png`) }
}

// the png the tool answered with, the caption drawn on
const pngOf = (output: unknown): string | undefined => {
  if (!Array.isArray(output)) return undefined
  const block = output.find(b => b?.type === 'image' && b.source?.media_type === 'image/png')
  return typeof block?.source?.data === 'string' ? block.source.data : undefined
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // the first session fetches the pictures in the background; the tool waits for them
    ensureInstalled($, sizes).catch(error => $.ui.log(`memes: install failed, tried again on the next meme (${error})`))
    await $.tool.register({
      name: 'meme',
      description: DESCRIPTION,
      inputSchema: {
        type: 'object',
        properties: {
          meme: {
            type: 'string',
            enum: Object.keys(MEMES),
            description: 'Which template; when each fits and its panels:\n' + Object.entries(MEMES).map(([slug, m]) => `${slug}: ${m[3]}`).join('\n'),
          },
          caption: { type: 'string', maxLength: 120, description: "The meme's text in English, panels split by ' / ', drawn on the picture" },
        },
        required: ['meme'],
      },
      isDeferred: false,
    })

    return next(e)
  })

  on('tool.call', { tool: TOOL }, async ($, e) => {
    // the tool's arguments sit on e itself, beside tool and tool_use_id
    const input = e as { meme?: unknown; caption?: unknown }
    const meme = typeof input.meme === 'string' ? input.meme : ''
    const entry = MEMES[meme]
    if (!entry) return { deny: `Unknown meme "${meme}". Pick one of: ${Object.keys(MEMES).join(', ')}` }
    const raw = typeof input.caption === 'string' ? input.caption.trim().slice(0, 120) : ''
    const caption = plainCaption(raw)
    if (caption === undefined) return { deny: 'The caption must be in English (plain ASCII letters and punctuation). Rewrite it in English and post again.' }
    const shown: Shown = { meme, name: entry[0], ...(caption && { caption }) }

    // the picture rides along as an image block: the apps draw a tool's image result themselves
    const ready = await ensureInstalled($, sizes).catch((error: unknown) => String(error))
    if (typeof ready === 'string') return { deny: `memes could not fetch its pictures yet (${ready}). Skip the meme this time.` }
    const image = await pictureOf($, ready, meme, caption || undefined)

    return {
      result: [
        { type: 'text', text: JSON.stringify(shown) },
        { type: 'image', source: { type: 'base64', ...image } },
      ],
    }
  }).catch(($, e, next) => ({
    deny: `memes: the meme tool failed (${next.error.kind}${next.error.message ? `: ${next.error.message}` : ''}).`,
  }))

  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    const shown = e.props.tool === TOOL && !e.props.isErrored ? parseShown(e.props.output) : undefined
    if (!shown) return next(e)
    const braillePath = `${$.plugin.root}/braille/${shown.meme}.txt`
    const label = labelOf(shown)

    if (e.surface === 'terminal') {
      const { Box, Text, Image } = $.ui.resolve(e)
      // the tool's png, else the plain one; neither where resvg has no build: the braille alone
      const png = pngOf(e.props.output) ?? (await $.fs.read(`${assetsOf($)}/${shown.meme}.png`, { as: 'bytes' }).then(b => b.base64, () => undefined))
      const braille = (await $.fs.read(braillePath)).trimEnd()
      const [, width, height] = MEMES[shown.meme]!
      const columns = Math.max(20, Math.min(BRAILLE_COLUMNS, (e.viewport?.columns ?? 100) - 4))
      const rows = Math.max(1, Math.round((columns * height) / width / CELL_ASPECT))

      return (
        <Box flexDirection="column">
          {png ? <Image source={{ png }} columns={columns} rows={rows} alt={braille} /> : <Text>{braille}</Text>}
          <Text dimColor>{label}</Text>
        </Box>
      )
    }

    // the apps draw the image block of the result themselves
    if (e.surface === 'desktop' || e.surface === 'mobile') return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const braille = await $.fs.read(braillePath)

    return (
      <Box flexDirection="column">
        <Text>{braille.trimEnd()}</Text>
        <Text dimColor>{label}</Text>
      </Box>
    )
  })
}
