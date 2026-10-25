import { admin, env, APP_ID } from './_admin.js';

// カード・Apple Pay で払われた集金の返金。会計（pay）か管理者だけが、LINE版の集金確認から行う（2026-10-25 ユーザー決定）。
// 全額を返金する。元の支払いの Stripe 手数料は戻らず、チームの負担になる（Stripe の仕様）。
// 返金したら paymentStatuses を status: 'refunded' にする（その家族は「返金済み」になり、払う必要があるかは会計が判断する）

const stripe = async (method, path, params) => {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${env('STRIPE_SECRET_KEY')}`, ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: params ? new URLSearchParams(params) : undefined,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || `Stripe ${r.status}`);
  return data;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!env('STRIPE_SECRET_KEY')) return res.status(503).json({ error: 'カード払いが使えない設定です' });

  const { auth, db } = admin();
  let claims;
  try { claims = await auth.verifyIdToken((req.headers.authorization || '').replace(/^Bearer /, '')); } catch { return res.status(401).json({ error: 'unauthorized' }); }
  const base = db.collection('artifacts').doc(APP_ID);
  // 役割はトークンより新しいメンバーの記録で確かめる
  const roles = (await base.collection('members').doc(claims.uid).get()).data()?.roles || [];
  if (!claims.member || !roles.some((r) => r === 'pay' || r === 'admin')) return res.status(403).json({ error: '返金できるのは会計と管理者だけです' });

  const psId = String(req.body?.paymentStatusId || '');
  const ref = base.collection('public').doc('data').collection('paymentStatuses').doc(psId);
  const ps = (await ref.get()).data();
  if (!ps || ps.method !== 'card' || !ps.stripeSessionId) return res.status(400).json({ error: 'カード・Apple Pay で払われた集金ではありません' });
  if (ps.status === 'refunded') return res.status(409).json({ error: 'もう返金済みです' });

  const session = await stripe('GET', `checkout/sessions/${ps.stripeSessionId}`);
  if (!session.payment_intent) return res.status(400).json({ error: '支払いが見つかりません' });
  const refund = await stripe('POST', 'refunds', {
    payment_intent: session.payment_intent,
    reason: 'requested_by_customer',
    'metadata[paymentStatusId]': psId,
    'metadata[by]': claims.uid,
  });

  const name = (await base.collection('members').doc(claims.uid).get()).data()?.displayName || '';
  const now = new Date().toISOString();
  await ref.set({ status: 'refunded', isConfirmed: false, refundedAt: now, refundedBy: name, refundId: refund.id, refundAmount: refund.amount, updatedAt: now }, { merge: true });
  console.log(`pay-refund: ${psId} ${refund.amount} JPY (${refund.status}) by ${claims.uid}`);
  return res.status(200).json({ ok: true, amount: refund.amount, status: refund.status });
}
