import { admin, env, APP_ID } from './_admin.js';

// 集金のカード払い。保護者が「カードで払う」を押すと、その家族とその集金に合わせた Stripe の支払い画面を作って URL を返す。
// 金額と子どもは画面から受け取らず、集金の設定（payments/{予定のID}）とメンバー（members/{uid} の studentId）から決める。
// 払い終わると Stripe から api/stripe-webhook.js に知らせが来て、自動で確認済みになる（ことら送金の消し込みをなくすため。2026-10-25 ユーザー決定）。
// 手数料はチームが持つので、保護者には集金額そのままを請求する。

const stripe = async (path, params) => {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('STRIPE_SECRET_KEY')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || `Stripe ${r.status}`);
  return data;
};

const WD = ['日', '月', '火', '水', '木', '金', '土'];
const dateLabel = (s) => { const [y, m, d] = s.split('-').map(Number); return `${m}/${d}(${WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`; };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!env('STRIPE_SECRET_KEY')) return res.status(503).json({ error: 'カード払いはまだ使えません' });

  const { auth, db } = admin();
  let claims;
  try { claims = await auth.verifyIdToken((req.headers.authorization || '').replace(/^Bearer /, '')); } catch { return res.status(401).json({ error: 'unauthorized' }); }
  if (!claims.member) return res.status(403).json({ error: 'forbidden' });

  const eventId = String(req.body?.eventId || '');
  const base = db.collection('artifacts').doc(APP_ID);
  const pub = base.collection('public').doc('data');
  const [member, payment, event] = await Promise.all([
    base.collection('members').doc(claims.uid).get(),
    pub.collection('payments').doc(eventId).get(),
    pub.collection('events').doc(eventId).get(),
  ]);
  const studentId = member.data()?.studentId;
  const p = payment.data();
  const e = event.data();
  if (!studentId) return res.status(400).json({ error: 'お子さんが登録されていません' });
  if (!p?.isActive || !(p.amount > 0) || !e) return res.status(400).json({ error: 'この集金はカードで払えません' });

  const done = (await pub.collection('paymentStatuses').doc(`${eventId}_${studentId}`).get()).data();
  if (done?.isConfirmed) return res.status(409).json({ error: 'もう確認済みです' });

  const kid = (await pub.collection('students').doc(studentId).get()).data();
  // 払い終わったらLINE版に戻す（?paid=1 で「受け付けました」を出す）
  const back = `https://liff.line.me/${env('VITE_LIFF_ID')}`;
  const session = await stripe('checkout/sessions', {
    mode: 'payment',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'jpy',
    'line_items[0][price_data][unit_amount]': String(Math.round(p.amount)),
    'line_items[0][price_data][product_data][name]': `${dateLabel(e.date)} ${e.title} ${p.description || '集金'}`,
    'line_items[0][price_data][product_data][description]': `${kid?.childName || ''}さんの分`,
    'metadata[eventId]': eventId,
    'metadata[studentId]': studentId,
    'metadata[uid]': claims.uid,
    'payment_intent_data[metadata][eventId]': eventId,
    'payment_intent_data[metadata][studentId]': studentId,
    success_url: `${back}?paid=1`,
    cancel_url: back,
    locale: 'ja',
  });
  return res.status(200).json({ url: session.url });
}
