// 開発用（npm run dev で /liff.html?mock を開いたときだけ読み込む）。本番データには一切触らない
const iso = (d) => d.toISOString().slice(0, 10);
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const untilWeekday = (w) => (w - new Date().getDay() + 7) % 7;
const sat = untilWeekday(6), sun = untilWeekday(0) || 7;

const state = {
  events: [
    { id: 'ev1', date: day(sat), type: '練習', title: '練習', startTime: '09:00', endTime: '11:00', location: '柏の葉小 第二グラウンド' },
    { id: 'ev2', date: day(sun), type: '試合', title: '練習試合（△△SC）', gatherTime: '08:30', startTime: '09:30', location: '〇〇市民運動場' },
    { id: 'ev3', date: day(sat + 7), type: '練習', title: '練習', startTime: '09:00', endTime: '11:00', location: '柏の葉小 第二グラウンド' },
    { id: 'ev4', date: day(sat + 8), type: '試合', title: '市リーグ 第5節', gatherTime: '08:40', location: '柏の葉公園 第2グラウンド', answerDeadline: day(sat + 6) },
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
  ],
  rides: [
    { id: 'ev2_s3', eventId: 'ev2', studentId: 's3', role: 'driver', capacity: 3, area: '柏の葉' },
    { id: 'ev2_s4', eventId: 'ev2', studentId: 's4', role: 'rider', count: 1, area: '柏の葉' },
    { id: 'ev2_s2', eventId: 'ev2', studentId: 's2', role: 'rider', count: 1, area: '柏たなか' },
  ],
  payments: [{ id: 'ev2', eventId: 'ev2', isActive: true, description: '試合の参加費', amount: 500 }],
  paymentStatuses: [{ id: 'ev2_s3', eventId: 'ev2', studentId: 's3', status: 'transferred', responderName: '颯真パパ' }],
  ridePlans: [],
  studentPhotos: [],
  members: [
    { id: 'u_parent', displayName: '保護者A', roles: [], studentId: null },
    { id: 'u_kawaguchi', displayName: '川口コーチ', roles: ['ride'], studentId: 's2' },
    { id: 'u_yamato', displayName: '大和', roles: ['pay'], studentId: 's3' },
    { id: 'u_kobayashi', displayName: '小林コーチ', roles: ['guide'], studentId: 's5' },
    { id: 'u_admin', displayName: '髙村', roles: ['admin'], studentId: 's4' },
  ],
};

const listeners = new Set();
let meId = 'u_parent';
const emit = () => {
  const me = state.members.find((m) => m.id === meId);
  const snapshot = { ...structuredClone(state), me: { uid: meId, ...me } };
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
    const list = [{ date, type: /試合|大会|カップ|TM/.test(text) ? '試合' : '練習', title: /試合|大会|カップ/.test(text) ? '練習試合' : '練習', gatherTime: '08:30', startTime: '09:00', endTime: '11:00', location: '柏の葉小 第二グラウンド', memo: /水筒/.test(text) ? '水筒を多めに' : '' }];
    if (/両日|土日/.test(text)) list.push({ ...list[0], date: day(sun + 7), title: '練習' });
    return list;
  },
  saveDeadline: async (eventId, answerDeadline) => upsert('events', eventId, { answerDeadline }),
  saveRide: async (eventId, studentId, ride) => upsert('rides', `${eventId}_${studentId}`, { eventId, studentId, ...ride, updatedAt: new Date().toISOString() }, false),
  async registerKid({ childName, kana, grade, jerseyNumber, photo }) {
    const id = `stu_${Math.random().toString(36).slice(2, 8)}`;
    upsert('students', id, { childName, kana, grade, jerseyNumber: jerseyNumber || '' });
    if (photo) upsert('studentPhotos', id, { dataUrl: photo });
    await actions.linkKid(id);
    return id;
  },
  linkKid: async (studentId) => upsert('members', meId, { studentId }),
  async saveKid(studentId, { childName, jerseyNumber, photo }) {
    upsert('students', studentId, { jerseyNumber: jerseyNumber || '', ...(childName ? { childName } : {}) });
    if (photo) upsert('studentPhotos', studentId, { dataUrl: photo });
  },
  reportTransfer: async (eventId, studentId) => upsert('paymentStatuses', `${eventId}_${studentId}`, { eventId, studentId, status: 'transferred' }),
  confirmTransfer: async (psId, by) => upsert('paymentStatuses', psId, { isConfirmed: true, confirmedBy: by }),
  saveRidePlan: async (eventId, cars, by) => upsert('ridePlans', eventId, { eventId, cars, confirmedBy: by, confirmedAt: new Date().toISOString() }, false),
  setRoles: async (uid, roles) => upsert('members', uid, { roles }),
  loadVenue: async () => null,
  shareTargetPicker: async (messages) => { console.log('shareTargetPicker', messages); return { status: 'success' }; },
  getFriendship: async () => false,
  addFriendUrl: () => 'https://line.me/R/ti/p/%40example',
  openUrl: (url) => console.log('openUrl', url),
  liffUrl: () => 'https://liff.line.me/xxxx',
  close: () => {},
};
