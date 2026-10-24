import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Sparkles, Loader2, Ban, X, ChevronDown, Paperclip, FileText, Trash2 } from 'lucide-react';
import { Sheet, Press, useShake, useToast, spring } from '../ui.jsx';
import { todayJst, dateLabel, timeLabel, defaultDeadline, isCanceled, startOf, compressAttachment, readAsDataUrl, ATTACH_MAX_FILE } from '../util.js';

// 「AIで読み取る」は使うAIを決めるまで「準備中」で押せない。Vercel の環境変数 VITE_AI_PARSE=on で使える（開発の見本データでは常に使える）
const AI_ENABLED = import.meta.env.VITE_AI_PARSE === 'on' || (import.meta.env.DEV && new URLSearchParams(location.search).has('mock'));

const EMPTY = { date: '', type: '練習', title: '', startTime: '', endTime: '', location: '', memo: '', answerDeadline: '' };
// 開始は集合の時刻。古い予定に集合時刻（gatherTime）があれば、それを「開始」として見せる
const pick = (e) => ({ ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, e?.[k] || ''])), startTime: e ? startOf(e) : '' });
// 登録済みの予定を壊さないため、「開始」は読み込んだのと同じ項目に書き戻す（集合時刻がある予定は gatherTime、無ければ startTime）。
// 既存アプリが別々に持つ集合・開始の値はどちらも消さない
const startKeyOf = (e) => (e?.gatherTime ? 'gatherTime' : 'startTime');

// 予定の追加・修正（配車担当・案内係・管理者）。新規はAIで文章から読み取って入力欄を埋められる
// 見た目はGmailの「作成」画面に合わせる（2026-10-24 ユーザー決定）：×・見出し・右上の保存、枠なしの1行ずつの入力欄、下にメモ
export default function EventEditor({ ctx, event, open, onClose }) {
  return (
    <Sheet open={open} onClose={onClose} bare>
      {open && <EditorBody key={event?.id || 'new'} ctx={ctx} event={event} onClose={onClose} />}
    </Sheet>
  );
}

function EditorBody({ ctx, event, onClose }) {
  const toast = useToast();
  const [f, setF] = useState(event ? pick(event) : { ...EMPTY, date: todayJst(), startTime: '09:00', endTime: '17:00' });
  const [flash, setFlash] = useState(0);
  const [results, setResults] = useState([]);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [scope, shake] = useShake();
  // 添付：登録済み（existing）、消す予定（removed）、これから足す（added）。保存を押したときにまとめて書く
  const [existing, setExisting] = useState([]);
  const [removed, setRemoved] = useState([]);
  const [added, setAdded] = useState([]);
  const [reading, setReading] = useState(false);
  useEffect(() => { if (event?.id) ctx.actions.loadAttachments(event.id).then(setExisting).catch(console.error); }, [ctx.actions, event?.id]);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v?.target ? v.target.value : v }));

  const fill = (e) => { setF({ ...EMPTY, ...e }); setFlash((n) => n + 1); };
  const sameDay = f.date ? ctx.data.events.filter((e) => e.date === f.date && e.id !== event?.id && !isCanceled(e)) : [];

  const save = async () => {
    if (!f.date || !f.title.trim()) { setErr('日付とタイトルを入れてください'); return shake(); }
    setSaving(true);
    try {
      const { startTime, ...rest } = f;
      const data = { ...rest, title: f.title.trim(), [startKeyOf(event)]: startTime };
      if (!data.answerDeadline) delete data.answerDeadline;
      const kept = existing.filter((a) => !removed.includes(a.id));
      if (added.length || removed.length) data.hasAttachments = kept.length + added.length > 0;
      const id = await ctx.actions.saveEvent(event ? { ...data, id: event.id } : data);
      for (const a of added) await ctx.actions.addAttachment(id, a);
      for (const attId of removed) await ctx.actions.removeAttachment(id, attId);
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

  const pickFiles = async (ev) => {
    const files = [...(ev.target.files || [])];
    ev.target.value = '';
    setReading(true); setErr('');
    for (const file of files) {
      try {
        if (!file.type.startsWith('image/') && file.size > ATTACH_MAX_FILE) throw new Error(`${file.name} は大きすぎます（画像以外は700KBまで）`);
        const url = file.type.startsWith('image/') ? await compressAttachment(file) : await readAsDataUrl(file);
        setAdded((x) => [...x, { name: file.name, url }]);
      } catch (e) { setErr(e.message); }
    }
    setReading(false);
  };
  const attachList = [...existing.filter((a) => !removed.includes(a.id)).map((a) => ({ ...a, drop: () => setRemoved((r) => [...r, a.id]) })),
    ...added.map((a, i) => ({ ...a, id: `new${i}`, drop: () => setAdded((x) => x.filter((_, j) => j !== i)) }))];

  const deleteEvent = async () => {
    setSaving(true);
    try {
      await ctx.actions.deleteEvent(event.id);
      toast('予定を削除しました', `${dateLabel(event.date)} ${event.title}`);
      onClose();
    } catch (e) { console.error(e); setErr('削除できませんでした'); setSaving(false); setConfirmDelete(false); }
  };

  const cancelEvent = async () => {
    await ctx.actions.saveEvent({ id: event.id, title: `【中止】${event.title}` });
    toast('中止にしました', '予定一覧に取り消し線で残ります');
    onClose();
  };

  // 1行に「項目名｜入力」。横に2つ並べると iPhone の日付欄がはみ出して重なるので、全部1行ずつにする
  const plain = 'liff-plain w-full bg-transparent border-0 outline-none text-base py-3 text-gray-900 placeholder:text-gray-400';
  const row = (label, el, id) => (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-2 min-h-[52px] px-4 border-b border-gray-100 focus-within:border-blue-600">
      {id ? <label htmlFor={id} className="text-sm text-gray-500">{label}</label> : <span className="text-sm text-gray-500">{label}</span>}
      {el}
    </div>
  );
  const typeChip = (t) => (
    <button key={t} type="button" onClick={() => set('type')(t)} aria-pressed={f.type === t}
      className={`rounded-lg px-3.5 py-1.5 text-sm border transition-colors ${f.type === t ? 'bg-blue-100 text-blue-900 font-bold border-transparent' : 'border-gray-200 text-gray-700'}`}>{t}</button>
  );

  return (
    <div className="text-sm">
      <div className="sticky top-0 z-10 bg-white flex items-center gap-2 px-2.5 pt-3 pb-2">
        <button onClick={onClose} aria-label="閉じる" className="w-10 h-10 rounded-full grid place-items-center active:bg-gray-100"><X className="w-[22px] h-[22px] text-gray-700" /></button>
        <h3 className="flex-1 text-lg font-bold">{event ? '予定を直す' : '予定を追加'}</h3>
        <Press onClick={save} disabled={saving} className="bg-blue-600 text-white rounded-full px-5 py-2 font-bold disabled:opacity-60">{saving ? '保存中…' : event ? '保存' : '追加'}</Press>
      </div>

      {!event && <AiBox ctx={ctx} onResults={(list) => { setResults(list); if (list[0]) fill(list[0]); }} />}

      <AnimatePresence>
        {results.length > 1 && (
          <motion.section initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden px-3 pb-2">
            <div className="bg-blue-50 rounded-2xl p-3 space-y-2">
              <p className="font-bold text-blue-900">{results.length}件の予定が見つかりました</p>
              {results.map((r, i) => (
                <button key={i} onClick={() => fill(r)} className="w-full text-left bg-white rounded-xl px-3 py-2">
                  <b>{dateLabel(r.date)} {r.title}</b><span className="block text-xs text-gray-500">{[timeLabel(r), r.location].filter(Boolean).join(' ・ ')}</span>
                </button>
              ))}
              <Press onClick={addAll} disabled={saving} className="w-full bg-blue-600 text-white rounded-full py-2.5 font-bold disabled:opacity-60">{saving ? '追加中…' : `${results.length}件まとめて追加`}</Press>
              <p className="text-[11px] text-blue-900">1件ずつ直したいときは、押すと下の入力欄に入ります</p>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <motion.div ref={scope} key={flash} initial={flash ? { backgroundColor: '#eff6ff' } : false} animate={{ backgroundColor: 'rgba(255,255,255,0)' }} transition={{ duration: 1.2 }}>
        {row('タイトル', <input id="ev-title" className={`${plain} text-lg font-bold placeholder:font-normal placeholder:text-base`} value={f.title} onChange={set('title')} placeholder="例：練習、市リーグ 第5節" />, 'ev-title')}
        {row('種別', <div className="flex flex-wrap gap-1.5 py-2">{['練習', '試合', 'その他'].map(typeChip)}</div>)}
        {row('日付', <input id="ev-date" type="date" className={plain} value={f.date} onChange={set('date')} />, 'ev-date')}
        {row('開始（集合）', <input id="ev-start" type="time" className={plain} value={f.startTime} onChange={set('startTime')} />, 'ev-start')}
        {row('終了（解散）', <input id="ev-end" type="time" className={plain} value={f.endTime} onChange={set('endTime')} />, 'ev-end')}
        {row('場所', <input id="ev-place" className={plain} value={f.location} onChange={set('location')} placeholder="例：柏の葉小 第二グラウンド" />, 'ev-place')}
        {row('出欠の締切', <input id="ev-deadline" type="date" className={plain} value={f.answerDeadline} max={f.date} onChange={set('answerDeadline')} />, 'ev-deadline')}
        {f.date && !f.answerDeadline && <p className="text-xs text-gray-500 pl-[120px] pr-4 pt-1.5">空なら {dateLabel(defaultDeadline(f))}（{f.type === '試合' ? '2週間前' : '3日前'}）</p>}
        <div className="px-4 py-2 border-b border-gray-100">
          <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-2 min-h-[36px]">
            <span className="text-sm text-gray-500">添付</span>
            <label className="relative inline-flex items-center gap-1.5 justify-self-start rounded-full border border-gray-200 px-3.5 py-1.5 text-sm text-gray-700 cursor-pointer active:bg-gray-100">
              {reading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}{reading ? '読み込み中…' : '画像・PDFを選ぶ'}
              <input type="file" multiple accept="image/*,application/pdf" onChange={pickFiles} className="absolute inset-0 opacity-0" aria-label="添付するファイルを選ぶ" />
            </label>
          </div>
          {attachList.length > 0 && (
            <ul className="mt-2 grid grid-cols-3 gap-2">
              {attachList.map((a) => (
                <li key={a.id} className="relative rounded-xl bg-gray-100 overflow-hidden aspect-square">
                  {a.url?.startsWith('data:image/')
                    ? <img src={a.url} alt={a.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full grid place-items-center p-2 text-center"><div><FileText className="w-6 h-6 text-gray-500 mx-auto" /><p className="text-[10px] text-gray-600 mt-1 line-clamp-2 break-all">{a.name}</p></div></div>}
                  <button type="button" onClick={a.drop} aria-label={`${a.name}を外す`} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white grid place-items-center"><X className="w-3.5 h-3.5" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <textarea aria-label="メモ（持ち物・注意など）" className="block w-full min-h-[160px] border-0 outline-none resize-none bg-transparent text-base leading-relaxed p-4" value={f.memo} onChange={set('memo')} placeholder="メモ（持ち物・注意など）" />
      </motion.div>

      <div className="px-4 space-y-3">
        {sameDay.length > 0 && <p className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2">同じ日に「{sameDay.map((e) => e.title).join('」「')}」があります。二重登録になっていないか確かめてください</p>}
        <AnimatePresence>{err && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-red-600 bg-red-50 rounded-xl px-3 py-2">{err}</motion.p>}</AnimatePresence>

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

        {event && (
          <div>
            {!confirmDelete
              ? <button onClick={() => setConfirmDelete(true)} className="w-full flex items-center justify-center gap-1.5 text-gray-500 text-sm py-2"><Trash2 className="w-4 h-4" />この予定を削除する</button>
              : (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="bg-red-50 rounded-xl p-3 text-red-700">
                  <p className="font-bold">この予定を削除しますか？</p>
                  <p className="text-xs mt-0.5">削除すると元に戻せません。一覧からも消えて、付けた添付も消えます。予定を残したまま取りやめるときは「中止にする」を使ってください。</p>
                  <div className="flex gap-2 mt-2"><Press onClick={deleteEvent} disabled={saving} className="flex-1 bg-red-600 text-white rounded-lg py-2 font-bold disabled:opacity-60">{saving ? '削除中…' : '削除する'}</Press><Press onClick={() => setConfirmDelete(false)} className="flex-1 bg-white border border-red-200 rounded-lg py-2 font-bold">やめる</Press></div>
                </motion.div>
              )}
          </div>
        )}
      </div>
    </div>
  );
}

// 1行だけ見せて、押すと貼り付け欄が開く。使えない間は「準備中」で開かない
function AiBox({ ctx, onResults }) {
  const [open, setOpen] = useState(false);
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
    <section className="mx-3 mb-2 rounded-2xl bg-gray-100">
      <button type="button" onClick={() => AI_ENABLED && setOpen((o) => !o)} aria-expanded={open} className="w-full flex items-center gap-3 px-3.5 py-3 text-left">
        <Sparkles className="w-5 h-5 text-gray-500 shrink-0" />
        <span className="flex-1 min-w-0 font-bold">AIで読み取る<span className="block font-normal text-xs text-gray-500 mt-0.5">メモ書きでOK。日付さえ入っていれば、何件でもまとめて入力欄に振り分けます</span></span>
        {AI_ENABLED ? <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} /> : <span className="text-[11px] text-gray-500 border border-gray-300 rounded-full px-2 py-0.5 shrink-0">準備中</span>}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring} className="overflow-hidden">
            <div className="px-3 pb-3 space-y-2">
              <textarea value={text} onChange={(e) => setText(e.target.value)} className="w-full rounded-xl p-3 text-base h-24 bg-white outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="例：来週土曜 練習 9時〜 柏の葉小 水筒多め（LINEの連絡をそのまま貼っても大丈夫）" />
              <Press onClick={run} disabled={busy || !text.trim()} className="w-full bg-blue-600 text-white rounded-full py-2.5 font-bold disabled:opacity-50 flex items-center justify-center gap-1.5">
                {busy ? <><Loader2 className="w-4 h-4 animate-spin" />読み取り中…</> : <><Sparkles className="w-4 h-4" />読み取って入力欄に入れる</>}
              </Press>
              <AnimatePresence>{msg && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring} className="text-xs text-gray-700">{msg}</motion.p>}</AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
