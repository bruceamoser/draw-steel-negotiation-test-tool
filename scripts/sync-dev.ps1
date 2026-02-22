# =============================================================================
# sync-dev.ps1
# Syncs the repo source directly into the local Foundry VTT module folder.
# Run this after any code change during development, then reload Foundry (F5).
# =============================================================================
[CmdletBinding()]
param(
  [string]$FoundryDataPath = "C:\Users\bruce\AppData\Local\FoundryVTT\Data"
)

$ErrorActionPreference = "Stop"
$repoRoot  = Resolve-Path (Join-Path $PSScriptRoot "..")
$module    = Get-Content (Join-Path $repoRoot "module.json") | ConvertFrom-Json
$moduleId  = $module.id
$dstBase   = Join-Path $FoundryDataPath "modules\$moduleId"

if (!(Test-Path $dstBase)) {
  Write-Error "Module not found at: $dstBase`nInstall the module in Foundry first."
  exit 1
}

$folders = @("src", "templates", "styles", "lang")
foreach ($f in $folders) {
  $s = Join-Path $repoRoot $f
  $d = Join-Path $dstBase $f
  if (!(Test-Path $s)) { continue }
  robocopy $s $d /E /PURGE /NFL /NDL /NJH /NJS | Out-Null
  Write-Host "Synced: $f"
}

Copy-Item -Force (Join-Path $repoRoot "module.json") (Join-Path $dstBase "module.json")
Write-Host "Synced: module.json"
Write-Host ""
Write-Host "Done. Reload Foundry (F5) to see changes."
