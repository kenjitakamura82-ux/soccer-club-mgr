// LIFF版の管理用スクリプト（ローカル専用）。リポジトリ直下の Firebase サービスアカウント鍵で動く
//   node scripts/liff-admin.mjs members                     LINEで入ったメンバー一覧
//   node scripts/liff-admin.mjs role <名前の一部> <役割...>   役割を付ける（ride / pay / guide / admin）。役割なしは "-"
//   node scripts/liff-admin.mjs venue <地図> <通用門> <入口>   練習場の案内の画像を入れる
//   node scripts/liff-admin.mjs groups                      line-schedule-bot が入っているLINEグループのID
//   node scripts/liff-admin.mjs rules --deploy              firestore.rules を本番に反映（--deploy なしは内容の確認だけ）
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getSecurityRules } from 'firebase-admin/security-rules';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const keyFile = readdirSync(root).find((f) => f.includes('firebase-adminsdk') && f.endsWith('.json'));
if (!keyFile) throw new Error('サービスアカウント鍵がリポジトリ直下にありません');
initializeApp({ credential: cert(JSON.parse(readFileSync(resolve(root, keyFile), 'utf8'))) });
const db = getFirestore();
const APP_ID = 'soccer-club-mgr-app';
const members = db.collection(`artifacts/${APP_ID}/members`);

const [cmd, ...args] = process.argv.slice(2);

if (cmd === 'members') {
  const snap = await members.get();
  for (const d of snap.docs) {
    const m = d.data();
    console.log(`${m.displayName}\t${(m.roles || []).join(',') || '-'}\t${m.studentId || (m.noFamily ? '(家族なし)' : '(未登録)')}\t${d.id}`);
  }
} else if (cmd === 'role') {
  const [who, ...roles] = args;
  const hit = (await members.get()).docs.filter((d) => (d.data().displayName || '').includes(who) || d.id === who);
  if (hit.length !== 1) throw new Error(`「${who}」に当たるメンバーが ${hit.length} 人います`);
  const next = roles[0] === '-' ? [] : roles;
  await hit[0].ref.update({ roles: next, updatedAt: new Date().toISOString() });
  console.log(`${hit[0].data().displayName}: ${next.join(',') || '役割なし'}`);
} else if (cmd === 'venue') {
  const keys = ['map', 'gateNo', 'gateYes'];
  for (const [i, k] of keys.entries()) {
    const dataUrl = `data:image/jpeg;base64,${readFileSync(args[i]).toString('base64')}`;
    if (dataUrl.length > 1_000_000) throw new Error(`${args[i]} が大きすぎます（1MB以下にしてください）`);
    await db.doc(`artifacts/${APP_ID}/liffContent/venue-${k}`).set({ dataUrl, updatedAt: new Date().toISOString() });
    console.log(`venue-${k}: ${Math.round(dataUrl.length / 1024)}KB`);
  }
} else if (cmd === 'groups') {
  const snap = await db.collection('lineScheduleBot').get();
  for (const d of snap.docs) console.log(d.id, JSON.stringify(d.data()).slice(0, 120));
  const joins = await db.collection('lineScheduleBot').doc('_joins').collection('groups').get();
  for (const d of joins.docs) console.log('joined:', d.id, d.data().joinedAt);
} else if (cmd === 'rules') {
  const source = readFileSync(resolve(root, 'firestore.rules'), 'utf8');
  if (!args.includes('--deploy')) {
    console.log(source);
    console.log('\n（確認だけ。反映するには --deploy を付ける）');
  } else {
    const rs = await getSecurityRules().releaseFirestoreRulesetFromSource(source);
    console.log('反映しました:', rs.name);
  }
} else {
  console.log('使い方はファイル冒頭のコメントを参照');
}
