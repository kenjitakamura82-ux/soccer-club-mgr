import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Info, Map, MapPin, Clock, Car, Users, FileText, Lock, CalendarClock, Plus, Pencil, Bell, X } from 'lucide-react';
import { Sheet, Press, Segmented, Stepper, Avatar, useToast, listVariants, itemVariants, spring } from '../ui.jsx';
import EventEditor from './EventEditor.jsx';
import { upcomingEvents, md, dateLabel, timeLabel, isCanceled, isKashiwanohaEs, kidName, deadlineOf, defaultDeadline, isClosed, canEditDeadline } from '../util.js';

const typeStyle = (e) => isCanceled(e) ? 'bg-gray-200 text-gray-500' : e.type === '試合' ? 'bg-orange-100 text-orange-700' : e.type === '練習' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600';

export default function Home({ ctx, open }) {
  const { data, myKid } = ctx;
  const events = upcomingEvents(data.events);
  const att = (eid) => data.attendances.find((a) => a.eventId === eid && a.studentId === myKid?.id)?.status;
  const unanswered = myKid ? events.filter((e) => !isCanceled(e) && !isClosed(e) && !att(e.id)).length : 0;
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const selectedEvent = data.events.find((e) => e.id === selected);
  const editor = canEditDeadline(ctx.has);

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 px-3 pt-3">
        <Press onClick={() => open('welcome')} className="flex items-center justify-center gap-1.5 bg-white border border-gray-200 rounded-xl py-2 text-[13px] font-bold text-emerald-700"><Info className="w-4 h-4" />はじめての方へ</Press>
        <Press onClick={() => open('venue')} className="flex items-center justify-center gap-1.5 bg-white border border-gray-200 rounded-xl py-2 text-[13px] font-bold text-emerald-700"><Map className="w-4 h-4" />練習場の使い方</Press>
      </div>

      {myKid && <FriendBanner ctx={ctx} />}

      {myKid && (
        <motion.p layout className={`mx-3 mt-3 text-[13px] rounded-xl px-3 py-2 font-bold ${unanswered ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {unanswered ? `未回答の予定が ${unanswered} 件あります` : '受付中の予定は全部回答済み'}
        </motion.p>
      )}

      {events.length === 0 && <p className="text-center text-sm text-gray-400 py-16">この先6週間の予定はまだありません</p>}

      <motion.ul className="p-3 space-y-3" variants={listVariants} initial="hidden" animate="show">
        {events.map((e) => <EventCard key={e.id} e={e} ctx={ctx} status={att(e.id)} onOpen={() => setSelected(e.id)} />)}
      </motion.ul>

      <Sheet open={!!selectedEvent} onClose={() => setSelected(null)} title={selectedEvent && `${dateLabel(selectedEvent.date)} ${selectedEvent.title}`}>
        {selectedEvent && <EventDetail e={selectedEvent} ctx={ctx} open={open} onEdit={() => { setEditing(selectedEvent); setSelected(null); }} />}
      </Sheet>

      {editor && (
        <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring} whileTap={{ scale: 0.9 }} onClick={() => setEditing('new')}
          className="fixed right-4 z-20 bg-emerald-600 text-white rounded-full shadow-lg pl-3 pr-4 py-3 font-bold text-sm flex items-center gap-1"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 76px)' }}>
          <Plus className="w-5 h-5" />予定を追加
        </motion.button>
      )}
      {editor && <EventEditor ctx={ctx} open={!!editing} event={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

// 公式アカウントを友だち追加していない人に、試合の個別リマインドが届くように案内する
function FriendBanner({ ctx }) {
  const url = ctx.actions.addFriendUrl();
  const [friend, setFriend] = useState(true);
  const [closed, setClosed] = useState(() => { try { return localStorage.getItem('friendBannerClosed') === '1'; } catch { return false; } });
  useEffect(() => { if (url) ctx.actions.getFriendship().then((f) => setFriend(f !== false)); }, [ctx.actions, url]);
  const close = () => { setClosed(true); try { localStorage.setItem('friendBannerClosed', '1'); } catch { /* 保存できなくても閉じるだけ */ } };
  return (
    <AnimatePresence>
      {url && !friend && !closed && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={spring} className="overflow-hidden">
          <div className="mx-3 mt-3 rounded-xl bg-sky-50 border border-sky-100 p-3 flex gap-2 items-start text-[13px] text-sky-900">
            <Bell className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p>公式アカウントを友だち追加すると、試合の出欠や配車の回答を忘れていたときに、締切前にお知らせが届きます。</p>
              <Press onClick={() => ctx.actions.openUrl(url)} className="mt-2 bg-[#06c755] text-white rounded-lg px-3 py-1.5 text-xs font-bold">友だち追加する</Press>
            </div>
            <button onClick={close} aria-label="閉じる" className="text-sky-700"><X className="w-4 h-4" /></button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function EventCard({ e, ctx, status, onOpen }) {
  const { myKid } = ctx;
  const d = md(e.date);
  const canceled = isCanceled(e);
  return (
    <motion.li variants={itemVariants} className={`bg-white rounded-2xl p-3 shadow-sm border border-gray-100 grid grid-cols-[44px_1fr] gap-3 ${canceled ? 'opacity-60' : ''}`}>
      <button onClick={onOpen} className="text-center border-r border-gray-100 pr-2">
        <p className="text-[11px] text-gray-500">{d.m}月</p><p className="text-2xl font-black tabular-nums leading-tight">{d.d}</p><p className="text-[11px] text-gray-500">({d.w})</p>
      </button>
      <div className="min-w-0">
        <div className="flex items-start gap-2">
          <button onClick={onOpen} className="flex-1 min-w-0 text-left">
            <span className="flex items-center gap-1.5">
              <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded shrink-0 ${typeStyle(e)}`}>{e.type || 'その他'}</span>
              <span className={`font-bold truncate ${canceled ? 'line-through' : ''}`}>{e.title}</span>
            </span>
            <span className="block text-xs text-gray-500 mt-1 truncate">{[timeLabel(e), e.location].filter(Boolean).join(' ・ ') || '詳細を見る'}</span>
          </button>
          {myKid && !canceled && <AttendSwitch e={e} ctx={ctx} status={status} />}
        </div>
        {myKid && !canceled && <DeadlineNote e={e} status={status} />}
      </div>
    </motion.li>
  );
}

function DeadlineNote({ e, status }) {
  const closed = isClosed(e);
  return (
    <p className={`mt-1.5 text-[11px] flex items-center gap-1 ${closed ? 'text-gray-400' : status ? 'text-gray-400' : 'text-amber-600 font-bold'}`}>
      {closed ? <><Lock className="w-3 h-3" />締切済み。変えるときはコーチに連絡してください</> : <>{status ? '回答済み' : '未回答'} ・ 締切 {dateLabel(deadlineOf(e))}</>}
    </p>
  );
}

/* 右端の小さな2択。初回は1回で回答、変えるときだけ確認を挟む。締切後は変えられない */
function AttendSwitch({ e, ctx, status, wide }) {
  const toast = useToast();
  const [confirm, setConfirm] = useState(null);
  const closed = isClosed(e);
  const plan = ctx.data.ridePlans?.find((p) => p.id === e.id);

  const save = async (s) => {
    setConfirm(null);
    try {
      await ctx.actions.saveAttendance(e.id, ctx.myKid.id, s, ctx.myName);
      toast(`「${s}」で回答しました`, plan ? '配車担当の画面に変更の印が付きます' : 'グループには表示されません');
    } catch (err) { console.error(err); toast('保存できませんでした', '電波の良いところでもう一度'); }
  };
  const tap = (s) => {
    if (closed || s === status) return;
    if (!status) return save(s);
    setConfirm(s);
  };

  return (
    <div className={wide ? 'w-full' : 'shrink-0 relative'}>
      <div className={`relative grid grid-cols-2 bg-gray-100 rounded-full p-0.5 ${wide ? 'w-full' : ''} ${closed ? 'opacity-60' : ''}`}>
        {status && (
          <motion.span layout transition={spring} className={`absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-full ${status === '参加' ? 'bg-emerald-600 left-0.5' : 'bg-gray-500 right-0.5'}`} />
        )}
        {['参加', '欠席'].map((s) => (
          <motion.button key={s} whileTap={closed ? undefined : { scale: 0.92 }} onClick={() => tap(s)} disabled={closed} aria-pressed={status === s}
            className={`relative z-[1] rounded-full font-bold transition-colors ${wide ? 'py-2.5 text-sm' : 'px-3 py-1.5 text-xs'} ${status === s ? 'text-white' : 'text-gray-500'}`}>{s}</motion.button>
        ))}
      </div>
      <AnimatePresence>
        {confirm && (
          <motion.div
            initial={wide ? { height: 0, opacity: 0 } : { opacity: 0, y: -6, scale: 0.95 }}
            animate={wide ? { height: 'auto', opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={wide ? { height: 0, opacity: 0 } : { opacity: 0, y: -6, scale: 0.95 }}
            transition={spring}
            className={wide ? 'overflow-hidden' : 'absolute right-0 top-full z-20 w-60 origin-top-right'}>
            <div className={`mt-2 rounded-xl bg-amber-50 p-2.5 text-xs text-amber-800 ${wide ? '' : 'shadow-lg border border-amber-200'}`}>
              <p className="font-bold">「{confirm}」に変えますか？</p>
              {plan && <p className="mt-0.5">配車が確定済みです。変えると配車担当の画面に印が付きます。</p>}
              <div className="flex gap-2 mt-2">
                <Press onClick={() => save(confirm)} className="flex-1 bg-amber-600 text-white rounded-lg py-1.5 font-bold">変える</Press>
                <Press onClick={() => setConfirm(null)} className="flex-1 bg-white border border-amber-200 rounded-lg py-1.5 font-bold">やめる</Press>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DeadlineEditor({ e, ctx }) {
  const toast = useToast();
  const [value, setValue] = useState(deadlineOf(e));
  const changed = value !== deadlineOf(e);
  const save = async (v) => {
    await ctx.actions.saveDeadline(e.id, v);
    toast('締切を変えました', `${dateLabel(v)} まで`);
  };
  return (
    <section className="bg-gray-50 rounded-2xl p-3 space-y-2">
      <h4 className="font-bold text-xs text-gray-500 flex items-center gap-1"><CalendarClock className="w-4 h-4" />出欠の締切（コーチ用）</h4>
      <div className="flex gap-2 items-center">
        <input type="date" value={value} max={e.date} onChange={(ev) => setValue(ev.target.value)} className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-base bg-white" />
        <Press onClick={() => save(value)} disabled={!changed} className="bg-emerald-600 text-white rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-40">保存</Press>
      </div>
      <p className="text-[11px] text-gray-500">
        初期値は{e.type === '試合' ? '試合の2週間前' : '3日前'}（{dateLabel(defaultDeadline(e))}）。
        {e.answerDeadline && <button onClick={() => { setValue(defaultDeadline(e)); save(defaultDeadline(e)); }} className="ml-1 text-blue-600 underline">初期値に戻す</button>}
      </p>
    </section>
  );
}

function EventDetail({ e, ctx, open, onEdit }) {
  const { data, myKid, students, photos, has } = ctx;
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
          <AttendSwitch e={e} ctx={ctx} status={status} wide />
          <DeadlineNote e={e} status={status} />
        </section>
      )}

      {canEditDeadline(has) && (
        <Press onClick={onEdit} className="w-full flex items-center justify-center gap-1.5 border border-gray-200 rounded-xl py-2.5 text-sm font-bold text-gray-700 bg-white"><Pencil className="w-4 h-4" />予定を直す・中止にする</Press>
      )}
      {!isCanceled(e) && canEditDeadline(has) && <DeadlineEditor key={deadlineOf(e)} e={e} ctx={ctx} />}

      {plan && (
        <section className="bg-emerald-50 rounded-2xl p-3">
          <h4 className="font-bold text-xs text-emerald-700 flex items-center gap-1 mb-1"><Car className="w-4 h-4" />配車（確定）</h4>
          {myCar
            ? <p>{myCar.driver === myKid.id ? `あなたの車：${myCar.passengers.map((p) => kidName(students[p])).join('、') || '同乗なし'}` : `${kidName(students[myCar.driver])}家の車（${myCar.area}）に乗ります`}</p>
            : <p className="text-gray-600">配車表が共有されています</p>}
        </section>
      )}

      {myKid && status === '参加' && !isCanceled(e) && !isClosed(e) && <RideForm e={e} ctx={ctx} />}

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
