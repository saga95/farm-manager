# Performance budget

Issue #108 · SRS v1.1 §25.2. Field workers use mid-range Android phones on 4G, often with weak signal at the far end of a plot. The budget keeps a cold load fast on that connection.

## The budget

| Check                                  | Budget                                                                                        | Where it runs                                        |
| -------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| First-load JS, any page                | ≤ **365 kB** gzip                                                                             | CI Build job, every PR (`pnpm budget:js`)            |
| First-load JS shared by all pages      | ≤ **280 kB** gzip                                                                             | CI Build job, every PR                               |
| Lighthouse mobile, public pages on dev | Performance ≥ **90**, Accessibility **100**, LCP ≤ **2.5 s**, TBT ≤ **200 ms**, CLS ≤ **0.1** | Nightly on live dev (`pnpm budget:lighthouse <url>`) |

- **Lighthouse settings:** the mobile preset (mid-range phone, slow 4G, 4× CPU slowdown) with applied (devtools) throttling. Each page is run three times and the median is judged.
- **Why applied throttling:** the default simulated mode reports LCP 3.3–3.7 s on the login page. A real browser paints that page's LCP (the server-rendered subtitle) at the same moment as FCP. The simulation assumes the text waits for the deferred scripts, which it doesn't.
- **Signed-in pages** need an account, so the JS budget covers them. The JS budget is deterministic and runs on every PR.

## Measurements (2026-10-06)

| Page      | Before: dev, one `vendors` chunk        | After: this change, Next.js chunking                   |
| --------- | --------------------------------------- | ------------------------------------------------------ |
| Sign in   | LCP 2.66 s · perf 92 · JS 365 kB        | LCP 1.79 s · perf 98 · JS 323 kB (local build)         |
| Register  | LCP 2.55 s · perf 94                    | LCP 1.79 s · perf 99 (local build)                     |
| Offline   | LCP 2.73 s · perf 92 · accessibility 98 | LCP 1.78 s · perf 98 · accessibility 100 (local build) |
| Shared JS | 394 kB (Next.js build output)           | 302 kB (Next.js build output)                          |

The two main changes:

1. **Removed the template's `splitChunks` override.** It forced every `node_modules` package into one `vendors` chunk, so the sign-in page downloaded the chart, form and dialog code of every screen. Next.js's default chunking splits the framework, the shared libraries and each page's own code.
2. **Fixed the skip link on status pages.** It pointed to `#main-content`, which those pages didn't have.

## What is already in place

- **Long lists page on the server:**
  - sales history, change history and stock movements use cursors;
  - plucking rounds return the newest 50;
  - search filters the lists the phone has already loaded, so typing costs no extra download.
- **Photos:**
  - lists show thumbnails generated on the phone before upload (ADR-0003);
  - full images load only in the viewer;
  - uploads are queued and retried.
- **Repeat visits:** the service worker caches the app shell and every visited page. `_next/static` files are content-hashed and cached forever.
- **Charts:** the bar chart is the app's own small component, not a charting library.

## When the budget fails

Don't raise a number to make CI pass. First find what grew: `pnpm analyze` opens the bundle report. The usual causes are a new library imported on a page or into `_app`, and a large component that could be loaded with `next/dynamic`. If a raise is justified, record it in this file with the reason and the new measurement.
