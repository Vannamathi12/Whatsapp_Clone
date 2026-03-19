$ErrorActionPreference = 'SilentlyContinue'

$ports = @(3000, 5000)

foreach ($port in $ports) {
  $pids = Get-NetTCPConnection -LocalPort $port -State Listen |
    Select-Object -ExpandProperty OwningProcess -Unique

  foreach ($pid in $pids) {
    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
  }
}

exit 0
