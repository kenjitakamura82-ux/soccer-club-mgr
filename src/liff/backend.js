import liff from '@line/liff';
import { initializeApp } from 'firebase/app';
import { tagUrl, newSid, linkTag, joinPaymentId } from './util.js';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentSingleTabManager, collection, doc, setDoc, addDoc, getDoc, getDocs, onSnapshot, updateDoc, deleteDoc, deleteField, runTransaction, query, where } from 'firebase/firestore';

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
// 前に開いたときのデータを端末に残しておき、次に開いたときはまずそれを出す（電波が悪いと一覧が出るまで待たされていたため）。
// 残せない環境では自動でふつうの読み込みになる
const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() }) });

const pub = (name) => collection(db, 'artifacts', APP_ID, 'public', 'data', name);
const pubDoc = (name, id) => doc(db, 'artifacts', APP_ID, 'public', 'data', name, id);
const memberDoc = (uid) => doc(db, 'artifacts', APP_ID, 'members', uid);
const now = () => new Date().toISOString();

let me = null;

// どこで時間がかかっているかを測る（LIFFのURLに ?debug=1 を付けると画面の隅に出る）。値はページを開いてからのミリ秒
export const timings = { js: Math.round(performance.now()) };
const mark = (k) => { if (!(k in timings)) timings[k] = Math.round(performance.now()); };

// LINEの準備（liff.init）。前回のログインが残っていれば、これを待たずに画面を出す。LINEの機能を使う操作だけ、これを待つ
let liffReady = null;

// LINEでログイン → サーバーでIDトークンを確かめて Firebase のログイン用トークンをもらう
async function signInViaServer() {
  const res = await fetch('/api/liff-auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: liff.getIDToken() }),
  });
  if (res.status === 403) {
    const b = await res.json().catch(() => ({}));
    if (b.withdrawn) throw Object.assign(new Error('退会の手続きがされています'), { withdrawn: true, childName: b.childName });
  }
  if (!res.ok) throw new Error(`ログインに失敗しました（${res.status}）`);
  const { token, member } = await res.json();
  const cred = await signInWithCustomToken(auth, token);
  return { uid: cred.user.uid, ...member };
}

export async function connect() {
  liffReady = liff.init({ liffId: import.meta.env.VITE_LIFF_ID }).then(() => mark('liffInit'));
  await auth.authStateReady();
  mark('authReady');
  // 前回のFirebaseのログインが残っていれば、LINEの準備もサーバーも待たずに始める（端末に残したデータがすぐ出る）。
  // LINEの準備ができたら、同じ人か確かめて、名前や役割の取り直しを裏で済ませる（役割の変更は次に開いたときから効く）
  const cached = auth.currentUser;
  if (cached?.uid?.startsWith('line_')) {
    me = { uid: cached.uid };
    timings.path = 'cached';
    liffReady.then(async () => {
      if (!liff.isLoggedIn()) return liff.login({ redirectUri: location.href });
      if (`line_${liff.getDecodedIDToken()?.sub}` !== cached.uid) { await auth.signOut(); location.reload(); return; }
      await signInViaServer();
      mark('serverAuth');
    }).catch((e) => { if (e.withdrawn) { auth.signOut().then(() => location.reload()); return; } console.error('background sign-in', e); });
    return me;
  }
  timings.path = 'server';
  await liffReady;
  if (!liff.isLoggedIn()) {
    liff.login({ redirectUri: location.href });
    return new Promise(() => {});
  }
  me = await signInViaServer();
  mark('serverAuth');
  return me;
}

// カードのリンクから開いた人を記録する（分析タブ用）。1回のお知らせにつき1人1件、最初に開いた時刻だけ残す（2回目以降はルールで弾かれる）
function logOpen() {
  const tag = linkTag();
  if (!tag || !me?.uid) return;
  setDoc(doc(db, 'artifacts', APP_ID, 'opens', `${tag.sid}_${me.uid}`.slice(0, 1400)), { uid: me.uid, src: tag.src, sid: tag.sid, at: now() })
    .catch(() => {});
}

export function subscribe(onData) {
  logOpen();
  const state = {};
  const unsubs = [];
  const listen = (key, ref, map = (s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))) => {
    unsubs.push(onSnapshot(ref, { includeMetadataChanges: key === 'events' || key === 'me' }, (snap) => {
      if (key === 'events') mark(snap.metadata.fromCache ? 'eventsCache' : 'eventsServer');
      state[key] = map(snap); onData({ ...state });
    }, (e) => console.error(key, e)));
  };
  ['events', 'attendances', 'rides', 'students', 'payments', 'paymentStatuses', 'ridePlans', 'studentPhotos', 'selections', 'bibTakes', 'bibAsks'].forEach((k) => listen(k, pub(k)));
  listen('members', collection(db, 'artifacts', APP_ID, 'members'));
  listen('settings', doc(db, 'artifacts', APP_ID, 'settings', 'reminders'), (s) => s.data() || {});
  listen('onboardingSettings', doc(db, 'artifacts', APP_ID, 'settings', 'onboarding'), (s) => s.data() || {});
  listen('bibsSettings', doc(db, 'artifacts', APP_ID, 'settings', 'bibs'), (s) => s.data() || {});
  // 消した項目（やり直しで消した onboarding など）が前の値のまま残らないよう、毎回ドキュメントの中身で置き換える。fromCache＝端末に残した古いかもしれないデータ
  // 練習メニュー（メンバーが読める）と、プレイのメモ（自分が書いたものだけ。ルールでも本人以外は読めない）
  listen('practicePlans', collection(db, 'artifacts', APP_ID, 'practicePlans'));
  listen('playerNotes', query(collection(db, 'artifacts', APP_ID, 'playerNotes'), where('uid', '==', me.uid)));
  listen('me', memberDoc(me.uid), (s) => { me = { uid: me.uid, ...s.data() }; return { ...me, fromCache: s.metadata.fromCache }; });
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

  // はじめての準備の進み具合（members/{uid}.onboarding）。本人だけ書ける（firestore.rules）
  saveOnboarding: (patch) => updateDoc(memberDoc(me.uid), { onboarding: { ...(me.onboarding || {}), ...patch }, updatedAt: now() }),
  // はじめての準備を最初からやり直す（管理者だけ。試しに通したあとなど）。進み具合を消し、入会の集金を止める。
  // カードで払った・会計が確認した支払いの記録は消さない（お金が動いているため）。まだ確認していないことら送金の報告だけ消す
  async resetOnboarding(uid, studentId) {
    await updateDoc(memberDoc(uid), { onboarding: deleteField(), updatedAt: now() });
    if (!studentId) return;
    const pid = joinPaymentId(studentId);
    const psRef = pubDoc('paymentStatuses', `${pid}_${studentId}`);
    const ps = await getDoc(psRef);
    if (ps.exists() && !ps.data().isConfirmed && ps.data().method !== 'card') await deleteDoc(psRef);
    if (!ps.exists() || !ps.data().isConfirmed) await setDoc(pubDoc('payments', pid), { isActive: false, updatedAt: now() }, { merge: true });
  },
  // ビブスの持ち帰り。1件＝予定×色×子ども（bibTakes/{予定}_{色}_{子ども}）。取り消しは消す
  takeBib: (eventId, colorId, studentId) => setDoc(pubDoc('bibTakes', `${eventId}_${colorId}_${studentId}`), { eventId, colorId, studentId, uid: me?.uid || '', by: me?.displayName || '', at: now() }),
  untakeBib: (eventId, colorId, studentId) => deleteDoc(pubDoc('bibTakes', `${eventId}_${colorId}_${studentId}`)),
  // 担当の誰かが全体LINEに聞いたら記録（ほかの担当に「〇〇さんが送りました」と出す）
  markBibsAsked: (eventId) => setDoc(pubDoc('bibAsks', eventId), { eventId, by: me?.displayName || '', uid: me?.uid || '', at: now() }),
  // ビブスの設定（色・聞く担当・自動で聞くか）。管理者とコーチ
  saveBibsSettings: (fields) => setDoc(doc(db, 'artifacts', APP_ID, 'settings', 'bibs'), { ...fields, updatedAt: now() }, { merge: true }),
  // 入会の設定（会計・案内係・管理者）
  saveOnboardingSettings: (fields) => setDoc(doc(db, 'artifacts', APP_ID, 'settings', 'onboarding'), { ...fields, updatedAt: now() }, { merge: true }),
  // 背番号を早い者勝ちで取る。番号ごとの印（jerseyNumbers/{番号}）をトランザクションで取り合い、先に取った子だけが通る。
  // 印が残っていても、その子の背番号がもう変わっていれば（名簿で直したなど）取れる
  async claimJersey(studentId, n) {
    await runTransaction(db, async (tx) => {
      const lockRef = pubDoc('jerseyNumbers', String(n));
      const lock = await tx.get(lockRef);
      const holder = lock.exists() ? lock.data().studentId : null;
      if (holder && holder !== studentId) {
        const other = await tx.get(pubDoc('students', holder));
        if (other.exists() && String(other.data().jerseyNumber) === String(n)) throw new Error('ほかの子が先に選びました。別の番号を選んでください');
      }
      tx.set(lockRef, { studentId, at: now() });
      tx.set(pubDoc('students', studentId), { jerseyNumber: String(n), updatedAt: now() }, { merge: true });
    });
  },
  // 入会の集金（年会費＋ユニフォーム代をまとめた個別の集金）。払う前なら、選び直しや金額の変更に合わせて作り直す
  saveJoinPayment: (studentId, { title, items, amount, baseAmount }) =>
    setDoc(pubDoc('payments', joinPaymentId(studentId)), { kind: 'custom', join: true, title, items, amount, baseAmount, targets: [studentId], isActive: true, setBy: me?.displayName || '', updatedAt: now() }, { merge: true }),

  // 退会（2026-10-26 ユーザー決定）。消さずに印を付け、一覧から外す。背番号は空けて、元に戻すとき用に残す
  // 練習メニュー（コーチ・管理者）。振り返りも同じドキュメントに入れる
  savePlan: (e, { purpose, total, blocks, review }) => setDoc(doc(db, 'artifacts', APP_ID, 'practicePlans', e.id), {
    eventId: e.id, date: e.date, purpose, total, blocks,
    review: review ? { text: review, by: me?.displayName || '', at: now() } : null,
    by: me?.displayName || '', uid: me?.uid || '', updatedAt: now(),
  }, { merge: true }),
  // プレイのメモ。書いた本人にしか見えない（だれが書いたかは画面に出さない。uid は本人だけが読み消しするため）
  addNote: ({ eventId, date, studentId, text }) => addDoc(collection(db, 'artifacts', APP_ID, 'playerNotes'), { eventId, date, studentId, text, uid: me.uid, at: now() }),
  deleteNote: (id) => deleteDoc(doc(db, 'artifacts', APP_ID, 'playerNotes', id)),

  withdrawKid: (s) => setDoc(pubDoc('students', s.id), { withdrawnAt: now(), jerseyBeforeWithdraw: s.jerseyNumber || '', jerseyNumber: '', updatedAt: now() }, { merge: true }),
  restoreKid: (s, jerseyNumber) => setDoc(pubDoc('students', s.id), { withdrawnAt: deleteField(), jerseyBeforeWithdraw: deleteField(), jerseyNumber, updatedAt: now() }, { merge: true }),

  async saveKid(studentId, { childName, jerseyNumber, photo }) {
    const patch = { jerseyNumber: jerseyNumber || '', updatedAt: now() };
    if (childName) patch.childName = childName;
    await setDoc(pubDoc('students', studentId), patch, { merge: true });
    if (photo) await setDoc(pubDoc('studentPhotos', studentId), { dataUrl: photo, updatedAt: now() });
  },

  // 集金の設定。既存アプリ（src/App.jsx の savePaymentDoc）と同じ形で payments/{予定のID} に入れる
  // baseAmount は手数料込みにする前の金額（込みでなければ null）。保護者の画面で内訳と Stripe の手数料の説明を出すのに使う
  savePayment: (eventId, { description, amount, isActive, baseAmount = null }, by) =>
    setDoc(pubDoc('payments', eventId), { eventId, description, amount: amount ? Number(amount) : null, baseAmount, isActive, setBy: by, updatedAt: now() }, { merge: true }),

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

  // 個別の集金（入会費・ユニフォーム代など）。予定にひも付かないので ID は custom-…。支払いの記録（paymentStatuses）の eventId にはこの ID が入る
  async saveCustomPayment(id, fields, by) {
    const pid = id || `custom-${crypto.randomUUID().slice(0, 8)}`;
    await setDoc(pubDoc('payments', pid), { ...fields, kind: 'custom', setBy: by, updatedAt: now(), ...(id ? {} : { createdAt: now() }) }, { merge: true });
    return pid;
  },

  // カード・Apple Pay で払われた集金の返金（会計・管理者だけ。サーバーが Stripe に頼む）
  async refundCardPay(paymentStatusId) {
    const res = await fetch('/api/pay-refund', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await auth.currentUser.getIdToken()}` },
      body: JSON.stringify({ paymentStatusId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `返金できませんでした（${res.status}）`);
    return data;
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
  // relayUids は頼む人（何人でも）。line-schedule-bot は relayUids を見る（古い relayUid も読む）
  saveWeekendMode: (weekendMode, relayUids) =>
    setDoc(doc(db, 'artifacts', APP_ID, 'settings', 'reminders'), { weekendMode, relayUids: relayUids || [], relayUid: (relayUids || [])[0] || null, updatedAt: now() }, { merge: true }),

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
    await liffReady;
    if (!liff.isApiAvailable('shareTargetPicker')) throw new Error('この端末では共有できません');
    return liff.shareTargetPicker(messages);
  },

  // お知らせを送る（送り先を選ぶ画面）。リンクに印を付け、送れたら送った記録を残す（分析タブ用）。
  // build はリンクを受け取ってメッセージを返す。meta：eventId・targets（回答を数える対象の家族＝子どものID）・sid（決まった送信IDを使うとき）
  async share(kind, build, meta = {}) {
    const sid = meta.sid || newSid(kind);
    const r = await actions.shareTargetPicker([build(tagUrl(actions.liffUrl(), kind, sid))]);
    if (r) {
      const { sid: _sid, ...rest } = meta;
      setDoc(doc(db, 'artifacts', APP_ID, 'sends', sid), { kind, sid, ...rest, by: me?.displayName || '', byUid: me?.uid || '', via: 'share', at: now() }, { merge: true })
        .catch((e) => console.error('record send', e));
    }
    return r;
  },

  // 分析タブの元データ（管理者だけ読める）
  async loadAnalytics() {
    const [sends, opens] = await Promise.all([
      getDocs(collection(db, 'artifacts', APP_ID, 'sends')),
      getDocs(collection(db, 'artifacts', APP_ID, 'opens')),
    ]);
    return { sends: sends.docs.map((d) => ({ sid: d.id, ...d.data() })), opens: opens.docs.map((d) => d.data()) };
  },

  // 公式アカウントを友だち追加しているか（試合の個別リマインドは友だちにしか届かない）。分からなければ null
  async getFriendship() {
    try { await liffReady; return (await liff.getFriendship()).friendFlag; } catch { return null; }
  },
  addFriendUrl: () => (import.meta.env.VITE_OA_BASIC_ID ? `https://line.me/R/ti/p/${encodeURIComponent(import.meta.env.VITE_OA_BASIC_ID)}` : null),
  openUrl: async (url) => { await liffReady; liff.openWindow({ url }); },

  liffUrl: () => `https://liff.line.me/${import.meta.env.VITE_LIFF_ID}`,
  close: async () => { await liffReady; if (liff.isInClient()) liff.closeWindow(); else history.back(); },
};
