import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimate } from 'motion/react';
import { CircleCheck, Minus, Plus, X } from 'lucide-react';

export const spring = { type: 'spring', stiffness: 380, damping: 30 };

/* ---------- 保存したよの通知（上から降りてくる） ---------- */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef();
  const show = useCallback((title, sub) => {
    clearTimeout(timer.current);
    setToast({ title, sub, key: Date.now() });
    timer.current = setTimeout(() => setToast(null), 2200);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="fixed inset-x-0 top-0 z-[70] flex justify-center px-3 pointer-events-none" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 10px)' }}>
        <AnimatePresence>
          {toast && (
            <motion.div key={toast.key} initial={{ y: -80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -80, opacity: 0 }} transition={spring}
              className="w-full max-w-[440px] bg-gray-900 text-white rounded-2xl px-4 py-3 shadow-xl flex items-center gap-3">
              <CircleCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-bold">{toast.title}</p>
                {toast.sub && <p className="text-xs text-gray-300">{toast.sub}</p>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- 下から出るシート ---------- */
export function Sheet({ open, onClose, title, children }) {
  return (
    <AnimatePresence>
      {open && <SheetBody onClose={onClose} title={title}>{children}</SheetBody>}
    </AnimatePresence>
  );
}

// LINEの中では下スワイプがLINEの画面を閉じる操作と取り合うので、シートは×ボタンか外側のタップで閉じる
function SheetBody({ onClose, title, children }) {
  return (
    <div className="fixed inset-0 z-50">
      <motion.div className="absolute inset-0 bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        className="absolute inset-x-0 bottom-0 mx-auto max-w-[480px] bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[92%]"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={spring}
      >
        <div className="px-4 pt-4 pb-3 flex items-start gap-3">
          {title && <h3 className="font-bold text-base flex-1">{title}</h3>}
          <button onClick={onClose} aria-label="閉じる" className="ml-auto -mt-1 w-9 h-9 rounded-full bg-gray-100 grid place-items-center shrink-0"><X className="w-5 h-5 text-gray-600" /></button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}>{children}</div>
      </motion.div>
    </div>
  );
}

/* ---------- 顔写真（無ければ名前の1文字目） ---------- */
const COLORS = ['#f59e0b', '#3b82f6', '#8b5cf6', '#ef4444', '#ec4899', '#14b8a6', '#0ea5e9', '#84cc16'];
export function Avatar({ student, photo, size = 36 }) {
  const name = student?.childName || '?';
  const color = COLORS[[...(student?.id || name)].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
  return (
    <span className="inline-grid place-items-center rounded-full overflow-hidden text-white font-bold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.4, background: photo ? '#e5e7eb' : color }}>
      {photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : name[0]}
    </span>
  );
}

/* ---------- 読み込み中の仮表示 ---------- */
export function Skeleton({ rows = 4 }) {
  return (
    <div className="p-3 space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl p-3 flex gap-3 items-center border border-gray-100">
          <div className="liff-skel w-11 h-11 rounded-xl" />
          <div className="flex-1 space-y-2"><div className="liff-skel h-3 w-3/5 rounded" /><div className="liff-skel h-2.5 w-2/5 rounded" /></div>
        </div>
      ))}
    </div>
  );
}

/* ---------- 押したときの手ごたえ ---------- */
export function Press({ className = '', children, ...props }) {
  return <motion.button whileTap={{ scale: 0.95 }} transition={{ type: 'spring', stiffness: 600, damping: 20 }} className={className} {...props}>{children}</motion.button>;
}

/* ---------- 選択の目印が滑る ---------- */
export function Segmented({ id, options, value, onChange }) {
  return (
    <div className="relative grid bg-gray-100 rounded-xl p-1" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={`relative py-2.5 px-1 text-[13px] font-bold rounded-lg transition-colors ${value === o.value ? 'text-white' : 'text-gray-500'}`}>
          {value === o.value && <motion.span layoutId={`seg-${id}`} transition={spring} className="absolute inset-0 rounded-lg bg-emerald-600 shadow" />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------- 入力漏れで首を振る ---------- */
export function useShake() {
  const [scope, animate] = useAnimate();
  const shake = () => scope.current && animate(scope.current, { x: [0, -9, 9, -7, 7, -4, 4, 0] }, { duration: 0.45 });
  return [scope, shake];
}

/* ---------- 人数ステッパー（数字が入れ替わる） ---------- */
export function Stepper({ value, min = 1, max = 6, onChange, unit = '人' }) {
  const [scope, shake] = useShake();
  const [dir, setDir] = useState(1);
  const step = (d) => {
    const v = value + d;
    if (v < min || v > max) return shake();
    setDir(d);
    onChange(v);
  };
  return (
    <div ref={scope} className="flex items-center gap-5">
      <Press type="button" onClick={() => step(-1)} aria-label="減らす" className="w-11 h-11 rounded-full border-2 border-gray-200 grid place-items-center bg-white"><Minus className="w-5 h-5" /></Press>
      <span className="relative inline-grid overflow-hidden text-3xl font-black tabular-nums h-10 w-10 place-items-center">
        <AnimatePresence initial={false} custom={dir}>
          <motion.span key={value} custom={dir} className="col-start-1 row-start-1"
            variants={{ enter: (d) => ({ y: d * 30, opacity: 0 }), center: { y: 0, opacity: 1 }, exit: (d) => ({ y: -d * 30, opacity: 0 }) }}
            initial="enter" animate="center" exit="exit" transition={spring}>{value}</motion.span>
        </AnimatePresence>
      </span>
      <Press type="button" onClick={() => step(1)} aria-label="増やす" className="w-11 h-11 rounded-full border-2 border-gray-200 grid place-items-center bg-white"><Plus className="w-5 h-5" /></Press>
      <span className="text-sm text-gray-500">{unit}まで</span>
    </div>
  );
}

/* ---------- 一覧が順に出てくる ---------- */
export const listVariants = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
export const itemVariants = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.2, 0.8, 0.2, 1] } } };

/* ---------- 丸とチェックが描かれる ---------- */
export function DrawCheck({ size = 40 }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <motion.circle cx="20" cy="20" r="17" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45 }} />
      <motion.path d="M12.5 20.5l5 5 10-10.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3, delay: 0.4 }} />
    </svg>
  );
}
