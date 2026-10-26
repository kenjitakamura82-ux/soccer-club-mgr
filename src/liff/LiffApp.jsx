import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CalendarDays, Wallet, Contact, Car, ListChecks, Receipt, BarChart3, Shield, X, Loader2 } from 'lucide-react';
import { ToastProvider, Skeleton, Avatar, useToast } from './ui.jsx';
import Home from './screens/Home.jsx';
import Register from './screens/Register.jsx';
import { Welcome, Venue } from './screens/Guide.jsx';
import WeekendSend from './screens/WeekendSend.jsx';
import Select from './screens/Select.jsx';
import Onboarding from './screens/Onboarding.jsx';
import Analytics from './screens/Analytics.jsx';
import Coach from './screens/Coach.jsx';
import { MyPay, PayAdmin } from './screens/Pay.jsx';
import Roster, { MyKidSheet } from './screens/Roster.jsx';
import Roles from './screens/Roles.jsx';

// npm run dev で ?mock を付けたときだけ、本番データに触らない見本データで動かす
const loadBackend = () =>
  import.meta.env.DEV && new URLSearchParams(location.search).has('mock') ? import('./mockBackend.js') : import('./backend.js');

export default function LiffApp() {
  const [backend, setBackend] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let unsub = () => {};
    loadBackend()
      .then(async (b) => { await b.connect(); setBackend(b); unsub = b.subscribe(setData); })
      .catch((e) => { console.error(e); setError(e.message || String(e)); });
    return () => unsub();
  }, []);

  if (error) return <Centered><p className="font-bold">開けませんでした</p><p className="text-sm text-gray-500 mt-1">{error}</p><p className="text-xs text-gray-400 mt-4">LINEのグループにあるリンクから開き直してください</p></Centered>;
  // 予定一覧も揃ってから出す（揃う前に出すと一瞬「予定はまだありません」が見えるため）
  if (!backend || !data?.me || !data.students || !data.events) return <Shell><Skeleton /></Shell>;
  return <ToastProvider><Main data={data} actions={backend.actions} /><PaidNotice />{DEBUG && backend.timings && <Timings t={backend.timings} />}</ToastProvider>;
}

// Stripe の支払い画面から戻ってきたとき（?paid=1）。確認済みになるのは Stripe からの知らせが届いてから（ふつう数秒）
function PaidNotice() {
  const toast = useToast();
  const shown = useRef(false);
  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    const q = new URLSearchParams(location.search);
    const paid = q.get('paid') === '1' || new URLSearchParams((q.get('liff.state') || '').replace(/^[^?]*\?/, '')).get('paid') === '1';
    if (paid) toast('お支払いを受け付けました', '数秒で「確認済み」になります');
  }, [toast]);
  return null;
}

// ?debug=1 のとき、読み込みのどこで時間がかかったかを画面の隅に出す（電波が悪いときの遅さの調査用）
const DEBUG = (() => { const q = new URLSearchParams(location.search); return q.has('debug') || /debug/.test(q.get('liff.state') || ''); })();
const T_LABEL = { js: 'プログラム読込', authReady: '前回ログイン確認', liffInit: 'LINE準備', eventsCache: '予定（端末）', eventsServer: '予定（最新）', serverAuth: 'サーバー確認' };
function Timings({ t }) {
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 500); return () => clearInterval(id); }, []);
  return (
    <div className="fixed left-2 bottom-20 z-50 bg-black/75 text-white text-[11px] leading-snug rounded-lg px-2.5 py-2 tabular-nums pointer-events-none">
      <p>経路：{t.path === 'cached' ? '前回ログインで開始' : 'サーバーでログイン'}</p>
      {Object.entries(T_LABEL).map(([k, l]) => <p key={k}>{l}：{k in t ? `${(t[k] / 1000).toFixed(1)}秒` : '…'}</p>)}
    </div>
  );
}

function Centered({ children }) {
  return <div className="min-h-screen grid place-items-center p-8 text-center text-gray-700"><div>{children}</div></div>;
}

function Shell({ children, right }) {
  return (
    <div className="max-w-[480px] mx-auto min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-emerald-600 text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-30" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
        <b className="flex-1 tracking-wider">まちサカ</b>
        {right}
      </header>
      {children}
    </div>
  );
}

function Main({ data, actions }) {
  const me = data.me;
  const roles = me.roles || [];
  const has = (r) => roles.includes(r);
  const students = useMemo(() => Object.fromEntries(data.students.map((s) => [s.id, s])), [data.students]);
  const photos = useMemo(() => Object.fromEntries((data.studentPhotos || []).map((p) => [p.id, p.dataUrl])), [data.studentPhotos]);
  const myKid = me.studentId ? students[me.studentId] : null;
  const ctx = { data, actions, me, has, students, photos, myKid, myName: me.displayName || '保護者' };

  const paidBack = (() => {
    const q = new URLSearchParams(location.search);
    return q.get('paid') === '1' || new URLSearchParams((q.get('liff.state') || '').replace(/^[^?]*\?/, '')).get('paid') === '1';
  })();
  const [tab, setTab] = useState(paidBack ? 'pay' : 'home');
  // 担当の人に届くお知らせの「全体LINEに送る」は ?send=weekend 付きで開く（LIFFのURLを通すと liff.state に入ってくることもある）
  const [overlay, setOverlay] = useState(() => {
    const q = new URLSearchParams(location.search);
    const send = q.get('send') || new URLSearchParams((q.get('liff.state') || '').replace(/^[^?]*\?/, '')).get('send');
    return send === 'weekend' ? 'weekendSend' : null;
  });
  const [kidSheet, setKidSheet] = useState(false);
  const needsRegister = !me.studentId;

  // はじめての準備：案内のカード（?onboarding=1）から開いた家族は、終わるまで開くたびにこの画面。「先に予定を見る」でその回だけ閉じられる
  const fromInvite = (() => {
    const q = new URLSearchParams(location.search);
    return q.get('onboarding') === '1' || new URLSearchParams((q.get('liff.state') || '').replace(/^[^?]*\?/, '')).get('onboarding') === '1';
  })();
  const [later, setLater] = useState(false);
  const ob = me.onboarding;
  useEffect(() => {
    if (fromInvite && !ob?.started) actions.saveOnboarding({ started: true, at: new Date().toISOString() }).catch((e) => console.error(e));
  }, [fromInvite, ob?.started, actions]);
  if ((fromInvite || ob?.started) && !ob?.done && !later) return <Shell><Onboarding ctx={ctx} onLater={() => setLater(true)} /></Shell>;

  if (needsRegister) return <Shell><Register ctx={ctx} onDone={() => setOverlay('welcome')} /></Shell>;

  const tabs = [
    { id: 'home', icon: CalendarDays, label: '予定' },
    myKid && { id: 'pay', icon: Wallet, label: '集金' },
    { id: 'roster', icon: Contact, label: '名簿' },
    has('select') && { id: 'select', icon: ListChecks, label: '選抜' },
    has('ride') && { id: 'coach', icon: Car, label: '配車まとめ' },
    has('pay') && { id: 'payadmin', icon: Receipt, label: '集金確認' },
    has('admin') && { id: 'roles', icon: Shield, label: '管理' },
    has('admin') && { id: 'analytics', icon: BarChart3, label: '分析' },
  ].filter(Boolean);
  const current = tabs.some((t) => t.id === tab) ? tab : 'home';
  const open = (o) => setOverlay(o);

  return (
    <Shell right={myKid
      ? <button onClick={() => setKidSheet(true)} className="flex items-center gap-2 bg-white/15 rounded-full pl-1 pr-3 py-1 text-xs"><Avatar student={myKid} photo={photos[myKid.id]} size={22} />{myKid.childName}の家族</button>
      : <span className="text-xs bg-white/15 rounded-full px-3 py-1">{ctx.myName}</span>}>
      <main className="flex-1 pb-24">
        <AnimatePresence mode="wait">
          <motion.div key={current} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            {current === 'home' && <Home ctx={ctx} open={open} />}
            {current === 'pay' && <MyPay ctx={ctx} />}
            {current === 'roster' && <Roster ctx={ctx} />}
            {current === 'select' && <Select ctx={ctx} />}
            {current === 'coach' && <Coach ctx={ctx} />}
            {current === 'payadmin' && <PayAdmin ctx={ctx} />}
            {current === 'roles' && <Roles ctx={ctx} />}
            {current === 'analytics' && <Analytics ctx={ctx} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="fixed bottom-0 inset-x-0 mx-auto max-w-[480px] bg-white border-t border-gray-200 grid z-30" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)`, paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`relative py-2.5 flex flex-col items-center gap-0.5 whitespace-nowrap tracking-tighter ${tabs.length >= 8 ? "text-[9px]" : "text-[10px]"} font-bold ${current === t.id ? 'text-emerald-600' : 'text-gray-400'}`}>
            {current === t.id && <motion.span layoutId="tab-dot" className="absolute top-0 h-0.5 w-8 bg-emerald-600 rounded-full" />}
            <t.icon className="w-5 h-5" />{t.label}
          </button>
        ))}
      </nav>

      <AnimatePresence>
        {overlay && (
          <motion.div key={overlay} className="fixed inset-0 z-40 bg-gray-50 overflow-y-auto" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 340, damping: 34 }}>
            <div className="max-w-[480px] mx-auto">
              <div className="sticky top-0 z-10 bg-gray-50/90 backdrop-blur px-3 py-2 flex justify-end" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 8px)' }}>
                <button onClick={() => setOverlay(null)} aria-label="閉じる" className="w-9 h-9 rounded-full bg-white shadow grid place-items-center"><X className="w-5 h-5" /></button>
              </div>
              {overlay === 'welcome' && <Welcome ctx={ctx} onVenue={() => setOverlay('venue')} onDone={() => setOverlay(null)} />}
              {overlay === 'venue' && <Venue ctx={ctx} onDone={() => setOverlay(null)} />}
              {overlay === 'weekendSend' && <WeekendSend ctx={ctx} onDone={() => setOverlay(null)} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {myKid && <MyKidSheet ctx={ctx} open={kidSheet} onClose={() => setKidSheet(false)} />}
    </Shell>
  );
}

export function Saving() {
  return <Loader2 className="w-4 h-4 animate-spin" />;
}
