/* global process */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// api/ の中でも先頭が _ のファイルは Vercel の関数（URL）にならない。共通部品の置き場

export const APP_ID = 'soccer-club-mgr-app';

// PowerShell経由で登録した値は先頭にBOMが付くことがあるので除去する（line-schedule-bot と同じ）
export const env = (name) => (process.env[name] || '').replace(/^\uFEFF/, '').trim();

export function admin() {
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
