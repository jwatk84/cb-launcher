param(
    [string]$InstalledData = (Join-Path $env:LOCALAPPDATA 'cbservers')
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$destination = Join-Path $repo 'output/EN-CB'
$manifestSource = Join-Path $InstalledData 'manifest'
foreach ($required in @(
    (Join-Path $repo 'build/bin/x64/Release/cb-launcher.exe'),
    (Join-Path $repo 'build/runtime/x64/Release/cef'),
    (Join-Path $repo 'build/runtime/x64/Release/discord'),
    $manifestSource
)) {
    if (!(Test-Path -LiteralPath $required)) { throw "Required package input missing: $required" }
}
# Do not replace a running executable; close the concept before packaging.
$exe = Join-Path $destination 'cb-launcher.exe'
if (Get-Process cb-launcher -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $exe }) {
    throw 'Close the EN/CB test launcher before packaging.'
}
foreach ($folder in @('data/launcher-ui','data/cef/Release','data/discord','manifest','user')) {
    New-Item -ItemType Directory -Path (Join-Path $destination "cbservers/$folder") -Force | Out-Null
}
Copy-Item (Join-Path $repo 'build/bin/x64/Release/cb-launcher.exe') $exe -Force
Copy-Item (Join-Path $repo 'src/launcher-ui/*') (Join-Path $destination 'cbservers/data/launcher-ui') -Recurse -Force
Copy-Item (Join-Path $repo 'build/runtime/x64/Release/cef/*') (Join-Path $destination 'cbservers/data/cef/Release') -Recurse -Force
Copy-Item (Join-Path $repo 'build/runtime/x64/Release/discord/*') (Join-Path $destination 'cbservers/data/discord') -Recurse -Force
Copy-Item (Join-Path $manifestSource '*.json') (Join-Path $destination 'cbservers/manifest') -Force
[IO.File]::WriteAllText((Join-Path $destination 'cbservers/portable.marker'), '')
# Reuse game paths only. Never copy launcher accounts or authentication settings.
$settingsPath = Join-Path $destination 'cbservers/user/properties.json'
if (!(Test-Path -LiteralPath $settingsPath)) {
    $settings = @{'auto-shortcuts'='false'; 'skip-self-update'='true'}
    $originalPath = Join-Path $InstalledData 'user/properties.json'
    if (Test-Path -LiteralPath $originalPath) {
        $original = Get-Content -LiteralPath $originalPath -Raw | ConvertFrom-Json
        foreach ($property in $original.PSObject.Properties) {
            if ($property.Name -match '^(t4|t5|t6|bo3)-install$') { $settings[$property.Name] = $property.Value }
        }
    }
    [IO.File]::WriteAllText($settingsPath, ($settings | ConvertTo-Json))
}
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut((Join-Path $destination 'EN-CB Test Launcher.lnk'))
$shortcut.TargetPath = $exe
$shortcut.Arguments = '-portable -noupdate -en-cb-concept'
$shortcut.WorkingDirectory = $destination
$shortcut.Save()
Write-Output "Packaged EN/CB test launcher at $destination"
