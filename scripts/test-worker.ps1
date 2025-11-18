# Test script for Fear and Greed Telegram Bot Worker
# Tests all endpoints and commands
#
# Usage:
#   .\scripts\test-worker.ps1 [URL]
#   Default URL: http://localhost:8787

param(
    [string]$WorkerUrl = "http://localhost:8787",
    [string]$TestChatId = "",
    [string]$TestUserId = ""
)

$ErrorActionPreference = "Stop"

# Read .dev.vars file if it exists
function Read-DevVars {
    $devVarsPath = Join-Path $PSScriptRoot "..\.dev.vars"
    if (Test-Path $devVarsPath) {
        $content = Get-Content $devVarsPath -Raw
        $vars = @{}
        
        # Parse KEY=VALUE pairs, skipping comments
        foreach ($line in $content -split "`n") {
            $line = $line.Trim()
            if ($line -and -not $line.StartsWith("#")) {
                if ($line -match "^([^=]+)=(.*)$") {
                    $key = $matches[1].Trim()
                    $value = $matches[2].Trim()
                    $vars[$key] = $value
                }
            }
        }
        
        return $vars
    }
    return @{}
}

# Load dev vars
$devVars = Read-DevVars

# Get webhook secret from .dev.vars
$WebhookSecret = $devVars["TELEGRAM_WEBHOOK_SECRET"]
if ([string]::IsNullOrEmpty($WebhookSecret)) {
    Write-Host "⚠️  TELEGRAM_WEBHOOK_SECRET not found in .dev.vars" -ForegroundColor Yellow
    Write-Host "   Webhook requests will fail authentication" -ForegroundColor Yellow
} else {
    Write-Host "✓ Using TELEGRAM_WEBHOOK_SECRET from .dev.vars" -ForegroundColor Green
}

# Use ADMIN_CHAT_ID from .dev.vars if not provided as parameter
if ([string]::IsNullOrEmpty($TestChatId)) {
    $TestChatId = $devVars["ADMIN_CHAT_ID"]
}
if ([string]::IsNullOrEmpty($TestChatId)) {
    $TestChatId = "123456789"  # Fallback to default
    Write-Host "⚠️  ADMIN_CHAT_ID not found in .dev.vars, using default test ID" -ForegroundColor Yellow
} else {
    # Mask chat ID for security - only show first and last few digits
    $maskedChatId = if ($TestChatId.Length -gt 6) {
        $TestChatId.Substring(0, 3) + "..." + $TestChatId.Substring($TestChatId.Length - 3)
    } else {
        "***masked***"
    }
    Write-Host "✓ Using ADMIN_CHAT_ID from .dev.vars: $maskedChatId" -ForegroundColor Green
}

# Use same chat ID for user ID if not provided
if ([string]::IsNullOrEmpty($TestUserId)) {
    $TestUserId = $TestChatId
}

# Store webhook secret in script scope for Test-Post function
$script:WebhookSecret = $WebhookSecret

# Test counter
$script:TESTS_PASSED = 0
$script:TESTS_FAILED = 0

# Print test header
function Print-Test {
    param([string]$TestName)
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "Test: $TestName" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
}

# Print success
function Print-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
    $script:TESTS_PASSED++
}

# Print failure
function Print-Failure {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
    $script:TESTS_FAILED++
}

# Test POST request
function Test-Post {
    param(
        [string]$TestName,
        [string]$Payload,
        [int]$ExpectedStatus = 200,
        [switch]$SkipAuth = $false
    )
    
    Print-Test $TestName
    
    try {
        $headers = @{
            "Content-Type" = "application/json"
        }
        
        # Add webhook secret header unless authentication is skipped
        if (-not $SkipAuth -and -not [string]::IsNullOrEmpty($script:WebhookSecret)) {
            $headers["X-Telegram-Bot-Api-Secret-Token"] = $script:WebhookSecret
        }
        
        $response = Invoke-WebRequest -Uri $WorkerUrl -Method POST -Body $Payload `
            -Headers $headers -UseBasicParsing -ErrorAction Stop
        
        $statusCode = $response.StatusCode
        $body = $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
        
        Write-Host "HTTP Status: $statusCode"
        Write-Host "Response Body:"
        Write-Host $body
        
        if ($statusCode -eq $ExpectedStatus) {
            Print-Success "HTTP status code is $ExpectedStatus"
            return $true
        } else {
            Print-Failure "Expected status $ExpectedStatus, got $statusCode"
            return $false
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $body = $_.Exception.Response | Get-Member | Out-String
        
        Write-Host "HTTP Status: $statusCode"
        Write-Host "Error: $_"
        
        if ($statusCode -eq $ExpectedStatus) {
            Print-Success "HTTP status code is $ExpectedStatus"
            return $true
        } else {
            Print-Failure "Expected status $ExpectedStatus, got $statusCode"
            return $false
        }
    }
}

# Test GET request
function Test-Get {
    param(
        [string]$TestName,
        [int]$ExpectedStatus = 405
    )
    
    Print-Test $TestName
    
    try {
        $response = Invoke-WebRequest -Uri $WorkerUrl -Method GET -UseBasicParsing -ErrorAction Stop
        $statusCode = $response.StatusCode
        $body = $response.Content
        
        Write-Host "HTTP Status: $statusCode"
        Write-Host "Response: $body"
        
        if ($statusCode -eq $ExpectedStatus) {
            Print-Success "HTTP status code is $ExpectedStatus (Method not allowed)"
            return $true
        } else {
            Print-Failure "Expected status $ExpectedStatus, got $statusCode"
            return $false
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $body = $_.Exception.Message
        
        Write-Host "HTTP Status: $statusCode"
        Write-Host "Response: $body"
        
        if ($statusCode -eq $ExpectedStatus) {
            Print-Success "HTTP status code is $ExpectedStatus (Method not allowed)"
            return $true
        } else {
            Print-Failure "Expected status $ExpectedStatus, got $statusCode"
            return $false
        }
    }
}

# Test scheduled endpoint
function Test-Scheduled {
    param([string]$TestName)
    
    Print-Test $TestName
    
    $scheduledUrl = "$WorkerUrl/__scheduled?cron=0+9-23+*+*+1-5"
    
    try {
        $response = Invoke-WebRequest -Uri $scheduledUrl -Method GET -UseBasicParsing -ErrorAction Stop
        $statusCode = $response.StatusCode
        $body = $response.Content
        
        Write-Host "HTTP Status: $statusCode"
        Write-Host "Response: $body"
        
        if ($statusCode -eq 200 -or $statusCode -eq 202) {
            Print-Success "Scheduled endpoint responded"
            return $true
        } else {
            Print-Failure "Expected status 200/202, got $statusCode"
            return $false
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $body = $_.Exception.Message
        
        Write-Host "HTTP Status: $statusCode"
        Write-Host "Response: $body"
        
        if ($statusCode -eq 405) {
            Write-Host ""
            Write-Host "⚠️  Scheduled endpoint test skipped:" -ForegroundColor Yellow
            Write-Host "   The scheduled endpoint requires wrangler dev to be started with --test-scheduled flag" -ForegroundColor Yellow
            Write-Host "   Run: npm run dev:scheduled (or wrangler dev --test-scheduled)" -ForegroundColor Yellow
            Write-Host "   This test is informational only and doesn't count as pass/fail" -ForegroundColor Yellow
            return $true  # Don't count as failure
        } elseif ($statusCode -eq 200 -or $statusCode -eq 202) {
            Print-Success "Scheduled endpoint responded"
            return $true
        } else {
            Print-Failure "Expected status 200/202, got $statusCode"
            return $false
        }
    }
}

# Create Telegram payload
function Get-TelegramPayload {
    param([string]$Command)
    
    $messageId = Get-Random -Minimum 1 -Maximum 999999
    $date = [DateTimeOffset]::Now.ToUnixTimeSeconds()
    
    $payload = @{
        message = @{
            message_id = $messageId
            from = @{
                id = [int]$TestUserId
                is_bot = $false
                first_name = "Test"
                username = "testuser"
            }
            chat = @{
                id = [int]$TestChatId
                type = "private"
                first_name = "Test"
                username = "testuser"
            }
            date = $date
            text = $Command
        }
    }
    
    return ($payload | ConvertTo-Json -Depth 10)
}

# Invalid payload
function Get-InvalidPayload {
    $payload = @{
        invalid = "payload"
        no = "message"
    }
    return ($payload | ConvertTo-Json -Depth 10)
}

# Start tests
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "Testing Worker: $WorkerUrl" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""
if ($TestChatId -eq "123456789") {
    Write-Host "Note: Using default test chat ID. Telegram API calls may fail with 'chat not found'." -ForegroundColor Cyan
    Write-Host "      Set ADMIN_CHAT_ID in .dev.vars to use your real chat ID for actual API testing." -ForegroundColor Cyan
} else {
    Write-Host "Using real chat ID from .dev.vars - Telegram API calls should work!" -ForegroundColor Green
}
Write-Host ""

# Test 1: POST /start command
Test-Post "POST /start command" (Get-TelegramPayload "/start") 200

# Test 2: POST /stop command
Test-Post "POST /stop command" (Get-TelegramPayload "/stop") 200

# Test 3: POST /help command
Test-Post "POST /help command" (Get-TelegramPayload "/help") 200

# Test 4: POST /now command
Test-Post "POST /now command" (Get-TelegramPayload "/now") 200

# Test 5: POST unknown command
Test-Post "POST unknown command" (Get-TelegramPayload "/unknown") 200

# Test 6: POST invalid payload
Test-Post "POST invalid payload" (Get-InvalidPayload) 200

# Test 6b: POST without webhook secret (should return 401)
Test-Post "POST without webhook secret (unauthorized)" (Get-TelegramPayload "/start") 401 -SkipAuth

# Test 7: GET request (should return 405)
Test-Get "GET request (Method not allowed)" 405

# Test 8: Scheduled endpoint
Test-Scheduled "Scheduled endpoint (cron trigger)"

# Print summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "Test Summary" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "Tests Passed: $script:TESTS_PASSED" -ForegroundColor Green
Write-Host "Tests Failed: $script:TESTS_FAILED" -ForegroundColor Red

if ($script:TESTS_FAILED -eq 0) {
    Write-Host ""
    Write-Host "All tests passed! ✓" -ForegroundColor Green
    exit 0
} else {
    Write-Host ""
    Write-Host "Some tests failed! ✗" -ForegroundColor Red
    exit 1
}

