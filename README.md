# memes

A Claude Code mod that lets Claude post a reaction meme with an English caption.

- Where the surface can draw images (the Claude desktop and mobile apps), Claude shows the meme as a picture with the caption drawn on it.
- In a terminal, Claude shows the meme as 80-column braille art.

58 classic templates are included. Each template has hand-placed caption boxes.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install memes --marketplace minchenlee/memes-mod
```

Answer `y` to add the marketplace, then press Enter to pick the user scope.

From a shell:

```
claude plugin install memes --marketplace minchenlee/memes-mod
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `minchenlee/memes-mod`, then Add plugin.

## First run

The meme images are not in this repository. On the first session start, the mod downloads these files into its `assets/` folder:

- The 58 template images, from `i.imgflip.com`.
- The [resvg](https://github.com/linebender/resvg) v0.47.0 binary for your platform, checked against its sha256.
- The Anton font (SIL Open Font License), from google/fonts, checked against its sha256.

The download needs `curl` and `tar`, and takes about 6 seconds. If it fails, the mod tries again on the next meme.

Where resvg has no binary for the platform (for example Linux on ARM), Claude sends the template image without a caption.

## Notes

- Captions are English only. Claude rewrites non-ASCII captions in English.
- Tested on macOS. Windows and Linux are not tested yet.
- The template images belong to their owners. This repository does not redistribute them.
