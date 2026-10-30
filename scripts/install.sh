#!/usr/bin/env bash
# Cognitest — one-command installer for Ubuntu 24.04 (single host, Docker Compose).
#
# With a domain (Let's Encrypt):
#   curl -fsSL https://raw.githubusercontent.com/<owner>/<repo>/<branch>/scripts/install.sh \
#     | sudo bash -s -- --domain example.ir --email ops@example.ir
#
# Without a domain yet (server IP, self-signed certificate):
#   curl -fsSL …/scripts/install.sh | sudo bash -s -- --ip
#
# Re-running is safe: secrets, certificates and the admin account are kept;
# code is updated, images are rebuilt and migrations are applied. Switching
# from --ip to --domain later is a re-run with the new option.
set -Eeuo pipefail

REPO_URL="https://github.com/ferya3/iva2.git"
BRANCH="claude/kind-maxwell-ibgtgr"
INSTALL_DIR="/opt/cognitest"
DOMAIN=""
IP=""
IP_MODE=0
EMAIL=""
ADMIN_EMAIL=""
ADMIN_IPS=""
REGISTRY_MIRROR=""
NPM_REGISTRY=""
APT_MIRROR=""
SELF_SIGNED=0
DEMO=0
SKIP_DOCKER=0
NO_BUILD=0

usage() {
  cat <<'USAGE'
Usage: install.sh (--domain DOMAIN | --ip [ADDRESS]) [options]

  --domain DOMAIN          Serve api.DOMAIN, clinic.DOMAIN and admin.DOMAIN
  --ip [ADDRESS]           No domain yet: https://IP (clinic + /api/v1) and https://IP:8443 (admin),
                           self-signed certificate; ADDRESS defaults to the detected public IPv4
  --email EMAIL            Let's Encrypt account e-mail (domain mode)
  --admin-email EMAIL      First platform administrator (default: admin@DOMAIN / admin@cognitest.local)
  --admin-ip IP[,IP…]      Addresses allowed to open the admin panel (default: your SSH client IP)
  --registry-mirror URL    Docker Hub mirror (needed on servers in Iran)
  --npm-registry URL       npm mirror used while building images
  --apt-mirror URL         Debian mirror base for image builds (URL/debian, URL/debian-security)
  --self-signed            Domain mode without Let's Encrypt
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
    --ip)
      IP_MODE=1
      if [[ $# -gt 1 && "$2" != --* ]]; then IP="$2"; shift 2; else shift; fi ;;
    --email) EMAIL="$2"; shift 2 ;;
    --admin-email) ADMIN_EMAIL="$2"; shift 2 ;;
    --admin-ip) ADMIN_IPS="$2"; shift 2 ;;
    --registry-mirror) REGISTRY_MIRROR="$2"; shift 2 ;;
    --npm-registry) NPM_REGISTRY="$2"; shift 2 ;;
    --apt-mirror) APT_MIRROR="$2"; shift 2 ;;
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
STEP="setup"
trap 'die "Installation failed during: $STEP. Fix the error above and run the same command again."' ERR

[[ $EUID -eq 0 ]] || die "Run as root (sudo)."
if [[ -r /etc/os-release ]]; then
  . /etc/os-release
  [[ "${ID:-}" == "ubuntu" && "${VERSION_ID:-}" == "24.04" ]] || warn "Tested on Ubuntu 24.04; detected ${PRETTY_NAME:-unknown}."
fi

# ------------------------------------------------------------------ layout --
if [[ $IP_MODE -eq 1 ]]; then
  [[ -z "$DOMAIN" ]] || die "Use either --domain or --ip, not both."
  if [[ -z "$IP" ]]; then
    IP="$(curl -fs4 --max-time 8 https://api.ipify.org 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')"
  fi
  [[ "$IP" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || die "Could not determine the server IPv4 address; pass it: --ip 1.2.3.4"
  SELF_SIGNED=1
  NGINX_MODE=ip
  PUBLIC_HOST="$IP"
  API_URL="https://$IP/api/v1"
  CLINIC_URL="https://$IP"
  ADMIN_URL="https://$IP:8443"
  ADMIN_EMAIL="${ADMIN_EMAIL:-admin@cognitest.local}"
  CERT_ID="ip:$IP"; CERT_CN="$IP"; CERT_SAN="IP:$IP"
else
  [[ -n "$DOMAIN" ]] || { usage; die "Pass --domain DOMAIN, or --ip to run on the server address."; }
  [[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || die "Invalid domain: $DOMAIN"
  [[ $SELF_SIGNED -eq 1 || -n "$EMAIL" ]] || die "Pass --email for Let's Encrypt, or --self-signed."
  NGINX_MODE=domain
  PUBLIC_HOST="api.$DOMAIN"
  API_URL="https://api.$DOMAIN/api/v1"
  CLINIC_URL="https://clinic.$DOMAIN"
  ADMIN_URL="https://admin.$DOMAIN"
  ADMIN_EMAIL="${ADMIN_EMAIL:-admin@$DOMAIN}"
  CERT_ID="domain:$DOMAIN"; CERT_CN="$DOMAIN"; CERT_SAN="DNS:api.$DOMAIN,DNS:clinic.$DOMAIN,DNS:admin.$DOMAIN"
fi

# ---------------------------------------------------------------- packages --
STEP="installing system packages"
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
set_env DOMAIN "${DOMAIN:-cognitest.local}"
set_env NGINX_MODE "$NGINX_MODE"
set_env PUBLIC_HOST "$PUBLIC_HOST"
set_env PUBLIC_API_URL "${API_URL%/api/v1}"
set_env PUBLIC_CLINIC_URL "$CLINIC_URL"
set_env PUBLIC_ADMIN_URL "$ADMIN_URL"
if [[ -n "$NPM_REGISTRY" ]]; then set_env NPM_REGISTRY "$NPM_REGISTRY"; fi
if [[ -n "$APT_MIRROR" ]]; then set_env DEBIAN_MIRROR "$APT_MIRROR"; fi
chmod 600 "$ENV_FILE"

# --------------------------------------------------------------- resources --
# Size container limits and PostgreSQL/Redis/PHP-FPM memory to this host
# (Docker refuses CPU limits above the number of host CPUs).
STEP="sizing resources"
clamp() { local v=$1; (( v < $2 )) && v=$2; (( v > $3 )) && v=$3; echo "$v"; }
CPUS="$(nproc)"
MEM_MB="$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)"
(( MEM_MB >= 3500 )) || warn "Only ${MEM_MB} MB RAM detected; 4 GB or more is recommended."
set_env API_CPUS "$CPUS"
set_env WORKER_CPUS "$(( CPUS >= 4 ? 2 : 1 ))"
set_env PG_SHARED_BUFFERS "$(clamp $(( MEM_MB / 4 )) 128 4096)MB"
set_env PG_EFFECTIVE_CACHE_SIZE "$(clamp $(( MEM_MB / 2 )) 256 12288)MB"
set_env PG_WORK_MEM "$(( MEM_MB >= 8000 ? 16 : (MEM_MB >= 4000 ? 8 : 4) ))MB"
set_env PG_MAINTENANCE_WORK_MEM "$(clamp $(( MEM_MB / 16 )) 64 512)MB"
set_env PG_MEMORY_LIMIT "$(clamp $(( MEM_MB * 6 / 10 )) 512 8192)m"
REDIS_MB="$(clamp $(( MEM_MB / 16 )) 128 1536)"
set_env REDIS_MAXMEMORY "${REDIS_MB}mb"
set_env REDIS_MEMORY_LIMIT "$(( REDIS_MB + 256 ))m"
FPM_CHILDREN="$(clamp $(( MEM_MB / 200 )) 5 24)"
set_env FPM_MAX_CHILDREN "$FPM_CHILDREN"
set_env API_MEMORY_LIMIT "$(clamp $(( FPM_CHILDREN * 80 + 256 )) 768 2048)m"
set_env WORKER_MEMORY_LIMIT "$(clamp $(( MEM_MB / 4 )) 1024 2048)m"
log "Sized for ${CPUS} CPU / ${MEM_MB} MB RAM"

# ------------------------------------------------------------- admin access --
if [[ -z "$ADMIN_IPS" ]]; then ADMIN_IPS="$(awk '{print $1}' <<<"${SSH_CLIENT:-}")"; fi
ALLOW_FILE="infrastructure/nginx/snippets/admin-allowlist.local.conf"
{
  echo "# Generated by scripts/install.sh — addresses allowed to open $ADMIN_URL"
  IFS=',' read -ra ips <<<"$ADMIN_IPS"
  for ip in "${ips[@]}"; do [[ -n "$ip" ]] && echo "allow $ip;"; done
} >"$ALLOW_FILE"
[[ -n "$ADMIN_IPS" ]] || warn "$ADMIN_URL is closed to everyone; rerun with --admin-ip to open it."

# ------------------------------------------------------------- certificates --
STEP="certificates"
CERT_DIR="$INSTALL_DIR/infrastructure/nginx/certs"
mkdir -p "$CERT_DIR"
self_signed() {
  log "Creating a self-signed certificate for $CERT_CN"
  openssl req -x509 -nodes -newkey rsa:2048 -days 825 -subj "/CN=$CERT_CN" \
    -addext "subjectAltName=$CERT_SAN" -addext "extendedKeyUsage=serverAuth" \
    -keyout "$CERT_DIR/privkey.pem" -out "$CERT_DIR/fullchain.pem" >/dev/null 2>&1
  echo "$CERT_ID" >"$CERT_DIR/.identity"
}
if [[ $SELF_SIGNED -eq 1 ]]; then
  # Re-issue only when the address/domain changed since the last run.
  if [[ ! -s "$CERT_DIR/fullchain.pem" || "$(cat "$CERT_DIR/.identity" 2>/dev/null)" != "$CERT_ID" ]]; then self_signed; fi
else
  HOSTS=(api clinic admin)
  LIVE="/etc/letsencrypt/live/api.$DOMAIN"
  if [[ ! -d "$LIVE" ]]; then
    log "Requesting Let's Encrypt certificate (DNS of api/clinic/admin.$DOMAIN must point here)"
    dc stop nginx >/dev/null 2>&1 || true
    args=(); for h in "${HOSTS[@]}"; do args+=(-d "$h.$DOMAIN"); done
    if ! certbot certonly --standalone --non-interactive --agree-tos -m "$EMAIL" --cert-name "api.$DOMAIN" "${args[@]}"; then
      warn "Let's Encrypt failed (DNS not pointing here, or port 80 blocked). Falling back to self-signed."
      self_signed
    fi
  fi
  if [[ -d "$LIVE" ]]; then
    cp -L "$LIVE/fullchain.pem" "$LIVE/privkey.pem" "$CERT_DIR/"
    echo "letsencrypt:$DOMAIN" >"$CERT_DIR/.identity"
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
  log "Opening ports 80/443/8443 in ufw"
  ufw allow 80/tcp >/dev/null && ufw allow 443/tcp >/dev/null && ufw allow 8443/tcp >/dev/null
fi

# ------------------------------------------------------------ build & start --
if [[ $NO_BUILD -eq 0 ]]; then
  BUILD_LOGS=/var/log/cognitest
  mkdir -p "$BUILD_LOGS"
  # One image at a time (readable output), retried: network failures are
  # usually transient and BuildKit's cache keeps every finished step.
  build_image() {
    local svc="$1" label="$2" log="$BUILD_LOGS/build-$1.log" attempt
    for attempt in 1 2 3; do
      log "Building $label (attempt $attempt/3) — full log: $log"
      if dc --progress=plain build "$svc" 2>&1 | tee "$log" \
          | { grep --line-buffered -E '^#[0-9]+ \[[^]]+ [0-9]+/[0-9]+\]' | cut -c1-110 || true; }; then
        return 0
      fi
      warn "Building $label failed. Error lines:"
      grep -E 'ERROR|E: |Err:|ERR_|error ' "$log" | grep -v '^#[0-9]* \[' | tail -12 >&2 || true
      sleep 10
    done
    case "$svc" in
      migrate|horizon) hint="Debian downloads: rerun with --apt-mirror URL (and --registry-mirror URL)" ;;
      *) hint="npm downloads: rerun with --npm-registry URL" ;;
    esac
    die "Could not build $label after 3 attempts. $hint. Full log: $log"
  }
  STEP="building images"
  build_image migrate "API image"            # cognitest/api — the worker image is built on top of it
  build_image horizon "worker image (scoring + PDF)"
  build_image clinic-web "clinic panel"
  build_image admin-web "admin panel"
fi

STEP="starting services"
log "Starting services and applying migrations"
dc up -d --remove-orphans --no-build || { dc logs migrate | tail -40; die "Services failed to start."; }
state="starting 0"
for _ in $(seq 1 90); do
  state="$(docker inspect -f '{{.State.Status}} {{.State.ExitCode}}' "$(dc ps -aq migrate)" 2>/dev/null || echo 'starting 0')"
  [[ "$state" == "exited 0" ]] && break
  [[ "$state" == exited* ]] && { dc logs migrate | tail -40; die "Migrations failed."; }
  sleep 2
done
[[ "$state" == "exited 0" ]] || die "Migrations did not finish in time; see: docker compose logs migrate"
# Services that waited for migrate; --force-recreate applies changed URLs / layout.
dc up -d --no-build --force-recreate api horizon scheduler clinic-web admin-web >/dev/null
# Re-render the nginx template and pick up new certificates / allow-list.
dc up -d --no-build --force-recreate nginx >/dev/null

# ------------------------------------------------------------ admin account --
STEP="creating the admin account"
CRED_FILE="/root/cognitest-admin.txt"
if [[ ! -f "$CRED_FILE" ]]; then
  log "Creating platform administrator $ADMIN_EMAIL"
  out="$(dc exec -T api php artisan cognitest:create-admin "$ADMIN_EMAIL")"
  password="$(sed -n 's/^Password: //p' <<<"$out")"
  umask 077
  printf 'E-mail: %s\nPassword: %s\n' "$ADMIN_EMAIL" "$password" >"$CRED_FILE"
  umask 022
fi

if [[ $DEMO -eq 1 ]]; then
  log "Seeding demo clinic"
  dc exec -T horizon php artisan db:seed --class='Database\Seeders\DemoSeeder' --force
fi

# ------------------------------------------------------------------- check --
host="${API_URL#https://}"; host="${host%%/*}"
code=000
for _ in $(seq 1 15); do
  code="$(curl -sk --noproxy '*' -o /dev/null -w '%{http_code}' --resolve "$host:443:127.0.0.1" "$API_URL/auth/me" || true)"
  [[ "$code" == "401" ]] && break
  sleep 2
done
if [[ "$code" == "401" ]]; then log "API is answering ($API_URL)"; else warn "API health check returned HTTP $code; see: docker compose logs api nginx"; fi
FINGERPRINT="sha256/$(openssl x509 -in "$CERT_DIR/fullchain.pem" -outform der | openssl dgst -sha256 -binary | base64)"

trap - ERR
echo
echo "  Cognitest is installed in $INSTALL_DIR"
echo
echo "  Clinic panel : $CLINIC_URL"
echo "  Admin panel  : $ADMIN_URL   (allowed from: ${ADMIN_IPS:-nobody})"
echo "  API          : $API_URL"
echo "  Admin login  : $CRED_FILE"
if [[ $DEMO -eq 1 ]]; then echo "  Demo clinic  : owner@demo.cognitest.ir / password"; fi
echo
if [[ $SELF_SIGNED -eq 1 ]]; then
  echo "  The certificate is self-signed: browsers warn once — choose Advanced → Proceed."
  echo "  Desktop player pins it instead of trusting it blindly; build the player with:"
  echo "    MAIN_VITE_API_URL=$API_URL"
  echo "    MAIN_VITE_API_CERT_SHA256=$FINGERPRINT"
  if [[ $IP_MODE -eq 1 ]]; then echo "  Move to a domain later: re-run with --domain DOMAIN --email EMAIL."; fi
else
  echo "  Desktop player: build it with MAIN_VITE_API_URL=$API_URL"
fi
echo "  Logs: docker compose --project-directory $INSTALL_DIR --env-file $ENV_FILE logs -f"
