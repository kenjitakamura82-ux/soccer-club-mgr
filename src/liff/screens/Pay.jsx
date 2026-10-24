import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Clock, Wallet, Plus, Send, Pencil } from 'lucide-react';
import { Press, Avatar, DrawCheck, Sheet, useShake, useToast, listVariants, itemVariants, spring } from '../ui.jsx';
import { dateLabel, jersey, isCanceled, todayJst, addDays, payFlex } from '../util.js';

const activePayments = (data) => data.payments
  .filter((p) => p.isActive)
  .map((p) => ({ ...p, event: data.events.find((e) => e.id === (p.eventId || p.id)) }))
  .filter((p) => p.event)
  .sort((a, b) => b.event.date.localeCompare(a.event.date));

const statusOf = (ps) => !ps || ps.status !== 'transferred' ? 'todo' : ps.isConfirmed ? 'done' : 'wait';

export function MyPay({ ctx }) {
  const { data, myKid, actions, myName } = ctx;
  const toast = useToast();
  const list = activePayments(data);
  if (!list.length) return <Empty />;
  return (
    <motion.div className="p-3 space-y-3" variants={listVariants} initial="hidden" animate="show">
      {list.map((p) => {
        const ps = data.paymentStatuses.find((x) => x.eventId === p.event.id && x.studentId === myKid.id);
        const st = statusOf(ps);
        return (
          <motion.section key={p.id} variants={itemVariants} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500">{dateLabel(p.event.date)} {p.event.title}</p>
            <p className="font-bold">{p.description || '集金'}</p>
            {p.amount && <p className="text-2xl font-black tabular-nums mt-1">¥{Number(p.amount).toLocaleString()}</p>}
            <div className="mt-3 min-h-[52px] grid place-items-center">
              <AnimatePresence mode="wait">
                <motion.div key={st} initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }} transition={spring} className="w-full grid place-items-center">
                  {st === 'todo' && <Press onClick={async () => { await actions.reportTransfer(p.event.id, myKid.id, myName); toast('会計に報告しました', '確認されると「確認済み」になります'); }} className="w-full bg-emerald-600 text-white rounded-xl py-3 font-bold">ことら送金した</Press>}
                  {st === 'wait' && <span className="inline-flex items-center gap-2 bg-amber-50 text-amber-700 rounded-full px-4 py-2 font-bold text-sm"><Clock className="w-4 h-4" />会計の確認待ち</span>}
                  {st === 'done' && <span className="inline-flex items-center gap-2 text-emerald-700 font-black"><DrawCheck size={36} />確認済み</span>}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.section>
        );
      })}
    </motion.div>
  );
}

// 集金を知らせるカードを全体LINEに送る（会計の人が送り先を選ぶ）
async function announce(ctx, toast, event, payment) {
  try {
    const r = await ctx.actions.shareTargetPicker([payFlex(event, payment, ctx.actions.liffUrl())]);
    if (r) toast('集金のお知らせを送りました');
  } catch (e) { toast('送れませんでした', e.message); }
}

export function PayAdmin({ ctx }) {
  const { data, students, photos, actions, myName } = ctx;
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const list = activePayments(data);
  return (
    <div className="p-3 space-y-4">
      <Press onClick={() => setEditing({})} className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-xl py-3 font-bold"><Plus className="w-4 h-4" />集金を設定する</Press>
      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing?.event ? '集金の設定を直す' : '集金を設定する'}>
        {editing && <PayForm key={editing.event?.id || 'new'} ctx={ctx} initial={editing} onDone={() => setEditing(null)} />}
      </Sheet>
      {!list.length && <Empty />}
      {list.map((p) => {
        const attending = new Set(data.attendances.filter((a) => a.eventId === p.event.id && a.status === '参加').map((a) => a.studentId));
        const statuses = data.paymentStatuses.filter((x) => x.eventId === p.event.id);
        statuses.forEach((s) => attending.add(s.studentId));
        const rows = [...attending].map((sid) => ({ sid, s: students[sid], ps: statuses.find((x) => x.studentId === sid) })).sort((a, b) => jersey(a.s) - jersey(b.s));
        const count = (k) => rows.filter((r) => statusOf(r.ps) === k).length;
        return (
          <section key={p.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500">{dateLabel(p.event.date)} {p.event.title}</p>
            <p className="font-bold">{p.description || '集金'}{p.amount ? ` ¥${Number(p.amount).toLocaleString()}` : ''}</p>
            <div className="flex gap-2 mt-2">
              <Press onClick={() => announce(ctx, toast, p.event, p)} className="flex-1 flex items-center justify-center gap-1.5 bg-[#06c755] text-white rounded-lg py-2 text-xs font-bold"><Send className="w-3.5 h-3.5" />全体LINEに知らせる</Press>
              <Press onClick={() => setEditing({ event: p.event, payment: p })} className="flex items-center justify-center gap-1.5 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold text-gray-700"><Pencil className="w-3.5 h-3.5" />直す</Press>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center my-3">
              {[['done', '確認済み'], ['wait', '確認待ち'], ['todo', '未報告']].map(([k, l]) => (
                <div key={k} className="bg-gray-50 rounded-xl py-2"><motion.b key={count(k)} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="block text-lg tabular-nums">{count(k)}</motion.b><span className="text-[11px] text-gray-500">{l}</span></div>
              ))}
            </div>
            <ul className="divide-y divide-gray-100">
              {rows.map(({ sid, s, ps }) => {
                const st = statusOf(ps);
                return (
                  <li key={sid} className="flex items-center gap-3 py-2 text-sm">
                    <Avatar student={s} photo={photos[sid]} size={30} />
                    <span className="flex-1 truncate">{s?.childName || ps?.responderName || '不明'}の家族</span>
                    {st === 'wait' && <Press onClick={async () => { await actions.confirmTransfer(ps.id, myName); toast('確認済みにしました'); }} className="bg-emerald-600 text-white rounded-lg px-2.5 py-1 text-xs font-bold">入金を確認した</Press>}
                    <span className={`text-[11px] font-bold rounded-full px-2 py-0.5 ${st === 'done' ? 'bg-emerald-50 text-emerald-700' : st === 'wait' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>{st === 'done' ? '確認済み' : st === 'wait' ? '確認待ち' : '未報告'}</span>
                  </li>
                );
              })}
            </ul>
            <p className="text-[11px] text-gray-400 mt-2">ことら送金の入金を銀行アプリで確かめてから押してください</p>
          </section>
        );
      })}
    </div>
  );
}

// 予定を選んで、内容と金額を入れる。保存したらそのまま全体LINEに知らせられる
function PayForm({ ctx, initial, onDone }) {
  const toast = useToast();
  const [scope, shake] = useShake();
  const t = todayJst();
  const from = addDays(t, -30), to = addDays(t, 60);
  const events = ctx.data.events.filter((e) => e.date && e.date >= from && e.date <= to && !isCanceled(e)).sort((a, b) => a.date.localeCompare(b.date));
  const [eventId, setEventId] = useState(initial.event?.id || '');
  const [description, setDescription] = useState(initial.payment?.description || '');
  const [amount, setAmount] = useState(initial.payment?.amount ? String(initial.payment.amount) : '');
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(null);
  const event = ctx.data.events.find((e) => e.id === eventId);
  const already = (id) => ctx.data.payments.find((p) => (p.eventId || p.id) === id && p.isActive);
  const input = 'w-full border border-gray-200 rounded-xl p-3 text-base bg-white outline-none focus:ring-2 focus:ring-emerald-500';

  const save = async () => {
    if (!event) { setErr('予定を選んでください'); return shake(); }
    if (!description.trim()) { setErr('何の集金か入れてください'); return shake(); }
    if (amount && !(Number(amount) > 0)) { setErr('金額は数字で入れてください'); return shake(); }
    const payment = { description: description.trim(), amount: amount ? Number(amount) : null, isActive: true };
    try {
      await ctx.actions.savePayment(event.id, payment, ctx.myName);
      toast('集金を設定しました', '保護者の「集金」タブに出ます');
      setSaved(payment);
    } catch (e) { console.error(e); setErr('保存できませんでした'); }
  };
  const stop = async () => {
    await ctx.actions.savePayment(event.id, { description, amount, isActive: false }, ctx.myName);
    toast('集金を止めました', '保護者の「集金」タブから消えます');
    onDone();
  };

  if (saved) return (
    <div className="space-y-3 text-center py-2">
      <DrawCheck size={48} />
      <p className="font-bold">{dateLabel(event.date)} {event.title} の集金を設定しました</p>
      <p className="text-sm text-gray-500">全体LINEに知らせますか？ 送り先を選ぶ画面が出ます。</p>
      <Press onClick={async () => { await announce(ctx, toast, event, saved); onDone(); }} className="w-full flex items-center justify-center gap-2 bg-[#06c755] text-white rounded-xl py-3 font-bold"><Send className="w-4 h-4" />全体LINEに知らせる</Press>
      <button onClick={onDone} className="w-full text-sm text-gray-500 py-2">あとで知らせる</button>
    </div>
  );

  return (
    <div className="space-y-3 text-sm">
      <div ref={scope} className="space-y-3">
        <label className="block"><span className="text-xs text-gray-500">どの予定の集金？</span>
          <select className={input} value={eventId} onChange={(e) => setEventId(e.target.value)} disabled={!!initial.event}>
            <option value="">予定を選ぶ</option>
            {events.map((e) => <option key={e.id} value={e.id}>{dateLabel(e.date)} {e.title}{already(e.id) && e.id !== initial.event?.id ? '（集金あり）' : ''}</option>)}
          </select>
        </label>
        <label className="block"><span className="text-xs text-gray-500">何の集金？</span><input className={input} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="例：大会の参加費、グラウンド代" /></label>
        <label className="block"><span className="text-xs text-gray-500">1人あたりの金額（円）</span><input className={input} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))} placeholder="例：500" /></label>
      </div>
      {event && already(event.id) && !initial.event && <p className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2">この予定にはもう集金があります。保存すると内容を書き換えます。</p>}
      <p className="text-xs text-gray-500">保存すると、保護者の「集金」タブに出ます。入金の確認はこの画面でします。</p>
      <AnimatePresence>{err && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-red-600 bg-red-50 rounded-xl px-3 py-2">{err}</motion.p>}</AnimatePresence>
      <Press onClick={save} className="w-full bg-emerald-600 text-white rounded-xl py-3 font-bold">保存</Press>
      {initial.event && <button onClick={stop} className="w-full text-sm text-red-600 py-2">この集金を止める</button>}
    </div>
  );
}

function Empty() {
  return <div className="text-center text-gray-400 py-16"><Wallet className="w-10 h-10 mx-auto mb-2 opacity-30" /><p className="text-sm">いま集金はありません</p></div>;
}
