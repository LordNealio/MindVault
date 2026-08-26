// Vault media store — multi-image support for vault items.
//
// WHY A SEPARATE STORE: vault items live in localStorage ("j_vault"), which
// has a ~5MB quota. A single phone photo as a raw data URL is 3-8MB, so the
// previous single-image flow was already at risk and 10 images was impossible.
// Image bytes therefore live in IndexedDB (hundreds of MB available) while
// j_vault keeps only the ordered list of image ids.
//
// Own database name — never share one with another module; same-name/
// same-version databases silently lose their object stores.

const DB_NAME = "mindvault_vaultmedia_v1";
const STORE = "images";

export const MAX_IMAGES_PER_ITEM = 10;

// Full-size is capped for mobile memory; thumbs drive the grid so a card with
// 10 images decodes ~10 x 20KB instead of ~10 x 400KB.
const FULL_MAX_PX = 1400;
const FULL_QUALITY = 0.78;
const THUMB_MAX_PX = 320;
const THUMB_QUALITY = 0.7;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("itemId", "itemId");
        store.createIndex("createdAt", "createdAt");
      }
    };
  });
}

export function storageRef(id) {
  return `idb://${DB_NAME}/${STORE}/${id}`;
}

// ── Image processing ─────────────────────────────────────────
function drawScaled(img, maxPx, quality) {
  const c = document.createElement("canvas");
  let w = img.width, h = img.height;
  if (w > maxPx || h > maxPx) {
    if (w >= h) { h = Math.round(h * maxPx / w); w = maxPx; }
    else { w = Math.round(w * maxPx / h); h = maxPx; }
  }
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return { dataUrl: c.toDataURL("image/jpeg", quality), w, h };
}

/**
 * Decode + compress one File into a full and thumbnail data URL.
 * Rejects on unreadable/corrupt files so callers can report per-file failure
 * without discarding the images that succeeded.
 */
export function processImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith("image/")) {
      reject(new Error(`${file?.name || "File"} is not an image`));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const full = drawScaled(img, FULL_MAX_PX, FULL_QUALITY);
        const thumb = drawScaled(img, THUMB_MAX_PX, THUMB_QUALITY);
        URL.revokeObjectURL(url);
        const id = crypto.randomUUID();
        resolve({
          id,
          ref: storageRef(id),
          name: file.name || "photo.jpg",
          full: full.dataUrl,
          thumb: thumb.dataUrl,
          w: full.w,
          h: full.h,
          bytes: Math.round(full.dataUrl.length * 0.75),
          createdAt: new Date().toISOString(),
        });
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not read ${file.name || "image"}`));
    };
    img.src = url;
  });
}

// Wrap an already-encoded data URL (legacy migration / backup restore).
export function recordFromDataUrl(dataUrl, name = "photo.jpg", id) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const thumb = drawScaled(img, THUMB_MAX_PX, THUMB_QUALITY);
      const rid = id || crypto.randomUUID();
      resolve({
        id: rid, ref: storageRef(rid), name,
        full: dataUrl, thumb: thumb.dataUrl,
        w: img.width, h: img.height,
        bytes: Math.round(dataUrl.length * 0.75),
        createdAt: new Date().toISOString(),
      });
    };
    img.onerror = () => reject(new Error("Could not decode stored image"));
    img.src = dataUrl;
  });
}

// ── CRUD ─────────────────────────────────────────────────────
export async function putImage(record, itemId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ ...record, itemId: itemId ?? record.itemId ?? null });
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve(record.id);
  });
}

export async function putImages(records, itemId) {
  for (const r of records) await putImage(r, itemId);
  return records.map(r => r.id);
}

export async function getImage(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(id);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result || null);
  });
}

/** Returns records in the same order as `ids`, skipping any that are missing. */
export async function getImages(ids = []) {
  if (!ids.length) return [];
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = db.transaction(STORE).objectStore(STORE);
    const out = new Map();
    let pending = ids.length;
    let failed = false;
    ids.forEach(id => {
      const req = store.get(id);
      req.onsuccess = () => {
        if (req.result) out.set(id, req.result);
        if (--pending === 0 && !failed) resolve(ids.map(i => out.get(i)).filter(Boolean));
      };
      req.onerror = () => {
        if (!failed) { failed = true; reject(req.error); }
      };
    });
  });
}

export async function deleteImage(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();
  });
}

export async function deleteImages(ids = []) {
  for (const id of ids) {
    try { await deleteImage(id); } catch { /* keep deleting the rest */ }
  }
}

export async function getAllImages() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).getAll();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result || []);
  });
}

export async function importImages(records = []) {
  let ok = 0;
  for (const r of records) {
    if (!r?.id || !r?.full) continue;
    try { await putImage(r, r.itemId); ok++; } catch { /* skip bad record */ }
  }
  return ok;
}

// ── Legacy migration ─────────────────────────────────────────
// Old shape: { type:"photo", content:"data:image/..." } with the bytes in
// localStorage. Move those bytes into IndexedDB, VERIFY the write by reading
// it back, and only then drop `content`. If anything fails we leave the item
// exactly as it was — the card still renders from `content`.
export async function migrateLegacyPhotoItem(item) {
  if (!item || item.type !== "photo") return item;
  if (Array.isArray(item.imageIds) && item.imageIds.length) return item;
  if (typeof item.content !== "string" || !item.content.startsWith("data:")) return item;

  try {
    const record = await recordFromDataUrl(item.content, `${item.title || "photo"}.jpg`);
    await putImage(record, item.id);
    const readBack = await getImage(record.id);
    if (!readBack?.full) throw new Error("verification failed");
    const { content, ...rest } = item;
    return { ...rest, imageIds: [record.id], migratedAt: new Date().toISOString() };
  } catch {
    return item; // untouched — legacy render path still works
  }
}

/** Normalizes a vault item to the multi-image shape for rendering. */
export function imageIdsOf(item) {
  if (Array.isArray(item?.imageIds)) return item.imageIds;
  return [];
}

export function hasLegacyPhoto(item) {
  return item?.type === "photo"
    && !imageIdsOf(item).length
    && typeof item?.content === "string"
    && item.content.startsWith("data:");
}
