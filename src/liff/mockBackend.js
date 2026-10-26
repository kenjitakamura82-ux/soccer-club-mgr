// 開発用（npm run dev で /liff.html?mock を開いたときだけ読み込む）。本番データには一切触らない
const iso = (d) => d.toISOString().slice(0, 10);
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const untilWeekday = (w) => (w - new Date().getDay() + 7) % 7;
const sat = untilWeekday(6), sun = untilWeekday(0) || 7;

const state = {
  events: [
    { id: 'ev0', date: day(-2), type: '練習', title: '練習', startTime: '09:00', endTime: '11:00', location: '柏の葉小 第二グラウンド' },
    { id: 'ev1', date: day(sat), type: '練習', title: '練習', startTime: '09:00', endTime: '11:00', location: '柏の葉小 第二グラウンド', hasAttachments: true, memo: '出欠は調整さんでも受付中 https://chouseisan.com/s?h=example' },
    { id: 'ev2', date: day(sun), type: '試合', title: '練習試合（△△SC）', gatherTime: '08:30', startTime: '09:30', location: '〇〇市民運動場' },
    { id: 'ev3', date: day(sat + 7), type: '練習', title: '練習', startTime: '09:00', endTime: '11:00', location: '柏の葉小 第二グラウンド' },
    { id: 'ev4', date: day(sat + 8), type: '試合', title: '市リーグ 第5節', gatherTime: '08:40', location: '柏の葉公園 第2グラウンド', answerDeadline: day(sat + 6), selection: true },
  ],
  students: [
    { id: 's1', childName: '悠斗', kana: 'ゆうと', grade: '4年', jerseyNumber: '3' },
    { id: 's2', childName: '陽翔', kana: 'はると', grade: '4年', jerseyNumber: '4' },
    { id: 's3', childName: '颯真', kana: 'そうま', grade: '3年', jerseyNumber: '5' },
    { id: 's4', childName: '陸', kana: 'りく', grade: '4年', jerseyNumber: '6' },
    { id: 's5', childName: '葵', kana: 'あおい', grade: '2年', jerseyNumber: '' },
  ],
  attendances: [
    { id: 'ev1_s2', eventId: 'ev1', studentId: 's2', status: '参加' },
    { id: 'ev1_s3', eventId: 'ev1', studentId: 's3', status: '参加' },
    { id: 'ev2_s3', eventId: 'ev2', studentId: 's3', status: '参加' },
    { id: 'ev2_s4', eventId: 'ev2', studentId: 's4', status: '参加' },
    { id: 'ev2_s2', eventId: 'ev2', studentId: 's2', status: '参加' },
    { id: 'ev4_s2', eventId: 'ev4', studentId: 's2', status: '参加' },
    { id: 'ev4_s3', eventId: 'ev4', studentId: 's3', status: '参加' },
    { id: 'ev4_s4', eventId: 'ev4', studentId: 's4', status: '参加' },
  ],
  rides: [
    { id: 'ev2_s3', eventId: 'ev2', studentId: 's3', role: 'driver', capacity: 3, area: '柏の葉' },
    { id: 'ev2_s4', eventId: 'ev2', studentId: 's4', role: 'rider', count: 1, area: '柏の葉' },
    { id: 'ev2_s2', eventId: 'ev2', studentId: 's2', role: 'rider', count: 1, area: '柏たなか' },
  ],
  payments: [{ id: 'ev2', eventId: 'ev2', isActive: true, description: '試合の参加費', amount: 500 }],
  paymentStatuses: [{ id: 'ev2_s3', eventId: 'ev2', studentId: 's3', status: 'transferred', responderName: '颯真パパ' }],
  ridePlans: [],
  selections: [],
  bibTakes: [],
  practicePlans: [
    { id: 'ev0', eventId: 'ev0', date: day(-2), purpose: 'パスを正確につなぐ', total: 120, review: { text: 'パスは良かった。ミニゲームになると、受けたあと下を向いてしまう', by: '小林コーチ' }, blocks: [
      { id: 'b1', name: '集合・あいさつ', min: 5, note: '', fixed: true }, { id: 'b2', name: 'ウォームアップ', min: 15, note: 'ブラジル体操', fixed: false },
      { id: 'b3', name: 'パス＆コントロール', min: 25, note: '2人1組・インサイド', fixed: false }, { id: 'b4', name: '給水', min: 5, note: '', fixed: true },
      { id: 'b5', name: '2対1', min: 25, note: '数的有利を使う', fixed: false }, { id: 'b6', name: 'ミニゲーム', min: 35, note: '5人制', fixed: false },
      { id: 'b7', name: '振り返り・あいさつ', min: 10, note: '', fixed: true }] },
  ],
  playerNotes: [],
  bibAsks: [],
  bibsSettings: {},
  settings: {},
  onboardingSettings: {},
  jerseyNumbers: {},
  studentPhotos: [],
  members: [
    { id: 'u_parent', displayName: '保護者A', roles: [], studentId: null },
    { id: 'u_kawaguchi', displayName: '川口コーチ', roles: ['coach', 'ride'], studentId: 's2' },
    { id: 'u_yamato', displayName: '大和', roles: ['pay'], studentId: 's3' },
    { id: 'u_kobayashi', displayName: '小林コーチ', roles: ['coach', 'guide', 'select'], studentId: 's5' },
    { id: 'u_new', displayName: '新しい保護者', roles: [], studentId: null },
    { id: 'u_joining', displayName: '山田', roles: [], studentId: null, onboarding: { started: true, at: '2026-10-25T09:00:00Z', line: true } },
    { id: 'u_admin', displayName: '髙村', roles: ['admin'], studentId: 's4' },
  ],
};

const attachments = {};
// 分析タブの見本
const ago = (h) => new Date(Date.now() - h * 3600e3).toISOString();
const mockSends = [
  { kind: 'weekend', sid: 'weekend-a', via: 'bot', at: ago(50) },
  { kind: 'nudge', sid: 'nudge-a', eventId: 'ev2', targets: ['s1', 's4', 's5'], by: '川口コーチ', via: 'share', at: ago(200) },
  { kind: 'pay', sid: 'pay-a', eventId: 'ev2', targets: ['s2', 's3', 's4'], by: '大和', via: 'share', at: ago(30) },
];
const mockOpens = [
  { uid: 'u_kawaguchi', src: 'weekend', sid: 'weekend-a', at: ago(49) }, { uid: 'u_yamato', src: 'weekend', sid: 'weekend-a', at: ago(48) },
  { uid: 'u_admin', src: 'weekend', sid: 'weekend-a', at: ago(45) }, { uid: 'u_admin', src: 'nudge', sid: 'nudge-a', at: ago(190) },
  { uid: 'u_yamato', src: 'pay', sid: 'pay-a', at: ago(29) },
];
const listeners = new Set();
let meId = 'u_parent';
const emit = () => {
  const me = state.members.find((m) => m.id === meId);
  const snapshot = { ...structuredClone(state), me: { uid: meId, ...me } };
  snapshot.playerNotes = snapshot.playerNotes.filter((n) => n.uid === meId);
  listeners.forEach((fn) => fn(snapshot));
};
const upsert = (col, id, data, merge = true) => {
  const list = state[col];
  const i = list.findIndex((x) => x.id === id);
  if (i >= 0) list[i] = merge ? { ...list[i], ...data } : { id, ...data };
  else list.push({ id, ...data });
  setTimeout(emit, 150);
};

export async function connect() {
  meId = new URLSearchParams(location.search).get('as') || 'u_parent';
  await new Promise((r) => setTimeout(r, 600));
  const m = state.members.find((x) => x.id === meId);
  return { uid: meId, ...m };
}

export function subscribe(fn) {
  listeners.add(fn);
  setTimeout(emit, 500);
  return () => listeners.delete(fn);
}

export const actions = {
  saveAttendance: async (eventId, studentId, status) => upsert('attendances', `${eventId}_${studentId}`, { eventId, studentId, status, updatedAt: new Date().toISOString() }),
  saveEvent: async (event) => { const id = event.id || `ev_${Math.random().toString(36).slice(2, 8)}`; upsert('events', id, { ...event, id }); return id; },
  // 見本：本物のAIは呼ばず、それらしい結果を返す
  parseEvents: async (text) => {
    await new Promise((r) => setTimeout(r, 900));
    const m = text.match(/(\d{1,2})\/(\d{1,2})/);
    const date = m ? `${new Date().getFullYear()}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : day(10);
    const list = [{ date, type: /試合|大会|カップ|TM/.test(text) ? '試合' : '練習', title: /試合|大会|カップ/.test(text) ? '練習試合' : '練習', startTime: '08:30', endTime: '11:00', location: '柏の葉小 第二グラウンド', memo: /水筒/.test(text) ? '水筒を多めに' : '' }];
    if (/両日|土日/.test(text)) list.push({ ...list[0], date: day(sun + 7), title: '練習' });
    return list;
  },
  saveDeadline: async (eventId, answerDeadline) => upsert('events', eventId, { answerDeadline }),
  saveRide: async (eventId, studentId, ride) => upsert('rides', `${eventId}_${studentId}`, { eventId, studentId, ...ride, updatedAt: new Date().toISOString() }, false),
  async registerKid({ childName, kana, grade, jerseyNumber, photo }, { link = true } = {}) {
    const id = `stu_${Math.random().toString(36).slice(2, 8)}`;
    upsert('students', id, { childName, kana, grade, jerseyNumber: jerseyNumber || '' });
    if (photo) upsert('studentPhotos', id, { dataUrl: photo });
    if (link) await actions.linkKid(id);
    return id;
  },
  linkKid: async (studentId) => upsert('members', meId, { studentId }),
  saveOnboarding: async (patch) => { const m = state.members.find((x) => x.id === meId); upsert('members', meId, { onboarding: { ...(m.onboarding || {}), ...patch } }); },
  resetOnboarding: async (uid, studentId) => {
    const m = state.members.find((x) => x.id === uid); delete m.onboarding; upsert('members', uid, {});
    if (studentId) { state.paymentStatuses = state.paymentStatuses.filter((x) => !(x.eventId === `join-${studentId}` && !x.isConfirmed)); upsert('payments', `join-${studentId}`, { isActive: false }); }
  },
  takeBib: async (eventId, colorId, studentId) => upsert('bibTakes', `${eventId}_${colorId}_${studentId}`, { eventId, colorId, studentId, uid: meId, at: new Date().toISOString() }),
  untakeBib: async (eventId, colorId, studentId) => { state.bibTakes = state.bibTakes.filter((x) => x.id !== `${eventId}_${colorId}_${studentId}`); setTimeout(emit, 150); },
  markBibsAsked: async (eventId) => upsert('bibAsks', eventId, { eventId, by: state.members.find((m) => m.id === meId)?.displayName, at: new Date().toISOString() }),
  saveBibsSettings: async (fields) => { state.bibsSettings = { ...state.bibsSettings, ...fields }; setTimeout(emit, 150); },
  saveOnboardingSettings: async (fields) => { state.onboardingSettings = { ...state.onboardingSettings, ...fields }; setTimeout(emit, 150); },
  claimJersey: async (studentId, n) => {
    const holder = state.jerseyNumbers[n];
    if (holder && holder !== studentId && String(state.students.find((s) => s.id === holder)?.jerseyNumber) === String(n)) throw new Error('ほかの子が先に選びました');
    if (state.students.some((s) => s.id !== studentId && String(s.jerseyNumber) === String(n))) throw new Error('ほかの子が使っています');
    state.jerseyNumbers[n] = studentId;
    upsert('students', studentId, { jerseyNumber: String(n) });
  },
  saveJoinPayment: async (studentId, { title, items, amount, baseAmount }) => upsert('payments', `join-${studentId}`, { kind: 'custom', join: true, title, items, amount, baseAmount, targets: [studentId], isActive: true }),
  savePlan: async (e, { purpose, total, blocks, review, groups = [] }) => upsert('practicePlans', e.id, { eventId: e.id, date: e.date, purpose, total, blocks, groups, review: review ? { text: review, by: 'me' } : null }),
  addNote: async (n) => upsert('playerNotes', `n${Date.now()}`, { ...n, uid: meId, at: new Date().toISOString() }),
  deleteNote: async (id) => { state.playerNotes = state.playerNotes.filter((n) => n.id !== id); setTimeout(emit, 100); },
  withdrawKid: async (s) => upsert('students', s.id, { withdrawnAt: new Date().toISOString(), jerseyBeforeWithdraw: s.jerseyNumber || '', jerseyNumber: '' }),
  restoreKid: async (s, jerseyNumber) => { const { withdrawnAt: _w, jerseyBeforeWithdraw: _j, ...rest } = state.students.find((x) => x.id === s.id); upsert('students', s.id, { ...rest, jerseyNumber }, false); },
  async saveKid(studentId, { childName, jerseyNumber, photo }) {
    upsert('students', studentId, { jerseyNumber: jerseyNumber || '', ...(childName ? { childName } : {}) });
    if (photo) upsert('studentPhotos', studentId, { dataUrl: photo });
  },
  savePayment: async (eventId, { description, amount, isActive, baseAmount = null }) => upsert('payments', eventId, { eventId, description, amount: amount ? Number(amount) : null, baseAmount, isActive }),
  // 見本：Stripe には行かず、少しして確認済みになる
  startCardPay: async (eventId) => { const sid = state.members.find((m) => m.id === meId)?.studentId; setTimeout(() => upsert('paymentStatuses', `${eventId}_${sid}`, { eventId, studentId: sid, status: 'transferred', method: 'card', isConfirmed: true, confirmedBy: 'カード決済', stripeSessionId: 'cs_test_mock' }), 800); },
  saveCustomPayment: async (id, fields) => { const pid = id || `custom-${Math.random().toString(36).slice(2, 8)}`; upsert('payments', pid, { ...fields, kind: 'custom', ...(id ? {} : { createdAt: new Date().toISOString() }) }); return pid; },
  refundCardPay: async (psId) => { await new Promise((r) => setTimeout(r, 500)); upsert('paymentStatuses', psId, { status: 'refunded', isConfirmed: false, refundedAt: new Date().toISOString() }); return { ok: true }; },
  reportTransfer: async (eventId, studentId) => upsert('paymentStatuses', `${eventId}_${studentId}`, { eventId, studentId, status: 'transferred' }),
  confirmTransfer: async (psId, by) => upsert('paymentStatuses', psId, { isConfirmed: true, confirmedBy: by }),
  saveSelection: async (eventId, studentIds, by) => upsert('selections', eventId, { eventId, studentIds, confirmedBy: by, confirmedAt: new Date().toISOString() }, false),
  saveRidePlan: async (eventId, cars, by) => upsert('ridePlans', eventId, { eventId, cars, confirmedBy: by, confirmedAt: new Date().toISOString() }, false),
  saveReminderDay: async (weekendDay) => { state.settings = { ...state.settings, weekendDay }; setTimeout(emit, 150); },
  saveWeekendMode: async (weekendMode, relayUids) => { state.settings = { ...state.settings, weekendMode, relayUids, relayUid: relayUids?.[0] || null }; setTimeout(emit, 150); },
  setRoles: async (uid, roles) => upsert('members', uid, { roles }),
  // 本番と同じく少し遅れて届く（見本の画像）
  loadVenue: async () => { await new Promise((r) => setTimeout(r, 700)); const svg = (t) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240"><rect width="400" height="240" fill="#e0f2fe"/><text x="200" y="130" font-size="26" text-anchor="middle" fill="#075985">${t}</text></svg>`); return { map: svg('地図（見本）'), gateNo: svg('通用門（見本）'), gateYes: svg('入口（見本）') }; },
  deleteEvent: async (eventId) => { state.events = state.events.filter((e) => e.id !== eventId); delete attachments[eventId]; setTimeout(emit, 150); },
  addAttachment: async (eventId, a) => { (attachments[eventId] ||= []).push({ id: `a_${Math.random().toString(36).slice(2, 8)}`, ...a }); },
  removeAttachment: async (eventId, attId) => { attachments[eventId] = (attachments[eventId] || []).filter((a) => a.id !== attId); },
  loadAttachments: async (eventId) => attachments[eventId] || (eventId === 'ev1' ? [{ id: 'a1', name: '練習メニュー.png', url: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="260"><rect width="400" height="260" fill="%23d1fae5"/><text x="200" y="140" font-size="28" text-anchor="middle" fill="%23065f46">練習メニュー（見本）</text></svg>').replace(/%2523/g, '%23') }, { id: 'a2', name: '大会要項.pdf', url: 'data:application/pdf;base64,JVBERi0=' }] : []),
  shareTargetPicker: async (messages) => { console.log('shareTargetPicker', messages); return { status: 'success' }; },
  share: async (kind, build, meta = {}) => {
    const sid = meta.sid || `${kind}-${Date.now().toString(36)}`;
    console.log('shareTargetPicker', [build(`https://liff.line.me/xxxx?src=${kind}&sid=${sid}`)]);
    const { sid: _sid, ...rest } = meta;
    mockSends.push({ kind, sid, ...rest, by: state.members.find((m) => m.id === meId)?.displayName, via: 'share', at: new Date().toISOString() });
    return { status: 'success' };
  },
  loadAnalytics: async () => { await new Promise((r) => setTimeout(r, 400)); return { sends: structuredClone(mockSends), opens: structuredClone(mockOpens) }; },
  getFriendship: async () => false,
  addFriendUrl: () => 'https://line.me/R/ti/p/%40example',
  openUrl: (url) => console.log('openUrl', url),
  liffUrl: () => 'https://liff.line.me/xxxx',
  close: () => {},
};
