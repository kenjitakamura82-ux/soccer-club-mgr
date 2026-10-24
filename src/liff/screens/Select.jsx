import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Send } from 'lucide-react';
import { Press, Avatar, useToast, spring } from '../ui.jsx';
import { upcomingEvents, needsRide, dateLabel, jersey, selectionOf, selectionFlex } from '../util.js';

// 選抜担当の画面。選抜ありの試合で、参加と答えた子の中から出る子を選んで確定し、全体LINEに知らせる（2026-10-25 ユーザー決定）。
// 並べるのは「選抜あり」の試合だけ（選抜なしは出さない。2026-10-25 ユーザー決定）。選抜ありは予定の追加・修正画面で付ける
export default function Select({ ctx }) {
  const events = upcomingEvents(ctx.data.events, 42).filter((e) => needsRide(e) && e.selection);
  const [eventId, setEventId] = useState(events[0]?.id);
  const event = events.find((e) => e.id === eventId) || events[0];
  if (!event) return <p className="text-center text-sm text-gray-400 py-16 px-6">選抜ありの試合はありません。予定の追加・修正画面で「選抜：あり」にすると、ここに出ます。</p>;
  return (
    <div className="p-3 space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3 [scrollbar-width:none]">
        {events.map((e) => (
          <Press key={e.id} onClick={() => setEventId(e.id)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold border ${e.id === event.id ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-200'}`}>
            {dateLabel(e.date)} {e.title}{selectionOf(ctx.data, e.id) ? '・確定' : ''}
          </Press>
        ))}
      </div>
      <Panel key={event.id} ctx={ctx} event={event} />
    </div>
  );
}

function Panel({ ctx, event }) {
  const { data, students, photos, actions, myName } = ctx;
  const toast = useToast();
  const sel = selectionOf(data, event.id);
  const attendingIds = data.attendances.filter((a) => a.eventId === event.id && a.status === '参加').map((a) => a.studentId);
  const kids = [...new Set([...attendingIds, ...(sel?.studentIds || [])])].map((id) => students[id]).filter(Boolean).sort((a, b) => jersey(a) - jersey(b));
  const [picked, setPicked] = useState(() => new Set(sel?.studentIds || attendingIds));
  const [saving, setSaving] = useState(false);
  const toggle = (id) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const dirty = !sel || sel.studentIds.length !== picked.size || sel.studentIds.some((id) => !picked.has(id));

  const setFlag = async (on) => {
    await actions.saveEvent({ id: event.id, selection: on });
    toast(on ? '選抜ありにしました' : '選抜なしにしました', on ? '出る子を選んで確定してください' : '参加の子全員で配車を組みます。この画面からは消えます');
  };
  const share = async (ids) => {
    try {
      const names = ids.map((id) => students[id]).filter(Boolean).sort((a, b) => jersey(a) - jersey(b)).map((s) => s.childName);
      const r = await actions.shareTargetPicker([selectionFlex(event, names, actions.liffUrl())]);
      if (r) toast('選抜メンバーを知らせました');
    } catch (e) { toast('送れませんでした', e.message); }
  };
  const confirm = async () => {
    if (!picked.size) return toast('1人以上選んでください');
    setSaving(true);
    try {
      const ids = kids.map((s) => s.id).filter((id) => picked.has(id));
      await actions.saveSelection(event.id, ids, myName);
      toast('選抜を確定しました', '選ばれた子の家族に配車の希望の欄が出ます');
    } catch (e) { console.error(e); toast('保存できませんでした'); }
    setSaving(false);
  };

  return (
    <div className="space-y-3">
      <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-sm">
        <div className="flex items-baseline gap-2">
          <h3 className="font-bold flex-1">出る子を選ぶ</h3>
          <span className="text-xs text-gray-500 tabular-nums">参加 {attendingIds.length}人中 {picked.size}人</span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5 mb-3">押すと選ぶ・外すが切り替わります。参加と答えた子が出ています。</p>
        {!kids.length && <p className="text-gray-400 text-center py-6">まだ参加と答えた子がいません</p>}
        <div className="grid grid-cols-4 gap-2">
          {kids.map((s) => {
            const on = picked.has(s.id);
            const left = !attendingIds.includes(s.id);
            return (
              <button key={s.id} type="button" onClick={() => toggle(s.id)} aria-pressed={on} className={`relative flex flex-col items-center gap-1 rounded-xl p-2 border-2 transition-colors ${on ? 'border-emerald-600 bg-emerald-50' : 'border-gray-100 bg-white opacity-60'}`}>
                <Avatar student={s} photo={photos[s.id]} size={40} />
                <span className="text-[11px] font-bold truncate w-full text-center">{s.childName}</span>
                {left && <span className="text-[10px] text-amber-700">欠席に変更</span>}
                <AnimatePresence>{on && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={spring} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-emerald-600 text-white grid place-items-center"><Check className="w-3.5 h-3.5" /></motion.span>}</AnimatePresence>
              </button>
            );
          })}
        </div>
      </section>

      {sel && <p className="text-xs text-gray-500 px-1">{new Date(sel.confirmedAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} に{sel.confirmedBy}さんが確定（{sel.studentIds.length}人）</p>}
      {(dirty || !sel) && <Press onClick={confirm} disabled={saving} className="w-full bg-emerald-600 text-white rounded-xl py-3 font-bold disabled:opacity-60">{saving ? '保存中…' : sel ? '選び直して確定する' : `${picked.size}人で確定する`}</Press>}
      {sel && !dirty && <Press onClick={() => share(sel.studentIds)} className="w-full flex items-center justify-center gap-2 bg-[#06c755] text-white rounded-xl py-3 font-bold"><Send className="w-4 h-4" />全体LINEに知らせる</Press>}
      <p className="text-xs text-gray-500 px-1">確定すると、選ばれた子の一覧が予定の詳細に出て、選ばれた子の家族にだけ配車の希望の欄が出ます。配車担当は選ばれた子だけで配車を組みます。</p>
      <button onClick={() => setFlag(false)} className="w-full text-sm text-gray-500 py-2">この試合を選抜なしに戻す</button>
    </div>
  );
}
