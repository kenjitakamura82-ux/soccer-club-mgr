import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Clock, Wallet, Plus, Send, Pencil, CreditCard, Search, Check, Calculator } from 'lucide-react';
import { Press, Avatar, DrawCheck, Sheet, Segmented, useShake, useToast, listVariants, itemVariants, spring } from '../ui.jsx';
import { OnboardingSettings } from './Onboarding.jsx';
import { dateLabel, jersey, isCanceled, todayJst, addDays, payTargets, announce, paymentEvent, withCardFee, CARD_FEE_RATE, feeBreakdown, STRIPE_FEE_NOTE } from '../util.js';

// 有効な集金。予定の集金（payments/{予定のID}）と、個別の集金（kind: 'custom'。入会費・ユニフォーム代など、予定にひも付かない）
const activePayments = (data) => data.payments
  .filter((p) => p.isActive)
  .map((p) => ({ ...p, event: paymentEvent(p, data) }))
  .filter((p) => p.kind === 'custom' || p.event)
  .sort((a, b) => (b.event?.date || b.createdAt || '').localeCompare(a.event?.date || a.createdAt || ''));
const payKey = (p) => p.eventId || p.id;
const payTitle = (p) => (p.kind === 'custom' ? p.title : p.description) || '集金';
const payLabel = (p) => (p.kind === 'custom' ? '個別の集金' : `${dateLabel(p.event.date)} ${p.event.title}`);

// カード・Apple Pay 払い（Stripe）は Vercel の環境変数 VITE_CARD_PAY=on で出す（開発の見本データでは常に出す）
const CARD_PAY = import.meta.env.VITE_CARD_PAY === 'on' || (import.meta.env.DEV && new URLSearchParams(location.search).has('mock'));
const CARD = 'カード・Apple Pay';

// 予定の集金が今は払えない理由。中止、または開催決定の待ち（needsConfirm の付いた集金のみ。古い集金は今までどおり払える）
const blockedOf = (p) => (p.kind === 'custom' || !p.event ? '' : isCanceled(p.event) ? '中止になりました' : p.needsConfirm && !p.event.confirmed ? '開催が決まったら払えます' : '');

const statusOf = (ps) => ps?.status === 'refunded' ? 'refunded' : !ps || ps.status !== 'transferred' ? 'todo' : ps.isConfirmed ? 'done' : 'wait';
const yen = (n) => `¥${Number(n).toLocaleString()}`;

export function MyPay({ ctx }) {
  const { data, myKid, actions, myName } = ctx;
  const toast = useToast();
  const [opening, setOpening] = useState(null);
  const card = async (key) => {
    setOpening(key);
    try { await actions.startCardPay(key); } catch (e) { toast('支払い画面を開けませんでした', e.message); }
    setOpening(null);
  };
  // 自分の子が払う対象の集金だけ（予定の集金は参加の子、選抜ありなら選ばれた子。個別の集金は指定された子）。払ったものは残す
  const list = activePayments(data).filter((p) => payTargets(p, data).includes(myKid.id) || data.paymentStatuses.some((x) => x.eventId === payKey(p) && x.studentId === myKid.id));
  if (!list.length) return <Empty />;
  return (
    <motion.div className="p-3 space-y-3" variants={listVariants} initial="hidden" animate="show">
      {list.map((p) => {
        const key = payKey(p);
        const ps = data.paymentStatuses.find((x) => x.eventId === key && x.studentId === myKid.id);
        const st = statusOf(ps);
        const blocked = blockedOf(p);
        return (
          <motion.section key={p.id} variants={itemVariants} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500">{payLabel(p)}</p>
            <p className="font-bold">{payTitle(p)}</p>
            {p.amount && <p className="text-2xl font-black tabular-nums mt-1">{yen(p.amount)}</p>}
            {feeBreakdown(p) && (
              <div className="mt-1.5 rounded-lg bg-gray-50 px-3 py-2 text-[11px] text-gray-600 leading-relaxed">
                <p className="tabular-nums">{yen(feeBreakdown(p).base)} ＋ 決済手数料 {yen(feeBreakdown(p).fee)}</p>
                <p className="text-gray-500">{STRIPE_FEE_NOTE}</p>
              </div>
            )}
            <div className="mt-3 min-h-[52px] grid place-items-center">
              <AnimatePresence mode="wait">
                <motion.div key={st} initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }} transition={spring} className="w-full grid place-items-center">
                  {st === 'todo' && blocked && <span className="inline-flex items-center gap-2 bg-gray-100 text-gray-600 rounded-full px-4 py-2 font-bold text-sm">{blocked}</span>}
                  {st === 'todo' && !blocked && (
                    <div className="w-full space-y-2">
                      {CARD_PAY && p.amount > 0 && <Press onClick={() => card(key)} disabled={opening === key} className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-xl py-3 font-bold disabled:opacity-60"><CreditCard className="w-4 h-4" />{opening === key ? '支払い画面を開いています…' : `${CARD}で払う`}</Press>}
                      <Press onClick={async () => { await actions.reportTransfer(key, myKid.id, myName); toast('会計に報告しました', '確認されると「確認済み」になります'); }} className={`w-full rounded-xl py-3 font-bold ${CARD_PAY && p.amount > 0 ? 'bg-white border border-gray-200 text-gray-700' : 'bg-emerald-600 text-white'}`}>ことら送金した</Press>
                      {CARD_PAY && p.amount > 0 && <p className="text-[11px] text-gray-500 text-center">{CARD}で払うと、会計の確認を待たずに「確認済み」になります</p>}
                    </div>
                  )}
                  {st === 'wait' && <span className="inline-flex items-center gap-2 bg-amber-50 text-amber-700 rounded-full px-4 py-2 font-bold text-sm"><Clock className="w-4 h-4" />会計の確認待ち</span>}
                  {st === 'refunded' && <span className="inline-flex items-center gap-2 bg-gray-100 text-gray-600 rounded-full px-4 py-2 font-bold text-sm">返金しました（カードに戻るまで5〜10日ほど）</span>}
                  {st === 'done' && <span className="inline-flex items-center gap-2 text-emerald-700 font-black"><DrawCheck size={36} />確認済み{ps?.method === 'card' && <span className="text-xs font-bold text-gray-500">（{CARD}）</span>}</span>}
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
  const [editing, setEditing] = useState(null);
  const [refunding, setRefunding] = useState(null);
  const list = activePayments(data);
  return (
    <div className="p-3 space-y-4">
      <Sheet open={!!refunding} onClose={() => setRefunding(null)} title="返金する">
        {refunding && <RefundConfirm ctx={ctx} target={refunding} onDone={() => setRefunding(null)} />}
      </Sheet>
      <Press onClick={() => setEditing({})} className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-xl py-3 font-bold"><Plus className="w-4 h-4" />集金を設定する</Press>
      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing?.payment ? '集金の設定を直す' : '集金を設定する'}>
        {editing && <PayForm key={editing.payment?.id || 'new'} ctx={ctx} initial={editing} onDone={() => setEditing(null)} />}
      </Sheet>
      {!list.length && <Empty />}
      {list.map((p) => {
        const key = payKey(p);
        const statuses = data.paymentStatuses.filter((x) => x.eventId === key);
        // 払う対象の家族と、対象外でも支払いの記録がある家族
        const sids = [...new Set([...payTargets(p, data), ...statuses.map((s) => s.studentId)])];
        const order = ['todo', 'wait', 'done', 'refunded'];
        const rows = sids.map((sid) => ({ sid, s: students[sid], ps: statuses.find((x) => x.studentId === sid) }))
          .sort((a, b) => order.indexOf(statusOf(a.ps)) - order.indexOf(statusOf(b.ps)) || jersey(a.s) - jersey(b.s));
        const count = (k) => rows.filter((r) => statusOf(r.ps) === k).length;
        const unpaid = rows.filter((r) => statusOf(r.ps) === 'todo').map((r) => r.s?.childName).filter(Boolean);
        const cards = statuses.filter((s) => s.method === 'card' && s.isConfirmed);
        const cardSum = cards.reduce((n, s) => n + (s.amount || p.amount || 0), 0);
        const cardFee = cards.reduce((n, s) => n + Math.round((s.amount || p.amount || 0) * CARD_FEE_RATE), 0);
        return (
          <section key={p.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500">{payLabel(p)}</p>
            <p className="font-bold">{payTitle(p)}{p.amount ? ` ${yen(p.amount)}` : ''}</p>
            <div className="flex gap-2 mt-2">
              <Press onClick={() => announce(ctx, toast, p)} className="flex-1 flex items-center justify-center gap-1.5 bg-[#06c755] text-white rounded-lg py-2 text-xs font-bold"><Send className="w-3.5 h-3.5" />{p.kind === 'custom' ? '対象の家族に知らせる' : '全体LINEに知らせる'}</Press>
              <Press onClick={() => setEditing({ event: p.event, payment: p })} className="flex items-center justify-center gap-1.5 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold text-gray-700"><Pencil className="w-3.5 h-3.5" />直す</Press>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center my-3">
              {[['todo', 'まだ'], ['wait', '確認待ち'], ['done', '確認済み']].map(([k, l]) => (
                <div key={k} className={`rounded-xl py-2 ${k === 'todo' && count(k) ? 'bg-amber-50' : 'bg-gray-50'}`}><motion.b key={count(k)} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="block text-lg tabular-nums">{count(k)}</motion.b><span className="text-[11px] text-gray-500">{l}</span></div>
              ))}
            </div>
            {unpaid.length > 0 && <p className="text-xs text-amber-800 bg-amber-50 rounded-xl px-3 py-2 mb-2"><b>まだの家族：</b>{unpaid.join('、')}</p>}
            {p.kind !== 'custom' && p.event?.selection && <p className="text-[11px] text-gray-500 mb-2">人数の限りがある試合なので、出場メンバーの家族だけが対象です。</p>}
            <ul className="divide-y divide-gray-100">
              {rows.map(({ sid, s, ps }) => {
                const st = statusOf(ps);
                return (
                  <li key={sid} className="flex items-center gap-3 py-2 text-sm">
                    <Avatar student={s} photo={photos[sid]} size={30} />
                    <span className="flex-1 truncate">{s?.childName || ps?.responderName || '不明'}の家族</span>
                    {st === 'wait' && <Press onClick={async () => { await actions.confirmTransfer(ps.id, myName); toast('確認済みにしました'); }} className="bg-emerald-600 text-white rounded-lg px-2.5 py-1 text-xs font-bold">入金を確認した</Press>}
                    {st === 'done' && ps?.method === 'card' && ps.stripeSessionId && <button onClick={() => setRefunding({ ps, name: s?.childName, amount: ps.amount || p.amount })} className="text-[11px] text-gray-500 underline">返金</button>}
                    <span className={`text-[11px] font-bold rounded-full px-2 py-0.5 whitespace-nowrap ${st === 'done' ? 'bg-emerald-50 text-emerald-700' : st === 'wait' ? 'bg-blue-50 text-blue-700' : st === 'refunded' ? 'bg-gray-100 text-gray-600' : 'bg-amber-50 text-amber-700'}`}>{st === 'done' ? (ps?.method === 'card' ? `${CARD}で支払い済み` : '確認済み') : st === 'wait' ? 'ことら・確認待ち' : st === 'refunded' ? '返金済み' : 'まだ'}</span>
                  </li>
                );
              })}
            </ul>
            {cards.length > 0 && (
              <div className="mt-3 bg-gray-50 rounded-xl px-3 py-2 text-xs text-gray-600 tabular-nums">
                <p className="font-bold text-gray-700">{CARD}で集まった分（{cards.length}件）</p>
                <p>合計 {yen(cardSum)} ・ 手数料の目安 {yen(cardFee)}（{(CARD_FEE_RATE * 100).toFixed(1)}%） ・ 口座に入る目安 {yen(cardSum - cardFee)}</p>
                <p className="text-gray-400 mt-0.5">正確な金額は Stripe の管理画面の「入金」で確かめてください。返金しても手数料は戻りません（チームの負担）</p>
              </div>
            )}
            <p className="text-[11px] text-gray-400 mt-2">ことら送金の入金を銀行アプリで確かめてから押してください。{CARD}で払われた分は自動で確認済みになります</p>
          </section>
        );
      })}
      <OnboardingSettings ctx={ctx} />
    </div>
  );
}

// 返金の確認。全額をカードに戻す。元の支払いの手数料は戻らずチームの負担になる（Stripe の仕様。2026-10-25 ユーザー確認）
function RefundConfirm({ ctx, target, onDone }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const fee = Math.round((target.amount || 0) * CARD_FEE_RATE);
  const go = async () => {
    setBusy(true);
    try {
      await ctx.actions.refundCardPay(target.ps.id);
      toast('返金しました', 'カードに戻るまで5〜10日ほどかかります');
      onDone();
    } catch (e) { toast('返金できませんでした', e.message); setBusy(false); }
  };
  return (
    <div className="space-y-3 text-sm">
      <p><b>{target.name}の家族</b>に <b className="tabular-nums">{yen(target.amount)}</b> を返金します。</p>
      <ul className="text-xs text-gray-600 space-y-1 list-disc pl-4">
        <li>全額が、払ったカード・Apple Pay に戻ります（反映まで5〜10日ほど）</li>
        <li>元の支払いの手数料（約{yen(fee)}）は戻りません。チームの負担になります</li>
        <li>返金は取り消せません</li>
      </ul>
      <Press onClick={go} disabled={busy} className="w-full bg-red-600 text-white rounded-xl py-3 font-bold disabled:opacity-60">{busy ? '返金しています…' : `${yen(target.amount)} を返金する`}</Press>
      <button onClick={onDone} className="w-full text-sm text-gray-500 py-2">やめる</button>
    </div>
  );
}

// 集金の設定。予定の集金（試合など。練習は集金しないので出さない）か、個別の集金（入会費・ユニフォーム代など。払う子を選ぶ）
function PayForm({ ctx, initial, onDone }) {
  const toast = useToast();
  const [scope, shake] = useShake();
  const editingPay = initial.payment;
  const [kind, setKind] = useState(editingPay?.kind === 'custom' ? 'custom' : 'event');
  const t = todayJst();
  const from = addDays(t, -30), to = addDays(t, 60);
  const events = ctx.data.events.filter((e) => e.date && e.date >= from && e.date <= to && !isCanceled(e) && e.type !== '練習').sort((a, b) => a.date.localeCompare(b.date));
  const [eventId, setEventId] = useState(initial.event?.id || '');
  const [title, setTitle] = useState((editingPay?.kind === 'custom' ? editingPay.title : editingPay?.description) || '');
  const [amount, setAmountRaw] = useState(editingPay?.amount ? String(editingPay.amount) : '');
  // 手数料込みにする前の金額。込みにしたあとは、もう一度は計算しない（押すたびに手数料が重ならないように）。金額を手で変えたら解除
  const [feeBase, setFeeBase] = useState(() => (feeBreakdown(editingPay) ? editingPay.baseAmount : null));
  const setAmount = (v) => { setAmountRaw(v); setFeeBase(null); };
  const [targets, setTargets] = useState(() => new Set(editingPay?.targets || []));
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(null);
  const event = ctx.data.events.find((e) => e.id === eventId);
  const already = (id) => ctx.data.payments.find((p) => p.kind !== 'custom' && payKey(p) === id && p.isActive);
  const input = 'w-full border border-gray-200 rounded-xl p-3 text-base bg-white outline-none focus:ring-2 focus:ring-emerald-500';

  const save = async () => {
    if (kind === 'event' && !event) { setErr('予定を選んでください'); return shake(); }
    if (!title.trim()) { setErr('何の集金か入れてください'); return shake(); }
    if (amount && !(Number(amount) > 0)) { setErr('金額は数字で入れてください'); return shake(); }
    if (kind === 'custom' && !amount) { setErr('金額を入れてください'); return shake(); }
    if (kind === 'custom' && !targets.size) { setErr('払う子を選んでください'); return shake(); }
    try {
      let p;
      if (kind === 'event') {
        const fields = { description: title.trim(), amount: amount ? Number(amount) : null, baseAmount: feeBase || null, isActive: true, ...(ctx.data.payments.some((x) => x.id === event.id) ? {} : { needsConfirm: true }) };
        await ctx.actions.savePayment(event.id, fields, ctx.myName);
        p = { ...fields, id: event.id, eventId: event.id, event };
      } else {
        const fields = { title: title.trim(), amount: Number(amount), baseAmount: feeBase || null, targets: [...targets], isActive: true };
        const id = await ctx.actions.saveCustomPayment(editingPay?.id || null, fields, ctx.myName);
        p = { ...fields, id, kind: 'custom' };
      }
      toast('集金を設定しました', '対象の保護者の「集金」タブに出ます');
      setSaved(p);
    } catch (e) { console.error(e); setErr('保存できませんでした'); }
  };
  const stop = async () => {
    if (editingPay.kind === 'custom') await ctx.actions.saveCustomPayment(editingPay.id, { isActive: false }, ctx.myName);
    else await ctx.actions.savePayment(payKey(editingPay), { description: title, amount, isActive: false }, ctx.myName);
    toast('集金を止めました', '保護者の「集金」タブから消えます');
    onDone();
  };

  if (saved) return (
    <div className="space-y-3 text-center py-2">
      <DrawCheck size={48} />
      <p className="font-bold">{saved.kind === 'custom' ? `「${saved.title}」` : `${dateLabel(saved.event.date)} ${saved.event.title} `}の集金を設定しました</p>
      <p className="text-sm text-gray-500">{saved.kind === 'custom' ? '対象の家族に知らせますか？' : '全体LINEに知らせますか？'} 送り先を選ぶ画面が出ます。</p>
      <Press onClick={async () => { await announce(ctx, toast, saved); onDone(); }} className="w-full flex items-center justify-center gap-2 bg-[#06c755] text-white rounded-xl py-3 font-bold"><Send className="w-4 h-4" />知らせる</Press>
      <button onClick={onDone} className="w-full text-sm text-gray-500 py-2">あとで知らせる</button>
    </div>
  );

  return (
    <div className="space-y-3 text-sm">
      {!editingPay && <Segmented id="pay-kind" value={kind} onChange={setKind} options={[{ value: 'event', label: '予定の集金' }, { value: 'custom', label: '個別の集金' }]} />}
      <div ref={scope} className="space-y-3">
        {kind === 'event' ? (
          <label className="block"><span className="text-xs text-gray-500">どの予定の集金？（練習は出ません）</span>
            <select className={input} value={eventId} onChange={(e) => setEventId(e.target.value)} disabled={!!initial.event}>
              <option value="">予定を選ぶ</option>
              {events.map((e) => <option key={e.id} value={e.id}>{dateLabel(e.date)} {e.title}{already(e.id) && e.id !== initial.event?.id ? '（集金あり）' : ''}</option>)}
            </select>
          </label>
        ) : <p className="text-xs text-gray-500">入会費やユニフォーム代など、予定にひも付かない集金です。払う子を選んでください。</p>}
        <label className="block"><span className="text-xs text-gray-500">何の集金？</span><input className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === 'event' ? '例：大会の参加費、グラウンド代' : '例：入会費、ユニフォーム代'} /></label>
        <label className="block"><span className="text-xs text-gray-500">1人あたりの金額（円）</span><input className={input} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))} placeholder="例：500" /></label>
        <FeeHelper amount={amount} base={feeBase} onApply={(v) => { setAmountRaw(String(v)); setFeeBase(Number(amount)); }} onUndo={() => { setAmountRaw(String(feeBase)); setFeeBase(null); }} />
        {kind === 'custom' && <KidPicker ctx={ctx} value={targets} onChange={setTargets} />}
      </div>
      {kind === 'event' && event && already(event.id) && !initial.event && <p className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2">この予定にはもう集金があります。保存すると内容を書き換えます。</p>}
      {kind === 'event' && <p className="text-xs text-gray-500">払うのは「参加」と答えた子の家族です。人数の限りがある試合は、出場メンバーの家族だけです。</p>}
      <AnimatePresence>{err && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-red-600 bg-red-50 rounded-xl px-3 py-2">{err}</motion.p>}</AnimatePresence>
      <Press onClick={save} className="w-full bg-emerald-600 text-white rounded-xl py-3 font-bold">保存</Press>
      {editingPay && <button onClick={stop} className="w-full text-sm text-red-600 py-2">この集金を止める</button>}
    </div>
  );
}

// カードの手数料分を、集金額そのものに含める手伝い。支払い方法で金額を変える（カードだけ上乗せする）のはカード会社の規約で禁止されているので、
// ことら送金の人も同じ金額になる（余った分はチームの収入）
function FeeHelper({ amount, base, onApply, onUndo }) {
  const n = Number(amount);
  if (!(n > 0)) return null;
  // 込みにしたあと：元の金額と、元に戻すボタンだけ出す（もう一度は押せない）
  if (base) return (
    <div className="flex items-start gap-2 bg-emerald-50 rounded-xl px-3 py-2 text-xs text-emerald-900">
      <Check className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="flex-1">
        <p>手数料込みの金額にしました（元の金額 <span className="tabular-nums">{yen(base)}</span>）</p>
        <p className="text-emerald-800/70">Stripe（ストライプ）の手数料{(CARD_FEE_RATE * 100).toFixed(1)}%分を足して、10円単位で切り上げています。保護者の画面とお知らせに、内訳と手数料の説明が出ます</p>
      </div>
      <button type="button" onClick={onUndo} className="shrink-0 border border-emerald-200 bg-white rounded-lg px-2 py-1 font-bold">元に戻す</button>
    </div>
  );
  const v = withCardFee(n);
  if (v === n) return null;
  return (
    <div className="flex items-start gap-2 bg-gray-50 rounded-xl px-3 py-2 text-xs text-gray-600">
      <Calculator className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="flex-1">
        <p>{CARD}の手数料（Stripe・{(CARD_FEE_RATE * 100).toFixed(1)}%）を含めるなら <b className="tabular-nums">{yen(v)}</b>（10円単位で切り上げ）</p>
        <p className="text-gray-400">カードだけ金額を上げることはできないので、ことら送金の人も同じ金額になります</p>
      </div>
      <button type="button" onClick={() => onApply(v)} className="shrink-0 border border-gray-300 bg-white rounded-lg px-2 py-1 font-bold text-gray-700">この金額にする</button>
    </div>
  );
}

// 個別の集金で払う子を選ぶ（名簿から。名前・背番号で探せる）
function KidPicker({ ctx, value, onChange }) {
  const [q, setQ] = useState('');
  const norm = (s) => String(s || '').replace(/\s/g, '');
  const kids = ctx.data.students.filter((s) => !s.id.startsWith('coach_')).sort((a, b) => jersey(a) - jersey(b));
  const shown = kids.filter((s) => !q || norm(`${s.childName}${s.kana}${s.jerseyNumber}`).includes(norm(q)));
  const toggle = (id) => { const n = new Set(value); if (n.has(id)) n.delete(id); else n.add(id); onChange(n); };
  return (
    <div>
      <div className="flex items-baseline"><span className="text-xs text-gray-500 flex-1">払う子（{value.size}人）</span><button type="button" onClick={() => onChange(new Set(value.size ? [] : kids.map((s) => s.id)))} className="text-xs text-blue-600">{value.size ? '全員外す' : '全員選ぶ'}</button></div>
      <label className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 mt-1 bg-white"><Search className="w-4 h-4 text-gray-400" /><input className="flex-1 py-2 text-base outline-none" value={q} onChange={(e) => setQ(e.target.value)} placeholder="名前や背番号で探す" /></label>
      <div className="grid grid-cols-4 gap-1.5 mt-2 max-h-64 overflow-y-auto">
        {shown.map((s) => {
          const on = value.has(s.id);
          return (
            <button key={s.id} type="button" onClick={() => toggle(s.id)} aria-pressed={on} className={`relative flex flex-col items-center gap-0.5 rounded-xl p-1.5 border-2 ${on ? 'border-emerald-600 bg-emerald-50' : 'border-gray-100 bg-white'}`}>
              <Avatar student={s} photo={ctx.photos[s.id]} size={34} />
              <span className="text-[10px] font-bold truncate w-full text-center">{s.childName}</span>
              {on && <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-emerald-600 text-white grid place-items-center"><Check className="w-3 h-3" /></span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Empty() {
  return <div className="text-center text-gray-400 py-16"><Wallet className="w-10 h-10 mx-auto mb-2 opacity-30" /><p className="text-sm">いま集金はありません</p></div>;
}
