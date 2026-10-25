#!/usr/bin/env bash
# soccer-club-mgr の Vercel（本番）に Stripe（テストモード）の環境変数を入れる。
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

SK=$(ask 'Stripe のシークレットキー（sk_test_ で始まる）' 'sk_test_' 200)
WH=$(ask 'Webhook の署名シークレット（whsec_ で始まる）' 'whsec_' 100)

for name in STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET; do vercel env rm "$name" production -y >/dev/null 2>&1 || true; done
printf '%s' "$SK" | vercel env add STRIPE_SECRET_KEY production
printf '%s' "$WH" | vercel env add STRIPE_WEBHOOK_SECRET production
vercel env ls production | grep -q VITE_CARD_PAY || printf '%s' 'on' | vercel env add VITE_CARD_PAY production

echo
vercel env ls production | grep -E 'STRIPE_|VITE_CARD_PAY'
