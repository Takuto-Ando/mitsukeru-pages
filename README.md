# みつけるスケッチ — Web prototype

A mobile-first browser prototype: choose an animal, observe one feature, draw, compare your drawing with the model, and learn.

## Run on Mac

```bash
cd mitsukeru-pages
python3 -m http.server 8000
```

Open http://localhost:8000 in your Mac browser. For iPhone, publish using GitHub Pages (HTTPS). The current mock works without camera access.

## Publish with GitHub Pages

1. Public repository: https://github.com/Takuto-Ando/mitsukeru-pages
2. Update `index.html` on the publishing branch `codex/20261023-pages` and push.
3. Open **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Site URL: https://takuto-ando.github.io/mitsukeru-pages/
5. A custom domain can be added later from GitHub Pages settings. Add appropriate DNS records following GitHub instructions.

## Scope and limitations

- 16 provisional animal groups derived from the earlier MIKECA summary; **not** a verified set of all 30 original cards.
- Features and educational explanations in this demo are provisional; review against original cards and zoological sources before release.
- Generic sketch area is used for all challenges, and the fixed answer overlay is a **placeholder**, not a precise anatomical reference for the other species.
- Horizontal-shape detection for goat/sheep is deliberately permissive. Other challenges currently allow any nonempty sketch to advance. **This is a UX mock, not validated recognition.**
- No live camera recognition, real-time AR masks, user accounts, backend, or photo assets.
- Production Figma UI can later replace styling and SVG placeholders without changing the core user flow.

## Future iOS

Host as a PWA-style website initially, then consider Capacitor after browser UX has been validated.
