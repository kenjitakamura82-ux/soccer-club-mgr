import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Sparkles, Loader2, Plus, Ban } from 'lucide-react';
import { Sheet, Press, Segmented, useShake, useToast, spring } from '../ui.jsx';
import { todayJst, dateLabel, timeLabel, defaultDeadline, isCanceled } from '../util.js';

const EMPTY = { date: '', type: '練習', title: '', gatherTime: '', startTime: '', endTime: '', location: '', memo: '', answerDeadline: '' };
const pick = (e) => Object.fromEntries(Object.keys(EMPTY).map((k) => [k, e?.[k] || '']));

// 予定の追加・修正（配車担当・案内係・管理者）。新規はAIで文章から読み取って入力欄を埋められる
export default function EventEditor({ ctx, event, open, onClose }) {
  return (
    <Sheet open={open} onClose={onClose} title={event ? '予定を直す' : '予定を追加'}>
      {open && <EditorBody key={event?.id || 'new'} ctx={ctx} event={event} onClose={onClose} />}
    </Sheet>
  );
}

function EditorBody({ ctx, event, onClose }) {
  const toast = useToast();
  const [f, setF] = useState(event ? pick(event) : { ...EMPTY, date: todayJst() });
  const [flash, setFlash] = useState(0);
  const [results, setResults] = useState([]);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [scope, shake] = useShake();
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v?.target ? v.target.value : v }));

  const fill = (e) => { setF({ ...EMPTY, ...e }); setFlash((n) => n + 1); };
  const sameDay = f.date ? ctx.data.events.filter((e) => e.date === f.date && e.id !== event?.id && !isCanceled(e)) : [];

  const save = async () => {
    if (!f.date || !f.title.trim()) { setErr('日付とタイトルを入れてください'); return shake(); }
    setSaving(true);
    try {
      const data = { ...f, title: f.title.trim() };
      if (!data.answerDeadline) delete data.answerDeadline;
      await ctx.actions.saveEvent(event ? { ...data, id: event.id } : data);
      toast(event ? '予定を直しました' : '予定を追加しました', `${dateLabel(f.date)} ${f.title.trim()}`);
      onClose();
    } catch (e) { console.error(e); setErr('保存できませんでした'); setSaving(false); }
  };

  const addAll = async () => {
    setSaving(true);
    try {
      for (const r of results) await ctx.actions.saveEvent(r);
      toast(`${results.length}件の予定を追加しました`);
      onClose();
    } catch (e) { console.error(e); setErr('保存できませんでした'); setSaving(false); }
  };

  const cancelEvent = async () => {
    await ctx.actions.saveEvent({ id: event.id, title: `【中止】${event.title}` });
    toast('中止にしました', '予定一覧に取り消し線で残ります');
    onClose();
  };

  const input = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base bg-white outline-none focus:ring-2 focus:ring-emerald-500';
  const field = (label, el) => <label className="block"><span className="text-xs text-gray-500">{label}</span>{el}</label>;

  return (
    <div className="space-y-4 text-sm">
      {!event && <AiBox ctx={ctx} onResults={(list) => { setResults(list); if (list[0]) fill(list[0]); }} />}

      <AnimatePresence>
        {results.length > 1 && (
          <motion.section initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="bg-emerald-50 rounded-2xl p-3 space-y-2">
              <p className="font-bold text-emerald-800">{results.length}件の予定が見つかりました</p>
              {results.map((r, i) => (
                <button key={i} onClick={() => fill(r)} className="w-full text-left bg-white rounded-xl px-3 py-2 border border-emerald-100">
                  <b>{dateLabel(r.date)} {r.title}</b><span className="block text-xs text-gray-500">{[timeLabel(r), r.location].filter(Boolean).join(' ・ ')}</span>
                </button>
              ))}
              <Press onClick={addAll} disabled={saving} className="w-full bg-emerald-600 text-white rounded-xl py-2.5 font-bold disabled:opacity-60">{saving ? '追加中…' : `${results.length}件まとめて追加`}</Press>
              <p className="text-[11px] text-emerald-800">1件ずつ直したいときは、押すと下の入力欄に入ります</p>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <motion.div ref={scope} key={flash} initial={flash ? { backgroundColor: '#ecfdf5' } : false} animate={{ backgroundColor: 'rgba(255,255,255,0)' }} transition={{ duration: 1.2 }} className="space-y-3 rounded-2xl">
        <div className="grid grid-cols-2 gap-2">
          {field('日付', <input type="date" className={input} value={f.date} onChange={set('date')} />)}
          {field('出欠の締切', <input type="date" className={input} value={f.answerDeadline} max={f.date} onChange={set('answerDeadline')} />)}
        </div>
        {f.date && !f.answerDeadline && <p className="text-[11px] text-gray-500 -mt-2">締切が空なら {dateLabel(defaultDeadline(f))}（{f.type === '試合' ? '2週間前' : '3日前'}）</p>}
        <div><span className="text-xs text-gray-500">種別</span><Segmented id="ev-type" value={f.type} onChange={set('type')} options={[{ value: '練習', label: '練習' }, { value: '試合', label: '試合' }, { value: 'その他', label: 'その他' }]} /></div>
        {field('タイトル', <input className={input} value={f.title} onChange={set('title')} placeholder="例：練習、市リーグ 第5節" />)}
        <div className="grid grid-cols-3 gap-2">
          {field('集合', <input type="time" className={input} value={f.gatherTime} onChange={set('gatherTime')} />)}
          {field('開始', <input type="time" className={input} value={f.startTime} onChange={set('startTime')} />)}
          {field('終了', <input type="time" className={input} value={f.endTime} onChange={set('endTime')} />)}
        </div>
        {field('場所', <input className={input} value={f.location} onChange={set('location')} placeholder="例：柏の葉小 第二グラウンド" />)}
        {field('メモ（持ち物・注意など）', <textarea className={`${input} h-20`} value={f.memo} onChange={set('memo')} />)}
      </motion.div>

      {sameDay.length > 0 && <p className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2">同じ日に「{sameDay.map((e) => e.title).join('」「')}」があります。二重登録になっていないか確かめてください</p>}
      <AnimatePresence>{err && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-red-600 bg-red-50 rounded-xl px-3 py-2">{err}</motion.p>}</AnimatePresence>

      <Press onClick={save} disabled={saving} className="w-full bg-emerald-600 text-white rounded-xl py-3 font-bold disabled:opacity-60 flex items-center justify-center gap-1.5">
        {!event && <Plus className="w-4 h-4" />}{saving ? '保存中…' : event ? '保存' : 'この内容で追加'}
      </Press>

      {event && !isCanceled(event) && (
        <div>
          {!confirmCancel
            ? <button onClick={() => setConfirmCancel(true)} className="w-full flex items-center justify-center gap-1.5 text-red-600 text-sm py-2"><Ban className="w-4 h-4" />この予定を中止にする</button>
            : (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="bg-red-50 rounded-xl p-3 text-red-700">
                <p className="font-bold">中止にしますか？</p>
                <p className="text-xs mt-0.5">タイトルの頭に【中止】が付いて、一覧に取り消し線で残ります。グループへの連絡は別にしてください。</p>
                <div className="flex gap-2 mt-2"><Press onClick={cancelEvent} className="flex-1 bg-red-600 text-white rounded-lg py-2 font-bold">中止にする</Press><Press onClick={() => setConfirmCancel(false)} className="flex-1 bg-white border border-red-200 rounded-lg py-2 font-bold">やめる</Press></div>
              </motion.div>
            )}
        </div>
      )}
    </div>
  );
}

function AiBox({ ctx, onResults }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const run = async () => {
    if (!text.trim()) return;
    setBusy(true); setMsg('');
    try {
      const list = await ctx.actions.parseEvents(text);
      if (!list.length) setMsg('予定が見つかりませんでした。日付が入っているか確かめてください');
      else { setMsg(list.length === 1 ? '読み取りました。下の内容を確かめて追加してください' : ''); onResults(list); }
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  };
  return (
    <section className="rounded-2xl p-3 bg-gradient-to-br from-emerald-50 to-sky-50 border border-emerald-100 space-y-2">
      <h4 className="font-bold text-emerald-800 flex items-center gap-1.5"><Sparkles className="w-4 h-4" />AIで読み取る</h4>
      <textarea value={text} onChange={(e) => setText(e.target.value)} className="w-full border border-emerald-100 rounded-xl p-3 text-base h-24 bg-white outline-none focus:ring-2 focus:ring-emerald-500"
        placeholder="LINEの連絡をそのまま貼るか、ふつうに書く&#10;例：11/3(火祝) 練習 9時〜11時 柏の葉小 第二G 水筒多め" />
      <Press onClick={run} disabled={busy || !text.trim()} className="w-full bg-emerald-700 text-white rounded-xl py-2.5 font-bold disabled:opacity-50 flex items-center justify-center gap-1.5">
        {busy ? <><Loader2 className="w-4 h-4 animate-spin" />読み取り中…</> : <><Sparkles className="w-4 h-4" />読み取って入力欄に入れる</>}
      </Press>
      <AnimatePresence>{msg && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring} className="text-xs text-emerald-800">{msg}</motion.p>}</AnimatePresence>
    </section>
  );
}
