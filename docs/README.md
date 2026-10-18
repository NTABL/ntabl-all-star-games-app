# NTABL Scorebook Phase 2 — LOCAL TEST BUILD

## Install
1. Make a backup of your existing project, especially `app/gamescorebook.tsx` and `utils/scorebook*.ts`.
2. Extract this ZIP into your existing `D:\ntabl-all-star-games-app` project, preserving the `app` and `utils` folder structure.
3. Keep your existing `utils/appconfig.ts`, dependencies, and Expo project configuration.
4. Run `npx expo start --clear`, open on your compatible Expo Go SDK 54 test device.
5. Access Score Game from Season Schedules / Game Lineup. Do not remove your production app.

## What's new
- Scorebook-first view with enlarged current-batter square and compact Ball / Strike / In-Play / Out / Other toolbar.
- Every pitch is recorded individually, including foul balls and balls put in play when selected.
- Guided play selection, editable runner destinations, ordered fielder selections, RBI selector.
- Start Game, End Game, Edit Game status workflow and queued device-local saves.
- Local event replay for pitches, outs, bases, batting progression and runs.
- Inning navigation, team batting views, Team Stats view, manual opponent batting order.
- Basic runner-only actions and event undo.
- Retains existing Phase 1 navigation entry points; All-Star app features are untouched.

## Important limitations — NOT FOR OFFICIAL GAME USE
- Traditional basepath drawings, out slashes, trajectory curves, and full scorecard markings are placeholders, not final artwork.
- Historical play editing is NOT implemented; Edit Game currently unlocks the finalized game for additional events or last-event undo only.
- Runner-only events and complicated force/tag/double-play situations need rigorous scoring tests and correction flows.
- Pitch events currently have no pitcher assignment; full pitching statistics cannot yet be compiled.
- `inPlay` and `hitByPitch` pitch types are modeled but not automatically appended by recording a play.
- Team Stats uses Phase 1 batting aggregation; it is preliminary and not published.
- Scoring does not yet pull live lineup changes back into a running scorebook.
- Ball-location tapping stores normalized coordinates; the scorecard does not yet draw a trajectory line.
- Skip Batter without an out is not yet implemented.
- No backend sharing or official stats publication.
- This package does not change server.js.

## Existing draft compatibility
Existing local Phase 1 scorebooks use the same key and schema version. The Phase 2 event reader accepts the Phase 1 event shape. Back up local app data before testing. This is a development build; migration/recovery has not been validated against every possible existing draft.
