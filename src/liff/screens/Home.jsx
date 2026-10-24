import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Info, Map, MapPin, Clock, Car, Users, FileText, Lock, CalendarClock, Pencil, Bell, X, Paperclip } from 'lucide-react';
import { Sheet, Press, Segmented, Stepper, Avatar, useToast, listVariants, spring } from '../ui.jsx';
import EventEditor from './EventEditor.jsx';
import { upcomingEvents, md, groupLabel, dateLabel, timeLabel, startOf, needsRide, isCanceled, isKashiwanohaEs, kidName, deadlineOf, defaultDeadline, isClosed, canEditDeadline } from '../util.js';

// 日付の丸の色：練習＝緑、試合＝オレンジ、その他＝青、中止＝灰色
const typeStyle = (e) => isCanceled(e) ? 'bg-gray-200 text-gray-500' : e.type === '試合' ? 'bg-orange-100 text-orange-900' : e.type === '練習' ? 'bg-green-100 text-green-900' : 'bg-blue-100 text-blue-900';

export default function Home({ ctx, open }) {
  const { data, myKid } = ctx;
  const events = upcomingEvents(data.events);
  const att = (eid) => data.attendances.find((a) => a.eventId === eid && a.studentId === myKid?.id)?.status;
  const unanswered = myKid ? events.filter((e) => !isCanceled(e) && !isClosed(e) && !att(e.id)).length : 0;
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const selectedEvent = data.events.find((e) => e.id === selected);
  const editor = canEditDeadline(ctx.has);
  const groups = [];
  for (const e of events) {
    const g = groupLabel(e.date);
    if (groups.at(-1)?.[0] === g) groups.at(-1)[1].push(e); else groups.push([g, [e]]);
  }

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

      {/* Gmailの受信トレイ風：区切りの見出しごとに、角を丸めた白い行を詰めて並べる（2026-10-24 ユーザー決定） */}
      <div className="pb-3">
        {groups.map(([label, list]) => (
          <section key={label}>
            <h3 className="text-xs text-gray-500 px-4 pt-4 pb-1.5">{label}</h3>
            <motion.ul className="px-1.5 space-y-[3px]" variants={listVariants} initial="hidden" animate="show">
              {list.map((e, i) => <EventRow key={e.id} e={e} ctx={ctx} status={att(e.id)} first={i === 0} last={i === list.length - 1} onOpen={() => setSelected(e.id)} />)}
            </motion.ul>
          </section>
        ))}
      </div>

      <Sheet open={!!selectedEvent} onClose={() => setSelected(null)} title={selectedEvent && `${dateLabel(selectedEvent.date)} ${selectedEvent.title}`}>
        {selectedEvent && <EventDetail e={selectedEvent} ctx={ctx} open={open} onEdit={() => { setEditing(selectedEvent); setSelected(null); }} />}
      </Sheet>

      {editor && (
        <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring} whileTap={{ scale: 0.9 }} onClick={() => setEditing('new')}
          className="fixed right-4 z-20 bg-sky-100 text-sky-950 rounded-2xl shadow-md px-5 py-4 font-bold text-[15px] flex items-center gap-2.5"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 76px)' }}>
          <Pencil className="w-5 h-5" />予定を追加
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

// 読み込み中の仮表示（ui.jsx の Skeleton）と同じ位置に出るので、下から滑らせずにその場でふわっと出す
const rowVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.3, ease: 'easeOut' } } };

// 1行目：タイトルと開始時刻／2行目：時間と場所／3行目：メモの書き出し（無ければ参加人数）。
// うちの子が未回答の予定は、Gmailの未読と同じく太字＋青い点。出欠の切り替えは右下（Gmailの星の位置）
function EventRow({ e, ctx, status, first, last, onOpen }) {
  const { myKid, data } = ctx;
  const d = md(e.date);
  const canceled = isCanceled(e);
  const closed = isClosed(e);
  const unread = !!myKid && !canceled && !closed && !status;
  const count = data.attendances.filter((a) => a.eventId === e.id && a.status === '参加').length;
  const memo = (e.memo || '').split('\n').find((l) => l.trim()) || '';
  const third = unread ? `締切 ${dateLabel(deadlineOf(e))}${memo ? ` ・ ${memo}` : ''}` : memo || (count ? `${count}人が参加予定` : '');
  return (
    <motion.li variants={rowVariants} onClick={onOpen}
      className={`bg-white grid grid-cols-[46px_minmax(0,1fr)_auto] gap-x-3 pl-2.5 pr-3 py-3 cursor-pointer active:bg-gray-100 ${first ? 'rounded-t-2xl' : 'rounded-t'} ${last ? 'rounded-b-2xl' : 'rounded-b'}`}>
      <div className={`row-span-3 self-start w-[46px] h-[46px] rounded-full grid place-items-center text-center leading-none ${typeStyle(e)}`}>
        <div><span className="block text-[9px]">{d.m}月</span><b className="block text-[17px] tabular-nums my-px">{d.d}</b><span className="block text-[9px]">{d.w}</span></div>
      </div>
      <p className={`min-w-0 truncate text-base ${unread ? 'font-bold' : ''} ${canceled ? 'line-through text-gray-400' : ''}`}>{e.title}</p>
      <p className={`flex items-center gap-1.5 text-xs tabular-nums ${unread ? 'font-bold text-gray-900' : 'text-gray-500'}`}>{startOf(e)}{unread && <span className="w-[9px] h-[9px] rounded-full bg-blue-600" />}</p>
      <p className={`min-w-0 truncate text-sm mt-0.5 ${unread ? 'font-bold' : ''} ${canceled ? 'line-through text-gray-400' : ''}`}>{[timeLabel(e), e.location].filter(Boolean).join('　') || '詳細を見る'}</p>
      <div className="row-span-2 self-end justify-self-end" onClick={(ev) => ev.stopPropagation()}>
        {myKid && !canceled && (closed
          ? <span className="flex items-center gap-1 text-xs text-gray-500"><Lock className="w-3.5 h-3.5" />{status ? `${status}・締切済み` : '出欠は締切済み'}</span>
          : <AttendSwitch e={e} ctx={ctx} status={status} />)}
      </div>
      <p className={`min-w-0 truncate text-[13px] mt-1 ${unread ? 'text-amber-700' : 'text-gray-500'}`}>{third}</p>
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
        {e.memo && <p className="flex gap-2 whitespace-pre-wrap"><FileText className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" /><span className="min-w-0"><Linkify text={e.memo} ctx={ctx} /></span></p>}
        {e.hasAttachments && <Attachments eventId={e.id} ctx={ctx} />}
      </div>

      {myKid && !isCanceled(e) && (
        <section className="bg-gray-50 rounded-2xl p-3 space-y-2">
          <h4 className="font-bold text-xs text-gray-500">出欠（{myKid.childName}）</h4>
          <AttendSwitch e={e} ctx={ctx} status={status} wide />
          <DeadlineNote e={e} status={status} />
        </section>
      )}

      {canEditDeadline(has) && (
        <Press onClick={onEdit} className="w-full flex items-center justify-center gap-1.5 border border-gray-200 rounded-xl py-2.5 text-sm font-bold text-gray-700 bg-white"><Pencil className="w-4 h-4" />予定を直す・中止・削除</Press>
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

      {myKid && status === '参加' && needsRide(e) && !isClosed(e) && <RideForm e={e} ctx={ctx} />}

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

// メモに貼られたURL（調整さんなど）を押せるようにする。LINEの中のブラウザで開く
const URL_RE = /(https?:\/\/[^\s]+)/g;
function Linkify({ text, ctx }) {
  return String(text).split(URL_RE).map((part, i) => (i % 2
    ? <a key={i} href={part} onClick={(ev) => { ev.preventDefault(); ctx.actions.openUrl(part); }} className="text-blue-600 underline break-all">{part}</a>
    : part));
}

// 予定の添付（既存アプリや line-schedule-bot が入れた画像・ファイル）。画像は押すと大きく見られる
function Attachments({ eventId, ctx }) {
  const [list, setList] = useState(null);
  const [view, setView] = useState(null);
  useEffect(() => { ctx.actions.loadAttachments(eventId).then(setList).catch(() => setList([])); }, [ctx.actions, eventId]);
  if (!list) return <p className="flex gap-2 text-xs text-gray-400"><Paperclip className="w-4 h-4" />添付を読み込み中…</p>;
  if (!list.length) return null;
  const images = list.filter((a) => a.url?.startsWith('data:image/'));
  const files = list.filter((a) => !a.url?.startsWith('data:image/'));
  const openFile = async (a) => {
    const blob = await (await fetch(a.url)).blob();
    window.open(URL.createObjectURL(blob), '_blank');
  };
  return (
    <div className="space-y-2">
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((a) => (
            <button key={a.id} onClick={() => setView(a)} className="aspect-square rounded-xl overflow-hidden bg-gray-100">
              <img src={a.url} alt={a.name || '添付画像'} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {files.map((a) => (
        <button key={a.id} onClick={() => openFile(a)} className="w-full flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 text-left text-sm">
          <Paperclip className="w-4 h-4 text-gray-400 shrink-0" /><span className="truncate flex-1">{a.name || 'ファイル'}</span><span className="text-xs text-blue-600">開く</span>
        </button>
      ))}
      <AnimatePresence>
        {view && (
          <motion.div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setView(null)}>
            <motion.img initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} transition={spring} src={view.url} alt={view.name || '添付画像'} className="max-w-full max-h-full rounded-lg" />
            <button aria-label="閉じる" className="absolute right-3 w-10 h-10 rounded-full bg-white/20 text-white grid place-items-center" style={{ top: 'calc(env(safe-area-inset-top) + 12px)' }}><X className="w-6 h-6" /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RideForm({ e, ctx }) {
  const toast = useToast();
  const current = ctx.data.rides.find((r) => r.eventId === e.id && r.studentId === ctx.myKid.id) || {};
  const [role, setRole] = useState(current.role || 'none');
  // 「乗せられる人数」は自分の子も含めて聞く（seatsTotal）。既存アプリと割り振りは capacity を「ほかの子の席数」として使うので、1引いて capacity にも入れる
  const [seats, setSeats] = useState(current.seatsTotal || (current.capacity ? current.capacity + 1 : 4));
  const [count, setCount] = useState(current.count || 1);
  // 車を出せる家族が、ほかの車に乗り合わせることになったときに乗せてほしい人数
  const [mergedCount, setMergedCount] = useState(current.countIfMerged || 1);
  const [area, setArea] = useState(current.area || '柏の葉');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const ride = { role, area, ...(role === 'driver' ? { capacity: seats - 1, seatsTotal: seats, countIfMerged: mergedCount } : role === 'rider' ? { count, type: 'child_only' } : {}) };
    try { await ctx.actions.saveRide(e.id, ctx.myKid.id, ride, ctx.myName); toast('配車の希望を保存しました', '配車担当にだけ届きます'); }
    catch (err) { console.error(err); toast('保存できませんでした'); }
    setSaving(false);
  };

  return (
    <section className="bg-gray-50 rounded-2xl p-3 space-y-3">
      <h4 className="font-bold text-xs text-gray-500 flex items-center gap-1"><Car className="w-4 h-4" />配車の希望</h4>
      <Segmented id={`ride-${e.id}`} value={role} onChange={setRole} options={[{ value: 'driver', label: '車を出せる' }, { value: 'rider', label: '乗せてほしい' }, { value: 'none', label: '不要' }]} />
      <motion.div layout transition={spring} className="space-y-3 overflow-hidden">
        {role === 'driver' && (
          <>
            <div><p className="text-xs text-gray-500 mb-2">子どもを何人乗せられる？（自分の子も含めて）</p><Stepper value={seats} onChange={setSeats} min={2} max={7} /></div>
            <div><p className="text-xs text-gray-500 mb-2">ほかの車に乗り合わせることになったら、何人乗せてほしい？</p><Stepper value={mergedCount} onChange={setMergedCount} min={1} max={4} upTo={false} /></div>
          </>
        )}
        {role === 'rider' && <div><p className="text-xs text-gray-500 mb-2">乗せてほしい人数</p><Stepper value={count} onChange={setCount} min={1} max={4} upTo={false} /></div>}
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
