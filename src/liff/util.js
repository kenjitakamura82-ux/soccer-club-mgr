const WD = ['日', '月', '火', '水', '木', '金', '土'];

export const todayJst = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

export const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const md = (s) => { const d = parseDate(s); return { m: d.getMonth() + 1, d: d.getDate(), w: WD[d.getDay()] }; };
export const dateLabel = (s) => { const x = md(s); return `${x.m}/${x.d}(${x.w})`; };

export const isCanceled = (e) => e.title?.includes('中止') || e.title?.includes('休み');
export const timeLabel = (e) => [e.gatherTime && `${e.gatherTime}集合`, e.startTime && (e.endTime ? `${e.startTime}〜${e.endTime}` : `${e.startTime}開始`)].filter(Boolean).join(' ・ ');
export const isKashiwanohaEs = (e) => /柏の葉小/.test(e.location || '') || /柏の葉小/.test(e.title || '');

export const upcomingEvents = (events = [], days = 42) => {
  const t = todayJst();
  const limit = new Date(parseDate(t).getTime() + days * 86400000).toISOString().slice(0, 10);
  return events.filter((e) => e.date && (e.endDate || e.date) >= t && e.date <= limit).sort((a, b) => a.date.localeCompare(b.date));
};

// 出欠の締切。予定に answerDeadline（YYYY-MM-DD）があればそれ、なければ練習は3日前・試合は2週間前（その日の終わりまで）
export const DEFAULT_DEADLINE_DAYS = { 試合: 14, default: 3 };
export const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const defaultDeadline = (e) => addDays(e.date, -(DEFAULT_DEADLINE_DAYS[e.type] ?? DEFAULT_DEADLINE_DAYS.default));
export const deadlineOf = (e) => e.answerDeadline || defaultDeadline(e);
export const isClosed = (e) => todayJst() > deadlineOf(e);

// 締切を変えられるのは役割を持つコーチ（配車担当・案内係）と管理者
export const canEditDeadline = (has) => has('ride') || has('guide') || has('admin');

export const jersey = (s) => (s?.jerseyNumber ? Number(s.jerseyNumber) : 999);
export const kidName = (s) => s?.childName || '不明';

// 既存アプリの TabMatching と同じ割り振り（同じエリア優先 → 空いている車）
export function matchRides(event, rides, attendances) {
  const attending = new Set(attendances.filter((a) => a.eventId === event.id && a.status === '参加').map((a) => a.studentId));
  const list = rides.filter((r) => r.eventId === event.id && attending.has(r.studentId));
  const drivers = list.filter((r) => r.role === 'driver').map((d) => ({ driver: d.studentId, area: d.area, capacity: d.capacity || 0, remain: d.capacity || 0, passengers: [] }));
  const riders = list.filter((r) => r.role === 'rider').map((r) => ({ studentId: r.studentId, area: r.area, count: r.count || 1, matched: false }));
  for (const pass of [true, false]) {
    for (const r of riders) {
      if (r.matched) continue;
      const d = drivers.find((x) => (!pass || x.area === r.area) && x.remain >= r.count);
      if (d) { d.passengers.push(r.studentId); d.remain -= r.count; r.matched = true; }
    }
  }
  return { cars: drivers.map(({ driver, area, capacity, passengers }) => ({ driver, area, capacity, passengers })), unmatched: riders.filter((r) => !r.matched).map((r) => r.studentId), riders };
}

// 顔写真は小さくしてから保存する（Firestoreの1件1MB制限があるため）
export const compressPhoto = (file, size = 360) => new Promise((resolve, reject) => {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    URL.revokeObjectURL(url);
    const s = Math.min(img.width, img.height);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
    resolve(c.toDataURL('image/jpeg', 0.8));
  };
  img.onerror = reject;
  img.src = url;
});

export function ridePlanFlex(event, plan, students, liffUrl) {
  const name = (id) => kidName(students[id]);
  const cars = plan.cars.filter((c) => c.passengers.length);
  return {
    type: 'flex',
    altText: `配車表 ${dateLabel(event.date)} ${event.title}`,
    contents: {
      type: 'bubble',
      body: {
        type: 'box', layout: 'vertical', spacing: 'md',
        contents: [
          { type: 'text', text: '配車表', size: 'xs', color: '#059669', weight: 'bold' },
          { type: 'text', text: `${dateLabel(event.date)} ${event.title}`, weight: 'bold', size: 'md', wrap: true },
          { type: 'separator' },
          ...(cars.length ? cars : [{ driver: null }]).map((c, i) => c.driver
            ? { type: 'box', layout: 'vertical', contents: [
                { type: 'text', text: `${i + 1}号車 ${name(c.driver)}家（${c.area || ''}）`, size: 'sm', weight: 'bold', wrap: true },
                { type: 'text', text: c.passengers.map(name).join('、'), size: 'sm', color: '#555555', wrap: true },
              ] }
            : { type: 'text', text: '同乗の割り振りはありません', size: 'sm', color: '#888888' }),
        ],
      },
      footer: { type: 'box', layout: 'vertical', contents: [
        { type: 'button', style: 'primary', color: '#059669', height: 'sm', action: { type: 'uri', label: '自分の配車を見る', uri: liffUrl } },
      ] },
    },
  };
}

export function inviteFlex(liffUrl) {
  return {
    type: 'flex',
    altText: 'まちサカへようこそ',
    contents: {
      type: 'bubble',
      body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: [
        { type: 'text', text: 'まちサカ', size: 'xs', color: '#059669', weight: 'bold' },
        { type: 'text', text: '新しく入ったご家族へ', weight: 'bold', size: 'lg' },
        { type: 'text', text: 'ようこそ！下のボタンから、お子さんの登録と出欠の回答ができます。持ち物や練習場の使い方も載っています。', size: 'sm', color: '#555555', wrap: true },
      ] },
      footer: { type: 'box', layout: 'vertical', contents: [
        { type: 'button', style: 'primary', color: '#059669', action: { type: 'uri', label: '登録してはじめる', uri: liffUrl } },
      ] },
    },
  };
}
