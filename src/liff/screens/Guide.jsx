import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Backpack, Shirt, Hash, CalendarCheck, Camera, Map, Ban, Bike, MapPin } from 'lucide-react';
import { Press, listVariants, itemVariants } from '../ui.jsx';

function Section({ icon: Icon, title, children }) {
  return (
    <motion.section variants={itemVariants} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <h3 className="font-bold flex items-center gap-2 mb-2"><Icon className="w-5 h-5 text-emerald-600" />{title}</h3>
      <div className="text-sm text-gray-700 leading-relaxed">{children}</div>
    </motion.section>
  );
}

function Hero({ label, title, sub }) {
  return (
    <div className="bg-emerald-600 text-white rounded-2xl p-5 mx-3">
      <p className="text-xs opacity-80">{label}</p><h2 className="text-xl font-black mt-0.5">{title}</h2><p className="text-sm opacity-90 mt-1">{sub}</p>
    </div>
  );
}

// 小林コーチが新規加入の家族に送っている案内の中身（TeamHubの手順は不要になったので外した）
export function Welcome({ onVenue, onDone }) {
  return (
    <div className="pb-10">
      <Hero label="まちサカ" title="新しく入ったご家族へ" sub="ようこそ！はじめに確認してほしいことをまとめました。" />
      <motion.div className="p-3 space-y-3" variants={listVariants} initial="hidden" animate="show">
        <Section icon={Backpack} title="用意するもの"><ul className="list-disc pl-5"><li>サッカーソックス</li><li>すね当て</li><li>サッカーシューズ</li><li>ウエア上下</li></ul></Section>
        <Section icon={Shirt} title="試合に出るとき"><ul className="list-disc pl-5 space-y-1"><li>ユニフォームの上着を購入します（5,700円・税込）</li><li>パンツとソックスは市販のもので、白を着ます。1組は白を用意してください</li></ul></Section>
        <Section icon={Hash} title="背番号">別途調整します。決まったら、画面右上の「〇〇の家族」から入れてください。</Section>
        <Section icon={CalendarCheck} title="出欠">このアプリの予定画面で回答します。なるべく早めの回答にご協力ください。あとで変えるときの連絡は要りません。</Section>
        <Section icon={Camera} title="顔写真">お子さんの顔が分かる写真を登録してください。みんなが顔と名前を早く覚えられるように。</Section>
      </motion.div>
      <div className="px-3 space-y-2">
        <Press onClick={onVenue} className="w-full flex items-center justify-center gap-2 border-2 border-emerald-600 text-emerald-700 rounded-xl py-3 font-bold bg-white"><Map className="w-4 h-4" />練習場の使い方を見る</Press>
        <Press onClick={onDone} className="w-full bg-emerald-600 text-white rounded-xl py-3 font-bold">予定を見る</Press>
      </div>
    </div>
  );
}

export function Venue({ ctx, onDone }) {
  const [img, setImg] = useState(null);
  useEffect(() => { ctx.actions.loadVenue().then(setImg).catch(() => setImg(null)); }, [ctx.actions]);
  const pic = (k, alt) => img?.[k] ? <img src={img[k]} alt={alt} className="w-full rounded-xl mt-2" /> : null;
  return (
    <div className="pb-10">
      <Hero label="練習場所" title="柏の葉小学校 第二グラウンド" sub="第一グラウンドは工事のため使えません。" />
      <motion.div className="p-3 space-y-3" variants={listVariants} initial="hidden" animate="show">
        {img?.map && <motion.section variants={itemVariants} className="bg-white rounded-2xl p-2 shadow-sm border border-gray-100"><img src={img.map} alt="柏の葉小学校の地図。駐車エリア、入口、第二グラウンドへのルート、AED、トイレの位置" className="w-full rounded-xl" /></motion.section>}
        <Section icon={Ban} title="守ってほしいこと">
          <ol className="list-decimal pl-5 space-y-3">
            <li><b>校舎の中には入らない</b><br />扉が開いていても入らないでください。</li>
            <li><b>通用門は使わない</b><br />下の写真の門は通れません。{pic('gateNo', '通用門。通らない')}</li>
            <li><b>ウサギ小屋に近づかない</b><br />駐車場から体育館の裏を抜けた先にあります。グラウンドへは校舎側から回ってください。</li>
            <li><b>駐車は駐車エリアだけ</b><br />校舎側には停めないでください（地図の「駐車禁止」）。</li>
          </ol>
        </Section>
        <Section icon={Bike} title="自転車・歩いて来るとき">入口はこちら。{pic('gateYes', '自転車・歩行者の入口')}</Section>
        <Section icon={MapPin} title="あると便利な場所">
          <dl className="grid grid-cols-[6em_1fr] gap-y-1"><dt className="text-gray-500">AED</dt><dd>校舎の中庭側（地図の位置）</dd><dt className="text-gray-500">トイレ・倉庫</dt><dd>第一グラウンドの南東の角</dd><dt className="text-gray-500">駐輪</dt><dd>第二グラウンドへのルートの途中</dd></dl>
        </Section>
      </motion.div>
      <div className="px-3"><Press onClick={onDone} className="w-full bg-emerald-600 text-white rounded-xl py-3 font-bold">閉じる</Press></div>
    </div>
  );
}
