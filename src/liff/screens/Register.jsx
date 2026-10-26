import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Camera, ChevronLeft, Search, UserPlus } from 'lucide-react';
import { Press, Avatar, useShake, useToast, spring } from '../ui.jsx';
import { compressPhoto, jersey } from '../util.js';

// 学年ごとのチームなので、新しく入る子の学年は名簿でいちばん多い学年にする（今は2年。無ければ2年）
const teamGrade = (students) => {
  const n = {};
  students.forEach((s) => { if (s.grade) n[s.grade] = (n[s.grade] || 0) + 1; });
  return Object.entries(n).sort((a, b) => b[1] - a[1])[0]?.[0] || '2年';
};

// 名簿（TeamHubから入れた子）から選ぶのが基本。名簿にいない子だけ新しく入力する
export default function Register({ ctx, onDone }) {
  const [mode, setMode] = useState('pick');
  const [picked, setPicked] = useState(null);
  return (
    <AnimatePresence mode="wait">
      <motion.div key={mode} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.2 }} className="p-4">
        {mode === 'pick' && <PickKid ctx={ctx} onPick={(s) => { setPicked(s); setMode('photo'); }} onNew={() => setMode('new')} />}
        {mode === 'photo' && <PhotoStep ctx={ctx} kid={picked} back={() => setMode('pick')} onDone={onDone} />}
        {mode === 'new' && <NewKid ctx={ctx} back={() => setMode('pick')} onDone={onDone} />}
      </motion.div>
    </AnimatePresence>
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

function PickKid({ ctx, onPick, onNew }) {
  const [q, setQ] = useState('');
  const norm = (s) => String(s || '').replace(/\s/g, '');
  const list = ctx.data.students
    .filter((s) => !s.id.startsWith('coach_'))
    .filter((s) => !q || norm(`${s.childName}${s.kana}${s.jerseyNumber}`).includes(norm(q)))
    .sort((a, b) => (a.jerseyNumber ? 1 : 0) - (b.jerseyNumber ? 1 : 0) || jersey(a) - jersey(b) || (a.childName || '').localeCompare(b.childName || '', 'ja'));
  return (
    <div>
      <h2 className="text-lg font-black">ようこそ、{ctx.myName}さん</h2>
      <p className="text-sm text-gray-500 mt-1 mb-3">最初の1回だけ、名簿からお子さんを選んでください。父母どちらが選んでも、同じ家族としてまとまります。</p>
      {/* 名簿にいない子は保護者が自分で入れる（コーチが足すと自分の子ではないので間違えやすく、手間もかかるため。2026-10-26 ユーザー決定）。一覧の上に置いてスクロールさせない */}
      <button onClick={onNew} className="mb-3 w-full flex items-center justify-center gap-2 text-sm font-bold text-emerald-700 border border-dashed border-emerald-300 rounded-xl py-3 bg-white"><UserPlus className="w-4 h-4" />名簿にいない（新しく入った）</button>
      <label className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 mb-3 sticky top-[60px] z-10"><Search className="w-4 h-4 text-gray-400" /><input className="flex-1 py-2.5 text-base outline-none" value={q} onChange={(e) => setQ(e.target.value)} placeholder="名前や背番号で探す" /></label>
      <motion.div layout className="grid grid-cols-3 gap-2">
        {list.map((s) => (
          <Press key={s.id} onClick={() => onPick(s)} className="flex flex-col items-center gap-1 rounded-2xl border-2 border-gray-100 p-2.5 bg-white">
            <Avatar student={s} photo={ctx.photos[s.id]} size={44} />
            <b className="text-[13px] leading-tight text-center line-clamp-2 w-full">{s.childName}</b>
            <span className="text-[11px] text-gray-500">{s.jerseyNumber ? `#${s.jerseyNumber}` : '背番号 未定'}</span>
          </Press>
        ))}
      </motion.div>
      {!list.length && <p className="text-center text-sm text-gray-400 py-8">見つかりません</p>}
    </div>
  );
}

function PhotoStep({ ctx, kid, back, onDone }) {
  const toast = useToast();
  const [photo, setPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const hasPhoto = !!ctx.photos[kid.id];
  const finish = async (withPhoto) => {
    setSaving(true);
    try {
      if (withPhoto && photo) await ctx.actions.saveKid(kid.id, { jerseyNumber: kid.jerseyNumber, photo });
      await ctx.actions.linkKid(kid.id);
      toast(`${kid.childName}さんの家族として登録しました`);
      onDone();
    } catch (e) { console.error(e); toast('保存できませんでした', 'もう一度お試しください'); setSaving(false); }
  };
  return (
    <div>
      <Back onClick={back} />
      <div className="flex flex-col items-center text-center gap-2 mb-5">
        <Avatar student={kid} photo={photo || ctx.photos[kid.id]} size={88} />
        <h2 className="text-xl font-black">{kid.childName}</h2>
        <p className="text-sm text-gray-500">{kid.jerseyNumber ? `背番号 ${kid.jerseyNumber}` : '背番号 未定'}</p>
      </div>
      {!hasPhoto && (
        <div className="space-y-2 mb-4">
          <p className="text-sm text-gray-600">顔写真を登録しませんか？ みんなが顔と名前を早く覚えられるように。あとからでも登録できます。</p>
          <PhotoPicker value={photo} onChange={setPhoto} />
        </div>
      )}
      <Press onClick={() => finish(true)} disabled={saving} className="w-full bg-emerald-600 text-white rounded-xl py-3.5 font-bold disabled:opacity-60">{saving ? '登録中…' : 'この子の家族としてはじめる'}</Press>
      {!hasPhoto && !photo && <button onClick={() => finish(false)} disabled={saving} className="w-full text-sm text-gray-500 py-3">写真はあとで</button>}
    </div>
  );
}

// forRoster: 名簿画面から管理者・案内係が足すとき（自分の子として紐づけない）
export function NewKid({ ctx, back, onDone, forRoster }) {
  const toast = useToast();
  const [f, setF] = useState({ childName: '', kana: '', jerseyNumber: '', photo: null });
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [scope, shake] = useShake();
  const [dupOk, setDupOk] = useState(false);
  const set = (k) => (e) => { setF({ ...f, [k]: e.target ? e.target.value : e }); if (k === 'childName') setDupOk(false); };
  // 保護者が入れるときは背番号を聞かない（ユニフォームを買うときに、空いている番号から選ぶ）。コーチ・管理者が名簿に足すときだけ聞く
  const askNumber = forRoster;
  const norm = (v) => String(v || '').replace(/\s/g, '');
  const same = ctx.data.students.find((s) => norm(s.childName) && norm(s.childName) === norm(f.childName));

  const submit = async () => {
    const no = askNumber ? f.jerseyNumber.trim() : '';
    if (!f.childName.trim() || !f.kana.trim()) { setErr('名前とふりがなを入れてください'); return shake(); }
    if (same && !dupOk) { setErr(`名簿に「${same.childName}」さんがもういます。同じ子なら、戻って名簿から選んでください。別の子なら、もう一度押すと登録します`); setDupOk(true); return shake(); }
    if (no && ctx.data.students.some((s) => String(s.jerseyNumber) === no)) { setErr(`背番号 ${no} はもう使われています`); return shake(); }
    setSaving(true);
    try {
      await ctx.actions.registerKid({ ...f, grade: teamGrade(ctx.data.students), childName: f.childName.trim(), kana: f.kana.trim(), jerseyNumber: no }, { link: !forRoster });
      toast(forRoster ? `${f.childName.trim()}さんを名簿に追加しました` : '登録しました');
      onDone();
    } catch (e) { console.error(e); setErr('保存できませんでした。もう一度お試しください'); setSaving(false); }
  };

  const input = 'w-full border border-gray-200 rounded-xl p-3 text-base bg-white outline-none focus:ring-2 focus:ring-emerald-500';
  return (
    <div>
      {!forRoster && <Back onClick={back} />}
      {!forRoster && <h2 className="text-lg font-black mb-1">新しく入ったお子さんを登録</h2>}
      <p className="text-sm text-gray-500 mb-4">{forRoster ? '保護者は、初めて開いたときにこの名簿からお子さんを選べます。名簿にいない子は、保護者が自分でも登録できます。' : '名簿にいないときだけ入力してください。入れた内容は、あとからコーチが直すこともできます。'}</p>
      <div ref={scope} className="space-y-3">
        <label className="block"><span className="text-xs text-gray-500">名前（漢字）</span><input className={input} value={f.childName} onChange={set('childName')} placeholder="例：佐藤 海斗" /></label>
        <label className="block"><span className="text-xs text-gray-500">ふりがな</span><input className={input} value={f.kana} onChange={set('kana')} placeholder="例：さとう かいと" /></label>
        {askNumber && <label className="block"><span className="text-xs text-gray-500">背番号（未定なら空ける）</span><input className={input} inputMode="numeric" value={f.jerseyNumber} onChange={set('jerseyNumber')} placeholder="未定" /></label>}
        <div><span className="text-xs text-gray-500">顔写真（みんなが顔と名前を早く覚えるため）</span><PhotoPicker value={f.photo} onChange={set('photo')} /></div>
      </div>
      <AnimatePresence>{err && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{err}</motion.p>}</AnimatePresence>
      <Press onClick={submit} disabled={saving} className="mt-4 w-full bg-emerald-600 text-white rounded-xl py-3.5 font-bold disabled:opacity-60">{saving ? '登録中…' : forRoster ? '名簿に追加' : '登録してはじめる'}</Press>
    </div>
  );
}
