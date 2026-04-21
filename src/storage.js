/*
 * window.storage adapter for self-hosted deployment.
 *
 * The original claude.ai artifact called `window.storage.get/set/delete(key, true)`
 * — a shared-across-viewers key/value store. We emulate that on a static host using
 * two tiers per key:
 *
 *   1. A baked snapshot at BASE/<key>.json (the "shared" tier). Everyone who loads
 *      the page sees whatever is committed to public/<key>.json in the repo.
 *   2. localStorage (the per-browser tier). Admins can upload CSVs and preview
 *      them without committing; nothing is shared until the admin exports and
 *      commits the JSON.
 *
 * The admin "Save" path becomes a file download the admin can commit to the repo,
 * so shared state stays version-controlled. Filename = `<key>.json`, so callers
 * drive the split between environments (data.production vs data.sandbox vs ...).
 */

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "") + "/";
const LS_PREFIX = "approval_map::";

// Per-key cache of the shared snapshot fetched from the deployed site.
const sharedCache = new Map(); // key -> string | null

function sharedFileFor(key) {
  return `${BASE}${key}.json`.replace(/\/+/g, "/");
}

async function loadSharedSnapshot(key) {
  if (sharedCache.has(key)) return sharedCache.get(key);
  try {
    const res = await fetch(sharedFileFor(key), { cache: "no-store" });
    if (!res.ok) {
      sharedCache.set(key, null);
      return null;
    }
    const text = await res.text();
    sharedCache.set(key, text);
    return text;
  } catch {
    sharedCache.set(key, null);
    return null;
  }
}

function downloadFile(name, text) {
  try {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    console.warn("storage.set: download failed", err);
  }
}

// Per-browser local override, used as a preview before committing.
const local = {
  get(key) {
    try {
      const raw = localStorage.getItem(LS_PREFIX + key);
      return raw == null ? null : { value: raw };
    } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(LS_PREFIX + key, value); } catch {}
  },
  delete(key) {
    try { localStorage.removeItem(LS_PREFIX + key); } catch {}
  },
};

// Public adapter — matches the shape the original component expects.
window.storage = {
  async get(key, _shared) {
    // Prefer the admin's local preview if one exists — otherwise fall back to the
    // deployed shared snapshot. This mirrors the original behaviour where a
    // `set` shadows the shared tier.
    const localHit = local.get(key);
    if (localHit) return localHit;

    const shared = await loadSharedSnapshot(key);
    return shared ? { value: shared } : null;
  },

  async set(key, value, _shared) {
    // Save locally so the admin sees their change immediately.
    local.set(key, value);
    // Bust the cache so a subsequent get() re-fetches the deployed file
    // (in case the admin is iterating and deletes their local preview).
    sharedCache.delete(key);
    // Trigger a download so the admin can commit the new snapshot to the repo.
    // Filename is `<key>.json` → drop it straight into public/<key>.json.
    downloadFile(`${key}.json`, value);
  },

  async delete(key, _shared) {
    local.delete(key);
    sharedCache.delete(key);
    // We can't un-commit the deployed snapshot from the browser; the admin has
    // to delete public/<key>.json and redeploy if they want a full wipe.
  },
};
