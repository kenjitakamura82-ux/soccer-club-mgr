import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Send, UserPlus, ChevronDown, UserMinus, Undo2 } from 'lucide-react';
import { Sheet, Press, Avatar, useShake, useToast, listVariants, itemVariants, spring } from '../ui.jsx';
import { jersey, inviteFlex, canManageRoster } from '../util.js';
import { PhotoPicker, NewKid } from './Register.jsx';
import { NewFamilies, OnboardingSettings } from './Onboarding.jsx';

export default function Roster({ ctx }) {
  const { data, photos, has, actions } = ctx;
  const toast = useToast();
  const admin = has('admin'), guide = has('guide'), manage = canManageRoster(has);
  const [edit, setEdit] = useState(null);
  const [adding, setAdding] = useState(false);
  const kids = data.students.filter((s) => !s.id.startsWith('coach_')).sort((a, b) => jersey(a) - jersey(b));
  const famCount = (sid) => (data.members || []).filter((m) => m.studentId === sid).length;

  const invite = async () => {
    try {
      const r = await actions.share('invite', (url) => inviteFlex(url));
      if (r) toast('案内を送りました');
    } catch (e) { toast('送れませんでした', e.message); }
  };

  return (
    <div className="p-3 space-y-3">
      {/* 新しく入った人のこと（案内・入会の設定・準備の進み具合）。役割のある人にだけ出す。保護者には出ない（2026-10-26 ユーザー決定） */}
      {(guide || admin) && <Press onClick={invite} className="w-full flex items-center justify-center gap-2 bg-[#06c755] text-white rounded-xl py-3 font-bold"><Send className="w-4 h-4" />新しく入った人に案内を送る</Press>}
      {(guide || admin || has('pay')) && <OnboardingSettings ctx={ctx} collapsible />}
      {(guide || admin || manage || has('pay')) && <NewFamilies ctx={ctx} />}
      {manage && <Press onClick={() => setAdding(true)} className="w-full flex items-center justify-center gap-2 bg-white border border-emerald-200 text-emerald-700 rounded-xl py-3 font-bold"><UserPlus className="w-4 h-4" />子どもを名簿に追加</Press>}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <h3 className="font-bold px-4 pt-3 pb-1 flex">子どもの名簿 <span className="ml-2 text-gray-400 font-normal">{kids.length}人</span>{manage && <span className="ml-auto text-xs text-gray-400 font-normal self-center">押すと直せる</span>}</h3>
        <motion.ul className="divide-y divide-gray-100" variants={listVariants} initial="hidden" animate="show">
          {kids.map((s) => {
            const n = famCount(s.id);
            return (
              <motion.li key={s.id} variants={itemVariants} onClick={manage ? () => setEdit(s) : undefined} className={`flex items-center gap-3 px-4 py-2.5 ${manage ? 'cursor-pointer active:bg-gray-50' : ''}`}>
                <Avatar student={s} photo={photos[s.id]} size={42} />
                <span className="flex-1 min-w-0"><b className="block truncate">{s.childName}</b><span className="text-xs text-gray-500">{[s.kana, s.grade].filter(Boolean).join('・')}</span></span>
                <span className={`w-9 text-center font-bold tabular-nums ${s.jerseyNumber ? '' : 'text-[11px] text-amber-600'}`}>{s.jerseyNumber || '未定'}</span>
                {(admin || guide) && <span className={`text-[11px] font-bold rounded-full px-2 py-0.5 whitespace-nowrap ${n ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{n ? `保護者 ${n}人` : '登録待ち'}</span>}
              </motion.li>
            );
          })}
        </motion.ul>
      </section>
      {manage && <WithdrawnList ctx={ctx} />}
      <p className="text-xs text-gray-400 px-1">名前と背番号はコーチが登録・修正します。顔写真は保護者が登録します。</p>
      <KidEditSheet ctx={ctx} kid={edit} onClose={() => setEdit(null)} admin={manage} />
      <Sheet open={adding} onClose={() => setAdding(false)} title="子どもを名簿に追加">
        {adding && <NewKid ctx={ctx} forRoster onDone={() => setAdding(false)} />}
      </Sheet>
    </div>
  );
}

// 退会した子（コーチ・管理者）。ふだんは閉じておく。元に戻すと名簿に戻り、家族もまた開けるようになる
function WithdrawnList({ ctx }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const list = ctx.data.withdrawnStudents || [];
  if (!list.length) return null;
  const restore = async (s) => {
    const n = s.jerseyBeforeWithdraw || '';
    const taken = n && ctx.data.students.some((x) => String(x.jerseyNumber) === String(n));
    await ctx.actions.restoreKid(s, taken ? '' : n);
    toast(`${s.childName}さんを名簿に戻しました`, taken ? `背番号 ${n} はほかの子が使っているので、未定にしました` : undefined);
  };
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="w-full flex items-center gap-2 px-4 py-3 text-left">
        <span className="flex-1 font-bold">退会した子 <span className="ml-1 text-gray-400 font-normal">{list.length}人</span></span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring} className="overflow-hidden divide-y divide-gray-100 border-t border-gray-100">
            {list.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                <Avatar student={s} photo={ctx.photos[s.id]} size={36} />
                <span className="flex-1 min-w-0"><b className="block truncate text-gray-600">{s.childName}</b><span className="text-[11px] text-gray-400">{s.withdrawnAt ? `${new Date(s.withdrawnAt).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}に退会` : ''}</span></span>
                <Press onClick={() => restore(s)} className="flex items-center gap-1 text-xs font-bold text-emerald-700 border border-emerald-200 rounded-full px-3 py-1.5"><Undo2 className="w-3.5 h-3.5" />元に戻す</Press>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </section>
  );
}

export function MyKidSheet({ ctx, open, onClose }) {
  return <KidEditSheet ctx={ctx} kid={open ? ctx.myKid : null} onClose={onClose} />;
}

function KidEditSheet({ ctx, kid, onClose, admin }) {
  return (
    <Sheet open={!!kid} onClose={onClose} title={admin ? '名簿を直す' : 'うちの子の情報'}>
      {kid && <KidForm key={kid.id} ctx={ctx} kid={kid} onClose={onClose} admin={admin} />}
    </Sheet>
  );
}

function KidForm({ ctx, kid, onClose, admin }) {
  const toast = useToast();
  const [name, setName] = useState(kid.childName || '');
  const [no, setNo] = useState(kid.jerseyNumber || '');
  const [photo, setPhoto] = useState(null);
  const [err, setErr] = useState('');
  const [scope, shake] = useShake();
  const [leaving, setLeaving] = useState(false);
  const withdraw = async () => { await ctx.actions.withdrawKid(kid); toast(`${kid.childName}さんを退会にしました`, '名簿の下の「退会した子」から元に戻せます'); onClose(); };
  const input = 'w-full border border-gray-200 rounded-xl p-3 text-base outline-none focus:ring-2 focus:ring-emerald-500';

  const save = async () => {
    const n = admin ? String(no).trim() : kid.jerseyNumber || '';
    if (admin && !name.trim()) { setErr('名前を入れてください'); return shake(); }
    if (n && ctx.data.students.some((s) => s.id !== kid.id && String(s.jerseyNumber) === n)) { setErr(`背番号 ${n} はもう使われています`); return shake(); }
    await ctx.actions.saveKid(kid.id, { childName: admin ? name.trim() : undefined, jerseyNumber: n, photo });
    toast('保存しました');
    onClose();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3"><Avatar student={kid} photo={photo || ctx.photos[kid.id]} size={56} /><div><b className="block text-lg">{kid.childName}</b><span className="text-xs text-gray-500">{[kid.kana, kid.grade].filter(Boolean).join('・')}</span></div></div>
      <div ref={scope} className="space-y-3">
        {admin && <label className="block"><span className="text-xs text-gray-500">名前（漢字）</span><input className={input} value={name} onChange={(e) => setName(e.target.value)} /></label>}
        {admin
          ? <label className="block"><span className="text-xs text-gray-500">背番号（未定なら空ける）</span><input className={input} inputMode="numeric" value={no} onChange={(e) => setNo(e.target.value)} placeholder="未定" /></label>
          : <p className="text-sm"><span className="text-xs text-gray-500 block">背番号</span>{kid.jerseyNumber || '未定'}<span className="text-xs text-gray-500 ml-2">（変えるときはコーチに伝えてください）</span></p>}
        {!admin && <PhotoPicker value={photo || ctx.photos[kid.id]} onChange={setPhoto} />}
      </div>
      {admin && <p className="text-xs text-gray-500">背番号を変えても同じ子として扱うので、出欠や配車の記録はそのまま残ります。</p>}
      <AnimatePresence>{err && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{err}</motion.p>}</AnimatePresence>
      <Press onClick={save} className="w-full bg-emerald-600 text-white rounded-xl py-3 font-bold">保存</Press>
      {admin && !kid.id.startsWith('coach_') && (leaving ? (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-900">
          <p className="font-bold">{kid.childName}さんを退会にしますか？</p>
          <p className="text-xs mt-1">名簿・出欠・配車・集金の一覧から外れ、家族（父母とも）はアプリを開けなくなります。背番号は空きます。これまでの出欠や集金の記録は残り、あとで元に戻せます。全体LINEからは別に外してください。</p>
          <div className="flex gap-2 mt-2"><Press onClick={withdraw} className="flex-1 bg-red-600 text-white rounded-lg py-2 font-bold">退会にする</Press><Press onClick={() => setLeaving(false)} className="flex-1 bg-white border border-red-200 rounded-lg py-2 font-bold">やめる</Press></div>
        </div>
      ) : (
        <button type="button" onClick={() => setLeaving(true)} className="w-full flex items-center justify-center gap-1.5 text-sm font-bold text-red-600 py-2"><UserMinus className="w-4 h-4" />退会にする</button>
      ))}
    </div>
  );
}
