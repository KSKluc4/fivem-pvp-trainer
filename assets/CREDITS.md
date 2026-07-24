# Asset credits

## Trainer immersion (viewmodel weapon + drill sounds)

Both the viewmodel pistol and the three drill sound effects are **100%
procedurally generated in code** — no third-party or extracted game assets
are used anywhere in this feature, and nothing is fetched from a CDN at
runtime.

- **Weapon model** — low-poly pistol built from primitive Three.js geometries
  (`BoxGeometry`) at runtime.
  Source: `src/frontend/src/trainer/engine/viewmodelWeapon.js`
- **Sounds** — synthesized PCM (oscillators + noise + envelopes via the Web
  Audio API), no recorded/sampled audio.
  Source: `src/frontend/src/trainer/audio/soundSynth.js`

No CC0/Kenney.nl/Poly Haven/OpenGameArt/Freesound assets were needed for this
feature. If any external CC0 asset is added to the project in the future,
list it here with its source, license, and link.
