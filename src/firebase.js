// Firebase(Firestore) 초기화 및 공유 데이터 저장/조회
// 설정값은 .env 의 VITE_FIREBASE_* 에서 읽어옵니다(README 참고).
import { initializeApp } from "firebase/app";
import {
  getFirestore, doc, setDoc, collection, getDocs,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// key 예: "submission:1712...-ab12" → 컬렉션 "submissions", 문서 "1712...-ab12"
//        "gallery:1712...-cd34"    → 컬렉션 "gallery"
function parseKey(key) {
  const idx = key.indexOf(":");
  const prefix = idx >= 0 ? key.slice(0, idx) : key;
  const id = idx >= 0 ? key.slice(idx + 1) : key;
  const map = { submission: "submissions", gallery: "gallery" };
  return { coll: map[prefix] || prefix, id };
}

// 저장(공유 데이터). 앱 코드의 storeSet(key, value, shared) 시그니처 유지.
export async function storeSet(key, value /*, shared */) {
  try {
    const { coll, id } = parseKey(key);
    await setDoc(doc(db, coll, id), value);
    return { ok: true };
  } catch (e) {
    console.error("storeSet error:", e);
    return null;
  }
}

// 목록 조회. prefix 예: "submission:" 또는 "gallery:"
export async function storeList(prefix /*, shared */) {
  try {
    const { coll } = parseKey(prefix);
    const snap = await getDocs(collection(db, coll));
    const short = prefix.replace(/:$/, "");
    const out = [];
    snap.forEach((d) => out.push({ key: `${short}:${d.id}`, value: d.data() }));
    return out;
  } catch (e) {
    console.error("storeList error:", e);
    return [];
  }
}
