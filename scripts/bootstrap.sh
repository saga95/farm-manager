#!/bin/bash

# ─── Bootstrap Script ────────────────────────────────────────────────────────
# One-command project setup for new developers and CI environments.
# Usage: ./scripts/bootstrap.sh [--ci]
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Flags
CI_MODE=false
if [[ "${1:-}" == "--ci" ]]; then
  CI_MODE=true
fi

info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC}   $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERR]${NC}  $1"; }

# ─── Step 1: Check prerequisites ─────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║        Next.js Enterprise Template — Bootstrap          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

info "Checking prerequisites..."

# Node.js
if ! command -v node &> /dev/null; then
  error "Node.js is not installed. Please install Node.js >= 18."
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if (( NODE_VERSION < 18 )); then
  error "Node.js >= 18 required. Found: $(node -v)"
  exit 1
fi
success "Node.js $(node -v)"

# Package manager
if command -v pnpm &> /dev/null; then
  PKG_MGR="pnpm"
elif command -v npm &> /dev/null; then
  PKG_MGR="npm"
else
  error "No package manager found. Install pnpm or npm."
  exit 1
fi
success "Package manager: $PKG_MGR"

# Git
if ! command -v git &> /dev/null; then
  error "Git is not installed."
  exit 1
fi
success "Git $(git --version | cut -d' ' -f3)"

# ─── Step 2: Install dependencies ────────────────────────────────────────────

echo ""
info "Installing dependencies..."

if [[ "$PKG_MGR" == "pnpm" ]]; then
  pnpm install --frozen-lockfile 2>/dev/null || pnpm install
else
  npm ci 2>/dev/null || npm install
fi
success "Dependencies installed"

# ─── Step 3: Setup environment variables ──────────────────────────────────────

echo ""
info "Setting up environment..."

if [[ ! -f .env.local ]]; then
  if [[ -f .env.example ]]; then
    cp .env.example .env.local
    success "Created .env.local from .env.example"
    if [[ "$CI_MODE" == false ]]; then
      warn "Edit .env.local with your project values"
    fi
  else
    # Create a minimal .env.local
    cat > .env.local << 'EOF'
# ─── Application ──────────────────────────────────────────────────────────────
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SITE_NAME=My App

# ─── Feature Flags ────────────────────────────────────────────────────────────
NEXT_PUBLIC_ENABLE_ANALYTICS=false
NEXT_PUBLIC_ENABLE_ERROR_TRACKING=false
NEXT_PUBLIC_ENABLE_PWA=false
NEXT_PUBLIC_ENABLE_I18N=true

# ─── EmailJS (optional) ──────────────────────────────────────────────────────
# NEXT_PUBLIC_EMAILJS_SERVICE_ID=
# NEXT_PUBLIC_EMAILJS_TEMPLATE_ID=
# NEXT_PUBLIC_EMAILJS_PUBLIC_KEY=

# ─── Analytics (optional) ────────────────────────────────────────────────────
# NEXT_PUBLIC_GA_MEASUREMENT_ID=
EOF
    success "Created .env.local with defaults"
  fi
else
  success ".env.local already exists"
fi

# ─── Step 4: Setup Git hooks ─────────────────────────────────────────────────

echo ""
info "Setting up Git hooks..."

if [[ -d .husky ]]; then
  $PKG_MGR run prepare 2>/dev/null || npx husky 2>/dev/null || true
  success "Husky hooks installed"
else
  warn "No .husky directory found — skipping Git hooks"
fi

# ─── Step 5: Validate setup ──────────────────────────────────────────────────

echo ""
info "Validating setup..."

ERRORS=0

# Type check
if $PKG_MGR run type-check &>/dev/null 2>&1; then
  success "TypeScript: no errors"
else
  warn "TypeScript check failed (may need env config)"
  ERRORS=$((ERRORS + 1))
fi

# Lint
if $PKG_MGR run lint &>/dev/null 2>&1; then
  success "ESLint: no errors"
else
  warn "Lint check has warnings (run '$PKG_MGR run lint' for details)"
  ERRORS=$((ERRORS + 1))
fi

# ─── Summary ──────────────────────────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                    Setup Complete!                       ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "  Quick start:"
echo "    $PKG_MGR run dev          — Start dev server"
echo "    $PKG_MGR run build        — Production build"
echo "    $PKG_MGR run test         — Run tests"
echo "    $PKG_MGR run lint         — Lint code"
echo ""

if [[ -d amplify ]]; then
  echo "  Amplify (no sandboxes — local dev talks to the live dev backend):"
  echo "    AMPLIFY_APP_ID=<id> $PKG_MGR run amplify:outputs:dev"
  echo ""
fi

echo "  Deployment (Amplify, on push — see docs/ENVIRONMENTS_AND_RELEASES.md):"
echo "    development  → dev"
echo "    main         → prod (semantic-release tags the version)"
echo ""

if (( ERRORS > 0 )); then
  warn "$ERRORS validation warning(s). Check above for details."
else
  success "All checks passed!"
fi
