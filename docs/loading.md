# Resource loading and playback

Playback becomes available only after the engine, packaged textures, every hit
sound, the chart, and all supplied music, timing configuration and cover sources
have finished downloading and decoding. Omitting optional sources still supports
silent charts and the stock stage. A supplied resource that fails keeps playback
disabled and displays an error; source failures can be retried in the player.
Engine or bundled-asset failures require remounting the component or reloading the page.

Changing a source pauses playback immediately. A retired download cannot publish
`loaded` or trigger autoplay for a newer selection. Buttons, canvas clicks,
keyboard shortcuts, exposed `play`/`toggle`/`seek` methods and autoplay share the
same readiness check. Cancelling a play request while the browser resumes its
AudioContext also prevents it from starting later.

Hosts fetching Blob sources themselves must pass `:pending="loading"` until their
entire source set is available. Set it before replacing the sources. Without this
prop the player cannot distinguish an omitted optional source from one that the
host has not yet provided. `ready` still means engine initialization;
`loaded` is emitted only after the current complete source set is ready.

Run `npm test` for the loading, transport and native preview regressions, and
`npm run build:lib` to rebuild the distributable Vue component.
