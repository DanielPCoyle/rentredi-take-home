#!/usr/bin/env bash
# Set up this project's Firebase Realtime Database from a fresh clone:
#   1. preflight — firebase CLI login + Application Default Credentials
#   2. deploy the security rules (database.rules.json)
#   3. seed a few sample users so the API/UI have data (only when /users is empty)
#   4. verify + print the console URL
#
# Idempotent: re-running redeploys the same rules and re-seeds only when /users
# is empty. Pass --reseed to overwrite the sample rows regardless. Real users
# added through the app are never touched (seed writes only the seed-* keys).
#
# Prereqs (one-time, per machine):
#   firebase login
#   gcloud auth application-default login   # the app's firebase-admin uses ADC
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RESEED=0
[[ "${1:-}" == "--reseed" ]] && RESEED=1

info(){ printf '\033[1;34m▸ %s\033[0m\n' "$*"; }
ok(){   printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
warn(){ printf '\033[1;33m! %s\033[0m\n' "$*"; }
die(){  printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# --- resolve project + RTDB instance ----------------------------------------
command -v firebase >/dev/null || die "firebase CLI not found — npm i -g firebase-tools"
command -v node >/dev/null     || die "node not found"
[[ -f .firebaserc ]] || die ".firebaserc missing — run from the repo root"
[[ -f .env ]]        || die ".env missing — copy .env.example and fill the FIREBASE_* values"

# .firebaserc has no .json extension, so parse it explicitly (require() would treat it as JS).
PROJECT="$(node -pe "JSON.parse(require('fs').readFileSync('.firebaserc','utf8')).projects.default")"
DB_URL="$(grep -E '^FIREBASE_DATABASE_URL=' .env | cut -d= -f2- || true)"
[[ -n "$DB_URL" ]] || die "FIREBASE_DATABASE_URL not set in .env"
# instance = first host label of the URL: https://<instance>.firebaseio.com
INSTANCE="$(printf '%s' "$DB_URL" | sed -E 's#https?://([^.]+)\..*#\1#')"

# --- preflight: auth ---------------------------------------------------------
firebase login:list 2>/dev/null | grep -q '@' || die "firebase CLI not logged in — run: firebase login"
ADC="${GOOGLE_APPLICATION_CREDENTIALS:-$HOME/.config/gcloud/application_default_credentials.json}"
[[ -f "$ADC" ]] || warn "no ADC at $ADC — the app (firebase-admin) needs: gcloud auth application-default login"
ok "project=$PROJECT  instance=$INSTANCE"

DB=(--project "$PROJECT" --instance "$INSTANCE")

# --- 1. deploy rules ---------------------------------------------------------
info "deploying database rules (database.rules.json)"
firebase deploy --only database --project "$PROJECT" --non-interactive
ok "rules deployed"

# --- 2. seed sample users (only if empty, or --reseed) -----------------------
CURRENT="$(firebase database:get /users "${DB[@]}" 2>/dev/null || echo null)"
if [[ "$CURRENT" != "null" && "$RESEED" -eq 0 ]]; then
  info "/users already has data — skipping seed (pass --reseed to overwrite the sample rows)"
else
  info "seeding sample users from scripts/seed-users.json"
  firebase database:update /users scripts/seed-users.json "${DB[@]}" --force
  ok "seeded $(node -p "Object.keys(require('./scripts/seed-users.json')).length") sample users"
fi

# --- 3. verify ---------------------------------------------------------------
COUNT="$(firebase database:get /users "${DB[@]}" 2>/dev/null \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s||"null");console.log(v?Object.keys(v).length:0)})')"
ok "RTDB ready — /users has ${COUNT} record(s)"
echo "  Console: https://console.firebase.google.com/project/$PROJECT/database/$INSTANCE/data"
