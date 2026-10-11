// A stable anonymous id for this browser, used only to dedupe product-view
// pings server-side (one view per viewer per product per day) - not tied
// to login, since customers browse before signing in.
const KEY = 'sellsence_viewer_key';

export function getViewerKey(): string {
  let key = localStorage.getItem(KEY);
  if (!key) {
    key = crypto.randomUUID ? crypto.randomUUID() : `v-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(KEY, key);
  }
  return key;
}
