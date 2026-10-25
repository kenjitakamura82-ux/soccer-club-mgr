#!/usr/bin/env bash
# soccer-club-mgr の Vercel（本番）に Stripe の環境変数を入れる。
# 引数なし＝テストモード（sk_test_）。「live」を付けると本物のお金が動く本番モード（sk_live_）の鍵を入れる。
# 鍵は貼り付けても画面に出ない（1回だけ貼って Enter）。入ったものは先頭と末尾の数文字と長さだけ表示するので、Stripe の画面と見比べる。
# 入れ終わったら Claude に「入れた」と伝える（再デプロイして試す）
set -euo pipefail
cd /c/Users/kenji/dev/soccer-club-mgr

peek() { printf '%s…%s（%d文字）' "${1:0:12}" "${1: -4}" "${#1}"; }

ask() { # $1=表示 $2=先頭 $3=最大文字数
  local v
  read -rsp "$1 を1回だけ貼り付けて Enter: " v; echo
  v=$(printf '%s' "$v" | tr -d '\r\n')
  case "$v" in "$2"*) ;; *) echo "  $2 で始まっていません。やり直してください" >&2; exit 1;; esac
  if [[ "$v" =~ [[:space:]] ]] || [ "${#v}" -gt "$3" ] || [ "$(grep -o "$2" <<<"$v" | wc -l)" -ne 1 ]; then
    echo "  形が正しくありません（$(peek "$v")）。何回か貼り付けて重なった可能性があります。やり直してください" >&2; exit 1
  fi
  echo "  受け取りました：$(peek "$v")" >&2
  printf '%s' "$v"
}

MODE=${1:-test}
if [ "$MODE" = live ]; then
  echo '本番モード（sk_live_）の鍵を入れます。入れたあとは「カードで払う」で本物のお金が動きます。'
  read -rp '続けるなら「本番」と入力して Enter: ' ok; [ "$ok" = 本番 ] || { echo 'やめました'; exit 1; }
  SK=$(ask 'Stripe の本番シークレットキー（sk_live_ で始まる）' 'sk_live_' 200)
  WHLABEL='本番モードの Webhook の署名シークレット（whsec_ で始まる）'
else
  SK=$(ask 'Stripe のシークレットキー（sk_test_ で始まる）' 'sk_test_' 200)
  WHLABEL='Webhook の署名シークレット（whsec_ で始まる）'
fi
WH=$(ask "$WHLABEL" 'whsec_' 100)

for name in STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET; do vercel env rm "$name" production -y >/dev/null 2>&1 || true; done
printf '%s' "$SK" | vercel env add STRIPE_SECRET_KEY production
printf '%s' "$WH" | vercel env add STRIPE_WEBHOOK_SECRET production
vercel env ls production | grep -q VITE_CARD_PAY || printf '%s' 'on' | vercel env add VITE_CARD_PAY production

echo
vercel env ls production | grep -E 'STRIPE_|VITE_CARD_PAY'
