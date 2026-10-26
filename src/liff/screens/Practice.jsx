import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ClipboardList, History, Target, ChevronUp, ChevronDown, Trash2, Plus, Minus, NotebookPen, Lock, Pin, Save } from 'lucide-react';
import { Sheet, Press, Avatar, useToast, spring } from '../ui.jsx';
import { PLAN_TEMPLATE, eventMinutes, fitBlocks, fromMinutes, toMinutes, startOf, planOf, prevPlan, canPlan, noteEvent, dateLabel, isCanceled, todayJst, kidName } from '../util.js';

// 練習補助・最初の版（2026-10-26 ユーザー決定）：練習メニュー（目的は必須・時間割・前回の流れを使う）、振り返り、プレイのメモ。
// AIの提案・ドリルのアニメーションはこのあと足す。メモは書いた本人にしか見えない（ほかの家の子に書いてもよい）
const uid = () => Math.random().toString(36).slice(2, 9);
const withIds = (blocks) => blocks.map((b) => ({ id: b.id || uid(), name: b.name || '', min: b.min || 5, note: b.note || '', fixed: !!b.fixed }));
// 各区切りの始まりの時刻（分）
const startsOf = (start, blocks) => blocks.reduce((acc, b, i) => [...acc, i ? acc[i - 1] + blocks[i - 1].min : start], []);
const sumMin = (blocks) => blocks.reduce((s, b) => s + (b.min || 0), 0);
const practices = (events) => events.filter((e) => e.type === '練習' && e.date && !isCanceled(e));

// 「練習」タブ（コーチ・管理者）：これからの練習と、練習の記録
export default function PracticeTab({ ctx }) {
  const { data } = ctx;
  const [editing, setEditing] = useState(null);
  const t = todayJst();
  const all = practices(data.events);
  const next = all.filter((e) => e.date >= t).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  const past = all.filter((e) => e.date < t).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
  const ev = editing && data.events.find((e) => e.id === editing);
  return (
    <div className="p-3 space-y-3">
      <section className="space-y-2">
        <h3 className="font-bold text-sm text-gray-500 px-1">これからの練習</h3>
        {next.map((e) => <PlanRow key={e.id} e={e} ctx={ctx} onOpen={() => setEditing(e.id)} />)}
        {!next.length && <p className="text-sm text-gray-400 px-1">予定に練習がありません</p>}
      </section>
      <section className="space-y-2">
        <h3 className="font-bold text-sm text-gray-500 px-1 flex items-center gap-1"><History className="w-4 h-4" />練習の記録</h3>
        {past.map((e) => <PlanRow key={e.id} e={e} ctx={ctx} onOpen={() => setEditing(e.id)} past />)}
        {!past.length && <p className="text-sm text-gray-400 px-1">まだありません</p>}
      </section>
      <PlanSheet e={ev} ctx={ctx} onClose={() => setEditing(null)} />
    </div>
  );
}

function PlanRow({ e, ctx, onOpen, past }) {
  const plan = planOf(ctx.data, e.id);
  return (
    <button type="button" onClick={onOpen} className="w-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-start gap-3 active:bg-gray-50">
      <span className="text-xs font-bold text-gray-500 tabular-nums w-14 shrink-0 pt-0.5">{dateLabel(e.date)}</span>
      <span className="flex-1 min-w-0">
        <b className={`block truncate ${plan?.purpose ? '' : 'text-gray-400 font-normal'}`}>{plan?.purpose || 'メニューはまだありません'}</b>
        {plan?.blocks?.length > 0 && <span className="block text-[11px] text-gray-500 truncate">{plan.blocks.filter((b) => !b.fixed && b.name).map((b) => b.name).join('・')}</span>}
      </span>
      {past
        ? <span className={`text-[11px] font-bold rounded-full px-2 py-0.5 shrink-0 ${plan?.review?.text ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{plan?.review?.text ? '振り返り済み' : '振り返りまだ'}</span>
        : <span className={`text-[11px] font-bold rounded-full px-2 py-0.5 shrink-0 ${plan ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{plan ? 'メニューあり' : '作る'}</span>}
    </button>
  );
}

// 予定の詳細に出す：練習の目的と時間割（だれでも見られる）。コーチには「作る・直す」
export function PlanSummary({ e, ctx, onEdit }) {
  const plan = planOf(ctx.data, e.id);
  const editable = canPlan(ctx.has);
  if (!plan && !editable) return null;
  const starts = plan ? startsOf(toMinutes(startOf(e)) ?? 9 * 60, plan.blocks) : [];
  return (
    <section className="bg-emerald-50/60 rounded-2xl p-3 space-y-2">
      <h4 className="font-bold text-xs text-emerald-800 flex items-center gap-1"><ClipboardList className="w-4 h-4" />練習メニュー</h4>
      {plan ? (
        <>
          <p className="flex items-start gap-1.5 font-bold"><Target className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />{plan.purpose}</p>
          <ol className="space-y-1">
            {plan.blocks.map((b, i) => { const s = starts[i]; return (
              <li key={b.id} className="flex gap-2 text-[13px]"><span className="w-10 shrink-0 text-gray-500 tabular-nums">{fromMinutes(s)}</span><span className="flex-1 min-w-0"><b className="font-bold">{b.name || 'メニュー'}</b>{b.note && <span className="block text-[11px] text-gray-500">{b.note}</span>}</span><span className="text-gray-500 tabular-nums">{b.min}分</span></li>
            ); })}
          </ol>
        </>
      ) : <p className="text-xs text-gray-500">まだメニューがありません</p>}
      {editable && <Press onClick={onEdit} className="w-full bg-white border border-emerald-200 text-emerald-700 rounded-xl py-2 text-sm font-bold">{plan ? 'メニューを直す・振り返りを書く' : 'メニューを作る'}</Press>}
    </section>
  );
}

// メニューを作る・直す（コーチ・管理者）
export function PlanSheet({ e, ctx, onClose }) {
  return (
    <Sheet open={!!e} onClose={onClose} title={e && `${dateLabel(e.date)} ${e.title} のメニュー`}>
      {e && <PlanEditor key={e.id} e={e} ctx={ctx} onClose={onClose} />}
    </Sheet>
  );
}

function PlanEditor({ e, ctx, onClose }) {
  const { data, actions } = ctx;
  const toast = useToast();
  const plan = planOf(data, e.id);
  const prev = prevPlan(data, e);
  const [purpose, setPurpose] = useState(plan?.purpose || '');
  const [total, setTotal] = useState(plan?.total || eventMinutes(e));
  const [blocks, setBlocks] = useState(() => withIds(plan?.blocks || fitBlocks(PLAN_TEMPLATE, eventMinutes(e))));
  const [review, setReview] = useState(plan?.review?.text || '');
  const [err, setErr] = useState('');
  const start = toMinutes(startOf(e)) ?? 9 * 60;
  const sum = sumMin(blocks);
  const past = e.date <= todayJst();

  const set = (i, patch) => setBlocks((bs) => bs.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const move = (i, d) => setBlocks((bs) => { const a = bs.slice(); const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; });
  const usePrev = () => { setBlocks(withIds(fitBlocks(prev.blocks, total))); if (!purpose) setPurpose(prev.purpose || ''); toast('前回の流れを入れました', `${dateLabel(prev.date)} の練習から。時間に合わせてあります`); };
  const save = async () => {
    if (!purpose.trim()) { setErr('今日の目的を入れてください'); return; }
    await actions.savePlan(e, { purpose: purpose.trim(), total, blocks: blocks.map(({ id, name, min, note, fixed }) => ({ id, name: name.trim(), min, note: note.trim(), fixed })), review: review.trim() });
    toast('メニューを保存しました');
    onClose();
  };
  const input = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-base bg-white outline-none focus:ring-2 focus:ring-emerald-500';

  const starts = startsOf(start, blocks);
  return (
    <div className="space-y-4 text-sm">
      <label className="block">
        <span className="text-xs font-bold text-gray-500 flex items-center gap-1"><Target className="w-4 h-4" />今日の目的 <span className="text-[10px] text-white bg-emerald-600 rounded-full px-1.5">必須</span></span>
        <input className={`${input} mt-1 font-bold`} value={purpose} onChange={(ev) => { setPurpose(ev.target.value); setErr(''); }} placeholder="例：ボールを止めて、前を向く" />
      </label>

      {prev && (
        <div className="flex items-center gap-3 border border-dashed border-emerald-200 rounded-xl px-3 py-2.5">
          <History className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="flex-1 min-w-0"><b className="block">前回の流れを使う</b><span className="block text-[11px] text-gray-500 truncate">{dateLabel(prev.date)}：{prev.purpose}</span></span>
          <Press onClick={usePrev} className="border border-emerald-200 text-emerald-700 rounded-lg px-3 py-1.5 font-bold">使う</Press>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500 flex-1">時間割（{fromMinutes(start)}〜{fromMinutes(start + total)}）</span>
          <select value={total} onChange={(ev) => setTotal(Number(ev.target.value))} className="border border-gray-200 rounded-lg px-2 py-1 text-base bg-white" aria-label="練習の長さ">
            {[...new Set([60, 90, 120, 150, 180, eventMinutes(e), total])].sort((a, b) => a - b).map((m) => <option key={m} value={m}>{m}分</option>)}
          </select>
        </div>
        {sum !== total && (
          <div className="flex items-center gap-2 bg-amber-50 text-amber-900 rounded-xl px-3 py-2 text-xs">
            <span className="flex-1">合計 {sum}分 ／ 練習 {total}分</span>
            <Press onClick={() => setBlocks((bs) => fitBlocks(bs, total))} className="bg-amber-600 text-white rounded-lg px-3 py-1.5 font-bold">時間に合わせる</Press>
          </div>
        )}
        <ol className="space-y-2">
          <AnimatePresence initial={false}>
            {blocks.map((b, i) => { const s = starts[i]; return (
              <motion.li key={b.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={spring} className={`rounded-xl p-2 space-y-1.5 ${b.fixed ? 'bg-gray-50' : 'bg-emerald-50/70'}`}>
                <div className="flex items-center gap-2">
                  <span className="w-10 shrink-0 text-xs font-bold text-gray-500 tabular-nums">{fromMinutes(s)}</span>
                  <input className="flex-1 min-w-0 bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-base font-bold" value={b.name} onChange={(ev) => set(i, { name: ev.target.value })} placeholder="メニュー名" aria-label="メニュー名" />
                  <span className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={() => set(i, { min: Math.max(5, b.min - 5) })} aria-label="5分へらす" className="w-7 h-7 rounded-full bg-white border border-gray-200 grid place-items-center"><Minus className="w-3.5 h-3.5" /></button>
                    <span className="w-9 text-center font-bold tabular-nums text-[13px]">{b.min}分</span>
                    <button type="button" onClick={() => set(i, { min: b.min + 5 })} aria-label="5分ふやす" className="w-7 h-7 rounded-full bg-white border border-gray-200 grid place-items-center"><Plus className="w-3.5 h-3.5" /></button>
                  </span>
                </div>
                <div className="flex items-center gap-1.5 pl-12">
                  <input className="flex-1 min-w-0 bg-white/70 border border-gray-200 rounded-lg px-2 py-1 text-base" value={b.note} onChange={(ev) => set(i, { note: ev.target.value })} placeholder="ねらい・やり方" aria-label="ねらい・やり方" />
                  <button type="button" onClick={() => set(i, { fixed: !b.fixed })} aria-pressed={b.fixed} aria-label="時間を固定する" title="時間を固定" className={`w-7 h-7 rounded-full grid place-items-center ${b.fixed ? 'bg-gray-700 text-white' : 'text-gray-400'}`}><Pin className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="上へ" className="w-7 h-7 grid place-items-center text-gray-500 disabled:opacity-30"><ChevronUp className="w-4 h-4" /></button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === blocks.length - 1} aria-label="下へ" className="w-7 h-7 grid place-items-center text-gray-500 disabled:opacity-30"><ChevronDown className="w-4 h-4" /></button>
                  <button type="button" onClick={() => setBlocks((bs) => bs.filter((_, j) => j !== i))} aria-label="消す" className="w-7 h-7 grid place-items-center text-gray-400"><Trash2 className="w-4 h-4" /></button>
                </div>
              </motion.li>
            ); })}
          </AnimatePresence>
        </ol>
        <button type="button" onClick={() => setBlocks((bs) => [...bs.slice(0, -1), { id: uid(), name: '', min: 15, note: '', fixed: false }, ...bs.slice(-1)])} className="w-full flex items-center justify-center gap-1 text-emerald-700 font-bold border border-dashed border-emerald-200 rounded-xl py-2"><Plus className="w-4 h-4" />メニューを足す</button>
        <p className="text-[11px] text-gray-400"><Pin className="w-3 h-3 inline -mt-0.5" /> を付けた区切り（集合・給水など）は、「時間に合わせる」で長さが変わりません。</p>
      </div>

      {past && (
        <label className="block">
          <span className="text-xs font-bold text-gray-500">振り返り（チーム全体について、ひとこと）</span>
          <textarea className={`${input} mt-1`} rows={3} value={review} onChange={(ev) => setReview(ev.target.value)} placeholder="例：パスは良かった。ミニゲームになると、受けたあと下を向いてしまう" />
        </label>
      )}

      <AnimatePresence>{err && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{err}</motion.p>}</AnimatePresence>
      <Press onClick={save} className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-xl py-3 font-bold"><Save className="w-4 h-4" />保存</Press>

      {past && <div className="border-t border-gray-100 pt-4"><NotesBody e={e} ctx={ctx} /></div>}
    </div>
  );
}

// 予定画面の上：最近の練習・試合のプレイのメモ（だれでも）。ふだんは1行
export function NotesCard({ ctx }) {
  const e = noteEvent(ctx.data.events);
  const [open, setOpen] = useState(false);
  if (!e) return null;
  const mine = (ctx.data.playerNotes || []).filter((n) => n.eventId === e.id).length;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="mx-3 mt-3 w-[calc(100%-1.5rem)] bg-white rounded-2xl border border-gray-100 flex items-center gap-1.5 px-3 py-2.5 text-left">
        <NotebookPen className="w-4 h-4 text-emerald-600" />
        <span className="font-bold text-sm flex-1">プレイのメモ</span>
        <span className="text-[11px] text-gray-400">{dateLabel(e.date)} {e.title}{mine ? `・${mine}件` : ''}</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={`${dateLabel(e.date)} ${e.title} のプレイのメモ`}>
        {open && <NotesBody e={e} ctx={ctx} />}
      </Sheet>
    </>
  );
}

// プレイのメモ：子どもを選んで書く。書いた人にしか見えない
function NotesBody({ e, ctx }) {
  const { data, students, photos, myKid, actions } = ctx;
  const toast = useToast();
  const attended = data.attendances.filter((a) => a.eventId === e.id && a.status === '参加').map((a) => students[a.studentId]).filter(Boolean);
  const [others, setOthers] = useState(false);
  const kids = data.students.filter((s) => !s.id.startsWith('coach_'));
  const firstList = [...(myKid ? [myKid] : []), ...attended.filter((s) => s.id !== myKid?.id)];
  const list = others ? [...firstList, ...kids.filter((s) => !firstList.some((x) => x.id === s.id))] : firstList.length ? firstList : kids;
  const [kid, setKid] = useState(myKid?.id || list[0]?.id || null);
  const [text, setText] = useState('');
  const mine = (data.playerNotes || []).filter((n) => n.eventId === e.id).sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  const add = async () => {
    if (!kid || !text.trim()) return;
    await actions.addNote({ eventId: e.id, date: e.date, studentId: kid, text: text.trim() });
    setText('');
    toast('メモを残しました', 'あなたにしか見えません');
  };
  return (
    <div className="space-y-3 text-sm">
      <p className="flex items-start gap-1.5 text-xs text-gray-500"><Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />メモは書いたあなたにしか見えません。ほかの家の子について書いてもかまいません。たまったメモは、これから足す練習づくりのAIが参考にします（だれが書いたかは使いません）。</p>
      <div className="flex flex-wrap gap-2">
        {list.map((s) => (
          <button key={s.id} type="button" onClick={() => setKid(s.id)} aria-pressed={kid === s.id} className={`flex items-center gap-1.5 rounded-full pl-1 pr-3 py-1 text-xs font-bold border ${kid === s.id ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-700 border-gray-200'}`}>
            <Avatar student={s} photo={photos[s.id]} size={22} />{s.childName}{s.id === myKid?.id ? '（うちの子）' : ''}
          </button>
        ))}
        {!others && kids.length > firstList.length && <button type="button" onClick={() => setOthers(true)} className="text-xs font-bold text-emerald-700 px-2">ほかの子も出す</button>}
      </div>
      <textarea className="w-full border border-gray-200 rounded-xl px-3 py-2 text-base bg-white outline-none focus:ring-2 focus:ring-emerald-500" rows={3} value={text} onChange={(ev) => setText(ev.target.value)} placeholder={`例：${kidName(students[kid])}は、受ける前に後ろを見られていた。止めたあと下を向きがち`} />
      <Press onClick={add} disabled={!kid || !text.trim()} className="w-full bg-emerald-600 text-white rounded-xl py-2.5 font-bold disabled:opacity-40">メモを残す</Press>
      {mine.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-gray-500">この日のあなたのメモ（{mine.length}件）</p>
          {mine.map((n) => (
            <div key={n.id} className="flex items-start gap-2 bg-gray-50 rounded-xl px-3 py-2">
              <Avatar student={students[n.studentId]} photo={photos[n.studentId]} size={24} />
              <span className="flex-1 min-w-0"><b className="text-xs">{kidName(students[n.studentId])}</b><span className="block whitespace-pre-wrap">{n.text}</span></span>
              <button type="button" onClick={() => actions.deleteNote(n.id).then(() => toast('メモを消しました'))} aria-label="消す" className="text-gray-400 p-1"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
