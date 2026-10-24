import liff from '@line/liff';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore';

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
  ['events', 'attendances', 'rides', 'students', 'payments', 'paymentStatuses', 'ridePlans', 'studentPhotos', 'selections'].forEach((k) => listen(k, pub(k)));
  listen('members', collection(db, 'artifacts', APP_ID, 'members'));
  listen('settings', doc(db, 'artifacts', APP_ID, 'settings', 'reminders'), (s) => s.data() || {});
  listen('me', memberDoc(me.uid), (s) => ({ uid: me.uid, ...me, ...s.data() }));
  return () => unsubs.forEach((u) => u());
}

export const actions = {
  saveAttendance: (eventId, studentId, status, name) =>
    setDoc(pubDoc('attendances', `${eventId}_${studentId}`), { eventId, studentId, status, responderName: name, updatedAt: now() }, { merge: true }),

  // 予定の追加・修正。項目は既存アプリの「手動追加」と同じ
  async saveEvent(event) {
    const id = event.id || crypto.randomUUID();
    const t = now();
    await setDoc(pubDoc('events', id), { ...event, id, updatedAt: t, ...(event.id ? {} : { createdAt: t, source: 'liff' }) }, { merge: true });
    return id;
  },

  async parseEvents(text) {
    const res = await fetch('/api/parse-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await auth.currentUser.getIdToken()}` },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `読み取れませんでした（${res.status}）`);
    return (await res.json()).events;
  },

  // 出欠の締切（YYYY-MM-DD）。既存アプリ・line-schedule-bot は読まない項目なので、足しても影響しない
  saveDeadline: (eventId, answerDeadline) =>
    setDoc(pubDoc('events', eventId), { answerDeadline, updatedAt: now() }, { merge: true }),

  saveRide: (eventId, studentId, ride, name) =>
    setDoc(pubDoc('rides', `${eventId}_${studentId}`), { eventId, studentId, ...ride, responderName: name, updatedAt: now() }),

  // link=false は名簿に足すだけ（管理者・案内係が名簿画面から追加するとき）
  async registerKid({ childName, kana, grade, jerseyNumber, photo }, { link = true } = {}) {
    const id = `stu_${crypto.randomUUID().slice(0, 8)}`;
    await setDoc(pubDoc('students', id), { childName, kana, grade, jerseyNumber: jerseyNumber || '', source: 'liff', createdAt: now(), updatedAt: now() });
    if (photo) await setDoc(pubDoc('studentPhotos', id), { dataUrl: photo, updatedAt: now() });
    if (link) await actions.linkKid(id);
    return id;
  },

  linkKid: (studentId) => updateDoc(memberDoc(me.uid), { studentId, updatedAt: now() }),

  async saveKid(studentId, { childName, jerseyNumber, photo }) {
    const patch = { jerseyNumber: jerseyNumber || '', updatedAt: now() };
    if (childName) patch.childName = childName;
    await setDoc(pubDoc('students', studentId), patch, { merge: true });
    if (photo) await setDoc(pubDoc('studentPhotos', studentId), { dataUrl: photo, updatedAt: now() });
  },

  // 集金の設定。既存アプリ（src/App.jsx の savePaymentDoc）と同じ形で payments/{予定のID} に入れる
  savePayment: (eventId, { description, amount, isActive }, by) =>
    setDoc(pubDoc('payments', eventId), { eventId, description, amount: amount ? Number(amount) : null, isActive, setBy: by, updatedAt: now() }, { merge: true }),

  // カード払い（Stripe）。サーバーが支払い画面を作るので、そこへ移る。払い終わると LINE版に ?paid=1 で戻ってくる
  async startCardPay(eventId) {
    const res = await fetch('/api/pay-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await auth.currentUser.getIdToken()}` },
      body: JSON.stringify({ eventId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `支払い画面を開けませんでした（${res.status}）`);
    location.href = data.url;
  },

  reportTransfer: (eventId, studentId, name) =>
    setDoc(pubDoc('paymentStatuses', `${eventId}_${studentId}`), { eventId, studentId, responderName: name, status: 'transferred', transferredAt: now(), updatedAt: now() }, { merge: true }),

  confirmTransfer: (psId, by) =>
    setDoc(pubDoc('paymentStatuses', psId), { isConfirmed: true, confirmedBy: by, confirmedAt: now(), updatedAt: now() }, { merge: true }),

  // 選抜の確定（選ばれた子のID）。既存アプリ・line-schedule-bot の試合リマインドが読む
  saveSelection: (eventId, studentIds, by) =>
    setDoc(pubDoc('selections', eventId), { eventId, studentIds, confirmedBy: by, confirmedAt: now() }),

  saveRidePlan: (eventId, cars, by) =>
    setDoc(pubDoc('ridePlans', eventId), { eventId, cars, confirmedBy: by, confirmedAt: now() }),

  // 週末リマインドを送る曜日（0=日〜6=土）。line-schedule-bot の api/weekend-reminder.js が読む
  saveReminderDay: (weekendDay) =>
    setDoc(doc(db, 'artifacts', APP_ID, 'settings', 'reminders'), { weekendDay, updatedAt: now() }, { merge: true }),

  // 週末リマインドの送り方。group＝公式アカウントがグループに直接送る、relay＝担当の人（relayUid）に1対1で頼み、担当の人が全体LINEに送る
  saveWeekendMode: (weekendMode, relayUid) =>
    setDoc(doc(db, 'artifacts', APP_ID, 'settings', 'reminders'), { weekendMode, relayUid: relayUid || null, updatedAt: now() }, { merge: true }),

  setRoles: (uid, roles) => updateDoc(memberDoc(uid), { roles, updatedAt: now() }),

  // 画像1枚ずつ別のドキュメント（1件1MBの制限があるため）。scripts/liff-admin.mjs venue で入れる
  // 予定の添付（既存アプリや line-schedule-bot が入れた画像・ファイル。url は data URL）
  async loadAttachments(eventId) {
    const snap = await getDocs(collection(db, 'artifacts', APP_ID, 'public', 'data', 'events', eventId, 'attachments'));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  },

  // 既存アプリと同じ形（events/{id}/attachments/{attId} に name・url・createdAt、予定本体に hasAttachments）
  async addAttachment(eventId, { name, url }) {
    await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'events', eventId, 'attachments', crypto.randomUUID()), { name, url, createdAt: now() });
  },
  // 予定の削除。既存アプリは予定本体だけ消すが、添付も残しても使い道がないので一緒に消す
  async deleteEvent(eventId) {
    const atts = await getDocs(collection(db, 'artifacts', APP_ID, 'public', 'data', 'events', eventId, 'attachments'));
    for (const d of atts.docs) await deleteDoc(d.ref);
    await deleteDoc(pubDoc('events', eventId));
  },
  removeAttachment: (eventId, attId) => deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'events', eventId, 'attachments', attId)),

  async loadVenue() {
    const keys = ['map', 'gateNo', 'gateYes'];
    const snaps = await Promise.all(keys.map((k) => getDoc(doc(db, 'artifacts', APP_ID, 'liffContent', `venue-${k}`))));
    return Object.fromEntries(keys.map((k, i) => [k, snaps[i].exists() ? snaps[i].data().dataUrl : null]));
  },

  async shareTargetPicker(messages) {
    if (!liff.isApiAvailable('shareTargetPicker')) throw new Error('この端末では共有できません');
    return liff.shareTargetPicker(messages);
  },

  // 公式アカウントを友だち追加しているか（試合の個別リマインドは友だちにしか届かない）。分からなければ null
  async getFriendship() {
    try { return (await liff.getFriendship()).friendFlag; } catch { return null; }
  },
  addFriendUrl: () => (import.meta.env.VITE_OA_BASIC_ID ? `https://line.me/R/ti/p/${encodeURIComponent(import.meta.env.VITE_OA_BASIC_ID)}` : null),
  openUrl: (url) => liff.openWindow({ url }),

  liffUrl: () => `https://liff.line.me/${import.meta.env.VITE_LIFF_ID}`,
  close: () => (liff.isInClient() ? liff.closeWindow() : history.back()),
};
