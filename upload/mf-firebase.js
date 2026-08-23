// MuniForce ⇄ Firestore live-sync helper.
// Loads the Firebase modular SDK from the gstatic CDN (no build step, works from a static file).
// Exposes a tiny API the dashboard logic uses: subscribe(cb) and save(data).

const firebaseConfig = {
  apiKey: "AIzaSyCMjD6K5f_3ZYx-YPMFXUNFGV5cQCesobA",
  authDomain: "muniforce-62797.firebaseapp.com",
  projectId: "muniforce-62797",
  storageBucket: "muniforce-62797.firebasestorage.app",
  messagingSenderId: "249806883222",
  appId: "1:249806883222:web:3d11e946243986745cb5b7"
};

const DOC_PATH = ["state", "main"];

let _dbP = null;
let _api = null;

async function _init() {
  if (_dbP) return _dbP;
  _dbP = (async () => {
    const appMod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
    const fs = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    const app = appMod.initializeApp(firebaseConfig);
    const db = fs.getFirestore(app);
    _api = { fs, db, ref: fs.doc(db, DOC_PATH[0], DOC_PATH[1]) };
    return _api;
  })();
  return _dbP;
}

// Subscribe to live updates. cb receives the stored {task,durations,starts} object
// (or null if the doc doesn't exist yet). Returns an unsubscribe function (async).
export async function subscribe(cb) {
  const { fs, ref } = await _init();
  return fs.onSnapshot(ref, (snap) => {
    cb(snap.exists() ? snap.data() : null);
  }, (err) => {
    console.warn("[mf-firebase] snapshot error:", err && err.message);
  });
}

// Save the whole state object to the cloud. The payload always carries every
// state map in full, and it is written WITHOUT merge so that removals (e.g. of
// legacy keys cleaned up by a shape upgrade) actually propagate instead of
// being deep-merged back in.
export async function save(data) {
  try {
    const { fs, ref } = await _init();
    await fs.setDoc(ref, { ...data, updatedAt: Date.now() });
    return true;
  } catch (err) {
    console.warn("[mf-firebase] save error:", err && err.message);
    return false;
  }
}
