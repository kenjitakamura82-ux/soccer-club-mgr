import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronLeft, ChevronRight, CreditCard, Info, Shirt, Users, Loader2, Save } from 'lucide-react';
import { Press, Avatar, DrawCheck, useToast, spring } from '../ui.jsx';
import { onboardingSettings, onboardingSteps, joinPaymentId, joinAmounts, STRIPE_FEE_NOTE, jersey } from '../util.js';
import Register from './Register.jsx';
import HowTo from './HowTo.jsx';

// 新しく入った家族の「はじめての準備」（2026-10-26 ユーザー決定）。案内係が送るカード（?onboarding=1）から始まり、終わるまでは開くたびにこの画面。
// 1 全体LINEに参加 → 2 お子さんの登録 → 3 予定の見かた → 4 ユニフォーム・背番号（早い者勝ち） → 5 支払い（年会費＋ユニフォーム代を1回で）
const STEPS = [
  { id: 'line', title: '全体LINEに参加', sub: '連絡はこのグループに届きます' },
  { id: 'kid', title: 'お子さんの登録', sub: '名前・学年・顔写真' },
  { id: 'guide', title: '予定の見かた', sub: '出欠の答え方・持ち物・練習場' },
  { id: 'uniform', title: 'ユニフォーム・背番号', sub: '買うかどうか選べます' },
  { id: 'pay', title: '支払い', sub: '年会費（ユニフォームを買うならその代金も）' },
];
const yen = (n) => `¥${Number(n).toLocaleString()}`;

export default function Onboarding({ ctx, onLater }) {
  const done = onboardingSteps(ctx.me, ctx.data);
  const count = STEPS.filter((s) => done[s.id]).length;
  const next = STEPS.find((s) => !done[s.id]);
  const [open, setOpen] = useState(null);
  const finish = () => ctx.actions.saveOnboarding({ done: true, doneAt: new Date().toISOString() });

  if (open) return (
    <div className="bg-white min-h-[calc(100vh-56px)]">
      <div className="flex items-center gap-2 px-3 py-3 border-b"><button onClick={() => setOpen(null)} aria-label="戻る" className="w-9 h-9 grid place-items-center"><ChevronLeft className="w-5 h-5 text-gray-500" /></button><p className="font-bold">{STEPS.findIndex((s) => s.id === open) + 1}. {STEPS.find((s) => s.id === open).title}</p></div>
      {open === 'line' && <LineStep ctx={ctx} onDone={() => setOpen(null)} />}
      {open === 'kid' && <Register ctx={ctx} onDone={() => setOpen(null)} />}
      {open === 'guide' && <GuideStep ctx={ctx} onDone={() => setOpen(null)} />}
      {open === 'uniform' && <UniformStep ctx={ctx} onDone={() => setOpen('pay')} />}
      {open === 'pay' && <PayStep ctx={ctx} onDone={() => setOpen(null)} />}
    </div>
  );

  return (
    <div>
      <div className="bg-emerald-600 text-white px-5 py-5">
        <p className="text-[11px] opacity-80">まちサカ</p>
        <p className="text-lg font-black">はじめての準備</p>
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 h-2 bg-white/30 rounded-full overflow-hidden"><motion.div className="h-2 bg-white rounded-full" initial={false} animate={{ width: `${(count / STEPS.length) * 100}%` }} transition={spring} /></div>
          <span className="text-xs font-bold tabular-nums">{count} / {STEPS.length}</span>
        </div>
      </div>
      <div className="p-3 space-y-2">
        {STEPS.map((s, i) => {
          const ok = done[s.id], cur = next?.id === s.id;
          // 子どもの登録の前は、ユニフォームと支払いは開けない（誰の分か決まらないため）
          const locked = !ok && !done.kid && (s.id === 'uniform' || s.id === 'pay');
          return (
            <button key={s.id} type="button" disabled={locked} onClick={() => setOpen(s.id)}
              className={`w-full text-left bg-white rounded-xl p-3 flex items-center gap-3 ${cur ? 'border-2 border-emerald-500 shadow-sm' : 'border border-gray-100'} ${locked ? 'opacity-50' : ''}`}>
              <span className={`w-7 h-7 rounded-full grid place-items-center text-sm font-bold shrink-0 ${ok ? 'bg-emerald-600 text-white' : cur ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{ok ? <Check className="w-4 h-4" /> : i + 1}</span>
              <span className="flex-1 min-w-0">
                <span className={`block text-sm font-bold ${ok ? 'text-gray-400 line-through' : ''}`}>{s.title}</span>
                <span className="block text-[11px] text-gray-500">{ok ? doneNote(s.id, ctx) : s.sub}</span>
              </span>
              {!ok && !locked && <ChevronRight className={`w-4 h-4 ${cur ? 'text-emerald-600' : 'text-gray-300'}`} />}
            </button>
          );
        })}
        {next
          ? <p className="text-[11px] text-gray-400 text-center pt-1">途中でやめても、次に開いたら続きからできます</p>
          : (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl p-4 text-center space-y-3 border border-emerald-100">
              <DrawCheck size={48} />
              <p className="font-bold">準備が終わりました</p>
              <Press onClick={finish} className="w-full bg-emerald-600 text-white rounded-xl py-3 font-bold">予定を見る</Press>
            </motion.div>
          )}
        {next && <button onClick={onLater} className="w-full text-sm text-gray-500 py-2">先に予定を見る</button>}
      </div>
    </div>
  );
}

function doneNote(id, ctx) {
  const u = ctx.me.onboarding?.uniform;
  if (id === 'kid') return ctx.myKid ? `${ctx.myKid.childName}（${ctx.myKid.grade || ''}）` : '';
  if (id === 'uniform') return u?.buy ? `${u.size}・背番号 ${u.number}` : '今は買わない';
  if (id === 'pay') return '支払いました';
  return '済み';
}

function LineStep({ ctx, onDone }) {
  const url = onboardingSettings(ctx.data).inviteUrl;
  const join = async () => { await ctx.actions.saveOnboarding({ line: true }); onDone(); };
  return (
    <div className="p-4 space-y-3 text-sm">
      <p className="text-gray-600">チームの連絡は全体LINEに届きます。下のボタンからグループに参加して、戻ってきたら「参加しました」を押してください。</p>
      {url
        ? <Press onClick={() => ctx.actions.openUrl(url)} className="w-full flex items-center justify-center gap-2 bg-[#06c755] text-white rounded-xl py-3 font-bold"><Users className="w-4 h-4" />全体LINEを開いて参加する</Press>
        : <p className="bg-amber-50 text-amber-800 rounded-xl px-3 py-2 text-xs">参加のリンクがまだ設定されていません。案内をくれた人に、全体LINEへ招待してもらってください。</p>}
      <Press onClick={join} className="w-full border border-gray-200 text-gray-700 rounded-xl py-3 font-bold">参加しました</Press>
    </div>
  );
}

// 3. 予定の見かた：出欠の答え方・ルール・試合のこと・配車を、動く見本で説明する（持ち物などの案内と練習場の使い方はここでは出さない。2026-10-26 ユーザー決定）
function GuideStep({ ctx, onDone }) {
  const ok = async () => { await ctx.actions.saveOnboarding({ guide: true }); onDone(); };
  return <HowTo ctx={ctx} onDone={ok} />;
}

// ユニフォーム：買う／今は買わない。買うならサイズと背番号（空いている番号から早い者勝ち。決めたあともコーチ・管理者は名簿で直せる）
function UniformStep({ ctx, onDone }) {
  const toast = useToast();
  const set = onboardingSettings(ctx.data);
  const saved = ctx.me.onboarding?.uniform;
  const kid = ctx.myKid;
  const [buy, setBuy] = useState(saved ? saved.buy : null);
  const [size, setSize] = useState(saved?.size || '');
  const [number, setNumber] = useState(saved?.number || kid?.jerseyNumber || '');
  const [busy, setBusy] = useState(false);
  const taken = new Set(ctx.data.students.filter((s) => s.id !== kid?.id && s.jerseyNumber).map((s) => String(s.jerseyNumber)));
  const maxNo = Math.max(30, ...[...taken].map(Number).filter((n) => n > 0));
  const numbers = Array.from({ length: Math.ceil(maxNo / 6) * 6 }, (_, i) => String(i + 1));

  const pick = async (n) => {
    if (taken.has(n) || n === number) return;
    setBusy(true);
    try {
      await ctx.actions.claimJersey(kid.id, n);
      setNumber(n);
      toast(`背番号 ${n} に決まりました`);
    } catch (e) { toast('その番号は使えません', e.message); }
    setBusy(false);
  };
  const save = async () => {
    if (buy === null) return toast('買うかどうか選んでください');
    if (buy && !size) return toast('サイズを選んでください');
    if (buy && !number) return toast('背番号を選んでください');
    await ctx.actions.saveOnboarding({ uniform: buy ? { buy, size, number } : { buy: false } });
    onDone();
  };
  const chip = (on) => `rounded-xl py-2.5 text-center font-bold ${on ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500'}`;
  return (
    <div className="p-4 space-y-5 text-sm">
      <div>
        <p className="font-bold mb-2">ユニフォームを買いますか？（{yen(set.uniformPrice)}）</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setBuy(true)} className={chip(buy === true)}>買う</button>
          <button type="button" onClick={() => setBuy(false)} className={chip(buy === false)}>今は買わない</button>
        </div>
        <p className="text-[11px] text-gray-500 mt-1.5">今は買わない場合、背番号は「未定」のままです。あとで買うときに選べます</p>
      </div>
      <AnimatePresence>
        {buy && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-5 overflow-hidden">
            <div>
              <p className="font-bold mb-2">サイズ</p>
              <div className="flex flex-wrap gap-1.5">
                {set.sizes.map((s) => <button key={s} type="button" onClick={() => setSize(s)} className={`px-3 py-1.5 rounded-full ${size === s ? 'bg-emerald-600 text-white font-bold' : 'bg-gray-100 text-gray-600'}`}>{s}</button>)}
              </div>
            </div>
            <div>
              <p className="font-bold mb-1">背番号</p>
              <p className="text-[11px] text-gray-500 mb-2">空いている番号を押すと、その場で決まります（早い者勝ち）。灰色はもう使われている番号です</p>
              <div className="grid grid-cols-6 gap-1.5 text-center text-xs font-bold">
                {numbers.map((n) => (
                  <button key={n} type="button" disabled={busy || taken.has(n)} onClick={() => pick(n)}
                    className={`py-2 rounded-lg ${n === number ? 'bg-emerald-600 text-white' : taken.has(n) ? 'bg-gray-100 text-gray-300' : 'border'}`}>{n}</button>
                ))}
              </div>
              {number && <p className="mt-2 rounded-lg bg-emerald-50 text-emerald-800 px-3 py-2 text-xs font-bold flex items-center gap-1.5"><Check className="w-4 h-4" />背番号 {number} に決まりました</p>}
              <p className="text-[11px] text-gray-400 mt-1">変えたいときは、コーチに伝えてください（名簿で直せます）</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <Press onClick={save} className="w-full bg-emerald-600 text-white rounded-xl py-3 font-bold">次へ（支払い）</Press>
    </div>
  );
}

// 支払い：年会費とユニフォーム代を1つの集金（個別の集金 join-{子どものID}）にまとめ、1回で払う。金額はこの画面を開いた時点の設定で決まる
function PayStep({ ctx, onDone }) {
  const toast = useToast();
  const kid = ctx.myKid;
  const pid = joinPaymentId(kid.id);
  const existing = ctx.data.payments.find((p) => p.id === pid);
  const ps = ctx.data.paymentStatuses.find((x) => x.eventId === pid && x.studentId === kid.id);
  const paid = ps?.status === 'transferred';
  const plan = joinAmounts(ctx.me.onboarding?.uniform, onboardingSettings(ctx.data));
  const [opening, setOpening] = useState(false);

  // まだ払っていなければ、今の選択と設定で集金を作り直す（払ったあとは変えない）
  const planKey = JSON.stringify(plan);
  const same = !!existing && existing.isActive && JSON.stringify({ title: existing.title, items: existing.items, amount: existing.amount, baseAmount: existing.baseAmount ?? null }) === planKey;
  useEffect(() => {
    if (!paid && !same) ctx.actions.saveJoinPayment(kid.id, JSON.parse(planKey)).catch((e) => console.error(e));
  }, [paid, same, planKey, kid.id, ctx.actions]);

  const p = existing || { ...plan };
  const card = async () => {
    setOpening(true);
    try { await ctx.actions.startCardPay(pid); } catch (e) { toast('支払い画面を開けませんでした', e.message); }
    setOpening(false);
  };
  const kotora = async () => { await ctx.actions.reportTransfer(pid, kid.id, ctx.myName); toast('会計に報告しました', '確認されると「確認済み」になります'); onDone(); };

  return (
    <div className="p-4 space-y-3 text-sm">
      <div className="rounded-xl border divide-y">
        {(p.items || []).map((it) => <div key={it.label} className="flex justify-between p-3"><span>{it.label}</span><span className="tabular-nums">{yen(it.amount)}</span></div>)}
        {p.baseAmount > 0 && p.amount > p.baseAmount && <div className="flex justify-between p-3"><span className="text-gray-600">決済手数料（Stripe・3.6%）</span><span className="tabular-nums text-gray-600">{yen(p.amount - p.baseAmount)}</span></div>}
        <div className="flex justify-between items-baseline p-3 bg-gray-50"><span className="font-bold">合計</span><span className="tabular-nums font-black text-xl">{yen(p.amount)}</span></div>
      </div>
      {p.baseAmount > 0 && p.amount > p.baseAmount && (
        <div className="rounded-xl bg-gray-50 text-gray-700 px-3 py-2.5 text-xs leading-relaxed">
          <p className="font-bold flex items-center gap-1.5"><Info className="w-4 h-4" />決済手数料について</p>
          <p className="mt-0.5">{STRIPE_FEE_NOTE}</p>
        </div>
      )}
      {paid ? (
        <div className="text-center py-3 space-y-1">
          <p className="inline-flex items-center gap-2 text-emerald-700 font-black">{ps.isConfirmed ? <><DrawCheck size={32} />確認済み</> : <><Check className="w-5 h-5" />会計の確認待ち</>}</p>
          <Press onClick={onDone} className="w-full bg-emerald-600 text-white rounded-xl py-3 font-bold mt-2">チェックリストに戻る</Press>
        </div>
      ) : (
        <>
          <Press onClick={card} disabled={opening || !existing} className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white rounded-xl py-3 font-bold disabled:opacity-60">{opening ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}カード・Apple Pay で払う</Press>
          <Press onClick={kotora} disabled={!existing} className="w-full border-2 border-emerald-600 text-emerald-700 rounded-xl py-3 font-bold disabled:opacity-60">ことら送金した</Press>
          <p className="text-[11px] text-gray-500">カード・Apple Pay で払うと、自動で確認済みになります</p>
        </>
      )}
    </div>
  );
}

// コーチ・会計・案内係・管理者が見る「新しく入った家族」。誰がどこで止まっているかと、ユニフォームの注文まとめ
const SHOW_DONE_DAYS = 14;
export function NewFamilies({ ctx }) {
  const { data, students, photos } = ctx;
  const toast = useToast();
  const [resetting, setResetting] = useState(null);
  const reset = async (m) => {
    await ctx.actions.resetOnboarding(m.id, m.studentId);
    setResetting(null);
    toast('準備を最初からやり直せるようにしました', '案内のカードから開くと、もう一度準備の画面が出ます');
  };
  const fams = (data.members || []).filter((m) => m.onboarding?.started).sort((a, b) => (b.onboarding.at || '').localeCompare(a.onboarding.at || ''));
  // ずっと出ているとうっとおしいので、準備が終わった家族は終わってから2週間で消す（終わっていない家族は出し続ける。2026-10-26 ユーザー指摘）
  const [cutoff] = useState(() => new Date(Date.now() - SHOW_DONE_DAYS * 86400000).toISOString());
  const rows = fams.map((m) => {
    const st = onboardingSteps(m, data);
    const kid = students[m.studentId];
    const pid = kid && joinPaymentId(kid.id);
    const ps = pid && data.paymentStatuses.find((x) => x.eventId === pid && x.studentId === kid.id);
    const n = STEPS.filter((s) => st[s.id]).length;
    const doneAt = n === STEPS.length ? m.onboarding.doneAt || ps?.updatedAt || ps?.transferredAt || '' : null;
    return { m, st, kid, ps, n, doneAt };
  }).filter((r) => r.doneAt === null || r.doneAt >= cutoff);
  if (!rows.length) return null;
  const orders = rows.filter((r) => r.m.onboarding.uniform?.buy && r.ps?.status === 'transferred');
  const bySize = orders.reduce((o, r) => ({ ...o, [r.m.onboarding.uniform.size]: (o[r.m.onboarding.uniform.size] || 0) + 1 }), {});
  const stuck = (st) => STEPS.find((s) => !st[s.id])?.title;
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
      <div><h3 className="font-bold">新しく入った家族</h3><p className="text-[11px] text-gray-400">準備が終わった家族は、終わってから{SHOW_DONE_DAYS}日で消えます</p></div>
      {rows.map(({ m, st, kid, ps, n }) => {
        const u = m.onboarding.uniform;
        return (
          <div key={m.id} className="border-t border-gray-100 pt-3 first:border-0 first:pt-0">
            <div className="flex items-center gap-2">
              {kid && <Avatar student={kid} photo={photos[kid.id]} size={28} />}
              <p className="font-bold text-sm flex-1 truncate">{kid ? `${kid.childName}（${kid.grade || ''}）` : `${m.displayName}さん（子ども未登録）`}</p>
              <span className={`text-[11px] font-bold rounded-full px-2 py-0.5 ${n === STEPS.length ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{n === STEPS.length ? '準備完了' : `${n} / ${STEPS.length}`}</span>
            </div>
            <div className="flex gap-1 mt-2">{STEPS.map((s) => <span key={s.id} className={`flex-1 h-1.5 rounded-full ${st[s.id] ? 'bg-emerald-500' : 'bg-gray-200'}`} />)}</div>
            <p className="text-[11px] text-gray-500 mt-1.5">
              {n < STEPS.length && `${stuck(st)}で止まっている ・ `}
              {u ? (u.buy ? `背番号 ${u.number}・ユニフォーム ${u.size}` : 'ユニフォームは今は買わない') : 'ユニフォーム未回答'}
              {ps?.status === 'transferred' && (ps.isConfirmed ? (ps.method === 'card' ? '・カードで支払い済み' : '・支払い確認済み') : '・ことら送金 確認待ち')}
            </p>
            {ctx.has('admin') && (resetting === m.id
              ? (
                <div className="mt-2 rounded-lg bg-red-50 p-2.5 text-xs text-red-700">
                  <p className="font-bold">最初からやり直しますか？</p>
                  <p className="mt-0.5">進み具合を消して、入会の集金を止めます。カードで払った分や会計が確認した支払いの記録は残します。背番号は名簿のまま残ります。</p>
                  <div className="flex gap-2 mt-2"><Press onClick={() => reset(m)} className="flex-1 bg-red-600 text-white rounded-lg py-1.5 font-bold">やり直す</Press><Press onClick={() => setResetting(null)} className="flex-1 bg-white border border-red-200 rounded-lg py-1.5 font-bold">やめる</Press></div>
                </div>
              )
              : <button onClick={() => setResetting(m.id)} className="mt-1 text-[11px] text-gray-400 underline">最初からやり直す（管理者）</button>)}
          </div>
        );
      })}
      {orders.length > 0 && (
        <div className="rounded-xl bg-gray-50 p-3 text-xs">
          <p className="font-bold flex items-center gap-1.5 text-sm"><Shirt className="w-4 h-4 text-emerald-600" />ユニフォームの注文まとめ（支払い済みの分）</p>
          <p className="mt-1 text-gray-700">{Object.entries(bySize).map(([s, c]) => `${s} × ${c}`).join('　')}</p>
          <p className="mt-0.5 text-gray-500">{orders.sort((a, b) => jersey(a.kid) - jersey(b.kid)).map((r) => `${r.kid?.childName} ${r.m.onboarding.uniform.size}・${r.m.onboarding.uniform.number}`).join('、')}</p>
        </div>
      )}
    </section>
  );
}

// 入会の設定（会計・管理者・案内係）。金額を変えても、もう払った家族には影響しない（払う前の家族は、支払いの画面を開いたときに新しい金額になる）
export function OnboardingSettings({ ctx }) {
  const toast = useToast();
  const cur = onboardingSettings(ctx.data);
  const [f, setF] = useState({ annualFee: String(cur.annualFee), uniformPrice: String(cur.uniformPrice), sizes: cur.sizes.join(' '), feeIncluded: cur.feeIncluded, inviteUrl: cur.inviteUrl });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? e.target.value : e }));
  const input = 'w-full border border-gray-200 rounded-xl p-2.5 text-base bg-white outline-none focus:ring-2 focus:ring-emerald-500';
  const save = async () => {
    const annualFee = Number(f.annualFee), uniformPrice = Number(f.uniformPrice);
    if (!(annualFee > 0) || !(uniformPrice > 0)) return toast('金額は数字で入れてください');
    if (f.inviteUrl && !/^https:\/\/line\.me\//.test(f.inviteUrl.trim())) return toast('招待リンクは https://line.me/ で始まるものを入れてください');
    await ctx.actions.saveOnboardingSettings({ annualFee, uniformPrice, sizes: f.sizes.split(/[\s,、]+/).filter(Boolean), feeIncluded: !!f.feeIncluded, inviteUrl: f.inviteUrl.trim() });
    toast('入会の設定を保存しました', 'これから支払いに進む家族から反映されます');
  };
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3 text-sm">
      <div><b>入会の設定</b><p className="text-xs text-gray-500 mt-0.5">新しく入った家族の「はじめての準備」で使う金額と、全体LINEの招待リンクです。</p></div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block"><span className="text-xs text-gray-500">年会費（円）</span><input className={input} inputMode="numeric" value={f.annualFee} onChange={(e) => set('annualFee')(e.target.value.replace(/[^0-9]/g, ''))} /></label>
        <label className="block"><span className="text-xs text-gray-500">ユニフォーム代（円）</span><input className={input} inputMode="numeric" value={f.uniformPrice} onChange={(e) => set('uniformPrice')(e.target.value.replace(/[^0-9]/g, ''))} /></label>
      </div>
      <label className="block"><span className="text-xs text-gray-500">ユニフォームのサイズ（空白で区切る）</span><input className={input} value={f.sizes} onChange={set('sizes')} /></label>
      <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={f.feeIncluded} onChange={(e) => set('feeIncluded')(e.target.checked)} /><span><span className="font-bold">決済手数料（Stripe・3.6%）を含める</span><span className="block text-xs text-gray-500">含めると、合計に手数料を足して10円単位で切り上げます。保護者の画面に内訳と説明が出ます</span></span></label>
      <label className="block"><span className="text-xs text-gray-500">全体LINEの招待リンク（グループの設定で作るリンク）</span><input className={input} value={f.inviteUrl} onChange={set('inviteUrl')} placeholder="https://line.me/R/ti/g/..." /></label>
      <p className="text-[11px] text-gray-500">招待リンクは、案内のカードから開く準備の画面の中だけに出します。</p>
      <Press onClick={save} className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-xl py-2.5 font-bold"><Save className="w-4 h-4" />保存</Press>
    </section>
  );
}
