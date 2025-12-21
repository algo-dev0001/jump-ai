#!/bin/bash

# Deployment Verification Script
# Usage: ./scripts/verify-deployment.sh <backend-url> <frontend-url>

BACKEND_URL=${1:-"http://localhost:3001"}
FRONTEND_URL=${2:-"http://localhost:3000"}

echo "🔍 AI Advisor Agent - Deployment Verification"
echo "=============================================="
echo ""
echo "Backend URL:  $BACKEND_URL"
echo "Frontend URL: $FRONTEND_URL"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass() {
  echo -e "${GREEN}✓${NC} $1"
}

fail() {
  echo -e "${RED}✗${NC} $1"
  FAILED=1
}

warn() {
  echo -e "${YELLOW}⚠${NC} $1"
}

FAILED=0

echo "1. Backend Health Checks"
echo "------------------------"

# Basic health check
HEALTH=$(curl -s "$BACKEND_URL/health" 2>/dev/null)
if [ $? -eq 0 ] && echo "$HEALTH" | grep -q '"status":"ok"'; then
  pass "Basic health check passed"
else
  fail "Basic health check failed"
fi

# Detailed health check
DETAILED=$(curl -s "$BACKEND_URL/health/detailed" 2>/dev/null)
if [ $? -eq 0 ]; then
  if echo "$DETAILED" | grep -q '"database":{"status":"ok"'; then
    pass "Database connection OK"
  else
    fail "Database connection failed"
  fi
  
  if echo "$DETAILED" | grep -q '"openai":{"status":"ok"'; then
    pass "OpenAI API key configured"
  else
    fail "OpenAI API key missing or invalid"
  fi
  
  if echo "$DETAILED" | grep -q '"google":{"status":"ok"'; then
    pass "Google OAuth configured"
  else
    warn "Google OAuth not configured"
  fi
else
  fail "Could not reach detailed health endpoint"
fi

echo ""
echo "2. API Endpoints"
echo "----------------"

# API info
API_INFO=$(curl -s "$BACKEND_URL/api" 2>/dev/null)
if [ $? -eq 0 ] && echo "$API_INFO" | grep -q '"version"'; then
  pass "API info endpoint responding"
else
  fail "API info endpoint not responding"
fi

# Auth endpoints (should redirect or return 401)
AUTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/auth/me" 2>/dev/null)
if [ "$AUTH_CHECK" = "401" ] || [ "$AUTH_CHECK" = "403" ]; then
  pass "Auth middleware active (returns 401/403 for unauthenticated)"
else
  warn "Auth endpoint returned $AUTH_CHECK (expected 401 or 403)"
fi

echo ""
echo "3. Frontend"
echo "-----------"

# Frontend page
FRONTEND_CHECK=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL" 2>/dev/null)
if [ "$FRONTEND_CHECK" = "200" ]; then
  pass "Frontend homepage loading"
else
  fail "Frontend not responding (status: $FRONTEND_CHECK)"
fi

# Login page
LOGIN_CHECK=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/login" 2>/dev/null)
if [ "$LOGIN_CHECK" = "200" ]; then
  pass "Login page accessible"
else
  warn "Login page returned $LOGIN_CHECK"
fi

echo ""
echo "=============================================="
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All critical checks passed!${NC}"
  echo ""
  echo "🚀 Deployment looks healthy. Try:"
  echo "   1. Open $FRONTEND_URL in browser"
  echo "   2. Click 'Sign in with Google'"
  echo "   3. Test chat: 'What can you help me with?'"
  exit 0
else
  echo -e "${RED}✗ Some checks failed${NC}"
  echo ""
  echo "Please review the errors above and check:"
  echo "   - Environment variables are set correctly"
  echo "   - Database is accessible"
  echo "   - Services are running"
  exit 1
fi

