#!/usr/bin/env bash
# Cognitest — one-command installer for Ubuntu 24.04 (single host, Docker Compose).
#
#   curl -fsSL https://raw.githubusercontent.com/<owner>/<repo>/<branch>/scripts/install.sh \
#     | sudo bash -s -- --domain example.ir --email ops@example.ir
#
# Re-running is safe: secrets, certificates and the admin account are kept;
# code is updated, images are rebuilt and migrations are applied.
set -Eeuo pipefail

REPO_URL="https://github.com/ferya3/iva2.git"
BRANCH="claude/kind-maxwell-ibgtgr"
INSTALL_DIR="/opt/cognitest"
DOMAIN=""
EMAIL=""
ADMIN_EMAIL=""
ADMIN_IPS=""
REGISTRY_MIRROR=""
NPM_REGISTRY=""
SELF_SIGNED=0
DEMO=0
SKIP_DOCKER=0
NO_BUILD=0

usage() {
  cat <<'USAGE'
Usage: install.sh --domain DOMAIN [options]

  --domain DOMAIN          Base domain; serves api.DOMAIN, clinic.DOMAIN, admin.DOMAIN (required)
  --email EMAIL            Let's Encrypt account e-mail (omit together with --self-signed)
  --admin-email EMAIL      First platform administrator (default: admin@DOMAIN)
  --admin-ip IP[,IP…]      Addresses allowed to open admin.DOMAIN (default: your SSH client IP)
  --registry-mirror URL    Docker Hub mirror, e.g. for servers in Iran
  --npm-registry URL       npm mirror used while building images
  --self-signed            Skip Let's Encrypt and use a self-signed certificate
  --demo                   Seed a demo clinic (owner@demo.cognitest.ir / password)
  --dir PATH               Install directory (default /opt/cognitest)
  --repo URL --branch NAME Source repository (private repo: https://<token>@github.com/…)
  --skip-docker-install    Docker Engine + Compose v2 are already installed
  --no-build               Use images already present locally (cognitest/*:VERSION)
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --email) EMAIL="$2"; shift 2 ;;
    --admin-email) ADMIN_EMAIL="$2"; shift 2 ;;
    --admin-ip) ADMIN_IPS="$2"; shift 2 ;;
    --registry-mirror) REGISTRY_MIRROR="$2"; shift 2 ;;
    --npm-registry) NPM_REGISTRY="$2"; shift 2 ;;
    --self-signed) SELF_SIGNED=1; shift ;;
    --demo) DEMO=1; shift ;;
    --dir) INSTALL_DIR="$2"; shift 2 ;;
    --repo) REPO_URL="$2"; shift 2 ;;
    --branch) BRANCH="$2"; shift 2 ;;
    --skip-docker-install) SKIP_DOCKER=1; shift ;;
    --no-build) NO_BUILD=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 2 ;;
  esac
done

log()  { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[!]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[x]\033[0m %s\n' "$*" >&2; exit 1; }
trap 'die "Installation failed at line $LINENO. Fix the error above and run the same command again."' ERR

[[ $EUID -eq 0 ]] || die "Run as root (sudo)."
[[ -n "$DOMAIN" ]] || { usage; die "--domain is required."; }
[[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || die "Invalid domain: $DOMAIN"
[[ $SELF_SIGNED -eq 1 || -n "$EMAIL" ]] || die "Pass --email for Let's Encrypt, or --self-signed."
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@$DOMAIN}"
if [[ -r /etc/os-release ]]; then
  . /etc/os-release
  [[ "${ID:-}" == "ubuntu" && "${VERSION_ID:-}" == "24.04" ]] || warn "Tested on Ubuntu 24.04; detected ${PRETTY_NAME:-unknown}."
fi

# ---------------------------------------------------------------- packages --
log "Installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl git openssl python3 >/dev/null
if [[ $SELF_SIGNED -eq 0 ]]; then apt-get install -y -qq certbot >/dev/null; fi
if [[ $SKIP_DOCKER -eq 0 ]] && ! docker compose version >/dev/null 2>&1; then
  # Ubuntu's own packages: no dependency on download.docker.com (unreachable from some networks).
  apt-get install -y -qq docker.io docker-compose-v2 docker-buildx >/dev/null
fi
command -v systemctl >/dev/null && systemctl enable --now docker >/dev/null 2>&1 || true
docker info >/dev/null 2>&1 || die "Docker daemon is not running."

if [[ -n "$REGISTRY_MIRROR" ]]; then
  log "Configuring Docker registry mirror $REGISTRY_MIRROR"
  mkdir -p /etc/docker
  python3 - "$REGISTRY_MIRROR" <<'PY'
import json, os, sys
path = "/etc/docker/daemon.json"
cfg = json.load(open(path)) if os.path.exists(path) and os.path.getsize(path) else {}
mirrors = cfg.setdefault("registry-mirrors", [])
if sys.argv[1] not in mirrors:
    mirrors.insert(0, sys.argv[1])
json.dump(cfg, open(path, "w"), indent=2)
PY
  if command -v systemctl >/dev/null && systemctl is-active --quiet docker; then
    systemctl restart docker
  else
    warn "Restart the Docker daemon manually to apply the mirror."
  fi
fi

# ------------------------------------------------------------------ source --
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || echo /nonexistent)"
if [[ -f "$SCRIPT_DIR/../docker-compose.yml" ]]; then
  INSTALL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
  log "Using checkout at $INSTALL_DIR"
elif [[ -d "$INSTALL_DIR/.git" ]]; then
  log "Updating $INSTALL_DIR"
  git -C "$INSTALL_DIR" fetch --quiet origin "$BRANCH"
  git -C "$INSTALL_DIR" checkout --quiet "$BRANCH"
  git -C "$INSTALL_DIR" reset --quiet --hard "origin/$BRANCH"
else
  log "Cloning $BRANCH into $INSTALL_DIR"
  git clone --quiet --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
fi
cd "$INSTALL_DIR"
ENV_FILE="$INSTALL_DIR/.env.production"
dc() { docker compose --project-directory "$INSTALL_DIR" --env-file "$ENV_FILE" "$@"; }

# ----------------------------------------------------------------- secrets --
set_env() { # key value — replace or append in .env.production
  if grep -q "^$1=" "$ENV_FILE"; then sed -i "s|^$1=.*|$1=$2|" "$ENV_FILE"; else echo "$1=$2" >>"$ENV_FILE"; fi
}
if [[ ! -f "$ENV_FILE" ]]; then
  log "Generating secrets in .env.production"
  umask 077
  cat >"$ENV_FILE" <<EOF
DOMAIN=$DOMAIN
VERSION=latest
APP_KEY=base64:$(openssl rand -base64 32)
POSTGRES_SUPERUSER_PASSWORD=$(openssl rand -hex 24)
COGNITEST_OWNER_PASSWORD=$(openssl rand -hex 24)
COGNITEST_APP_PASSWORD=$(openssl rand -hex 24)
REDIS_PASSWORD=$(openssl rand -hex 24)
TLS_CERT_DIR=./infrastructure/nginx/certs
NPM_REGISTRY=https://registry.npmjs.org
EOF
  umask 022
else
  log "Keeping existing secrets in .env.production"
fi
set_env DOMAIN "$DOMAIN"
[[ -n "$NPM_REGISTRY" ]] && set_env NPM_REGISTRY "$NPM_REGISTRY"
chmod 600 "$ENV_FILE"

# ------------------------------------------------------------- admin access --
if [[ -z "$ADMIN_IPS" ]]; then ADMIN_IPS="$(awk '{print $1}' <<<"${SSH_CLIENT:-}")"; fi
ALLOW_FILE="infrastructure/nginx/snippets/admin-allowlist.local.conf"
{
  echo "# Generated by scripts/install.sh — addresses allowed to open admin.$DOMAIN"
  IFS=',' read -ra ips <<<"$ADMIN_IPS"
  for ip in "${ips[@]}"; do [[ -n "$ip" ]] && echo "allow $ip;"; done
} >"$ALLOW_FILE"
[[ -n "$ADMIN_IPS" ]] || warn "admin.$DOMAIN is closed to everyone; rerun with --admin-ip to open it."

# ------------------------------------------------------------- certificates --
CERT_DIR="$INSTALL_DIR/infrastructure/nginx/certs"
mkdir -p "$CERT_DIR"
HOSTS=(api clinic admin)
self_signed() {
  log "Creating a self-signed certificate"
  openssl req -x509 -nodes -newkey rsa:2048 -days 825 -subj "/CN=$DOMAIN" \
    -addext "subjectAltName=DNS:api.$DOMAIN,DNS:clinic.$DOMAIN,DNS:admin.$DOMAIN" \
    -keyout "$CERT_DIR/privkey.pem" -out "$CERT_DIR/fullchain.pem" >/dev/null 2>&1
}
if [[ $SELF_SIGNED -eq 1 ]]; then
  [[ -s "$CERT_DIR/fullchain.pem" ]] || self_signed
else
  LIVE="/etc/letsencrypt/live/api.$DOMAIN"
  if [[ ! -d "$LIVE" ]]; then
    log "Requesting Let's Encrypt certificate (DNS of ${HOSTS[*]/%/.$DOMAIN} must point here)"
    dc stop nginx >/dev/null 2>&1 || true
    args=(); for h in "${HOSTS[@]}"; do args+=(-d "$h.$DOMAIN"); done
    if ! certbot certonly --standalone --non-interactive --agree-tos -m "$EMAIL" --cert-name "api.$DOMAIN" "${args[@]}"; then
      warn "Let's Encrypt failed (DNS not pointing here, or port 80 blocked). Falling back to self-signed."
      self_signed
    fi
  fi
  if [[ -d "$LIVE" ]]; then
    cp -L "$LIVE/fullchain.pem" "$LIVE/privkey.pem" "$CERT_DIR/"
    # Renewal uses the standalone authenticator on port 80: stop nginx, copy, start.
    hooks=/etc/letsencrypt/renewal-hooks
    mkdir -p "$hooks/pre" "$hooks/deploy" "$hooks/post"
    printf '#!/bin/sh\ndocker compose --project-directory %s --env-file %s stop nginx\n' "$INSTALL_DIR" "$ENV_FILE" >"$hooks/pre/cognitest.sh"
    printf '#!/bin/sh\ncp -L %s/fullchain.pem %s/privkey.pem %s/\n' "$LIVE" "$LIVE" "$CERT_DIR" >"$hooks/deploy/cognitest.sh"
    printf '#!/bin/sh\ndocker compose --project-directory %s --env-file %s start nginx\n' "$INSTALL_DIR" "$ENV_FILE" >"$hooks/post/cognitest.sh"
    chmod +x "$hooks"/*/cognitest.sh
  fi
fi
chmod 600 "$CERT_DIR/privkey.pem"

# ---------------------------------------------------------------- firewall --
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  log "Opening ports 80/443 in ufw"
  ufw allow 80/tcp >/dev/null && ufw allow 443/tcp >/dev/null
fi

# ------------------------------------------------------------ build & start --
if [[ $NO_BUILD -eq 0 ]]; then
  log "Building images (first run takes several minutes)"
  dc build migrate          # cognitest/api — the worker image is built on top of it
  dc build horizon clinic-web admin-web
fi

log "Starting services and applying migrations"
dc up -d --remove-orphans --no-build || { dc logs migrate | tail -40; die "Services failed to start."; }
for _ in $(seq 1 90); do
  state="$(docker inspect -f '{{.State.Status}} {{.State.ExitCode}}' "$(dc ps -aq migrate)" 2>/dev/null || echo 'starting 0')"
  [[ "$state" == "exited 0" ]] && break
  [[ "$state" == exited* ]] && { dc logs migrate | tail -40; die "Migrations failed."; }
  sleep 2
done
[[ "$state" == "exited 0" ]] || die "Migrations did not finish in time; see: docker compose logs migrate"
dc up -d --no-build   # services that waited for migrate
# Re-render the nginx template and pick up new certificates / allow-list.
dc restart nginx >/dev/null

# ------------------------------------------------------------ admin account --
CRED_FILE="/root/cognitest-admin.txt"
if [[ ! -f "$CRED_FILE" ]]; then
  log "Creating platform administrator $ADMIN_EMAIL"
  out="$(dc exec -T api php artisan cognitest:create-admin "$ADMIN_EMAIL")"
  password="$(sed -n 's/^Password: //p' <<<"$out")"
  umask 077
  printf 'URL: https://admin.%s\nE-mail: %s\nPassword: %s\n' "$DOMAIN" "$ADMIN_EMAIL" "$password" >"$CRED_FILE"
  umask 022
fi

if [[ $DEMO -eq 1 ]]; then
  log "Seeding demo clinic"
  dc exec -T horizon php artisan db:seed --class='Database\Seeders\DemoSeeder' --force
fi

# ------------------------------------------------------------------- check --
sleep 3
code="$(curl -sk --noproxy '*' -o /dev/null -w '%{http_code}' --resolve "api.$DOMAIN:443:127.0.0.1" "https://api.$DOMAIN/api/v1/auth/me" || true)"
[[ "$code" == "401" ]] && log "API is answering (https://api.$DOMAIN)" || warn "API health check returned HTTP $code; see: docker compose logs api nginx"

trap - ERR
cat <<EOF

  Cognitest is installed in $INSTALL_DIR

  Clinic panel : https://clinic.$DOMAIN
  Admin panel  : https://admin.$DOMAIN   (allowed from: ${ADMIN_IPS:-nobody})
  API          : https://api.$DOMAIN/api/v1
  Admin login  : see $CRED_FILE
$( [[ $DEMO -eq 1 ]] && echo "  Demo clinic  : owner@demo.cognitest.ir / password" )

  DNS: create A records for api.$DOMAIN, clinic.$DOMAIN and admin.$DOMAIN pointing to this server.
  Desktop player: build it with MAIN_VITE_API_URL=https://api.$DOMAIN/api/v1 (see docs/operations/deployment.md).
  Logs: docker compose --project-directory $INSTALL_DIR --env-file $ENV_FILE logs -f
EOF
