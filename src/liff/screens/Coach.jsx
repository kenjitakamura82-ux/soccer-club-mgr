import { useState } from 'react';
import { LayoutGroup, motion } from 'motion/react';
import { Car, Share2, Wand2, ClipboardList } from 'lucide-react';
import { Press, useToast, spring } from '../ui.jsx';
import { upcomingEvents, isCanceled, dateLabel, matchRides, kidName, ridePlanFlex } from '../util.js';

export default function Coach({ ctx }) {
  const events = upcomingEvents(ctx.data.events, 21).filter((e) => !isCanceled(e));
  const [eventId, setEventId] = useState(events[0]?.id);
  const event = events.find((e) => e.id === eventId);
  if (!event) return <p className="text-center text-sm text-gray-400 py-16">この先3週間の予定はありません</p>;
  return (
    <div className="p-3 space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3 [scrollbar-width:none]">
        {events.map((e) => (
          <Press key={e.id} onClick={() => setEventId(e.id)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold border ${e.id === eventId ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-200'}`}>
            {dateLabel(e.date)} {e.title}
          </Press>
        ))}
      </div>
      {/* 予定を切り替えたら作業中の割り振りも作り直す */}
      <Planner key={event.id} ctx={ctx} event={event} />
    </div>
  );
}

function Planner({ ctx, event }) {
  const { data, students, actions, myName } = ctx;
  const toast = useToast();
  const saved = data.ridePlans?.find((p) => p.id === event.id);
  const [cars, setCars] = useState(saved ? saved.cars : null);
  const [unmatched, setUnmatched] = useState([]);

  const m = matchRides(event, data.rides, data.attendances);
  const name = (id) => kidName(students[id]);
  const auto = () => { setCars(m.cars); setUnmatched(m.unmatched); toast('割り振り案を作りました', '名前を押すと別の車に移せます'); };

  // 名前を押すと次の車へ（最後は「未定」へ）移す
  const move = (sid) => {
    const all = [...cars.map((c) => c.passengers), unmatched];
    const from = all.findIndex((l) => l.includes(sid));
    const next = (from + 1) % all.length;
    const lists = all.map((l) => l.filter((x) => x !== sid));
    lists[next].push(sid);
    setCars(cars.map((c, i) => ({ ...c, passengers: lists[i] })));
    setUnmatched(lists[lists.length - 1]);
  };

  const share = async () => {
    try {
      await actions.saveRidePlan(event.id, cars, myName);
      const r = await actions.shareTargetPicker([ridePlanFlex(event, { cars }, students, actions.liffUrl())]);
      toast(r ? '配車表を共有しました' : '確定しました', r ? undefined : '共有はキャンセルされました');
    } catch (e) { console.error(e); toast('共有できませんでした', e.message); }
  };

  return (
    <div className="space-y-3">
      <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-sm">
        <h3 className="font-bold flex items-center gap-2 mb-2"><ClipboardList className="w-5 h-5 text-emerald-600" />集まった希望</h3>
        <dl className="grid grid-cols-[6.5em_1fr] gap-y-2">
          <dt className="text-gray-500">車を出せる</dt><dd>{m.cars.length ? m.cars.map((c) => `${name(c.driver)}家（${c.area}・${c.capacity}人）`).join('、') : 'なし'}</dd>
          <dt className="text-gray-500">乗せてほしい</dt><dd>{m.riders.length ? m.riders.map((r) => `${name(r.studentId)}（${r.area}）`).join('、') : 'なし'}</dd>
        </dl>
      </section>

      <Press onClick={auto} className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-xl py-3 font-bold"><Wand2 className="w-4 h-4" />{cars ? '割り振りをやり直す' : '自動で割り振る'}</Press>

      {cars && (
        <LayoutGroup>
          <div className="grid grid-cols-2 gap-2">
            {cars.map((c, i) => (
              <motion.div layout key={c.driver} className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm">
                <p className="font-bold text-sm flex items-center gap-1"><Car className="w-4 h-4 text-emerald-600" />{i + 1}号車 {name(c.driver)}家</p>
                <p className="text-[11px] text-gray-500 mb-2">{c.area}から・{c.capacity}席</p>
                <div className="flex flex-col items-start gap-1.5 min-h-8">
                  {c.passengers.map((p) => <Chip key={p} id={p} label={name(p)} onClick={() => move(p)} />)}
                </div>
              </motion.div>
            ))}
          </div>
          <motion.div layout className="bg-amber-50 rounded-2xl p-3">
            <p className="text-xs font-bold text-amber-700 mb-2">未定（車が足りない・あとで調整）</p>
            <div className="flex flex-wrap gap-1.5 min-h-8">{unmatched.map((p) => <Chip key={p} id={p} label={name(p)} onClick={() => move(p)} />)}</div>
          </motion.div>
          <Press onClick={share} className="w-full flex items-center justify-center gap-2 bg-[#06c755] text-white rounded-xl py-3 font-bold"><Share2 className="w-4 h-4" />確定してグループに共有</Press>
          {saved && <p className="text-xs text-gray-500 text-center">確定済み（{saved.confirmedBy}）。保護者の予定画面に配車が出ています</p>}
        </LayoutGroup>
      )}
    </div>
  );
}

function Chip({ id, label, onClick }) {
  return (
    <motion.button layout layoutId={`chip-${id}`} transition={spring} onClick={onClick}
      className="bg-white border border-gray-200 rounded-full px-2.5 py-1 text-xs font-bold shadow-sm">{label}</motion.button>
  );
}
