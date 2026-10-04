// Tiny IndexedDB key/value store (localStorage is too small for a month of keyword rows).
const DB = "vantage-performance", STORE = "kv";
function open() {
  return new Promise((res, rej) => {
    if (!("indexedDB" in window)) return rej(new Error("no-idb"));
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
export async function kvGet(key) { try { const db = await open(); return await new Promise((res, rej) => { const t = db.transaction(STORE, "readonly").objectStore(STORE).get(key); t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error); }); } catch (e) { return undefined; } }
export async function kvSet(key, val) { try { const db = await open(); await new Promise((res, rej) => { const t = db.transaction(STORE, "readwrite"); t.objectStore(STORE).put(val, key); t.oncomplete = res; t.onerror = () => rej(t.error); }); return true; } catch (e) { return false; } }
export async function kvDel(key) { try { const db = await open(); await new Promise((res, rej) => { const t = db.transaction(STORE, "readwrite"); t.objectStore(STORE).delete(key); t.oncomplete = res; t.onerror = () => rej(t.error); }); } catch (e) {} }
