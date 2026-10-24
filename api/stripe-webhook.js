/* global Buffer */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { admin, env, APP_ID } from './_admin.js';

// Stripe からの「支払いが終わった」知らせ（checkout.session.completed）を受けて、その家族の集金を確認済みにする。
// 書き込みの形は既存アプリ・LINE版の paymentStatuses と同じ（status: transferred、isConfirmed: true）に、method: 'card' を足す。
// Stripe の管理画面で、このURL（/api/stripe-webhook）を checkout.session.completed の送り先に登録し、署名の鍵を STRIPE_WEBHOOK_SECRET に入れる。

// 署名の確認には、手を加える前の本文がそのまま要る
const rawBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  req.on('error', reject);
});

// Stripe-Signature: t=時刻,v1=署名。「時刻.本文」を鍵で HMAC-SHA256 したものと突き合わせる。5分より古いものは断る
function verify(body, header, secret) {
  const parts = Object.fromEntries(String(header || '').split(',').map((kv) => kv.split('=')));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const expected = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  return String(header).split(',').filter((kv) => kv.startsWith('v1=')).some((kv) => {
    const sig = Buffer.from(kv.slice(3), 'hex');
    return sig.length === expected.length / 2 && timingSafeEqual(sig, Buffer.from(expected, 'hex'));
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('POST only');
  const body = await rawBody(req);
  if (!env('STRIPE_WEBHOOK_SECRET') || !verify(body, req.headers['stripe-signature'], env('STRIPE_WEBHOOK_SECRET'))) {
    return res.status(400).send('bad signature');
  }
  const event = JSON.parse(body);
  if (event.type !== 'checkout.session.completed') return res.status(200).json({ ignored: event.type });

  const s = event.data.object;
  const { eventId, studentId } = s.metadata || {};
  if (s.payment_status !== 'paid' || !eventId || !studentId) return res.status(200).json({ ignored: 'not paid' });

  const now = new Date().toISOString();
  const { db } = admin();
  await db.collection('artifacts').doc(APP_ID).collection('public').doc('data').collection('paymentStatuses').doc(`${eventId}_${studentId}`).set({
    eventId, studentId, status: 'transferred', method: 'card',
    isConfirmed: true, confirmedBy: 'カード決済', confirmedAt: now, transferredAt: now,
    amount: s.amount_total, stripeSessionId: s.id, livemode: !!s.livemode, updatedAt: now,
  }, { merge: true });
  console.log(`stripe-webhook: confirmed ${eventId}_${studentId} (${s.amount_total} JPY, live=${s.livemode})`);
  return res.status(200).json({ ok: true });
}
