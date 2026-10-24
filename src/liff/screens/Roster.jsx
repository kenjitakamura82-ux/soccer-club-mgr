import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Send } from 'lucide-react';
import { Sheet, Press, Avatar, useShake, useToast, listVariants, itemVariants } from '../ui.jsx';
import { jersey, inviteFlex } from '../util.js';
import { PhotoPicker } from './Register.jsx';

export default function Roster({ ctx }) {
  const { data, photos, has, actions } = ctx;
  const toast = useToast();
  const admin = has('admin'), guide = has('guide');
  const [edit, setEdit] = useState(null);
  const kids = data.students.filter((s) => !s.id.startsWith('coach_')).sort((a, b) => jersey(a) - jersey(b));
  const famCount = (sid) => (data.members || []).filter((m) => m.studentId === sid).length;

  const invite = async () => {
    try {
      const r = await actions.shareTargetPicker([inviteFlex(actions.liffUrl())]);
      if (r) toast('案内を送りました');
    } catch (e) { toast('送れませんでした', e.message); }
  };

  return (
    <div className="p-3 space-y-3">
      {guide && <Press onClick={invite} className="w-full flex items-center justify-center gap-2 bg-[#06c755] text-white rounded-xl py-3 font-bold"><Send className="w-4 h-4" />新しく入った人に案内を送る</Press>}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <h3 className="font-bold px-4 pt-3 pb-1 flex">子どもの名簿 <span className="ml-2 text-gray-400 font-normal">{kids.length}人</span>{admin && <span className="ml-auto text-xs text-gray-400 font-normal self-center">押すと直せる</span>}</h3>
        <motion.ul className="divide-y divide-gray-100" variants={listVariants} initial="hidden" animate="show">
          {kids.map((s) => {
            const n = famCount(s.id);
            return (
              <motion.li key={s.id} variants={itemVariants} onClick={admin ? () => setEdit(s) : undefined} className={`flex items-center gap-3 px-4 py-2.5 ${admin ? 'cursor-pointer active:bg-gray-50' : ''}`}>
                <Avatar student={s} photo={photos[s.id]} size={42} />
                <span className="flex-1 min-w-0"><b className="block truncate">{s.childName}</b><span className="text-xs text-gray-500">{[s.kana, s.grade].filter(Boolean).join('・')}</span></span>
                <span className={`w-9 text-center font-bold tabular-nums ${s.jerseyNumber ? '' : 'text-[11px] text-amber-600'}`}>{s.jerseyNumber || '未定'}</span>
                {(admin || guide) && <span className={`text-[11px] font-bold rounded-full px-2 py-0.5 whitespace-nowrap ${n ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{n ? `保護者 ${n}人` : '登録待ち'}</span>}
              </motion.li>
            );
          })}
        </motion.ul>
      </section>
      <p className="text-xs text-gray-400 px-1">名前・背番号・写真は保護者が登録します。間違いや背番号の重なりは管理者が直します。</p>
      <KidEditSheet ctx={ctx} kid={edit} onClose={() => setEdit(null)} admin />
    </div>
  );
}

export function MyKidSheet({ ctx, open, onClose }) {
  return <KidEditSheet ctx={ctx} kid={open ? ctx.myKid : null} onClose={onClose} />;
}

function KidEditSheet({ ctx, kid, onClose, admin }) {
  return (
    <Sheet open={!!kid} onClose={onClose} title={admin ? '名簿を直す（管理者）' : 'うちの子の情報'}>
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
  const input = 'w-full border border-gray-200 rounded-xl p-3 text-base outline-none focus:ring-2 focus:ring-emerald-500';

  const save = async () => {
    const n = String(no).trim();
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
        <label className="block"><span className="text-xs text-gray-500">背番号（未定なら空ける）</span><input className={input} inputMode="numeric" value={no} onChange={(e) => setNo(e.target.value)} placeholder="未定" /></label>
        {!admin && <PhotoPicker value={photo || ctx.photos[kid.id]} onChange={setPhoto} />}
      </div>
      <p className="text-xs text-gray-500">背番号を変えても同じ子として扱うので、出欠や配車の記録はそのまま残ります。</p>
      <AnimatePresence>{err && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{err}</motion.p>}</AnimatePresence>
      <Press onClick={save} className="w-full bg-emerald-600 text-white rounded-xl py-3 font-bold">保存</Press>
    </div>
  );
}
