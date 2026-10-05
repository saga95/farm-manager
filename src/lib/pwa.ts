/** Installable app (#104): register the service worker in built apps only. */

import { isProductionBuild } from './env';

export function registerServiceWorker(): void {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !isProductionBuild()
  )
    return;
  // After load, so it never competes with the first paint on a slow phone
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
