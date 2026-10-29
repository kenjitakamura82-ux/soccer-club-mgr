import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { Press, useToast } from '../ui.jsx';
import { weekendDates, weekendFlex, weekendTitle, isCanceled, md, timeLabel, startOf } from '../util.js';

// 週末リマインドを担当の人が全体LINEに送る画面。まちさかマネージャーから担当の人に届くお知らせのボタンで開く（?send=weekend）
export default function WeekendSend({ ctx, onDone }) {
  const toast = useToast();
  // 祝日の表は大きいので、この画面を開いたときだけ読み込む
  const [holidays, setHolidays] = useState(null);
  useEffect(() => { import('@holiday-jp/holiday_jp').then((m) => setHolidays((m.default || m).holidays)).catch(() => setHolidays({})); }, []);
  const dates = weekendDates(holidays || {});
  const events = ctx.data.events.filter((e) => dates.includes(e.date)).sort((a, b) => (a.date + startOf(a)).localeCompare(b.date + startOf(b)));
  const active = events.filter((e) => !isCanceled(e));
  const title = weekendTitle(events);

  const send = async () => {
    try {
      // 送信IDは週末ごとに決まった形（line-schedule-bot の api/weekend-reminder.js と同じ）
      const r = await ctx.actions.share('weekend', (url) => weekendFlex(events, url), { sid: `weekend-${dates[0]}` });
      if (r) { toast('全体LINEに送りました'); onDone(); }
    } catch (e) { toast('送れませんでした', e.message); }
  };

  if (!holidays) return <div className="p-6 text-center text-sm text-gray-500">読み込み中…</div>;
  if (!events.length) return <div className="p-6 text-center text-sm text-gray-500">今週末と祝日の予定はありません。送らなくて大丈夫です。</div>;

  return (
    <div className="p-4 space-y-4">
      <div>
        <h2 className="text-lg font-black">{title}の予定を全体LINEに送る</h2>
        <p className="text-sm text-gray-500 mt-1">下のカードが、あなたの名前で届きます。送り先に全体LINEを選んでください。</p>
      </div>
      <div className="rounded-2xl overflow-hidden bg-white shadow-sm border border-gray-100">
        <div className="bg-emerald-600 text-white px-4 py-3">
          <p className="text-xs text-emerald-100">おはようございます</p>
          <p className="font-bold text-lg">{active.length ? `${title}は${active.length}つの予定です` : `${title}の予定はすべて中止です`}</p>
        </div>
        <ul className="p-4 space-y-3">
          {events.map((e) => {
            const d = md(e.date), cx = isCanceled(e);
            return (
              <li key={e.id} className="flex gap-3 text-sm">
                <span className="w-[52px] shrink-0"><b className={`block tabular-nums ${cx ? 'text-gray-400' : ''}`}>{d.m}/{d.d}</b><span className="text-[11px] text-gray-500">{d.w}</span></span>
                {cx
                  ? <span className="text-gray-400 line-through">{e.title.replace(/【?(中止|休み)】?/g, '').trim() || '予定'} 中止</span>
                  : <span className="min-w-0"><b className="block">{[e.title, timeLabel(e)].filter(Boolean).join(' ')}</b>{e.location && <span className="text-xs text-gray-500">{e.location}</span>}</span>}
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-emerald-700 font-bold text-center pb-3">タップして予定を見る</p>
      </div>
      <Press onClick={send} className="w-full flex items-center justify-center gap-2 bg-[#06c755] text-white rounded-xl py-3.5 font-bold"><Send className="w-4 h-4" />全体LINEに送る</Press>
    </div>
  );
}
