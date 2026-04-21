/*
 * window.storage adapter for self-hosted deployment.
 *
 * The original claude.ai artifact called `window.storage.get/set/delete(key, true)`
 * — a shared-across-viewers key/value store. We emulate that on a static host using
 * two tiers:
 *
 *   1. A baked snapshot at BASE/data.json (the "shared" tier). Everyone who loads
 *      the page sees whatever is committed to public/data.json in the repo.
 *   2. localStorage (the per-browser tier). Admins can upload CSVs and preview
 *      them without committing; nothing is shared until the admin exports and
 *      commits the JSON.
 *
 * The admin "Save" path becomes a file download the admin can commit to the repo,
 * so shared state stays version-controlled.
 */

const SHARED_FILE = `${import.meta.env.BASE_URL || "/"}data.json`.replace(/\/+/g, "/");
const LS_PREFIX = "approval_map::";

// Cached shared snapshot. Populated lazily from the bundled/deployed data.json.
let sharedSnapshot = undefined;

async function loadSharedSnapshot() {
  if (sharedSnapshot !== undefined) return sharedSnapshot;
  try {
    const res = await fetch(SHARED_FILE, { cache: "no-store" });
    if (!res.ok) {
      sharedSnapshot = null;
      return null;
    }
    const text = await res.text();
    // Store the raw text — the app JSON.parse's it itself (matches original contract).
    sharedSnapshot = text;
    return sharedSnapshot;
  } catch {
    sharedSnapshot = null;
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

    const shared = await loadSharedSnapshot();
    return shared ? { value: shared } : null;
  },

  async set(key, value, _shared) {
    // Save locally so the admin sees their change immediately.
    local.set(key, value);
    // Trigger a download so the admin can commit the new snapshot to the repo.
    // The filename matches the key so the admin knows where to place it
    // (rename to data.json and drop into public/).
    downloadFile(`${key}.json`, value);
  },

  async delete(key, _shared) {
    local.delete(key);
    // We can't un-commit the deployed snapshot from the browser; the admin has
    // to delete public/data.json and redeploy if they want a full wipe.
  },
};
