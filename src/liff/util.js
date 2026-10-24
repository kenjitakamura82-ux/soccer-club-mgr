const WD = ['日', '月', '火', '水', '木', '金', '土'];

export const todayJst = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

export const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const md = (s) => { const d = parseDate(s); return { m: d.getMonth() + 1, d: d.getDate(), w: WD[d.getDay()] }; };
export const dateLabel = (s) => { const x = md(s); return `${x.m}/${x.d}(${x.w})`; };

export const isCanceled = (e) => e.title?.includes('中止') || e.title?.includes('休み');
// 時刻は「開始（集合）〜終了（解散）」の2つで見せる（2026-10-24 ユーザー決定）。
// 既存アプリや line-schedule-bot が入れた集合時刻（gatherTime）があれば、それを開始として扱う
export const startOf = (e) => e.gatherTime || e.startTime || '';
export const timeLabel = (e) => { const s = startOf(e), t = e.endTime || ''; return s ? `${s}〜${t}` : t ? `〜${t}` : ''; };
// 配車（希望の入力・配車まとめ）が要るのは試合だけ。練習・その他は車出しがない（2026-10-25 ユーザー決定）
export const needsRide = (e) => e.type === '試合' && !isCanceled(e);
// 選抜（2026-10-25 ユーザー決定）。予定に selection: true が付いた試合は、選抜担当が選んだ子（selections/{予定のID} の studentIds）だけが出て、配車もその子たちだけで組む
export const selectionOf = (data, eventId) => (data.selections || []).find((s) => s.id === eventId) || null;
// 配車の対象になる子か。選抜ありなら、確定して選ばれた子だけ
export const inRide = (e, data, sid) => !e.selection || !!selectionOf(data, e.id)?.studentIds?.includes(sid);
export const isKashiwanohaEs = (e) => /柏の葉小/.test(e.location || '') || /柏の葉小/.test(e.title || '');

export const upcomingEvents = (events = [], days = 42) => {
  const t = todayJst();
  // 日本時間の日付どうしで足す（toISOString は世界時に直すので1日前になり、最後の日の予定が漏れていた）
  const limit = addDays(t, days);
  return events.filter((e) => e.date && (e.endDate || e.date) >= t && e.date <= limit).sort((a, b) => a.date.localeCompare(b.date));
};

// 出欠の締切。予定に answerDeadline（YYYY-MM-DD）があればそれ、なければ練習は3日前・試合は2週間前（その日の終わりまで）
export const DEFAULT_DEADLINE_DAYS = { 試合: 14, default: 3 };
export const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const defaultDeadline = (e) => addDays(e.date, -(DEFAULT_DEADLINE_DAYS[e.type] ?? DEFAULT_DEADLINE_DAYS.default));
export const deadlineOf = (e) => e.answerDeadline || defaultDeadline(e);
export const isClosed = (e) => todayJst() > deadlineOf(e);

// 一覧の区切り：今週の日曜までは「今週末」、その次の日曜までは「来週」、その先は「11月」のように月ごと
export const groupLabel = (s) => {
  const t = todayJst();
  const thisSun = addDays(t, (7 - parseDate(t).getDay()) % 7);
  if (s <= thisSun) return '今週末';
  if (s <= addDays(thisSun, 7)) return '来週';
  return `${parseDate(s).getMonth() + 1}月`;
};

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

// 予定の添付。既存アプリ（src/App.jsx の compressImage）と同じく、画像は約800KB以下のJPEGに縮める。
// 画像以外はそのまま data URL にする（Firestoreの1件1MB制限があるので、大きいファイルは断る）
export const ATTACH_MAX_FILE = 700 * 1024;
export const compressAttachment = (file) => new Promise((resolve, reject) => {
  const img = new Image();
  const objectUrl = URL.createObjectURL(file);
  img.onload = () => {
    URL.revokeObjectURL(objectUrl);
    for (const maxW of [1200, 800, 500, 300]) {
      let w = img.width, h = img.height;
      if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      for (let q = 0.8; q >= 0.1; q = Math.round((q - 0.1) * 10) / 10) {
        const url = c.toDataURL('image/jpeg', q);
        if (url.length <= 800000) return resolve(url);
      }
    }
    reject(new Error('画像が大きすぎます'));
  };
  img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('画像を読み込めませんでした')); };
  img.src = objectUrl;
});
export const readAsDataUrl = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = reject;
  r.readAsDataURL(file);
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

// グループのアナウンスに固定する「入口カード」。どこを押してもアプリが開く。
// アナウンスの帯には altText が出るので、そこだけ読んでも分かる文にする
// day は週末リマインドを送る曜日（「金」など）。今はスケジュールの確認だけに使ってもらう前提の文面
export function entryFlex(liffUrl, day = '金') {
  const tap = { action: { type: 'uri', label: '開く', uri: liffUrl } };
  return {
    type: 'flex',
    altText: 'まちサカの予定はこちら',
    contents: {
      type: 'bubble',
      header: { type: 'box', layout: 'vertical', backgroundColor: '#059669', paddingAll: '18px', ...tap, contents: [
        { type: 'text', text: 'まちさかマネージャー', size: 'xs', color: '#d1fae5', weight: 'bold' },
        { type: 'text', text: 'まちサカの予定はこちら', size: 'lg', color: '#ffffff', weight: 'bold', wrap: true },
      ] },
      body: { type: 'box', layout: 'vertical', spacing: 'sm', ...tap, contents: [
        { type: 'text', text: 'いつものスケジュールを、LINEの中で確認できます。', size: 'sm', color: '#555555', wrap: true },
        { type: 'text', text: `毎週${day}曜の朝には、このグループに招待した「まちさかマネージャー」が今週末の予定をお知らせします。`, size: 'sm', color: '#555555', wrap: true },
        { type: 'text', text: '初めて開くときだけ、LINEの「許可する」と、名簿からお子さんを選ぶ画面が出ます。', size: 'xs', color: '#888888', wrap: true, margin: 'md' },
      ] },
      footer: { type: 'box', layout: 'vertical', contents: [
        { type: 'button', style: 'primary', color: '#059669', height: 'md', action: { type: 'uri', label: '開く', uri: liffUrl } },
      ] },
    },
  };
}

// 集金のお知らせ。会計の人が「人を選んで送る」で全体LINEに送る（本人が送る形なので公式アカウントの通数は使わない見込み）
export function payFlex(event, payment, liffUrl) {
  const yen = payment.amount ? `¥${Number(payment.amount).toLocaleString()}` : '';
  const tap = { action: { type: 'uri', label: '開く', uri: liffUrl } };
  return {
    type: 'flex',
    altText: `集金のお知らせ：${dateLabel(event.date)} ${event.title}${yen ? ` ${yen}` : ''}`,
    contents: {
      type: 'bubble',
      body: { type: 'box', layout: 'vertical', spacing: 'sm', ...tap, contents: [
        { type: 'text', text: '集金のお知らせ', size: 'xs', color: '#059669', weight: 'bold' },
        { type: 'text', text: `${dateLabel(event.date)} ${event.title}`, weight: 'bold', size: 'md', wrap: true },
        { type: 'text', text: payment.description || '集金', size: 'sm', color: '#555555', wrap: true },
        ...(yen ? [{ type: 'text', text: yen, size: 'xxl', weight: 'bold', margin: 'md' }] : []),
        { type: 'text', text: 'ことら送金をしたら、アプリの「集金」で「ことら送金した」を押してください。', size: 'xs', color: '#888888', wrap: true, margin: 'md' },
      ] },
      footer: { type: 'box', layout: 'vertical', contents: [
        { type: 'button', style: 'primary', color: '#059669', height: 'sm', action: { type: 'uri', label: 'アプリで確認する', uri: liffUrl } },
      ] },
    },
  };
}

// 今週末（次の土日）の日付。line-schedule-bot の api/weekend-reminder.js の weekendDates と同じ
export const weekendDates = () => {
  const t = todayJst();
  const sat = addDays(t, (6 - parseDate(t).getDay() + 7) % 7);
  return [sat, addDays(sat, 1)];
};

// 週末リマインドのカード。line-schedule-bot の api/weekend-reminder.js の buildFlex と同じ見た目（どちらかを変えたらもう片方も直す）。
// 担当の人に頼む送り方のときは、担当の人がこのカードを「人を選んで送る」で全体LINEに送る
export function weekendFlex(events, liffUrl) {
  const active = events.filter((e) => !isCanceled(e));
  const tap = { action: { type: 'uri', label: '予定を見る', uri: liffUrl } };
  const rows = events.map((e) => {
    const cx = isCanceled(e);
    const d = md(e.date);
    return {
      type: 'box', layout: 'horizontal', spacing: 'md',
      contents: [
        { type: 'box', layout: 'vertical', width: '52px', flex: 0, contents: [
          { type: 'text', text: `${d.m}/${d.d}`, weight: 'bold', size: 'sm', color: cx ? '#999999' : '#111111' },
          { type: 'text', text: d.w, size: 'xxs', color: '#777777' },
        ] },
        { type: 'box', layout: 'vertical', flex: 1, contents: cx
          ? [{ type: 'text', text: `${e.title.replace(/【?(中止|休み)】?/g, '').trim() || '予定'} 中止`, size: 'sm', color: '#999999', decoration: 'line-through', wrap: true }]
          : [
              { type: 'text', text: [e.title || '予定', timeLabel(e)].filter(Boolean).join(' '), weight: 'bold', size: 'sm', wrap: true },
              ...(e.location ? [{ type: 'text', text: e.location, size: 'xs', color: '#555555', wrap: true }] : []),
            ] },
      ],
    };
  });
  const headline = active.length ? `今週末は${active.length}つの予定です` : '今週末の予定はすべて中止です';
  return {
    type: 'flex',
    altText: `${headline}（${events.map((e) => `${dateLabel(e.date)} ${e.title}`).join('、')}）`,
    contents: {
      type: 'bubble',
      header: { type: 'box', layout: 'vertical', backgroundColor: '#059669', paddingAll: '16px', ...tap, contents: [
        { type: 'text', text: 'おはようございます', size: 'xs', color: '#d1fae5' },
        { type: 'text', text: headline, weight: 'bold', size: 'lg', color: '#ffffff', wrap: true },
      ] },
      body: { type: 'box', layout: 'vertical', spacing: 'md', ...tap, contents: rows },
      footer: { type: 'box', layout: 'vertical', paddingTop: '0px', ...tap, contents: [{ type: 'text', text: 'タップして予定を見る', size: 'xs', color: '#059669', align: 'center', weight: 'bold' }] },
    },
  };
}

// 選抜メンバーのお知らせ。選抜担当が「人を選んで送る」で全体LINEに送る。選ばれた子の家族に配車の希望を入れてもらう
export function selectionFlex(event, names, liffUrl) {
  return {
    type: 'flex',
    altText: `選抜メンバーのお知らせ：${dateLabel(event.date)} ${event.title}`,
    contents: {
      type: 'bubble',
      body: { type: 'box', layout: 'vertical', spacing: 'sm', action: { type: 'uri', label: '開く', uri: liffUrl }, contents: [
        { type: 'text', text: '選抜メンバーのお知らせ', size: 'xs', color: '#059669', weight: 'bold' },
        { type: 'text', text: `${dateLabel(event.date)} ${event.title}`, weight: 'bold', size: 'md', wrap: true },
        { type: 'separator', margin: 'md' },
        { type: 'text', text: `${names.length}人：${names.join('、')}`, size: 'sm', wrap: true, margin: 'md' },
        { type: 'text', text: '上記の子のご家族は、アプリで配車の希望を入れてください。', size: 'xs', color: '#888888', wrap: true, margin: 'md' },
      ] },
      footer: { type: 'box', layout: 'vertical', contents: [
        { type: 'button', style: 'primary', color: '#059669', height: 'sm', action: { type: 'uri', label: '配車の希望を入れる', uri: liffUrl } },
      ] },
    },
  };
}

// 出欠・配車の希望がまだの家族への催促。配車担当が「人を選んで送る」で送る（公式アカウントからの個別リマインドの代わり。2026-10-25 ユーザー決定）。
// 締切前に名前が出ると気まずいので、まだの子の名前は載せない（2026-10-25 ユーザー決定）。what は 'attendance'（出欠もまだの人がいる）か 'ride'（配車の希望だけ）
export function nudgeFlex(event, what, liffUrl) {
  const ask = what === 'ride' ? '配車の希望' : '出欠と配車の希望';
  const tap = { action: { type: 'uri', label: '開く', uri: liffUrl } };
  return {
    type: 'flex',
    altText: `${ask}のお願い：${dateLabel(event.date)} ${event.title}`,
    contents: {
      type: 'bubble',
      header: { type: 'box', layout: 'vertical', backgroundColor: '#059669', paddingAll: '16px', ...tap, contents: [
        { type: 'text', text: `${ask}のお願い`, size: 'xs', color: '#d1fae5', weight: 'bold' },
        { type: 'text', text: `${dateLabel(event.date)} ${event.title}`, weight: 'bold', size: 'lg', color: '#ffffff', wrap: true },
      ] },
      body: { type: 'box', layout: 'vertical', spacing: 'md', ...tap, contents: [
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: '締切', size: 'sm', color: '#777777', flex: 0 },
          { type: 'text', text: dateLabel(deadlineOf(event)), size: 'sm', weight: 'bold', margin: 'md' },
        ] },
        { type: 'text', text: `まだの方は、締切までにアプリで${ask}を入れてください。`, size: 'sm', color: '#333333', wrap: true },
        { type: 'text', text: 'もう入れた方は、このお知らせは気にしないでください。', size: 'xs', color: '#888888', wrap: true },
      ] },
      footer: { type: 'box', layout: 'vertical', contents: [
        { type: 'button', style: 'primary', color: '#059669', height: 'sm', action: { type: 'uri', label: 'アプリで入れる', uri: liffUrl } },
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
