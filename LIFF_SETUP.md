# LINE版（LIFF）のセットアップ

LINEの中で開く画面（`liff.html`）を動かすための手順。パイロット（パパ5人のグループ）用。

## 全体の形

| 部品 | 場所 | 役割 |
|---|---|---|
| `liff.html` + `src/liff/` | soccer-club-mgr（Vercel） | LINEの中で開く画面。出欠・配車・集金・名簿・役割 |
| `api/liff-auth.js` | soccer-club-mgr（Vercel） | LINEのIDトークンを確かめて、Firebaseのログイン用トークンを出す |
| `firestore.rules` | Firebase | 顔写真・メンバー・役割をLINEで入った人だけに絞る |
| `api/weekend-reminder.js` | line-schedule-bot（Vercel） | 金曜7時台に今週末の予定をグループへ送る |

既存のWebアプリ（`index.html`）はそのまま。データ（予定・出欠・配車・集金）は共有する。

## 1. LINE Developers（ユーザーが操作）

1. 今の公式アカウント（line-schedule-bot の Messaging API チャネル）と**同じプロバイダー**を開く
2. 「新規チャネル作成」→「LINEログイン」。アプリタイプは「ウェブアプリ」
3. 作ったチャネルの「LIFF」タブ →「追加」
   - サイズ：Full
   - エンドポイントURL：`https://soccer-club-mgr.vercel.app/liff.html`
   - Scope：`openid`、`profile`
   - 友だち追加オプション：Off
   - Scan QR：Off／モジュールモード：Off
4. LIFFの「シェアターゲットピッカー」をオンにする（配車表の共有と、新しく入った人への案内に使う）
5. チャネルのステータスを「公開済み」にする（「開発中」のままだと、管理者以外は開けない）
6. 控えるもの：**LIFF ID**（`1234567890-xxxxxxx`）、**チャネルID**（LINEログインのチャネル基本設定）

## 2. Vercel の環境変数（ユーザーが操作）

### soccer-club-mgr

| 名前 | 値 |
|---|---|
| `VITE_LIFF_ID` | LIFF ID |
| `LINE_LOGIN_CHANNEL_ID` | LINEログインのチャネルID |
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | line-schedule-bot と同じ値 |

### line-schedule-bot

| 名前 | 値 |
|---|---|
| `REMINDER_GROUP_IDS` | パパグループのID（3で調べる） |
| `NO_EXTRACT_GROUP_IDS` | パパグループのID（同じ。このグループの会話からは予定を拾わない） |
| `LIFF_URL` | `https://liff.line.me/<LIFF ID>` |
| `CRON_SECRET` | 適当な長い文字列 |

## 3. パパグループ

1. パパ5人のLINEグループを作り、公式アカウントを招待する
2. `node scripts/liff-admin.mjs groups` でグループIDを見る（招待されたときに記録される）
3. そのIDを 2 の `REMINDER_GROUP_IDS` と `NO_EXTRACT_GROUP_IDS` に入れて、line-schedule-bot を再デプロイ
4. グループのアナウンスに `https://liff.line.me/<LIFF ID>` を置く

## 4. 初回の設定（Claudeがスクリプトで実行できる）

- `node scripts/liff-admin.mjs rules --deploy`：`firestore.rules` を反映
- `node scripts/liff-admin.mjs venue <地図> <通用門> <入口>`：練習場の画像を入れる
- 管理者が一度開いたあと `node scripts/liff-admin.mjs role 髙村 admin`：最初の管理者を決める。あとは画面の「管理」から付け替えられる

## 開発

`npm run dev` → `http://localhost:5173/soccer-club-mgr/liff.html?mock&as=u_parent`。`?mock` のときは本番データに触らない見本データで動く。`as` は `u_parent` / `u_kawaguchi`（配車担当）/ `u_yamato`（会計）/ `u_kobayashi`（案内係）/ `u_admin`（管理者）。

## 役割

| id | 名前 | できること |
|---|---|---|
| `ride` | 配車担当 | 配車まとめ（割り振り・確定・グループに共有） |
| `pay` | 会計 | 集金確認（入金を確認済みにする） |
| `guide` | 案内係 | 名簿から新しく入った人に案内を送る |
| `admin` | 管理者 | 役割の付け替え、名簿の修正 |

役割はログインのたびにトークンに入る。変えたら次に開いたときから反映。

## 気をつけること

- 既存のWebアプリは匿名ログインのままなので、予定・出欠・配車・集金のデータはこれまで通り誰でも書ける。役割でデータベースから守れているのは、顔写真・メンバー・役割・練習場の画像だけ。全員がLINE版に移ったら、既存のデータもLINEの人だけに絞る
- このリポジトリは公開なので、練習場の画像や子どもの情報はリポジトリに入れない（Firestore に入れる）
