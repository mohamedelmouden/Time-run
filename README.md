# FLAME

This is a separate, complete rebuild of the FLAME personal discipline and expense tracker. It keeps the Arabic-first dark/fire visual design and the existing feature set, including installability, while avoiding the old cache failure that could return HTML in place of a missing JavaScript or CSS file.

## Run locally

From this directory:

```sh
npm install
npm run dev
```

## Build for Vercel

Set Vercel's **Root Directory** to `flame-rebuild`, use `npm run build` as the build command, and `dist` as the output directory. The app has no service worker and no URL-based client router, so refreshes load the same app entry directly.

The rebuild reads the same `flame:data` local-storage key as the current app, allowing it to recognize existing data when served on the same origin and browser. Local browser storage does not sync between devices.

Its service worker caches the app entry and the exact built assets. Failed asset requests never fall back to the HTML page; a failed asset remains a clear loading error instead of causing an app boot loop.
