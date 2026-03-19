$ErrorActionPreference = 'SilentlyContinue'

$url = 'http://localhost:3000'
$maxAttempts = 40
$delaySeconds = 1

for ($i = 0; $i -lt $maxAttempts; $i += 1) {
  try {
    $response = Invoke-WebRequest -Uri $url -Method GET -UseBasicParsing
    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
      break
    }
  } catch {
    # wait until dev server becomes available
  }

  Start-Sleep -Seconds $delaySeconds
}

$chromeCmd = Get-Command chrome -ErrorAction SilentlyContinue
if ($chromeCmd) {
  Start-Process chrome $url
} else {
  Start-Process $url
}

exit 0
