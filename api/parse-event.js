import { admin, env } from './_admin.js';

// 予定の入力画面の「AIで読み取る」。LINEの連絡文やふつうの言葉から、予定の項目を取り出す。
// 読み取るだけで保存はしない（保存は画面で中身を確かめてから）。
// 使えるのは配車担当・案内係・管理者（予定を追加できる人）だけ。

// line-schedule-bot と同じモデル。Groqはモデルを定期的に廃止するので、500が出たら https://console.groq.com/docs/models を確認
const MODEL = 'openai/gpt-oss-120b';
const EDITORS = ['ride', 'guide', 'admin'];

const prompt = (todayIso) => `サッカーチーム（少年団）の予定を、コーチが貼り付けた文章から取り出します。
今日の日付: ${todayIso}（日本時間）。「来週土曜」「11/3」など年の無い日付は、今日以降で一番近い日にする。
文章に含まれる予定を日付ごとに全て、次のJSON形式で出力すること。予定が無ければ {"events": []}。
{"events": [{"date": "YYYY-MM-DD", "type": "練習"|"試合"|"その他", "title": "短いタイトル", "gatherTime": "HH:MM または空文字", "startTime": "HH:MM または空文字", "endTime": "HH:MM または空文字", "location": "場所。不明なら空文字", "memo": "持ち物や注意など、上の項目に入らない大事なこと。無ければ空文字"}]}
type: 大会・試合・TM・カップ戦・リーグは試合、グラウンド名と時間だけの記載は練習。
同じ日に練習と試合が並んでいたら別々の予定にする。
時刻・場所は、その予定の記載にあるものだけを入れる（推測で埋めない）。
title は「練習」「市リーグ 第5節」「〇〇カップ」のように短く。`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const text = String(req.body?.text || '').slice(0, 4000);
  if (!text.trim()) return res.status(400).json({ error: 'text is required' });

  const bearer = (req.headers.authorization || '').replace(/^Bearer /, '');
  let claims;
  try { claims = await admin().auth.verifyIdToken(bearer); } catch { return res.status(401).json({ error: 'unauthorized' }); }
  if (!claims.member || !EDITORS.some((r) => (claims.roles || []).includes(r))) return res.status(403).json({ error: 'forbidden' });

  const todayIso = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env('GROQ_API_KEY')}` },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: prompt(todayIso) }, { role: 'user', content: text }],
    }),
  });
  if (!r.ok) {
    console.error('groq', r.status, await r.text());
    return res.status(502).json({ error: 'AIの読み取りに失敗しました' });
  }
  const body = await r.json();
  let events = [];
  try { events = JSON.parse(body.choices?.[0]?.message?.content || '{}').events || []; } catch { events = []; }
  const clean = (e) => ({
    date: /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? e.date : '',
    type: ['練習', '試合', 'その他'].includes(e.type) ? e.type : 'その他',
    title: String(e.title || '').slice(0, 60),
    gatherTime: /^\d{2}:\d{2}$/.test(e.gatherTime) ? e.gatherTime : '',
    startTime: /^\d{2}:\d{2}$/.test(e.startTime) ? e.startTime : '',
    endTime: /^\d{2}:\d{2}$/.test(e.endTime) ? e.endTime : '',
    location: String(e.location || '').slice(0, 80),
    memo: String(e.memo || '').slice(0, 300),
  });
  res.status(200).json({ events: Array.isArray(events) ? events.map(clean).filter((e) => e.date) : [] });
}
