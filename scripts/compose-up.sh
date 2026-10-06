#!/usr/bin/env bash
# One-command FlowOps demo stack (migrate + seed on API start).
# Usage: ./scripts/compose-up.sh   or   ./scripts/compose-up.sh -d
set -euo pipefail
cd "$(dirname "$0")/.."

# Some nested Docker / restricted VMs drop inter-container bridge traffic when
# bridge-nf-call-iptables=1 without working DOCKER FORWARD rules. Turning it
# off restores container-to-container connectivity (ICC). Harmless no-op elsewhere.
if [[ -w /proc/sys/net/bridge/bridge-nf-call-iptables ]]; then
  echo 0 >/proc/sys/net/bridge/bridge-nf-call-iptables 2>/dev/null \
    || sudo -n sh -c 'echo 0 >/proc/sys/net/bridge/bridge-nf-call-iptables' 2>/dev/null \
    || true
fi
if [[ -w /proc/sys/net/bridge/bridge-nf-call-ip6tables ]]; then
  echo 0 >/proc/sys/net/bridge/bridge-nf-call-ip6tables 2>/dev/null \
    || sudo -n sh -c 'echo 0 >/proc/sys/net/bridge/bridge-nf-call-ip6tables' 2>/dev/null \
    || true
fi

exec docker compose up --build "$@"
