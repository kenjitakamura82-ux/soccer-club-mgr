import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { UserPlus, Users, Megaphone, Camera, ChevronLeft, Search } from 'lucide-react';
import { Press, Avatar, useShake, useToast, spring } from '../ui.jsx';
import { compressPhoto, jersey } from '../util.js';

const GRADES = ['年少', '年中', '年長', '1年', '2年', '3年', '4年', '5年', '6年'];

export default function Register({ ctx, onDone }) {
  const [mode, setMode] = useState(null);
  return (
    <AnimatePresence mode="wait">
      <motion.div key={mode || 'top'} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.2 }} className="p-4">
        {!mode && <Choose setMode={setMode} ctx={ctx} />}
        {mode === 'new' && <NewKid ctx={ctx} back={() => setMode(null)} onDone={onDone} />}
        {mode === 'join' && <JoinKid ctx={ctx} back={() => setMode(null)} onDone={onDone} />}
      </motion.div>
    </AnimatePresence>
  );
}

function Item({ icon: Icon, title, sub, onClick }) {
  return (
    <Press onClick={onClick} className="w-full flex items-center gap-3 text-left bg-white border-2 border-gray-100 rounded-2xl p-4">
      <Icon className="w-6 h-6 text-emerald-600 shrink-0" /><span><b className="block">{title}</b><span className="text-xs text-gray-500">{sub}</span></span>
    </Press>
  );
}

function Choose({ setMode, ctx }) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-black">ようこそ、{ctx.myName}さん</h2>
      <p className="text-sm text-gray-500 mb-2">最初の1回だけ、お子さんを登録してください。次からはこの画面は出ません。</p>
      <Item icon={UserPlus} title="はじめて登録する" sub="名前・背番号・顔写真を入れる" onClick={() => setMode('new')} />
      <Item icon={Users} title="家族がもう登録している" sub="父母のもう1人が登録済みのとき" onClick={() => setMode('join')} />
      <Item icon={Megaphone} title="コーチ（子どもの登録なし）" sub="予定と担当の画面だけ使う" onClick={() => ctx.actions.skipFamily()} />
    </div>
  );
}

function Back({ onClick }) {
  return <button onClick={onClick} className="flex items-center text-sm text-gray-500 mb-3 -ml-1"><ChevronLeft className="w-4 h-4" />戻る</button>;
}

export function PhotoPicker({ value, onChange }) {
  return (
    <label className="relative flex items-center gap-3 border-2 border-dashed border-gray-200 rounded-2xl p-3 text-sm font-bold text-emerald-700 cursor-pointer">
      <span className="w-14 h-14 rounded-full bg-gray-100 grid place-items-center overflow-hidden shrink-0">
        {value ? <motion.img key={value.slice(-20)} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring} src={value} alt="" className="w-full h-full object-cover" /> : <Camera className="w-6 h-6 text-gray-400" />}
      </span>
      {value ? '写真を変える' : '写真を選ぶ'}
      <input type="file" accept="image/*" className="absolute inset-0 opacity-0" onChange={async (e) => { const f = e.target.files?.[0]; if (f) onChange(await compressPhoto(f)); }} />
    </label>
  );
}

function NewKid({ ctx, back, onDone }) {
  const toast = useToast();
  const [f, setF] = useState({ childName: '', kana: '', grade: '2年', jerseyNumber: '', photo: null });
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [scope, shake] = useShake();
  const set = (k) => (e) => setF({ ...f, [k]: e.target ? e.target.value : e });

  const submit = async () => {
    const no = f.jerseyNumber.trim();
    if (!f.childName.trim() || !f.kana.trim()) { setErr('名前とふりがなを入れてください'); return shake(); }
    if (no && ctx.data.students.some((s) => String(s.jerseyNumber) === no)) { setErr(`背番号 ${no} はもう使われています`); return shake(); }
    setSaving(true);
    try {
      await ctx.actions.registerKid({ ...f, childName: f.childName.trim(), kana: f.kana.trim(), jerseyNumber: no });
      toast('登録しました');
      onDone();
    } catch (e) { console.error(e); setErr('保存できませんでした。もう一度お試しください'); setSaving(false); }
  };

  const input = 'w-full border border-gray-200 rounded-xl p-3 text-base bg-white outline-none focus:ring-2 focus:ring-emerald-500';
  return (
    <div>
      <Back onClick={back} />
      <h2 className="text-lg font-black mb-4">お子さんを登録</h2>
      <div ref={scope} className="space-y-3">
        <label className="block"><span className="text-xs text-gray-500">名前（漢字）</span><input className={input} value={f.childName} onChange={set('childName')} placeholder="例：海斗" /></label>
        <label className="block"><span className="text-xs text-gray-500">ふりがな</span><input className={input} value={f.kana} onChange={set('kana')} placeholder="例：かいと" /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block"><span className="text-xs text-gray-500">学年</span><select className={input} value={f.grade} onChange={set('grade')}>{GRADES.map((g) => <option key={g}>{g}</option>)}</select></label>
          <label className="block"><span className="text-xs text-gray-500">背番号（未定なら空ける）</span><input className={input} inputMode="numeric" value={f.jerseyNumber} onChange={set('jerseyNumber')} placeholder="未定" /></label>
        </div>
        <div><span className="text-xs text-gray-500">顔写真（みんなが顔と名前を早く覚えるため）</span><PhotoPicker value={f.photo} onChange={set('photo')} /></div>
      </div>
      <AnimatePresence>{err && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{err}</motion.p>}</AnimatePresence>
      <Press onClick={submit} disabled={saving} className="mt-4 w-full bg-emerald-600 text-white rounded-xl py-3.5 font-bold disabled:opacity-60">{saving ? '登録中…' : '登録してはじめる'}</Press>
    </div>
  );
}

function JoinKid({ ctx, back, onDone }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const list = ctx.data.students
    .filter((s) => !s.id.startsWith('coach_'))
    .filter((s) => !q || `${s.childName}${s.kana || ''}${s.jerseyNumber}`.includes(q))
    .sort((a, b) => jersey(a) - jersey(b));
  const submit = async () => { await ctx.actions.linkKid(sel); toast('同じ家族として登録しました'); onDone(); };
  return (
    <div>
      <Back onClick={back} />
      <h2 className="text-lg font-black mb-1">どの子のご家族ですか？</h2>
      <p className="text-sm text-gray-500 mb-3">選ぶと、同じ家族としてまとまります。</p>
      <label className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 mb-3"><Search className="w-4 h-4 text-gray-400" /><input className="flex-1 py-2.5 text-base outline-none" value={q} onChange={(e) => setQ(e.target.value)} placeholder="名前や背番号で探す" /></label>
      <div className="grid grid-cols-3 gap-2">
        {list.map((s) => (
          <Press key={s.id} onClick={() => setSel(s.id)} className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-2.5 bg-white ${sel === s.id ? 'border-emerald-600 bg-emerald-50' : 'border-gray-100'}`}>
            <Avatar student={s} photo={ctx.photos[s.id]} size={44} />
            <b className="text-sm truncate w-full text-center">{s.childName}</b>
            <span className="text-[11px] text-gray-500">{s.jerseyNumber ? `背番号 ${s.jerseyNumber}` : '背番号 未定'}</span>
          </Press>
        ))}
      </div>
      <Press onClick={submit} disabled={!sel} className="mt-4 w-full bg-emerald-600 text-white rounded-xl py-3.5 font-bold disabled:opacity-40">はじめる</Press>
    </div>
  );
}
