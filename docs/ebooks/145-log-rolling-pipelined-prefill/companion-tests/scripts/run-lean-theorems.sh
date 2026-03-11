#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
LEAN_DIR="${ROOT_DIR}/formal/lean"

if [[ -x "${HOME}/.elan/bin/lake" ]]; then
  export PATH="${HOME}/.elan/bin:${PATH}"
fi

if ! command -v lake >/dev/null 2>&1; then
  echo "Lean Lake tool not found." >&2
  echo "Install Lean via elan (https://leanprover.github.io/elan/) or ensure 'lake' is on PATH." >&2
  exit 1
fi

if [[ ! -d "${LEAN_DIR}" ]]; then
  echo "Lean theorem directory missing: ${LEAN_DIR}" >&2
  exit 1
fi

cd "${LEAN_DIR}"
echo "Running Lean mechanized theorem build"
lake build
