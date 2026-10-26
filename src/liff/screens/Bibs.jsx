import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Shirt, HeartHandshake, Send, Trash2, Plus, Check, Loader2, ChevronDown } from 'lucide-react';
import { Press, useToast, spring } from '../ui.jsx';
import { bibsSettings, bibColors, currentPractice, dateLabel, isLightHex, bibsFlex, kidName } from '../util.js';

// ビブスの持ち帰り（2026-10-26 ユーザー決定）
// 練習の1時間後に、まちさかマネージャーが担当の人（コーチ・管理者から何人でも）に1対1で知らせる（line-schedule-bot の api/bibs-reminder.js）
// → 担当の人が LINE版の送る画面から全体LINEにカードを送る → 持ち帰った家族が色を押す（LINE版が開いて記録・お礼を出す）
// 「持ってきた」は押し忘れるので置かない。次の練習の日になれば、表示は次の練習に移る（リセット）
const Sw = ({ hex, round }) => <span className={`inline-block w-3.5 h-3.5 shrink-0 ${round ? 'rounded-full' : 'rounded'}`} style={{ background: hex }} />;
const takesOf = (data, eventId) => (data.bibTakes || []).filter((t) => t.eventId === eventId);

// 予定画面の上：今の練習で持ち帰った家族。名前がずっと見えていると恥ずかしいので、ふだんは閉じておく（押すと開く。2026-10-26 ユーザー指摘）
export function BibsCard({ ctx, onOpen }) {
  const { data, students, myKid } = ctx;
  const [open, setOpen] = useState(false);
  const ev = currentPractice(data.events);
  if (!ev) return null;
  const takes = takesOf(data, ev.id);
  const asked = (data.bibAsks || []).some((a) => a.id === ev.id);
  if (!takes.length && !asked) return null;
  const colors = bibColors(data);
  const mine = myKid && takes.filter((t) => t.studentId === myKid.id);
  return (
    <div className="mx-3 mt-3 bg-white rounded-2xl border border-gray-100">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="w-full flex items-center gap-1.5 px-3 py-2.5 text-left">
        <Shirt className="w-4 h-4 text-emerald-600" />
        <span className="font-bold text-sm flex-1">ビブスの持ち帰り</span>
        <span className="text-[11px] text-gray-400">{dateLabel(ev.date)} 練習の分</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring} className="overflow-hidden">
            <div className="px-3 pb-3 space-y-2">
              <div className="flex flex-wrap gap-1.5 text-xs">
                {colors.map((c) => {
                  const who = takes.filter((t) => t.colorId === c.id).map((t) => kidName(students[t.studentId]));
                  if (!who.length && (!asked || c.other)) return null;
                  return (
                    <span key={c.id} className={`flex items-center gap-1.5 rounded-full pl-1.5 pr-2.5 py-1 ${who.length ? 'bg-gray-50' : 'bg-amber-50 text-amber-800 font-bold'}`}>
                      <Sw hex={c.hex} round />{c.name}：{who.length ? who.join('、') : '未報告'}
                    </span>
                  );
                })}
              </div>
              {mine?.length > 0 && <p className="text-[12px] text-emerald-800">ありがとうございます。次の練習に持ってきてください</p>}
              <button type="button" onClick={() => onOpen(ev.id)} className="text-xs font-bold text-emerald-700">記録する・変える</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// 色を押して開く画面・状況を見る画面。color が色のIDなら、自分の子の持ち帰りとして記録してお礼を出す
export function BibsView({ ctx, eventId, color, onDone }) {
  const { data, students, myKid, actions } = ctx;
  const toast = useToast();
  const ev = data.events.find((e) => e.id === eventId);
  const colors = bibColors(data);
  const takes = takesOf(data, eventId);
  const picked = colors.find((c) => c.id === color);
  const [thanked, setThanked] = useState(null);
  const once = useRef(false);

  useEffect(() => {
    if (once.current || !picked || !myKid || !ev) return;
    once.current = true;
    const already = takes.some((t) => t.colorId === picked.id && t.studentId === myKid.id);
    (already ? Promise.resolve() : actions.takeBib(eventId, picked.id, myKid.id)).then(() => setThanked(picked)).catch((e) => toast('記録できませんでした', e.message));
  }, [picked, myKid, ev, takes, actions, eventId, toast]);

  if (!ev) return <p className="p-6 text-center text-sm text-gray-500">この練習が見つかりませんでした</p>;
  const add = async (c) => { await actions.takeBib(eventId, c.id, myKid.id); setThanked(c); };
  const remove = async (c) => { await actions.untakeBib(eventId, c.id, myKid.id); toast(`${c.name}を取り消しました`); if (thanked?.id === c.id) setThanked(null); };

  return (
    <div className="bg-white min-h-[60vh]">
      <div className="px-4 pt-4 pb-4 text-center space-y-2">
        {thanked ? (
          <>
            <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring} className="mx-auto w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 grid place-items-center"><HeartHandshake className="w-8 h-8" /></motion.span>
            <p className="font-black text-lg">持ち帰り、ありがとうございます！</p>
            <p className="text-sm text-gray-600">{thanked.name}のビブスを、{kidName(myKid)}の家族が{thanked.other ? '持っています' : '洗ってくれます'}</p>
            <p className="text-[11px] text-gray-400">次の練習に持ってきてください（{dateLabel(ev.date)} 練習の分）</p>
          </>
        ) : (
          <>
            <span className="mx-auto w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 grid place-items-center">{picked && myKid ? <Loader2 className="w-7 h-7 animate-spin" /> : <Shirt className="w-7 h-7" />}</span>
            <p className="font-black text-lg">ビブスの持ち帰り</p>
            <p className="text-sm text-gray-500">{dateLabel(ev.date)} {ev.title}</p>
          </>
        )}
      </div>
      <div className="px-4 pb-6 space-y-3 text-sm">
        <div className="rounded-xl border divide-y">
          {colors.map((c) => {
            const who = takes.filter((t) => t.colorId === c.id);
            const meToo = myKid && who.some((t) => t.studentId === myKid.id);
            return (
              <div key={c.id} className="flex items-center gap-2.5 p-3">
                <Sw hex={c.hex} /><b className="w-20 shrink-0 truncate">{c.name}</b>
                <span className={`flex-1 min-w-0 truncate ${who.length ? 'text-gray-700' : c.other ? 'text-gray-400' : 'text-amber-700 font-bold'}`}>{who.length ? who.map((t) => `${kidName(students[t.studentId])}の家族`).join('、') : c.other ? 'なし' : 'まだ誰も'}</span>
                {meToo && <button onClick={() => remove(c)} className="text-[11px] text-red-600 font-bold shrink-0">取り消す</button>}
              </div>
            );
          })}
        </div>
        {myKid && colors.some((c) => !takes.some((t) => t.colorId === c.id && t.studentId === myKid.id)) && (
          <>
            <p className="text-xs text-gray-500">持ち帰った色を押すと記録できます（いくつでも。色が分からない残りは「その他」）</p>
            <div className="flex gap-1.5 flex-wrap">
              {colors.filter((c) => !takes.some((t) => t.colorId === c.id && t.studentId === myKid.id)).map((c) => (
                <Press key={c.id} onClick={() => add(c)} className={`px-3 py-1.5 rounded-full text-xs font-bold ${isLightHex(c.hex) ? 'text-gray-900' : 'text-white'}`} style={{ background: c.hex }}>＋ {c.name}</Press>
              ))}
            </div>
          </>
        )}
        <div className="flex gap-2">
          <Press onClick={onDone} className="flex-1 border border-gray-200 text-gray-700 rounded-xl py-3 font-bold">閉じる</Press>
          <Press onClick={() => actions.close()} className="flex-1 bg-emerald-600 text-white rounded-xl py-3 font-bold">LINEに戻る</Press>
        </div>
      </div>
    </div>
  );
}

// 担当の人の画面：全体LINEに聞くカードを送る（まちさかマネージャーからのお知らせのボタン ?bibs=予定のID で開く）
export function BibsSend({ ctx, eventId, onDone }) {
  const { data, actions } = ctx;
  const toast = useToast();
  const ev = data.events.find((e) => e.id === eventId) || currentPractice(data.events);
  const colors = bibColors(data);
  const asked = ev && (data.bibAsks || []).find((a) => a.id === ev.id);
  if (!ev) return <p className="p-6 text-center text-sm text-gray-500">聞く練習がありません</p>;
  const send = async () => {
    try {
      const r = await actions.share('bibs', (url) => bibsFlex(ev, colors, url), { eventId: ev.id });
      if (r) { await actions.markBibsAsked(ev.id); toast('全体LINEで聞きました'); onDone(); }
    } catch (e) { toast('送れませんでした', e.message); }
  };
  return (
    <div className="p-4 space-y-4">
      <div><p className="text-[11px] font-bold text-emerald-600">練習おつかれさまでした</p><h2 className="text-lg font-black">ビブスの持ち帰りを全体LINEで聞く</h2><p className="text-sm text-gray-500 mt-1">下のカードが、あなたの名前で届きます。送り先に全体LINEを選んでください。</p></div>
      {asked && <p className="bg-amber-50 text-amber-800 rounded-xl px-3 py-2 text-sm"><b>{asked.by}さんが送りました</b>（{new Date(asked.at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}）。もう一度送らなくて大丈夫です。</p>}
      <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-4 space-y-2">
        <p className="text-[11px] font-bold text-emerald-600">ビブスの持ち帰り</p>
        <p className="font-bold">{dateLabel(ev.date)} {ev.title}</p>
        <p className="text-[13px] text-gray-600">持ち帰った方は、色を押してください（いくつでも）。色が分からない残りは「その他」</p>
        <div className="grid grid-cols-2 gap-1.5 text-sm font-bold text-center">
          {colors.map((c) => <span key={c.id} className={`rounded-lg py-2.5 ${isLightHex(c.hex) ? 'text-gray-900' : 'text-white'}`} style={{ background: c.hex }}>{c.name}</span>)}
        </div>
        <p className="text-center text-xs font-bold text-emerald-700 pt-1">持ち帰り状況を見る・変える</p>
      </div>
      <Press onClick={send} className={`w-full flex items-center justify-center gap-2 rounded-xl py-3.5 font-bold ${asked ? 'border border-gray-200 text-gray-700' : 'bg-[#06c755] text-white'}`}><Send className="w-4 h-4" />{asked ? 'それでも送る' : '全体LINEで聞く'}</Press>
    </div>
  );
}

// 管理タブ：ビブスの色・聞く担当・自動で聞くか
const PALETTE = ['#facc15', '#ec4899', '#f97316', '#2563eb', '#16a34a', '#dc2626', '#7c3aed', '#0ea5e9', '#84cc16', '#ffffff', '#111827', '#9ca3af'];
export function BibsSettings({ ctx, onAsk }) {
  const toast = useToast();
  const cur = bibsSettings(ctx.data);
  const [colors, setColors] = useState(cur.colors);
  const members = (ctx.data.members || []).filter((m) => (m.roles || []).some((r) => r === 'coach' || r === 'admin')).sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '', 'ja'));
  const save = (fields, msg) => ctx.actions.saveBibsSettings(fields).then(() => msg && toast(msg));
  const setName = (i, name) => setColors((cs) => cs.map((c, j) => (j === i ? { ...c, name } : c)));
  const saveColors = (cs) => { setColors(cs); save({ colors: cs.filter((c) => c.name.trim()) }, '色を保存しました'); };
  const toggleAsker = (uid) => save({ askers: cur.askers.includes(uid) ? cur.askers.filter((x) => x !== uid) : [...cur.askers, uid] });
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3 text-sm">
      <div><b>ビブスの設定</b><p className="text-xs text-gray-500 mt-0.5">買い足したり捨てたりしたら、ここで色を直してください。色が分からない残りのビブス用に「その他」がいつも最後に出ます。</p></div>
      <div className="rounded-xl border divide-y">
        {colors.map((c, i) => (
          <div key={c.id} className="flex items-center gap-2.5 p-2">
            <span className="w-6 h-6 rounded-md border border-gray-200 shrink-0" style={{ background: c.hex }} />
            <input className="flex-1 min-w-0 bg-transparent outline-none text-base" value={c.name} onChange={(e) => setName(i, e.target.value)} onBlur={() => saveColors(colors)} aria-label="色の名前" />
            <button onClick={() => saveColors(colors.filter((_, j) => j !== i))} aria-label={`${c.name}を消す`} className="text-gray-400 p-1"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-1.5">色を足す（押すと追加。名前はあとで直せます）</p>
        <div className="flex flex-wrap gap-1.5">
          {PALETTE.map((hex) => <button key={hex} type="button" aria-label="色を足す" onClick={() => saveColors([...colors, { id: `c${Date.now().toString(36)}`, name: '新しい色', hex }])} className="w-8 h-8 rounded-md border border-gray-200 grid place-items-center" style={{ background: hex }}><Plus className={`w-4 h-4 ${isLightHex(hex) ? 'text-gray-700' : 'text-white'}`} /></button>)}
        </div>
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-1.5">聞く担当（コーチ・管理者から、何人でも）</p>
        <div className="flex flex-wrap gap-1.5 text-xs font-bold">
          {members.map((m) => {
            const on = cur.askers.includes(m.id);
            return <button key={m.id} type="button" onClick={() => toggleAsker(m.id)} className={`flex items-center gap-1 rounded-full px-3 py-1.5 ${on ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{on && <Check className="w-3.5 h-3.5" />}{m.displayName}</button>;
          })}
          {!members.length && <p className="text-gray-400 font-normal">役割でコーチを付けると、ここに出ます</p>}
        </div>
      </div>
      <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={cur.auto} onChange={(e) => save({ auto: e.target.checked })} /><span><span className="font-bold">練習の1時間後に、担当の人へお知らせする</span><span className="block text-xs text-gray-500">まちさかマネージャーから1対1で届きます（担当の人の数だけ通数を使います）。担当の人は友だち追加が必要です</span></span></label>
      <Press onClick={onAsk} className="w-full border border-emerald-200 text-emerald-700 rounded-xl py-2.5 font-bold">いまの練習のビブスを聞く</Press>
    </section>
  );
}
