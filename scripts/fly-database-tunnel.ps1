param([int]$Port = 16482)
$ErrorActionPreference = 'Stop'
$fly = Join-Path $env:USERPROFILE '.fly\bin\fly.exe'
if (-not (Test-Path -LiteralPath $fly)) {
    throw 'Install flyctl and run fly auth login first.'
}
$listeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
if ($listeners.Count) {
    foreach ($listener in $listeners) {
        $owner = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
        $expected = 'mpg\s+proxy\s+1zvn90k136vrkpew\s+-p\s+' + $Port + '\s+-b\s+127\.0\.0\.1(?:\s|$)'
        if ($listener.LocalAddress -ne '127.0.0.1' -or
            $owner.ExecutablePath -ne $fly -or $owner.CommandLine -notmatch $expected) {
            throw "Port $Port is occupied by another process. No process was stopped."
        }
    }
    Write-Host "Fly PostgreSQL tunnel is already running on 127.0.0.1:$Port. Refresh the Database connection in GoLand."
    exit 0
}
Write-Host "Fly PostgreSQL tunnel: 127.0.0.1:$Port (keep this task running while browsing the database)."
& $fly mpg proxy 1zvn90k136vrkpew -p $Port -b 127.0.0.1
exit $LASTEXITCODE
