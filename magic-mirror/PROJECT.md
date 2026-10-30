# Magic Mirror

Called Video Filters (folder `video-filters/`) until 2026-10-30.

## Intent

A "magic mirror": the webcam feed, mirrored, redrawn on a 640×480 p5.js
canvas through a rotating set of low-resolution filters. The video is
captured at 1/10 scale (`scl = 10`), so each captured pixel becomes one
cell. The filter changes every 100 frames (`interval`), cycling through:

1. `ellipseBnW`: black-and-white ellipses
2. `polyBnW`: black-and-white polygons
3. `basicGridEllipse`: a grid of ellipses
4. `asciiDisplay`: brightness mapped to ` .:-=+*#%@`
5. `basicGridText`: a grid of text characters

Not student work. It was built quickly and parked in the SSD Creative
Coding 2025-26 gallery as card 13 ("Magic Mirror", "Smile And Wave")
before it had a proper home.

## Design decisions

- **p5 from a CDN, pinned** (`p5@1.11.13`, the version the SSD gallery's
  `_shared/libs/p5.js` carried). The SSD copy relied on that repo's
  `_shared/` folder, and the original commit bundled its own 5 MB p5.js.
  Neither belongs here.
- **No p5.sound.** The original page loaded it, but the sketch doesn't use it.
- **No analytics beacon.** The Cloudflare token was for the SSD site.
- Plain static files with no build step, unlike `gesture-kaleidoscope`.

## Changelog

- **2026-06-13**: created in SSD_CreativeCodingPage (`Adding Magic Mirror`).
- **2026-09-24**: Cloudflare beacon added there (site-wide commit).
- **2026-10-18**: moved to `interactive-installations/video-filters/`. The
  history was imported via a filtered `git filter-branch` (sketch, style,
  page, thumbnail only) and merged with `--allow-unrelated-histories`. The
  page now loads p5 from jsDelivr. The SSD copy, its gallery card and the
  thumbnail were removed from SSD_CreativeCodingPage.
- **2026-10-30**: published on FFFX. Renamed Magic Mirror, and the folder
  `video-filters/` became `magic-mirror/`, so its FFFX URL is now
  `/interactive-installations/magic-mirror/`. The old URL had been live for
  a few hours and has no redirect.

## Notes

- Needs camera permission, and browsers only grant camera access on
  `https://` or `localhost`. Opening `index.html` straight from Explorer
  (`file://`) may block the camera, depending on the browser. Serve it
  from a local static server instead (see the repo README).
- **Network use is one-time.** p5 loads from jsDelivr when the page opens.
  Everything after that, including the camera feed and all the filters,
  runs locally.
