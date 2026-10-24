#!/usr/bin/env bash
# soccer-club-mgr の Vercel（本番）に Stripe（テストモード）の環境変数を入れる。
# 鍵は貼り付けても画面に出ない。入れ終わったら Claude に「入れた」と伝える（再デプロイして試す）
set -euo pipefail
cd /c/Users/kenji/dev/soccer-club-mgr

read -rsp 'Stripe のシークレットキー（sk_test_ で始まる）を貼り付けて Enter: ' SK; echo
read -rsp 'Webhook の署名シークレット（whsec_ で始まる）を貼り付けて Enter: ' WH; echo
case "$SK" in sk_test_*) ;; *) echo 'sk_test_ で始まっていません。テストモードのキーを使ってください'; exit 1;; esac
case "$WH" in whsec_*) ;; *) echo 'whsec_ で始まっていません'; exit 1;; esac

printf '%s' "$SK" | vercel env add STRIPE_SECRET_KEY production
printf '%s' "$WH" | vercel env add STRIPE_WEBHOOK_SECRET production
printf '%s' 'on'  | vercel env add VITE_CARD_PAY production

echo
vercel env ls production | grep -E 'STRIPE_|VITE_CARD_PAY'
