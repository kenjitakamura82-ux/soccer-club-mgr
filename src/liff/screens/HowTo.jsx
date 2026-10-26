import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Hand, Bell, CalendarClock, MessageCircleOff, Lock, Shuffle, Car, ChevronRight, Minus, Plus, CalendarDays, Wallet, Contact } from 'lucide-react';
import { Press } from '../ui.jsx';

// 予定の見かた（使い方）。はじめての準備の3つ目と、予定画面の「使い方」で開く（2026-10-26 ユーザー決定）。
// 見本の上で指が動いて、押したらどうなるかを見せる。動きは CSS のアニメーション（6秒で1周）。見本は幅342pxの箱で、指の位置はその箱の中で決めている
const CSS = `
.hw-A { animation-duration: 6s; animation-iteration-count: infinite; animation-timing-function: ease-in-out; animation-fill-mode: both; }
.hw-finger { position: absolute; left: 0; top: 0; width: 34px; height: 34px; border-radius: 99px; background: rgba(17,24,39,.18); border: 2px solid rgba(17,24,39,.35); pointer-events: none; z-index: 20; }
.hw-toast { position: absolute; left: 6px; right: 6px; top: -8px; background: #111827; color: #fff; border-radius: 14px; padding: 9px 13px; font-size: 13px; z-index: 15; }
@media (prefers-reduced-motion: reduce) { .hw-A { animation: none !important; } .hw-finger, .hw-toast { display: none; } }
@keyframes hw-f1 { 0%,8% { transform: translate(120px, 150px); opacity: 0 } 18% { opacity: 1 } 30% { transform: translate(var(--x1), var(--y1)); } 33% { transform: translate(var(--x1), var(--y1)) scale(.8) } 36% { transform: translate(var(--x1), var(--y1)) scale(1) } 55% { transform: translate(var(--x1), var(--y1)); opacity: 1 } 65%,100% { transform: translate(300px, 160px); opacity: 0 } }
@keyframes hw-pill1 { 0%,33% { opacity: 0; transform: scale(.6) } 38%,92% { opacity: 1; transform: scale(1) } 100% { opacity: 0 } }
@keyframes hw-txt1 { 0%,33% { color: #6b7280 } 38%,92% { color: #fff } 100% { color: #6b7280 } }
@keyframes hw-dot1 { 0%,34% { opacity: 1; transform: scale(1) } 40%,92% { opacity: 0; transform: scale(0) } 100% { opacity: 1 } }
@keyframes hw-bold1 { 0%,34% { opacity: 1 } 40%,92% { opacity: 0 } 100% { opacity: 1 } }
@keyframes hw-thin1 { 0%,34% { opacity: 0 } 40%,92% { opacity: 1 } 100% { opacity: 0 } }
@keyframes hw-toast1 { 0%,36% { transform: translateY(-30px); opacity: 0 } 42%,78% { transform: translateY(0); opacity: 1 } 86%,100% { transform: translateY(-30px); opacity: 0 } }
@keyframes hw-f2 { 0%,6% { transform: translate(150px, 200px); opacity: 0 } 14% { opacity: 1 } 24% { transform: translate(var(--x1), var(--y1)) } 27% { transform: translate(var(--x1), var(--y1)) scale(.8) } 30% { transform: translate(var(--x1), var(--y1)) scale(1) } 44% { transform: translate(var(--x2), var(--y2)) } 47% { transform: translate(var(--x2), var(--y2)) scale(.8) } 50% { transform: translate(var(--x2), var(--y2)) scale(1) } 60%,100% { transform: translate(300px, 220px); opacity: 0 } }
@keyframes hw-conf2 { 0%,27% { opacity: 0; transform: translateY(-6px) scale(.95) } 32%,47% { opacity: 1; transform: none } 52%,100% { opacity: 0; transform: translateY(-6px) scale(.95) } }
@keyframes hw-pill2 { 0%,48% { transform: translateX(0); background: #059669 } 54%,92% { transform: translateX(100%); background: #6b7280 } 100% { transform: translateX(0); background: #059669 } }
@keyframes hw-tA2 { 0%,48% { color: #fff } 54%,92% { color: #6b7280 } 100% { color: #fff } }
@keyframes hw-tB2 { 0%,48% { color: #6b7280 } 54%,92% { color: #fff } 100% { color: #6b7280 } }
@keyframes hw-wait3 { 0%,40% { opacity: 1 } 46%,92% { opacity: 0 } 100% { opacity: 1 } }
@keyframes hw-done3 { 0%,40% { opacity: 0 } 46%,92% { opacity: 1 } 100% { opacity: 0 } }
@keyframes hw-pop3 { 0%,44% { opacity: 0; transform: scale(.3) } 50%,92% { opacity: 1; transform: scale(1) } 100% { opacity: 0 } }
@keyframes hw-box3 { 0%,42% { opacity: .35 } 46%,92% { opacity: 1 } 100% { opacity: .35 } }
@keyframes hw-f4 { 0%,4% { transform: translate(150px, 260px); opacity: 0 } 10% { opacity: 1 } 18% { transform: translate(var(--x1), var(--y1)) } 21% { transform: translate(var(--x1), var(--y1)) scale(.8) } 24% { transform: translate(var(--x1), var(--y1)) scale(1) } 36% { transform: translate(var(--x2), var(--y2)) } 39% { transform: translate(var(--x2), var(--y2)) scale(.8) } 42% { transform: translate(var(--x2), var(--y2)) scale(1) } 56% { transform: translate(var(--x3), var(--y3)) } 59% { transform: translate(var(--x3), var(--y3)) scale(.8) } 62% { transform: translate(var(--x3), var(--y3)) scale(1) } 70%,100% { transform: translate(300px, 280px); opacity: 0 } }
@keyframes hw-seg4 { 0%,21% { opacity: 0; transform: scale(.7) } 25%,94% { opacity: 1; transform: scale(1) } 100% { opacity: 0 } }
@keyframes hw-segt4 { 0%,21% { color: #6b7280 } 25%,94% { color: #fff } 100% { color: #6b7280 } }
@keyframes hw-open4 { 0%,22% { max-height: 0; opacity: 0 } 28%,94% { max-height: 80px; opacity: 1 } 100% { max-height: 0; opacity: 0 } }
@keyframes hw-n3 { 0%,39% { opacity: 1; transform: translateY(0) } 43%,100% { opacity: 0; transform: translateY(-14px) } }
@keyframes hw-n4 { 0%,39% { opacity: 0; transform: translateY(14px) } 43%,94% { opacity: 1; transform: translateY(0) } 100% { opacity: 0 } }
@keyframes hw-toast4 { 0%,60% { transform: translateY(-30px); opacity: 0 } 65%,88% { transform: translateY(0); opacity: 1 } 94%,100% { transform: translateY(-30px); opacity: 0 } }
@keyframes hw-stepA { 0%,62% { background: #ecfdf5; color: #047857 } 66%,94% { background: #059669; color: #fff } 100% { background: #ecfdf5; color: #047857 } }
@keyframes hw-stepB { 0%,72% { background: #ecfdf5; color: #047857 } 76%,94% { background: #059669; color: #fff } 100% { background: #ecfdf5; color: #047857 } }
@keyframes hw-stepC { 0%,82% { background: #ecfdf5; color: #047857 } 86%,94% { background: #059669; color: #fff } 100% { background: #ecfdf5; color: #047857 } }
`;
const an = (name, extra = {}) => ({ className: 'hw-A', style: { animationName: name, ...extra } });
// 指とお知らせの層。見本の箱の左上（内側6px）を原点にして、ほかの要素より上に重ねる
const layer = (name) => ({ className: 'hw-A absolute left-1.5 top-1.5 right-1.5 h-0 z-20', style: { animationName: name } });
const DAYS = ['日', '月', '火', '水', '木', '金', '土'];

function Row({ circle, title, time, sub, third, children }) {
  return (
    <div className="bg-white grid grid-cols-[46px_minmax(0,1fr)_auto] gap-x-3 pl-2.5 pr-3 py-3 rounded-2xl">
      <div className={`row-span-3 w-[46px] h-[46px] rounded-full grid place-items-center text-center leading-none ${circle.cls}`}><div><span className="block text-[9px]">{circle.m}月</span><b className="block text-[17px]">{circle.d}</b><span className="block text-[9px]">{circle.w}</span></div></div>
      {title}
      {time}
      <p className="text-sm truncate mt-0.5 text-gray-700">{sub}</p>
      <div className="row-span-2 self-end justify-self-end">{children}</div>
      {third}
    </div>
  );
}
const Demo = ({ children, vars }) => <div className="relative w-[342px] max-w-full mx-auto bg-gray-100 rounded-2xl p-1.5" style={vars}>{children}</div>;

function Page1({ day }) {
  return (
    <>
      <Head eyebrow="予定の一覧" title="押して答えるだけ" />
      <Demo vars={{ '--x1': '209px', '--y1': '51px' }}>
        <div {...layer('hw-toast1')} ><div className="hw-toast"><b>「参加」で答えました</b><span className="block text-[11px] text-gray-300">あとで変えても連絡は要りません</span></div></div>
        <div {...layer('hw-f1')} ><span className="hw-finger" /></div>
        <Row circle={{ m: 11, d: 8, w: '日', cls: 'bg-orange-100 text-orange-900' }}
          title={<p className="relative truncate"><span {...an('hw-bold1')}><b>市リーグ 第5節</b></span><span className="hw-A absolute left-0 top-0" style={{ animationName: 'hw-thin1' }}>市リーグ 第5節</span></p>}
          time={<p className="text-xs font-bold flex items-center gap-1.5">08:40<span className="hw-A w-[9px] h-[9px] rounded-full bg-blue-600" style={{ animationName: 'hw-dot1' }} /></p>}
          sub="08:40〜　柏の葉公園" third={<p className="text-[13px] text-gray-500 truncate mt-1">締切 10/25(日)</p>}>
          <span className="relative inline-grid grid-cols-2 bg-gray-100 rounded-full p-0.5 text-xs font-bold"><span className="hw-A absolute top-0.5 bottom-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-emerald-600" style={{ animationName: 'hw-pill1' }} /><span className="hw-A relative px-3 py-1.5" style={{ animationName: 'hw-txt1' }}>参加</span><span className="relative px-3 py-1.5 text-gray-500">欠席</span></span>
        </Row>
      </Demo>
      <ul className="space-y-2 text-[13px] text-gray-700">
        <li className="flex gap-2"><span className="mt-1 w-[9px] h-[9px] rounded-full bg-blue-600 shrink-0" />青い点と太字は、まだ答えていない予定です</li>
        <li className="flex gap-2"><Hand className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" />行を押すと、持ち物や地図など詳しく見られます</li>
        <li className="flex gap-2"><Bell className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" />毎週{day}曜の朝、全体LINEに「今週末の予定」が届きます</li>
      </ul>
      <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
        {[['bg-green-100', '練習'], ['bg-orange-100', '試合'], ['bg-blue-100', 'その他'], ['bg-gray-200', '中止']].map(([c, l]) => <div key={l}><span className={`mx-auto block w-6 h-6 rounded-full ${c}`} />{l}</div>)}
      </div>
    </>
  );
}

function Page2() {
  return (
    <>
      <Head eyebrow="出欠のルール" title="締切までなら変えられます" />
      <Demo vars={{ '--x1': '268px', '--y1': '50px', '--x2': '135px', '--y2': '124px' }}>
        <div {...layer('hw-f2')}><span className="hw-finger" /></div>
        <Row circle={{ m: 11, d: 7, w: '土', cls: 'bg-green-100 text-green-900' }}
          title={<p className="truncate">練習</p>} time={<p className="text-xs text-gray-500">09:00</p>}
          sub="09:00〜11:00　柏の葉小" third={<p className="text-[13px] text-gray-500 truncate mt-1">締切 11/4(水)</p>}>
          <span className="relative inline-grid grid-cols-2 bg-gray-100 rounded-full p-0.5 text-xs font-bold"><span className="hw-A absolute top-0.5 bottom-0.5 left-0.5 w-[calc(50%-2px)] rounded-full" style={{ animationName: 'hw-pill2' }} /><span className="hw-A relative px-3 py-1.5" style={{ animationName: 'hw-tA2' }}>参加</span><span className="hw-A relative px-3 py-1.5" style={{ animationName: 'hw-tB2' }}>欠席</span></span>
        </Row>
        <div className="hw-A absolute right-3 top-[96px] w-56 rounded-xl bg-amber-50 border border-amber-200 shadow-lg p-2.5 text-xs text-amber-800 z-10" style={{ animationName: 'hw-conf2' }}>
          <p className="font-bold">「欠席」に変えますか？</p>
          <div className="flex gap-2 mt-2"><span className="flex-1 bg-amber-600 text-white rounded-lg py-1.5 text-center font-bold">変える</span><span className="flex-1 bg-white border border-amber-200 rounded-lg py-1.5 text-center font-bold">やめる</span></div>
        </div>
      </Demo>
      <ol className="space-y-3 text-sm pt-8">
        <Rule icon={CalendarClock} title="締切は予定ごと">ふだんは練習は3日前、試合は2週間前まで。一覧の「締切」で確かめてください</Rule>
        <Rule icon={MessageCircleOff} title="変えても連絡は要りません">変えるときだけ、確かめる画面が出ます</Rule>
        <Rule icon={Lock} title="締切のあとはコーチへ">アプリでは変えられなくなります。急な欠席などは、コーチに直接連絡してください</Rule>
      </ol>
    </>
  );
}

function Page3() {
  const kids = [['悠', 'bg-amber-400'], ['陽', 'bg-sky-500'], ['颯', 'bg-violet-500'], ['陸', 'bg-rose-500'], ['葵', 'bg-teal-500']];
  return (
    <>
      <Head eyebrow="試合のこと" title="3年生からは8人制になります" />
      <div className="space-y-2.5 text-[13px] text-gray-700 leading-relaxed">
        <p>2年生までは1チーム5人の「5人制」、3年生からは1チーム8人の「8人制」が基本で、コートも広くなります。</p>
        <p>公式戦は、出場登録できる人数に限りがあります。そのため大会によっては、コーチが出場メンバーを決めることがあります。<b>基本はみんなで参加する方針です。</b></p>
      </div>
      <Demo>
        <div className="space-y-1.5">
          <Row circle={{ m: 11, d: 15, w: '日', cls: 'bg-orange-100 text-orange-900' }}
            title={<p className="truncate">市民大会</p>} time={<p className="text-xs text-gray-500">08:30</p>}
            sub="08:30〜　市民運動場"
            third={<p className="relative text-[13px] mt-1 h-5"><span className="hw-A absolute left-0 top-0 text-gray-500" style={{ animationName: 'hw-wait3' }}>メンバー調整中</span><span className="hw-A absolute left-0 top-0 text-emerald-700 font-bold whitespace-nowrap" style={{ animationName: 'hw-done3' }}>出場メンバー決定</span></p>}>
            <span className="inline-grid grid-cols-2 bg-gray-100 rounded-full p-0.5 text-xs font-bold"><span className="px-3 py-1.5 rounded-full bg-emerald-600 text-white">参加</span><span className="px-3 py-1.5 text-gray-500">欠席</span></span>
          </Row>
          <div className="hw-A bg-white rounded-2xl p-3" style={{ animationName: 'hw-box3' }}>
            <p className="text-xs font-bold text-gray-500 mb-2">出場メンバー（予定を押すと見られます）</p>
            <div className="flex gap-2.5">
              {kids.map(([k, c], i) => <span key={k} className={`hw-A w-9 h-9 rounded-full text-white grid place-items-center text-xs font-bold ${c}`} style={{ animationName: 'hw-pop3', animationDelay: `${i * 0.1}s` }}>{k}</span>)}
            </div>
          </div>
        </div>
      </Demo>
      <p className="text-[12px] text-gray-500">決まるまでは一覧に「メンバー調整中」と出ます。決まったら、出場する子の家族に配車の希望をお願いします。</p>
    </>
  );
}

function Page4() {
  return (
    <>
      <Head eyebrow="配車（試合のとき）" title="試合会場へは、車を出し合って行きます" />
      <Demo vars={{ '--x1': '38px', '--y1': '14px', '--x2': '98px', '--y2': '85px', '--x3': '133px', '--y3': '135px' }}>
        <div {...layer('hw-toast4')}><div className="hw-toast"><b>配車の希望を保存しました</b><span className="block text-[11px] text-gray-300">配車担当のコーチにだけ届きます</span></div></div>
        <div {...layer('hw-f4')}><span className="hw-finger" /></div>
        <div className="bg-white rounded-2xl p-3 space-y-3">
          <div className="relative grid grid-cols-3 gap-1 bg-gray-100 rounded-lg p-1 text-xs font-bold text-center">
            <span className="hw-A absolute top-1 bottom-1 left-1 w-[calc(33.3%-4px)] bg-emerald-600 rounded-md" style={{ animationName: 'hw-seg4' }} />
            <span className="hw-A relative py-1.5" style={{ animationName: 'hw-segt4' }}>車を出せる</span><span className="relative text-gray-500 py-1.5">乗せてほしい</span><span className="relative text-gray-500 py-1.5">自分で向かう</span>
          </div>
          <div className="hw-A overflow-hidden" style={{ animationName: 'hw-open4' }}>
            <p className="text-xs text-gray-500 mb-1.5">何人乗せられる？（自分の子も含めて）</p>
            <div className="flex items-center gap-4">
              <span className="w-9 h-9 rounded-full border-2 border-gray-200 bg-white grid place-items-center"><Minus className="w-4 h-4" /></span>
              <span className="relative w-8 h-8 text-2xl font-black text-center"><span className="hw-A absolute inset-0" style={{ animationName: 'hw-n3' }}>3</span><span className="hw-A absolute inset-0" style={{ animationName: 'hw-n4' }}>4</span></span>
              <span className="w-9 h-9 rounded-full border-2 border-gray-200 bg-white grid place-items-center"><Plus className="w-4 h-4" /></span>
              <span className="text-sm text-gray-500">人まで</span>
            </div>
          </div>
          <div className="bg-gray-900 text-white rounded-xl py-2.5 text-center font-bold text-sm">希望を保存</div>
        </div>
      </Demo>
      <p className="text-xs text-gray-500">試合に「参加」と答えると、予定の詳しい画面にこの欄が出ます。「乗せてほしい」は乗せてほしい人数、「自分で向かう」は自転車や現地集合など。</p>
      <div className="flex items-start justify-between text-center text-[11px] font-bold">
        {[[Hand, '希望を入れる', '各家族', 'hw-stepA'], [Shuffle, '割り振る', '配車担当のコーチ', 'hw-stepB'], [Car, '配車表が届く', '全体LINE', 'hw-stepC']].map(([I, t, w, a], i) => (
          <div key={t} className="contents">
            {i > 0 && <ChevronRight className="w-4 h-4 text-gray-300 mt-3" />}
            <div className="flex-1"><span className="hw-A mx-auto mb-1 w-10 h-10 rounded-full grid place-items-center" style={{ animationName: a }}><I className="w-5 h-5" /></span>{t}<br /><span className="font-normal text-gray-500">{w}</span></div>
          </div>
        ))}
      </div>
      <p className="text-[12px] text-gray-500">練習は各自で来るので、配車はありません。</p>
    </>
  );
}

function Page5() {
  return (
    <>
      <Head eyebrow="そのほか" title="下のタブの使い分け" />
      <div className="space-y-2 text-sm">
        {[[CalendarDays, '予定', '出欠・配車の希望はここ'], [Wallet, '集金', '大会の参加費などを払う。カード・Apple Pay か、ことら送金'], [Contact, '名簿', 'チームの子の顔と名前・背番号']].map(([I, t, d]) => (
          <div key={t} className="flex gap-3 items-start bg-gray-50 rounded-xl p-3"><I className="w-5 h-5 text-emerald-600 mt-0.5" /><div><p className="font-bold">{t}</p><p className="text-[13px] text-gray-600">{d}</p></div></div>
        ))}
      </div>
      <div className="rounded-xl bg-emerald-50 text-emerald-900 px-3 py-2.5 text-[13px] leading-relaxed">
        <p className="font-bold">回答のお願いが届いたら</p>
        <p>締切が近いのに出欠や配車の希望がまだのとき、コーチからお願いが届くことがあります。もう答えていれば気にしなくて大丈夫です。</p>
      </div>
    </>
  );
}

const Head = ({ eyebrow, title }) => <div><p className="text-[11px] font-bold text-emerald-600">{eyebrow}</p><p className="text-lg font-black">{title}</p></div>;
const Rule = ({ icon: I, title, children }) => (
  <li className="flex gap-3"><span className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-700 grid place-items-center shrink-0"><I className="w-4 h-4" /></span><div><p className="font-bold">{title}</p><p className="text-gray-600 text-[13px]">{children}</p></div></li>
);

export default function HowTo({ ctx, onDone, doneLabel = 'わかった' }) {
  const [page, setPage] = useState(0);
  const [dir, setDir] = useState(1);
  const day = DAYS[Number.isInteger(ctx.data.settings?.weekendDay) ? ctx.data.settings.weekendDay : 5];
  const pages = [<Page1 key="1" day={day} />, <Page2 key="2" />, <Page3 key="3" />, <Page4 key="4" />, <Page5 key="5" />];
  const go = (d) => { setDir(d); setPage((p) => p + d); };
  const last = page === pages.length - 1;
  return (
    <div className="bg-white">
      <style>{CSS}</style>
      <div className="p-4 space-y-4 overflow-hidden">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div key={page} custom={dir} initial={{ opacity: 0, x: dir * 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -dir * 40 }} transition={{ duration: 0.22 }} className="space-y-4">
            {pages[page]}
          </motion.div>
        </AnimatePresence>
        <div className="flex gap-1.5 justify-center pt-1">{pages.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === page ? 'w-5 bg-emerald-600' : 'w-1.5 bg-gray-300'}`} />)}</div>
        <div className="flex gap-2">
          {page > 0 && <Press onClick={() => go(-1)} className="px-5 border border-gray-200 text-gray-700 rounded-xl py-3 font-bold">戻る</Press>}
          <Press onClick={() => (last ? onDone() : go(1))} className="flex-1 bg-emerald-600 text-white rounded-xl py-3 font-bold">{last ? doneLabel : '次へ'}</Press>
        </div>
      </div>
    </div>
  );
}
