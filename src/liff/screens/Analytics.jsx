import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { BarChart3, RotateCw } from 'lucide-react';
import { Press, listVariants, itemVariants } from '../ui.jsx';
import { dateLabel } from '../util.js';

// 分析（管理者だけ）。お知らせごとに「何家族が開いたか」と「対象の家族がどれだけ回答したか」を出す（2026-10-25 ユーザー決定）。
// LINEは届いた人数・既読を教えてくれないので、到達率の代わりに「開いた家族の割合」を見る。
// 記録の元：sends（送った記録。カードのリンクに sid を付けて送る）、opens（そのリンクから開いた人）、
// 回答は attendances / rides / paymentStatuses の更新時刻と突き合わせる

export const KINDS = {
  weekend: '週末リマインド',
  nudge: '回答のお願い',
  selection: '選抜メンバー',
  pay: '集金のお知らせ',
  rideplan: '配車表',
  entry: '入口カード',
  invite: '新しく入った人への案内',
};
// 対象の家族がいるお知らせと、何をしたら「回答した」とみなすか
const GOAL = { nudge: '出欠か配車の希望', selection: '配車の希望', pay: '支払い' };

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const median = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const hours = (ms) => (ms < 3600e3 ? `${Math.max(1, Math.round(ms / 60e3))}分` : `${(ms / 3600e3).toFixed(1)}時間`);
const sentLabel = (iso) => { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

export default function Analytics({ ctx }) {
  const { data, actions } = ctx;
  const [log, setLog] = useState(null);
  const [err, setErr] = useState('');
  const [tries, setTries] = useState(0);
  useEffect(() => {
    let alive = true;
    actions.loadAnalytics().then((v) => { if (alive) setLog(v); }).catch((e) => { console.error(e); if (alive) setErr(e.code || e.message); });
    return () => { alive = false; };
  }, [actions, tries]);

  if (err) return <div className="p-6 text-center text-sm text-gray-500 space-y-3"><p>記録を読み込めませんでした（{err}）</p><Press onClick={() => { setErr(''); setTries((n) => n + 1); }} className="inline-flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-1.5 bg-white"><RotateCw className="w-4 h-4" />もう一度</Press></div>;
  if (!log) return <div className="p-3 space-y-3">{[0, 1, 2].map((i) => <div key={i} className="liff-skel h-28 rounded-2xl" />)}</div>;

  // 家族＝子ども。LINEで入ったメンバーをその子にまとめる
  const familyOf = Object.fromEntries((data.members || []).filter((m) => m.studentId).map((m) => [m.id, m.studentId]));
  const families = new Set(Object.values(familyOf));
  const openedBy = {};
  for (const o of log.opens) {
    if (o.src === 'relay') continue; // 担当の人へのお知らせを開いたのは、家族への到達ではない
    const fam = familyOf[o.uid];
    if (fam) (openedBy[o.sid] ||= new Set()).add(fam);
  }
  const answeredAt = (s, sid) => {
    const after = (t) => (t && t > s.at ? t : null);
    const att = data.attendances.find((a) => a.eventId === s.eventId && a.studentId === sid)?.updatedAt;
    const ride = data.rides.find((r) => r.eventId === s.eventId && r.studentId === sid)?.updatedAt;
    const ps = data.paymentStatuses.find((p) => p.eventId === s.eventId && p.studentId === sid);
    if (s.kind === 'nudge') return [after(att), after(ride)].filter(Boolean).sort()[0] || null;
    if (s.kind === 'selection') return after(ride);
    if (s.kind === 'pay') return ps?.status === 'transferred' ? after(ps.transferredAt || ps.updatedAt) : null;
    return null;
  };

  const sends = log.sends.filter((s) => s.at && KINDS[s.kind]).sort((a, b) => b.at.localeCompare(a.at));
  const rows = sends.map((s) => {
    const opened = openedBy[s.sid]?.size || 0;
    const targets = (s.targets || []).filter((sid) => data.students.some((x) => x.id === sid));
    const answered = targets.map((sid) => answeredAt(s, sid)).filter(Boolean);
    const event = data.events.find((e) => e.id === s.eventId);
    return { s, opened, targets, answered, event, took: median(answered.map((t) => new Date(t) - new Date(s.at))) };
  });

  // 種類ごとの平均（直近60日）
  const since = new Date(Date.now() - 60 * 864e5).toISOString();
  const byKind = Object.keys(KINDS).map((k) => {
    const rs = rows.filter((r) => r.s.kind === k && r.s.at >= since);
    if (!rs.length) return null;
    const open = Math.round(rs.reduce((n, r) => n + pct(r.opened, families.size), 0) / rs.length);
    const tr = rs.filter((r) => r.targets.length);
    const done = tr.length ? Math.round(tr.reduce((n, r) => n + pct(r.answered.length, r.targets.length), 0) / tr.length) : null;
    return { k, n: rs.length, open, done };
  }).filter(Boolean);

  return (
    <div className="p-3 space-y-4">
      <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-sm">
        <h3 className="font-bold flex items-center gap-2 mb-1"><BarChart3 className="w-5 h-5 text-emerald-600" />お知らせの効果（直近60日の平均）</h3>
        <p className="text-xs text-gray-500 mb-3">登録している家族：{families.size}家族。「開いた」はカードからアプリを開いた家族の割合です（LINEの既読は分かりません）。</p>
        {!byKind.length && <p className="text-gray-400 text-center py-4">まだ記録がありません。お知らせを送ると、ここに出ます。</p>}
        <motion.ul className="space-y-2.5" variants={listVariants} initial="hidden" animate="show">
          {byKind.map((b) => (
            <motion.li key={b.k} variants={itemVariants}>
              <div className="flex items-baseline text-xs"><b className="flex-1 text-sm">{KINDS[b.k]}</b><span className="text-gray-500">{b.n}回</span></div>
              <Bar label="開いた" value={b.open} />
              {b.done !== null && <Bar label="回答した" value={b.done} tone="amber" />}
            </motion.li>
          ))}
        </motion.ul>
      </section>

      <h3 className="text-xs text-gray-500 px-1">送ったお知らせ</h3>
      {!rows.length && <p className="text-sm text-gray-400 text-center py-6">まだ送ったお知らせがありません</p>}
      <motion.ul className="space-y-2" variants={listVariants} initial="hidden" animate="show">
        {rows.map(({ s, opened, targets, answered, event, took }) => (
          <motion.li key={s.sid} variants={itemVariants} className="bg-white rounded-2xl p-3.5 shadow-sm border border-gray-100 text-sm">
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] font-bold bg-emerald-50 text-emerald-700 rounded-full px-2 py-0.5 shrink-0">{KINDS[s.kind]}</span>
              <span className="text-xs text-gray-500 tabular-nums">{sentLabel(s.at)}</span>
              <span className="text-xs text-gray-500 truncate">{s.via === 'bot' ? 'まちさかマネージャー' : s.by ? `${s.by}さん` : ''}</span>
            </div>
            {event && <p className="font-bold mt-1 truncate">{dateLabel(event.date)} {event.title}</p>}
            <dl className="grid grid-cols-[6.5em_1fr] gap-y-1 mt-2 text-[13px] tabular-nums">
              <dt className="text-gray-500">開いた家族</dt><dd>{opened} / {families.size}（{pct(opened, families.size)}%）</dd>
              {GOAL[s.kind] && <><dt className="text-gray-500">回答した</dt><dd>{answered.length} / {targets.length}（{pct(answered.length, targets.length)}%）<span className="text-gray-500 text-xs ml-1">{GOAL[s.kind]}</span></dd></>}
              {took !== null && <><dt className="text-gray-500">回答まで</dt><dd>中央値 {hours(took)}</dd></>}
            </dl>
          </motion.li>
        ))}
      </motion.ul>
      <p className="text-[11px] text-gray-400 px-1">「回答した」は、送った時点で対象だった家族のうち、送ったあとに{'　'}出欠・配車の希望・支払いを済ませた家族です。</p>
    </div>
  );
}

function Bar({ label, value, tone = 'emerald' }) {
  return (
    <div className="flex items-center gap-2 mt-1">
      <span className="w-14 text-[11px] text-gray-500">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} className={`h-full rounded-full ${tone === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
      </div>
      <span className="w-9 text-right text-xs font-bold tabular-nums">{value}%</span>
    </div>
  );
}
