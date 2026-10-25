import { useState } from 'react';
import { motion } from 'motion/react';
import { Check, Send } from 'lucide-react';
import { entryFlex } from '../util.js';
import { Sheet, Press, Segmented, useToast, spring } from '../ui.jsx';

export const ROLES = [
  { id: 'coach', name: 'コーチ', desc: '名簿に子どもを追加し、名前・背番号を直す' },
  { id: 'ride', name: '配車担当', desc: '配車の希望を見て割り振り、グループに共有する' },
  { id: 'select', name: '選抜担当', desc: '選抜ありの試合で、出る子を選んで確定する' },
  { id: 'pay', name: '会計', desc: '家族ごとの支払い状況を見て、確認済みにする' },
  { id: 'guide', name: '案内係', desc: '新しく入った人に案内を送る' },
  { id: 'admin', name: '管理者', desc: '役割の付け替え、名簿の修正、分析' },
];

export default function Roles({ ctx }) {
  const members = ctx.data.members || [];
  const [editing, setEditing] = useState(null);
  return (
    <div className="p-3 space-y-3">
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-100">
        {ROLES.map((r) => {
          const holders = members.filter((m) => (m.roles || []).includes(r.id));
          return (
            <div key={r.id} className="p-4">
              <div className="flex items-center"><b className="flex-1">{r.name}</b><Press onClick={() => setEditing(r)} className="text-xs border border-gray-200 rounded-lg px-3 py-1">変更</Press></div>
              <p className="text-xs text-gray-500 mt-0.5 mb-2">{r.desc}</p>
              <div className="flex flex-wrap gap-1.5">
                {holders.length ? holders.map((m) => <motion.span layout key={m.id} className="text-xs bg-gray-100 rounded-full px-2.5 py-1">{m.displayName}</motion.span>) : <span className="text-xs text-gray-400">まだいない</span>}
              </div>
            </div>
          );
        })}
      </section>
      <ReminderDay ctx={ctx} />
      <WeekendMode ctx={ctx} />
      <EntryCard ctx={ctx} />
      <p className="text-xs text-gray-400 px-1">役割を変えると、その人が次にアプリを開いたときから反映されます。役割のない人は、出欠・配車の希望・送金報告・名簿を見ることだけできます。</p>
      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing && `${editing.name}にする人`}>
        {editing && <RolePicker ctx={ctx} role={editing} onClose={() => setEditing(null)} />}
      </Sheet>
    </div>
  );
}

// 週末リマインド（グループに届く「今週末の予定」）を送る曜日
const DAYS = ['日', '月', '火', '水', '木', '金', '土'];
function ReminderDay({ ctx }) {
  const toast = useToast();
  const current = Number.isInteger(ctx.data.settings?.weekendDay) ? ctx.data.settings.weekendDay : 5;
  // 説明は送り方（下の「週末リマインドの送り方」）に合わせる
  const relay = ctx.data.settings?.weekendMode === 'relay';
  const relayName = (ctx.data.members || []).find((m) => m.id === (ctx.data.settings?.relayUid || (ctx.data.members || []).find((x) => (x.roles || []).includes('guide'))?.id))?.displayName;
  const change = async (d) => {
    if (d === current) return;
    await ctx.actions.saveReminderDay(d);
    toast(`${DAYS[d]}曜日に送ります`, '次の朝7時台から反映されます');
  };
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      <b>週末リマインドを送る曜日</b>
      <p className="text-xs text-gray-500 mt-0.5 mb-3">{relay
        ? `選んだ曜日の朝7時台に、${relayName || '担当の人'}さんへ「今週末の予定を全体LINEに送りますか？」のお知らせが届きます。${relayName || '担当の人'}さんがボタンから全体LINEに送ります（届く時刻は1時間ほどずれることがあります）。`
        : '選んだ曜日の朝7時台に、まちさかマネージャーが「今週末の予定」をグループに直接送ります（1時間ほどずれることがあります）。'}</p>
      <Segmented id="reminder-day" value={current} onChange={change} options={[1, 2, 3, 4, 5, 6].map((d) => ({ value: d, label: DAYS[d] }))} />
    </section>
  );
}

// 週末リマインドの送り方。全体LINEに広げるときに「担当の人に頼む」に切り替える（2026-10-24 ユーザー決定）。
// 頼む形なら、公式アカウントが使う通数は担当の人への1通だけで済む
function WeekendMode({ ctx }) {
  const toast = useToast();
  const s = ctx.data.settings || {};
  const members = (ctx.data.members || []).slice().sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '', 'ja'));
  const mode = s.weekendMode === 'relay' ? 'relay' : 'group';
  const guide = members.find((m) => (m.roles || []).includes('guide'));
  const relayUid = s.relayUid || guide?.id || '';
  const save = async (m, uid) => {
    if (m === 'relay' && !uid) return toast('頼む人を選んでください');
    await ctx.actions.saveWeekendMode(m, uid);
    const who = members.find((x) => x.id === uid)?.displayName;
    toast(m === 'relay' ? `${who}さんに頼みます` : 'グループに直接送ります', '次の送る日から反映されます');
  };
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
      <div>
        <b>週末リマインドの送り方</b>
        <p className="text-xs text-gray-500 mt-0.5">「担当の人に頼む」にすると、まちさかマネージャーが担当の人に1対1でお知らせし、担当の人がボタンから全体LINEに送ります。公式アカウントの通数は1通で済みます。</p>
      </div>
      <Segmented id="weekend-mode" value={mode} onChange={(m) => save(m, relayUid)} options={[{ value: 'group', label: 'グループに直接送る' }, { value: 'relay', label: '担当の人に頼む' }]} />
      {mode === 'relay' && (
        <label className="block"><span className="text-xs text-gray-500">頼む人（まちさかマネージャーを友だち追加している人）</span>
          <select className="w-full border border-gray-200 rounded-xl p-3 text-base bg-white" value={relayUid} onChange={(e) => save('relay', e.target.value)}>
            {!relayUid && <option value="">選ぶ</option>}
            {members.map((m) => <option key={m.id} value={m.id}>{m.displayName}{(m.roles || []).includes('guide') ? '（案内係）' : ''}</option>)}
          </select>
        </label>
      )}
    </section>
  );
}

// グループのアナウンスに固定する入口カードを、自分の発言としてグループに送る
function EntryCard({ ctx }) {
  const toast = useToast();
  const send = async () => {
    try {
      const day = DAYS[Number.isInteger(ctx.data.settings?.weekendDay) ? ctx.data.settings.weekendDay : 5];
      const r = await ctx.actions.share('entry', (url) => entryFlex(url, day));
      if (r) toast('入口カードを送りました', '送ったカードを長押しして、アナウンスに固定してみてください');
    } catch (e) { toast('送れませんでした', e.message); }
  };
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      <b>グループの入口</b>
      <p className="text-xs text-gray-500 mt-0.5 mb-3">「まちサカの予定はこちら」のカードをグループに送ります。送ったカードを長押しして、アナウンスに固定してください。</p>
      <Press onClick={send} className="w-full flex items-center justify-center gap-2 bg-[#06c755] text-white rounded-xl py-2.5 font-bold text-sm"><Send className="w-4 h-4" />入口カードをグループに送る</Press>
    </section>
  );
}

function RolePicker({ ctx, role, onClose }) {
  const toast = useToast();
  const members = (ctx.data.members || []).slice().sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '', 'ja'));
  const kid = (m) => ctx.students[m.studentId]?.childName;
  const toggle = async (m) => {
    const cur = m.roles || [];
    const on = cur.includes(role.id);
    if (on && role.id === 'admin' && members.filter((x) => (x.roles || []).includes('admin')).length === 1) return toast('管理者は1人以上必要です');
    await ctx.actions.setRoles(m.id, on ? cur.filter((r) => r !== role.id) : [...cur, role.id]);
  };
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 mb-1">一度でもアプリを開いた人が出ます</p>
      {members.map((m) => {
        const on = (m.roles || []).includes(role.id);
        return (
          <Press key={m.id} onClick={() => toggle(m)} className={`w-full flex items-center gap-3 text-left rounded-xl border-2 p-3 ${on ? 'border-emerald-600 bg-emerald-50' : 'border-gray-100 bg-white'}`}>
            <span className={`w-5 h-5 rounded-md border-2 grid place-items-center ${on ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-gray-300'}`}>
              {on && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring}><Check className="w-3.5 h-3.5" /></motion.span>}
            </span>
            <span className="text-sm">{m.displayName}{kid(m) && <span className="text-gray-500">（{kid(m)}の家族）</span>}</span>
          </Press>
        );
      })}
      <Press onClick={onClose} className="w-full bg-emerald-600 text-white rounded-xl py-3 font-bold mt-2">決定</Press>
    </div>
  );
}
