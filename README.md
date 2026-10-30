# Interactive Installations

Camera-driven browser pieces meant to be shown live (projected, at
festivals and similar), each in its own folder:

| Folder                  | Piece                | Stack                                  |
| ----------------------- | -------------------- | -------------------------------------- |
| `gesture-kaleidoscope/` | Gesture Kaleidoscope | WebGL1 + MediaPipe pose tracking (CDN) |
| `video-filters/`        | Magic Mirror         | p5.js (CDN)                            |

Try them online on Form follows f(x):
<https://fffx.cabinetofcuriosities.in/interactive-installations/gesture-kaleidoscope/>
and <https://fffx.cabinetofcuriosities.in/interactive-installations/video-filters/>,
or run them locally (below). Both ask for camera access; webcam frames
stay in the browser.

`index.html` at the root is a landing page linking to both, for local use.
Each project's `PROJECT.md` holds its intent, design decisions, changelog
and notes.

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

Public repo, published in two places:

- **Form follows f(x) (fffx), the canonical home.** fffx mounts this repo
  at `/interactive-installations/` at a pinned commit (fffx's
  `content/external-repos.tsv`) and lists the two pieces under Image
  Experiments, linking to them directly. Only the files the pages load are
  published (fffx's `content/external-allowlists/interactive-installations.txt`):
  not the root `index.html`, the `.md` files or the Vite config. A push
  here changes nothing on fffx until the pin is moved
  (`npm run update-externals` in fffx). If a piece needs a new file, add
  it to the allowlist too.
- **GitHub Pages**, <https://jesmehta.github.io/interactive-installations/>,
  which publishes the whole repo as it is on `main`, landing page included.
  It updates on every push. Link to the fffx URLs, not this one.

## History

- `gesture-kaleidoscope/` was started here (originally under
  `D:\Projects\`).
- `video-filters/` came from `SSD_CreativeCodingPage`
  (`ssd-creative-coding-2025-26/Video_filters/`, where it had been parked
  as a gallery card) on 2026-10-18. Its history was imported with a
  filtered `git filter-branch` and merged with `--allow-unrelated-histories`.
- Made public on 2026-10-30, under GPL-3.0-or-later, and mounted on fffx.

## Licence and terms

- **Code** (the HTML, CSS and JavaScript in both folders): © Jesal Mehta,
  licensed under the **GNU General Public License v3.0 or later**
  ([LICENSE](LICENSE)). You may use, study, change and share it; if you
  distribute a modified version, including by hosting it on a website,
  you must make its source available under the same licence.
- **Libraries loaded from CDNs** keep their own licences: p5.js (LGPL-2.1)
  in Magic Mirror, and MediaPipe Tasks Vision and its pose landmarker
  model (Apache-2.0) in Gesture Kaleidoscope. They aren't stored in this repo.
- **`gesture-kaleidoscope/assets/seahorse.jpg`**, the default image, isn't
  covered by the code licence. Its source is not recorded yet.
