import liff from '@line/liff';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';

// src/App.jsx と同じプロジェクト・同じ appId。データは既存アプリと共有する
const firebaseConfig = {
  apiKey: 'AIzaSyDOElEjHKpomMS6zK8J51kUAZHNam5HHqE',
  authDomain: 'soccer-club-manager.firebaseapp.com',
  projectId: 'soccer-club-manager',
  storageBucket: 'soccer-club-manager.firebasestorage.app',
  messagingSenderId: '357394035470',
  appId: '1:357394035470:web:0f5f41fb0eb208a946dd5f',
};
const APP_ID = 'soccer-club-mgr-app';

const app = initializeApp(firebaseConfig, 'liff');
const auth = getAuth(app);
const db = getFirestore(app);

const pub = (name) => collection(db, 'artifacts', APP_ID, 'public', 'data', name);
const pubDoc = (name, id) => doc(db, 'artifacts', APP_ID, 'public', 'data', name, id);
const memberDoc = (uid) => doc(db, 'artifacts', APP_ID, 'members', uid);
const now = () => new Date().toISOString();

let me = null;

// LINEでログイン → サーバーでIDトークンを確かめて Firebase のログイン用トークンをもらう
export async function connect() {
  await liff.init({ liffId: import.meta.env.VITE_LIFF_ID });
  if (!liff.isLoggedIn()) {
    liff.login({ redirectUri: location.href });
    return new Promise(() => {});
  }
  const res = await fetch('/api/liff-auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: liff.getIDToken() }),
  });
  if (!res.ok) throw new Error(`ログインに失敗しました（${res.status}）`);
  const { token, member } = await res.json();
  const cred = await signInWithCustomToken(auth, token);
  me = { uid: cred.user.uid, ...member };
  return me;
}

export function subscribe(onData) {
  const state = {};
  const unsubs = [];
  const listen = (key, ref, map = (s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))) => {
    unsubs.push(onSnapshot(ref, (snap) => { state[key] = map(snap); onData({ ...state }); }, (e) => console.error(key, e)));
  };
  ['events', 'attendances', 'rides', 'students', 'payments', 'paymentStatuses', 'ridePlans', 'studentPhotos'].forEach((k) => listen(k, pub(k)));
  listen('members', collection(db, 'artifacts', APP_ID, 'members'));
  listen('me', memberDoc(me.uid), (s) => ({ uid: me.uid, ...me, ...s.data() }));
  return () => unsubs.forEach((u) => u());
}

export const actions = {
  saveAttendance: (eventId, studentId, status, name) =>
    setDoc(pubDoc('attendances', `${eventId}_${studentId}`), { eventId, studentId, status, responderName: name, updatedAt: now() }, { merge: true }),

  // 出欠の締切（YYYY-MM-DD）。既存アプリ・line-schedule-bot は読まない項目なので、足しても影響しない
  saveDeadline: (eventId, answerDeadline) =>
    setDoc(pubDoc('events', eventId), { answerDeadline, updatedAt: now() }, { merge: true }),

  saveRide: (eventId, studentId, ride, name) =>
    setDoc(pubDoc('rides', `${eventId}_${studentId}`), { eventId, studentId, ...ride, responderName: name, updatedAt: now() }),

  async registerKid({ childName, kana, grade, jerseyNumber, photo }) {
    const id = `stu_${crypto.randomUUID().slice(0, 8)}`;
    await setDoc(pubDoc('students', id), { childName, kana, grade, jerseyNumber: jerseyNumber || '', source: 'liff', createdAt: now(), updatedAt: now() });
    if (photo) await setDoc(pubDoc('studentPhotos', id), { dataUrl: photo, updatedAt: now() });
    await actions.linkKid(id);
    return id;
  },

  linkKid: (studentId) => updateDoc(memberDoc(me.uid), { studentId, updatedAt: now() }),

  async saveKid(studentId, { childName, jerseyNumber, photo }) {
    const patch = { jerseyNumber: jerseyNumber || '', updatedAt: now() };
    if (childName) patch.childName = childName;
    await setDoc(pubDoc('students', studentId), patch, { merge: true });
    if (photo) await setDoc(pubDoc('studentPhotos', studentId), { dataUrl: photo, updatedAt: now() });
  },

  reportTransfer: (eventId, studentId, name) =>
    setDoc(pubDoc('paymentStatuses', `${eventId}_${studentId}`), { eventId, studentId, responderName: name, status: 'transferred', transferredAt: now(), updatedAt: now() }, { merge: true }),

  confirmTransfer: (psId, by) =>
    setDoc(pubDoc('paymentStatuses', psId), { isConfirmed: true, confirmedBy: by, confirmedAt: now(), updatedAt: now() }, { merge: true }),

  saveRidePlan: (eventId, cars, by) =>
    setDoc(pubDoc('ridePlans', eventId), { eventId, cars, confirmedBy: by, confirmedAt: now() }),

  setRoles: (uid, roles) => updateDoc(memberDoc(uid), { roles, updatedAt: now() }),

  // 画像1枚ずつ別のドキュメント（1件1MBの制限があるため）。scripts/liff-admin.mjs venue で入れる
  async loadVenue() {
    const keys = ['map', 'gateNo', 'gateYes'];
    const snaps = await Promise.all(keys.map((k) => getDoc(doc(db, 'artifacts', APP_ID, 'liffContent', `venue-${k}`))));
    return Object.fromEntries(keys.map((k, i) => [k, snaps[i].exists() ? snaps[i].data().dataUrl : null]));
  },

  async shareTargetPicker(messages) {
    if (!liff.isApiAvailable('shareTargetPicker')) throw new Error('この端末では共有できません');
    return liff.shareTargetPicker(messages);
  },

  liffUrl: () => `https://liff.line.me/${import.meta.env.VITE_LIFF_ID}`,
  close: () => (liff.isInClient() ? liff.closeWindow() : history.back()),
};
