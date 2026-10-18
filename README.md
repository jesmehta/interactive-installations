# Interactive Installations

Camera-driven browser pieces meant to be shown live (projected, at
festivals and similar), each in its own folder:

| Folder                  | Piece              | Stack                                    |
| ----------------------- | ------------------ | ---------------------------------------- |
| `gesture-kaleidoscope/` | Gesture Kaleidoscope | WebGL1 + MediaPipe pose tracking (CDN) |
| `video-filters/`        | Video Filters ("Magic Mirror") | p5.js (CDN)                  |

`index.html` at the root is a landing page linking to both. Each project's
`PROJECT.md` holds its intent, design decisions, changelog and notes.

## Running

Serve the repo root with any static server and open the landing page, for
example VS Code's Live Server, or `python -m http.server` from the repo
root. No build step is needed. `gesture-kaleidoscope/` still works with
`npm run dev` inside its folder, but Vite is optional.

- **Use `localhost`, not double-click.** The kaleidoscope uses ES modules,
  which browsers won't load from a `file://` page. The camera also needs
  `https` or `localhost`.
- **Internet is needed once, not continuously.** p5 loads when Video
  Filters opens. The kaleidoscope fetches MediaPipe and the pose model the
  first time "Enable camera" is clicked. After that, all processing is
  local and webcam frames never leave the machine. A page reload fetches
  the libraries again, though usually from the browser cache. At a venue,
  open each piece (and enable the camera) while the wifi is good, then
  leave the tab open.
- If venue wifi turns out to be unreliable, the fallback is to put local
  copies of p5, MediaPipe and the model in the repo. That hasn't been done
  (about 20–25 MB, and the versions would then be updated by hand).

## Hosting

Private repo, not published yet. GitHub Pages is planned once the site
moves to Cloudflare. All paths are relative, so the repo works from a
Pages subpath (`/interactive-installations/`) as it is.

## History

- `gesture-kaleidoscope/` was started here (originally under
  `D:\Projects\`).
- `video-filters/` came from `SSD_CreativeCodingPage`
  (`ssd-creative-coding-2025-26/Video_filters/`, where it had been parked
  as a gallery card) on 2026-10-18. Its history was imported with a
  filtered `git filter-branch` and merged with `--allow-unrelated-histories`.
