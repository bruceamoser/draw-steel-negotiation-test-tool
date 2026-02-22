[CmdletBinding()]
param(
  [string]$Tag = "",
  [switch]$Draft,
  [switch]$Prerelease,
  [string]$OutDir = "dist"
)

$ErrorActionPreference = 'Stop'

function Assert-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' not found on PATH."
  }
}

Assert-Command "gh"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$moduleJsonPath = Join-Path $repoRoot "module.json"
$module = Get-Content -Raw -Path $moduleJsonPath | ConvertFrom-Json
$moduleId = [string]$module.id
$version = [string]$module.version

if ([string]::IsNullOrWhiteSpace($Tag)) {
  $Tag = "v$version"
}

$zipPath = Join-Path (Join-Path $repoRoot $OutDir) ("{0}-v{1}.zip" -f $moduleId, $version)
if (!(Test-Path $zipPath)) {
  throw "Zip not found at $zipPath. Run scripts/build.ps1 first."
}

# Ensure gh is authenticated (will throw if not)
& gh auth status | Out-Null

$args = @(
  "release", "create", $Tag,
  $zipPath,
  "--title", "$moduleId $version",
  "--generate-notes"
)
if ($Draft) { $args += "--draft" }
if ($Prerelease) { $args += "--prerelease" }

Write-Host "Creating GitHub release '$Tag' with asset: $zipPath"
& gh @args
