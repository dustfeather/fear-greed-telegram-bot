#!/bin/bash
# Test script for Fear and Greed Telegram Bot Worker
# Tests all endpoints and commands
#
# Usage:
#   ./scripts/test-worker.sh [URL]
#   Default URL: http://localhost:8787

set -euo pipefail

# Configuration
WORKER_URL="${1:-http://localhost:8787}"

# Read .dev.vars file if it exists
read_dev_var() {
    local var_name="$1"
    local dev_vars_file=".dev.vars"
    if [ -f "$dev_vars_file" ]; then
        # Extract variable value, handling comments and whitespace
        local value=$(grep "^${var_name}=" "$dev_vars_file" 2>/dev/null | head -1 | cut -d'=' -f2 | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' || echo "")
        if [ -n "$value" ]; then
            echo "$value"
            return
        fi
    fi
    echo ""
}

# Get webhook secret from .dev.vars
WEBHOOK_SECRET=$(read_dev_var "TELEGRAM_WEBHOOK_SECRET")
if [ -z "$WEBHOOK_SECRET" ]; then
    echo -e "${YELLOW}⚠️  TELEGRAM_WEBHOOK_SECRET not found in .dev.vars${NC}"
    echo -e "${YELLOW}   Webhook requests will fail authentication${NC}"
else
    echo -e "${GREEN}✓ Using TELEGRAM_WEBHOOK_SECRET from .dev.vars${NC}"
fi

# Get chat ID from .dev.vars
DEV_CHAT_ID=$(read_dev_var "ADMIN_CHAT_ID")
if [ -n "$DEV_CHAT_ID" ]; then
    TEST_CHAT_ID="$DEV_CHAT_ID"
    TEST_USER_ID="$DEV_CHAT_ID"
    # Mask chat ID for security - only show first and last few digits
    if [ ${#DEV_CHAT_ID} -gt 6 ]; then
        MASKED_CHAT_ID="${DEV_CHAT_ID:0:3}...${DEV_CHAT_ID: -3}"
    else
        MASKED_CHAT_ID="***masked***"
    fi
    echo -e "${GREEN}✓ Using ADMIN_CHAT_ID from .dev.vars: $MASKED_CHAT_ID${NC}"
else
    TEST_CHAT_ID="${TEST_CHAT_ID:-123456789}"
    TEST_USER_ID="${TEST_USER_ID:-123456789}"
    echo -e "${YELLOW}⚠️  ADMIN_CHAT_ID not found in .dev.vars, using default test ID${NC}"
fi

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Print test header
print_test() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Test: $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Print success
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
    ((TESTS_PASSED++)) || true
}

# Print failure
print_failure() {
    echo -e "${RED}✗ $1${NC}"
    ((TESTS_FAILED++)) || true
}

# Make a POST request and check response
test_post() {
    local test_name="$1"
    local payload="$2"
    local expected_status="${3:-200}"
    local skip_auth="${4:-false}"

    print_test "$test_name"

    # Build curl headers
    local curl_headers=("-H" "Content-Type: application/json")

    # Add webhook secret header unless authentication is skipped
    if [ "$skip_auth" != "true" ] && [ -n "$WEBHOOK_SECRET" ]; then
        curl_headers+=("-H" "X-Telegram-Bot-Api-Secret-Token: $WEBHOOK_SECRET")
    fi

    response=$(curl -s -w "\n%{http_code}" -X POST "$WORKER_URL" \
        "${curl_headers[@]}" \
        -d "$payload" 2>&1) || {
        echo "HTTP Status: 0"
        echo "Error: Connection failed"
        echo ""
        echo -e "${YELLOW}⚠️  Connection failed - is the worker running?${NC}"
        echo -e "${YELLOW}   Start the worker with: npm run dev${NC}"
        echo -e "${YELLOW}   Worker URL: $WORKER_URL${NC}"
        print_failure "Connection failed"
        return 1
    }

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    # Check if we got a valid HTTP code
    if ! [[ "$http_code" =~ ^[0-9]+$ ]]; then
        echo "HTTP Status: 0"
        echo "Error: $response"
        echo ""
        echo -e "${YELLOW}⚠️  Connection failed - is the worker running?${NC}"
        echo -e "${YELLOW}   Start the worker with: npm run dev${NC}"
        echo -e "${YELLOW}   Worker URL: $WORKER_URL${NC}"
        print_failure "Connection failed"
        return 1
    fi

    echo "HTTP Status: $http_code"
    echo "Response Body:"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"

    if [ "$http_code" -eq "$expected_status" ]; then
        print_success "HTTP status code is $expected_status"
        return 0
    else
        print_failure "Expected status $expected_status, got $http_code"
        return 1
    fi
}

# Make a GET request and check response
test_get() {
    local test_name="$1"
    local expected_status="${2:-405}"

    print_test "$test_name"

    response=$(curl -s -w "\n%{http_code}" "$WORKER_URL" 2>&1) || {
        echo "HTTP Status: 0"
        echo "Error: Connection failed"
        echo ""
        echo -e "${YELLOW}⚠️  Connection failed - is the worker running?${NC}"
        echo -e "${YELLOW}   Start the worker with: npm run dev${NC}"
        echo -e "${YELLOW}   Worker URL: $WORKER_URL${NC}"
        print_failure "Connection failed"
        return 1
    }

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    # Check if we got a valid HTTP code
    if ! [[ "$http_code" =~ ^[0-9]+$ ]]; then
        echo "HTTP Status: 0"
        echo "Error: $response"
        echo ""
        echo -e "${YELLOW}⚠️  Connection failed - is the worker running?${NC}"
        echo -e "${YELLOW}   Start the worker with: npm run dev${NC}"
        echo -e "${YELLOW}   Worker URL: $WORKER_URL${NC}"
        print_failure "Connection failed"
        return 1
    fi

    echo "HTTP Status: $http_code"
    echo "Response: $body"

    if [ "$http_code" -eq "$expected_status" ]; then
        print_success "HTTP status code is $expected_status (Method not allowed)"
        return 0
    else
        print_failure "Expected status $expected_status, got $http_code"
        return 1
    fi
}

# Test scheduled endpoint
test_scheduled() {
    local test_name="$1"

    print_test "$test_name"

    response=$(curl -s -w "\n%{http_code}" "$WORKER_URL/__scheduled?cron=0+9+*+*+1-5" 2>&1) || {
        echo "HTTP Status: 0"
        echo "Error: Connection failed"
        echo ""
        echo -e "${YELLOW}⚠️  Connection failed - is the worker running?${NC}"
        echo -e "${YELLOW}   Start the worker with: npm run dev${NC}"
        echo -e "${YELLOW}   Worker URL: $WORKER_URL${NC}"
        print_failure "Connection failed"
        return 1
    }

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    # Check if we got a valid HTTP code
    if ! [[ "$http_code" =~ ^[0-9]+$ ]]; then
        echo "HTTP Status: 0"
        echo "Error: $response"
        echo ""
        echo -e "${YELLOW}⚠️  Connection failed - is the worker running?${NC}"
        echo -e "${YELLOW}   Start the worker with: npm run dev${NC}"
        echo -e "${YELLOW}   Worker URL: $WORKER_URL${NC}"
        print_failure "Connection failed"
        return 1
    fi

    echo "HTTP Status: $http_code"
    echo "Response: $body"

    if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 202 ]; then
        print_success "Scheduled endpoint responded"
        return 0
    elif [ "$http_code" -eq 405 ]; then
        echo ""
        echo -e "${YELLOW}⚠️  Scheduled endpoint test skipped:${NC}"
        echo -e "${YELLOW}   The scheduled endpoint requires wrangler dev to be started with --test-scheduled flag${NC}"
        echo -e "${YELLOW}   Run: npm run dev:scheduled (or wrangler dev --test-scheduled)${NC}"
        echo -e "${YELLOW}   This test is informational only and doesn't count as pass/fail${NC}"
        return 0  # Don't count as failure
    else
        print_failure "Expected status 200/202, got $http_code"
        return 1
    fi
}

# Telegram update payload template
telegram_payload() {
    local command="$1"
    cat <<EOF
{
  "message": {
    "message_id": $RANDOM,
    "from": {
      "id": $TEST_USER_ID,
      "is_bot": false,
      "first_name": "Test",
      "username": "testuser"
    },
    "chat": {
      "id": $TEST_CHAT_ID,
      "type": "private",
      "first_name": "Test",
      "username": "testuser"
    },
    "date": $(date +%s),
    "text": "$command"
  }
}
EOF
}

# Invalid payload
invalid_payload() {
    cat <<EOF
{
  "invalid": "payload",
  "no": "message"
}
EOF
}

# Start tests
echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Testing Worker: $WORKER_URL${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""
if [ "$TEST_CHAT_ID" = "123456789" ]; then
    echo -e "${BLUE}Note: Using default test chat ID. Telegram API calls may fail with 'chat not found'.${NC}"
    echo -e "${BLUE}      Set ADMIN_CHAT_ID in .dev.vars to use your real chat ID for actual API testing.${NC}"
else
    echo -e "${GREEN}Using real chat ID from .dev.vars - Telegram API calls should work!${NC}"
fi
echo ""

# Test 1: POST /start command
test_post "POST /start command" "$(telegram_payload "/start")" 200

# Test 2: POST /stop command
test_post "POST /stop command" "$(telegram_payload "/stop")" 200

# Test 3: POST /help command
test_post "POST /help command" "$(telegram_payload "/help")" 200

# Test 4: POST /now command
test_post "POST /now command" "$(telegram_payload "/now")" 200

# Test 5: POST unknown command
test_post "POST unknown command" "$(telegram_payload "/unknown")" 200

# Test 6: POST invalid payload
test_post "POST invalid payload" "$(invalid_payload)" 200

# Test 6b: POST without webhook secret (should return 401)
test_post "POST without webhook secret (unauthorized)" "$(telegram_payload "/start")" 401 "true"

# Test 7: GET request (should return 405)
test_get "GET request (Method not allowed)" 405

# Test 8: Scheduled endpoint
test_scheduled "Scheduled endpoint (cron trigger)"

# Print summary
echo -e "\n${YELLOW}========================================${NC}"
echo -e "${YELLOW}Test Summary${NC}"
echo -e "${YELLOW}========================================${NC}"
echo -e "${GREEN}Tests Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Tests Failed: $TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}All tests passed! ✓${NC}"
    exit 0
else
    echo -e "\n${RED}Some tests failed! ✗${NC}"
    exit 1
fi

