# Refresh chart preview

The viewer uses the `wds-editor` Refresh core pinned by `third_party/wds-editor`
(commit `6fc30e2`). It automatically recognizes extended CSV geometry without a
manual profile switch. Notes may overhang either side of the twelve-lane stage
or be wider than the stage, but must still overlap a playable lane.

The same core supports positive SV rows (`type=-1`), nontail holds
(`1100/1101/1110/1111`), authored `900` judgments, native `.wdschart` v6 and the
editor's extended SUS metadata. The browser adapter passes each loaded chart's
SV timeline to stage geometry as well as the core snapshot builder. Loading an
ordinary chart clears the preceding chart's SV timeline. SV changes visual
scrolling, not music or judgment times; nontail holds do not acquire artificial
tail judgments or generated eighths.

Build and exercise the actual browser WASM and packaged skins:

```sh
npm run build:lib
npm run test:wasm
```

`SIRIUS_VIEWER_WASM_DIR` can point the tests at a host application's copied
`wasm/` directory, verifying the deployed integration uses the same core.
