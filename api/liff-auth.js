/* global process */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// LIFF（LINEの中で開く画面）のログイン。
// LINEのIDトークンを LINE のサーバーで確かめてから、Firebase のログイン用トークンを発行する。
// 役割（配車担当・会計など）はトークンに入れて、Firestore のルールでも確かめる。

const APP_ID = 'soccer-club-mgr-app';

// PowerShell経由で登録した値は先頭にBOMが付くことがあるので除去する（line-schedule-bot と同じ）
const env = (name) => (process.env[name] || '').replace(/^\uFEFF/, '').trim();

function admin() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: env('FIREBASE_PROJECT_ID'),
        clientEmail: env('FIREBASE_CLIENT_EMAIL'),
        privateKey: env('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
      }),
    });
  }
  return { auth: getAuth(), db: getFirestore() };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const idToken = req.body?.idToken;
  if (!idToken) return res.status(400).json({ error: 'idToken is required' });

  const verify = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id_token: idToken, client_id: env('LINE_LOGIN_CHANNEL_ID') }),
  });
  if (!verify.ok) return res.status(401).json({ error: 'invalid id token' });
  const line = await verify.json();

  const { auth, db } = admin();
  const uid = `line_${line.sub}`;
  const ref = db.doc(`artifacts/${APP_ID}/members/${uid}`);
  const snap = await ref.get();
  const now = new Date().toISOString();
  const base = { lineUserId: line.sub, displayName: line.name || '', pictureUrl: line.picture || '', lastSeenAt: now };
  if (snap.exists) await ref.update(base);
  else await ref.set({ ...base, roles: [], studentId: null, createdAt: now });

  const data = snap.exists ? snap.data() : {};
  const roles = data.roles || [];
  const token = await auth.createCustomToken(uid, { member: true, roles });
  res.status(200).json({ token, member: { ...base, roles, studentId: data.studentId || null } });
}
