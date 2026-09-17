// MuniForce ⇄ Firestore live-sync + Google sign-in gate.
// Loads the Firebase modular SDK from the gstatic CDN (no build step, works from a static file).

const firebaseConfig = {
  apiKey: "AIzaSyCMjD6K5f_3ZYx-YPMFXUNFGV5cQCesobA",
  authDomain: "muniforce-62797.firebaseapp.com",
  projectId: "muniforce-62797",
  storageBucket: "muniforce-62797.firebasestorage.app",
  messagingSenderId: "249806883222",
  appId: "1:249806883222:web:3d11e946243986745cb5b7"
};

const DOC_PATH = ["state", "main"];

let _p = null;

async function _init() {
  if (_p) return _p;
  _p = (async () => {
    const appMod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
    const fs = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    const au = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
    const app = appMod.initializeApp(firebaseConfig);
    const db = fs.getFirestore(app);
    const auth = au.getAuth(app);
    return { fs, au, db, auth, ref: fs.doc(db, DOC_PATH[0], DOC_PATH[1]) };
  })();
  return _p;
}

// ---- auth ----

// Watch sign-in state. cb receives {email, name, photo} or null when signed out.
export async function watchUser(cb) {
  const { au, auth } = await _init();
  return au.onAuthStateChanged(auth, u => {
    cb(u ? { email: u.email || "", name: u.displayName || "", photo: u.photoURL || "" } : null);
  });
}

export async function signIn() {
  const { au, auth } = await _init();
  const provider = new au.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    await au.signInWithPopup(auth, provider);
    return { ok: true };
  } catch (err) {
    const code = (err && err.code) || "";
    // Popup blocked or closed by the browser — fall back to a full-page redirect.
    if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
      try { await au.signInWithRedirect(auth, provider); return { ok: true }; } catch (e2) { return { ok: false, code: e2 && e2.code }; }
    }
    return { ok: false, code };
  }
}

export async function signOutUser() {
  const { au, auth } = await _init();
  try { await au.signOut(auth); } catch (e) {}
}

// ---- data ----

// Subscribe to live updates. cb receives the stored state object (or null).
// Returns an unsubscribe function.
export async function subscribe(cb, onError) {
  const { fs, ref } = await _init();
  return fs.onSnapshot(ref, (snap) => {
    cb(snap.exists() ? snap.data() : null);
  }, (err) => {
    console.warn("[mf-firebase] snapshot error:", err && err.message);
    if (onError) onError(err);
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
