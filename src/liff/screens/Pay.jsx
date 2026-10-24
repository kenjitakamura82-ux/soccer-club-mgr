import { AnimatePresence, motion } from 'motion/react';
import { Clock, Wallet } from 'lucide-react';
import { Press, Avatar, DrawCheck, useToast, listVariants, itemVariants, spring } from '../ui.jsx';
import { dateLabel, jersey } from '../util.js';

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

export function PayAdmin({ ctx }) {
  const { data, students, photos, actions, myName } = ctx;
  const toast = useToast();
  const list = activePayments(data);
  if (!list.length) return <Empty />;
  return (
    <div className="p-3 space-y-4">
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

function Empty() {
  return <div className="text-center text-gray-400 py-16"><Wallet className="w-10 h-10 mx-auto mb-2 opacity-30" /><p className="text-sm">いま集金はありません</p></div>;
}
