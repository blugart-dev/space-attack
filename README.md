# Space Attack

A small Canvas arcade shooter inspired by the 1982 Emerson Arcadia 2001 game.
Plain HTML, CSS, and native JavaScript modules; no libraries or build step.

Serve this directory locally with `python -m http.server 8000 --bind 127.0.0.1`, then open `http://localhost:8000` in Chrome. ES modules require HTTP rather than opening `index.html` directly. The same files can be hosted on GitHub Pages; all asset and module paths are relative.

## Source layout

- `index.html`: page structure, HUD, overlays, and playfield.
- `styles.css`: theme, component styling, and responsive rules.
- `src/main.js`: startup, keyboard/focus handling, and fixed-step animation loop.
- `src/config.js`: gameplay constants, dimensions, states, and difficulty parameters.
- `src/game.js`: mission state, entities, simulation, collisions, and progression.
- `src/renderer.js`: sprite data and Canvas drawing.
- `src/audio.js`: synthesized sound effects and mute preference.
- `src/ui.js`: HUD, overlay, button, and accessibility announcement updates.

`main.js` connects the components. The game owns its state and invokes the injected
UI/audio collaborators at the existing points in the simulation. The renderer
reads snapshots without modifying entities. Positions and hitboxes use logical
Canvas pixels; simulation durations use seconds.

High scores are saved immediately when exceeded, using the localStorage key
`space-attack.high-score`, and restored on page load. Records are specific to this
browser and site origin: localhost and GitHub Pages have separate records. If
storage is unavailable, gameplay continues with a high score kept for that page.
Only a strictly higher score earns the special game-over message; ties show
`MISSION LOST`. Mute preference still lasts only until the page is refreshed.

## Controls

- Left/right arrows or A/D: move.
- Hold Space: fire.
- Enter: start, restart, or resume when paused.
- P or Escape: pause/resume.
- M: mute/unmute.

## Manual regression checklist

- Compare the start screen, ship/enemy sprites, HUD, sidebar, and narrow-window layout.
- Start with Enter and the button; check movement limits and firing while moving.
- Confirm formation movement, diving/returning ships, and enemy fire behave as before.
- Check 100-point formation kills, 200-point diving kills, and squadron progress.
- Take projectile and ship hits; check three lives, respawn at center, and temporary protection.
- Clear waves and confirm transition timing and increasing difficulty.
- Pause with P/Escape and the button; switch away and return, including during a wave transition.
- Take a hit and pause immediately while the scene is shaking; leave it paused
  for a few seconds. The scene must stay completely still, then continue on resume.
- Check diagonal rockets from diving ships: crossings of the player should cause
  damage, while near misses should not. Straight rockets and player shots should
  still work normally; respawn protection should still prevent damage.
- Check sound effects and mute; lose all lives and restart repeatedly. Score/wave/lives
  reset, while the high score and mute preference persist across mission restarts.
- Beat the high score, refresh before game over, and confirm `HIGH SCORE` retains
  the new record. Close/reopen the page on the same origin and confirm it again.
- Lose with a score below or equal to the record: the message should be `MISSION
  LOST`. Beat it and lose: the message should remain `YOUR BEST FLIGHT YET`.
- Optionally use Chrome DevTools to put an invalid value in the storage key or
  block site storage. The game should still start and play normally.

## Targeted fixes

- High-score persistence and the `HIGH SCORE` label.
- Loss wording on game over, preserving the special message for a new record.
- Frozen Canvas rendering while paused, including screen shake.
- Full segment collision checks for enemy rockets, using both previous coordinates
  and the combined rocket/player hitboxes. Player-shot collision is unchanged.
