import { useState } from 'react';
import { motion } from 'motion/react';
import { Info, Map, MapPin, Clock, Car, Users, FileText } from 'lucide-react';
import { Sheet, Press, Segmented, Stepper, Avatar, useToast, listVariants, itemVariants, spring } from '../ui.jsx';
import { upcomingEvents, md, dateLabel, timeLabel, isCanceled, isKashiwanohaEs, kidName } from '../util.js';

const typeStyle = (e) => isCanceled(e) ? 'bg-gray-200 text-gray-500' : e.type === '試合' ? 'bg-orange-100 text-orange-700' : e.type === '練習' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600';

export default function Home({ ctx, open }) {
  const { data, myKid } = ctx;
  const events = upcomingEvents(data.events);
  const att = (eid) => data.attendances.find((a) => a.eventId === eid && a.studentId === myKid?.id)?.status;
  const unanswered = myKid ? events.filter((e) => !isCanceled(e) && !att(e.id)).length : 0;
  const [selected, setSelected] = useState(null);
  const selectedEvent = data.events.find((e) => e.id === selected);

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 px-3 pt-3">
        <Press onClick={() => open('welcome')} className="flex items-center justify-center gap-1.5 bg-white border border-gray-200 rounded-xl py-2 text-[13px] font-bold text-emerald-700"><Info className="w-4 h-4" />はじめての方へ</Press>
        <Press onClick={() => open('venue')} className="flex items-center justify-center gap-1.5 bg-white border border-gray-200 rounded-xl py-2 text-[13px] font-bold text-emerald-700"><Map className="w-4 h-4" />練習場の使い方</Press>
      </div>

      {myKid && (
        <motion.p layout className={`mx-3 mt-3 text-[13px] rounded-xl px-3 py-2 font-bold ${unanswered ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {unanswered ? `未回答の予定が ${unanswered} 件あります` : '全部回答済み'}
        </motion.p>
      )}

      {events.length === 0 && <p className="text-center text-sm text-gray-400 py-16">この先6週間の予定はまだありません</p>}

      <motion.ul className="p-3 space-y-3" variants={listVariants} initial="hidden" animate="show">
        {events.map((e) => <EventCard key={e.id} e={e} ctx={ctx} status={att(e.id)} onOpen={() => setSelected(e.id)} />)}
      </motion.ul>

      <Sheet open={!!selectedEvent} onClose={() => setSelected(null)} title={selectedEvent && `${dateLabel(selectedEvent.date)} ${selectedEvent.title}`}>
        {selectedEvent && <EventDetail e={selectedEvent} ctx={ctx} open={open} />}
      </Sheet>
    </div>
  );
}

function EventCard({ e, ctx, status, onOpen }) {
  const { data, myKid } = ctx;
  const d = md(e.date);
  const canceled = isCanceled(e);
  const counts = (s) => data.attendances.filter((a) => a.eventId === e.id && a.status === s).length;
  return (
    <motion.li variants={itemVariants} className={`bg-white rounded-2xl p-3 shadow-sm border border-gray-100 grid grid-cols-[48px_1fr] gap-3 ${canceled ? 'opacity-60' : ''}`}>
      <div className="text-center border-r border-gray-100 pr-2">
        <p className="text-[11px] text-gray-500">{d.m}月</p><p className="text-2xl font-black tabular-nums leading-tight">{d.d}</p><p className="text-[11px] text-gray-500">({d.w})</p>
      </div>
      <div className="min-w-0">
        <button onClick={onOpen} className="w-full text-left flex items-center gap-2">
          <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${typeStyle(e)}`}>{e.type || 'その他'}</span>
          <span className={`font-bold truncate flex-1 ${canceled ? 'line-through' : ''}`}>{e.title}</span>
          {myKid && !canceled && <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded shrink-0 ${status ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{status ? '回答済み' : '未回答'}</span>}
        </button>
        <button onClick={onOpen} className="block w-full text-left text-xs text-gray-500 mt-1 mb-2 truncate">{[timeLabel(e), e.location].filter(Boolean).join(' ・ ') || '詳細を見る'}</button>
        {!canceled && (myKid
          ? <AttendButtons e={e} ctx={ctx} status={status} />
          : <p className="text-xs text-gray-500 flex gap-3"><span>参加 <b className="text-gray-800">{counts('参加')}</b></span><span>欠席 <b className="text-gray-800">{counts('欠席')}</b></span></p>)}
      </div>
    </motion.li>
  );
}

function AttendButtons({ e, ctx, status }) {
  const toast = useToast();
  const save = async (s) => {
    try {
      await ctx.actions.saveAttendance(e.id, ctx.myKid.id, s, ctx.myName);
      toast(`「${s}」で回答しました`, 'グループには表示されません');
    } catch (err) { console.error(err); toast('保存できませんでした', '電波の良いところでもう一度'); }
  };
  return (
    <div className="grid grid-cols-2 gap-2">
      {['参加', '欠席'].map((s) => {
        const on = status === s;
        const color = s === '参加' ? 'bg-emerald-600 border-emerald-600' : 'bg-gray-500 border-gray-500';
        return (
          <Press key={s} onClick={() => save(s)} className={`relative overflow-hidden rounded-xl border-2 py-2 font-bold text-sm ${on ? 'text-white' : s === '参加' ? 'border-emerald-600 text-emerald-700 bg-white' : 'border-gray-200 text-gray-500 bg-white'}`}>
            <motion.span className={`absolute inset-0 origin-left ${color}`} initial={false} animate={{ scaleX: on ? 1 : 0 }} transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }} />
            <span className="relative">{s}</span>
          </Press>
        );
      })}
    </div>
  );
}

function EventDetail({ e, ctx, open }) {
  const { data, myKid, students, photos } = ctx;
  const status = myKid && data.attendances.find((a) => a.eventId === e.id && a.studentId === myKid.id)?.status;
  const attending = data.attendances.filter((a) => a.eventId === e.id && a.status === '参加').map((a) => students[a.studentId]).filter(Boolean);
  const plan = data.ridePlans?.find((p) => p.id === e.id);
  const myCar = plan && myKid && plan.cars.find((c) => c.driver === myKid.id || c.passengers.includes(myKid.id));

  return (
    <div className="space-y-4 text-sm">
      <div className="space-y-2 text-gray-700">
        {timeLabel(e) && <p className="flex gap-2"><Clock className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />{timeLabel(e)}</p>}
        {e.location && (
          <p className="flex gap-2"><MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
            <span>{e.location}{isKashiwanohaEs(e) && <button onClick={() => open('venue')} className="ml-2 text-blue-600 underline text-xs">使い方</button>}</span>
          </p>
        )}
        {e.memo && <p className="flex gap-2 whitespace-pre-wrap"><FileText className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />{e.memo}</p>}
      </div>

      {myKid && !isCanceled(e) && (
        <section className="bg-gray-50 rounded-2xl p-3 space-y-2">
          <h4 className="font-bold text-xs text-gray-500">出欠（{myKid.childName}）</h4>
          <AttendButtons e={e} ctx={ctx} status={status} />
        </section>
      )}

      {plan && (
        <section className="bg-emerald-50 rounded-2xl p-3">
          <h4 className="font-bold text-xs text-emerald-700 flex items-center gap-1 mb-1"><Car className="w-4 h-4" />配車（確定）</h4>
          {myCar
            ? <p>{myCar.driver === myKid.id ? `あなたの車：${myCar.passengers.map((p) => kidName(students[p])).join('、') || '同乗なし'}` : `${kidName(students[myCar.driver])}家の車（${myCar.area}）に乗ります`}</p>
            : <p className="text-gray-600">配車表が共有されています</p>}
        </section>
      )}

      {myKid && status === '参加' && !isCanceled(e) && <RideForm e={e} ctx={ctx} />}

      <section>
        <h4 className="font-bold text-xs text-gray-500 flex items-center gap-1 mb-2"><Users className="w-4 h-4" />参加する子（{attending.length}人）</h4>
        <div className="flex flex-wrap gap-3">
          {attending.map((s) => <span key={s.id} className="flex flex-col items-center gap-1 text-[11px] text-gray-600 w-12"><Avatar student={s} photo={photos[s.id]} size={40} /><span className="truncate w-full text-center">{s.childName}</span></span>)}
          {!attending.length && <p className="text-gray-400 text-xs">まだいません</p>}
        </div>
      </section>
    </div>
  );
}

function RideForm({ e, ctx }) {
  const toast = useToast();
  const current = ctx.data.rides.find((r) => r.eventId === e.id && r.studentId === ctx.myKid.id) || {};
  const [role, setRole] = useState(current.role || 'none');
  const [capacity, setCapacity] = useState(current.capacity || 3);
  const [count, setCount] = useState(current.count || 1);
  const [area, setArea] = useState(current.area || '柏の葉');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const ride = { role, area, ...(role === 'driver' ? { capacity } : role === 'rider' ? { count, type: 'child_only' } : {}) };
    try { await ctx.actions.saveRide(e.id, ctx.myKid.id, ride, ctx.myName); toast('配車の希望を保存しました', '配車担当にだけ届きます'); }
    catch (err) { console.error(err); toast('保存できませんでした'); }
    setSaving(false);
  };

  return (
    <section className="bg-gray-50 rounded-2xl p-3 space-y-3">
      <h4 className="font-bold text-xs text-gray-500 flex items-center gap-1"><Car className="w-4 h-4" />配車の希望</h4>
      <Segmented id={`ride-${e.id}`} value={role} onChange={setRole} options={[{ value: 'driver', label: '車を出せる' }, { value: 'rider', label: '乗せてほしい' }, { value: 'none', label: '不要' }]} />
      <motion.div layout transition={spring} className="space-y-3 overflow-hidden">
        {role === 'driver' && <div><p className="text-xs text-gray-500 mb-2">子どもを何人乗せられる？</p><Stepper value={capacity} onChange={setCapacity} min={1} max={6} /></div>}
        {role === 'rider' && <div><p className="text-xs text-gray-500 mb-2">乗せてほしい人数</p><Stepper value={count} onChange={setCount} min={1} max={4} /></div>}
        {role !== 'none' && (
          <div><p className="text-xs text-gray-500 mb-2">{role === 'driver' ? '出発する場所' : '乗る場所'}</p>
            <Segmented id={`area-${e.id}`} value={area} onChange={setArea} options={[{ value: '柏の葉', label: '柏の葉' }, { value: '柏たなか', label: '柏たなか' }]} />
          </div>
        )}
      </motion.div>
      <Press onClick={save} disabled={saving} className="w-full bg-gray-900 text-white rounded-xl py-3 font-bold disabled:opacity-60">{saving ? '保存中…' : '希望を保存'}</Press>
    </section>
  );
}
