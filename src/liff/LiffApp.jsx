import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CalendarDays, Wallet, Contact, Car, Receipt, Shield, X, Loader2 } from 'lucide-react';
import { ToastProvider, Skeleton, Avatar } from './ui.jsx';
import Home from './screens/Home.jsx';
import Register from './screens/Register.jsx';
import { Welcome, Venue } from './screens/Guide.jsx';
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
  if (!backend || !data?.me || !data.students) return <Shell><Skeleton /></Shell>;
  return <ToastProvider><Main data={data} actions={backend.actions} /></ToastProvider>;
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

  const [tab, setTab] = useState('home');
  const [overlay, setOverlay] = useState(null);
  const [kidSheet, setKidSheet] = useState(false);
  const needsRegister = !me.studentId && !me.noFamily;

  if (needsRegister) return <Shell><Register ctx={ctx} onDone={() => setOverlay('welcome')} /></Shell>;

  const tabs = [
    { id: 'home', icon: CalendarDays, label: '予定' },
    myKid && { id: 'pay', icon: Wallet, label: '集金' },
    { id: 'roster', icon: Contact, label: '名簿' },
    has('ride') && { id: 'coach', icon: Car, label: '配車まとめ' },
    has('pay') && { id: 'payadmin', icon: Receipt, label: '集金確認' },
    has('admin') && { id: 'roles', icon: Shield, label: '管理' },
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
            {current === 'coach' && <Coach ctx={ctx} />}
            {current === 'payadmin' && <PayAdmin ctx={ctx} />}
            {current === 'roles' && <Roles ctx={ctx} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="fixed bottom-0 inset-x-0 mx-auto max-w-[480px] bg-white border-t border-gray-200 grid z-30" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)`, paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`relative py-2.5 flex flex-col items-center gap-0.5 text-[10px] font-bold ${current === t.id ? 'text-emerald-600' : 'text-gray-400'}`}>
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
