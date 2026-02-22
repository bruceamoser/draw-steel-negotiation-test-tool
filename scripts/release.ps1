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

$outDirPath = Join-Path $repoRoot $OutDir
$manifestPath = Join-Path $outDirPath "module.json"
$zipStablePath = Join-Path $outDirPath ("{0}.zip" -f $moduleId)

if (!(Test-Path $manifestPath)) {
  throw "Manifest not found at $manifestPath. Run scripts/build.ps1 first."
}
if (!(Test-Path $zipStablePath)) {
  throw "Zip not found at $zipStablePath. Run scripts/build.ps1 first."
}

# Ensure gh is authenticated (will throw if not)
& gh auth status | Out-Null

$args = @(
  "release", "create", $Tag,
  $manifestPath,
  $zipStablePath,
  "--title", "$moduleId $version",
  "--generate-notes"
)
if ($Draft) { $args += "--draft" }
if ($Prerelease) { $args += "--prerelease" }

Write-Host "Creating GitHub release '$Tag' with assets: $manifestPath, $zipStablePath"
& gh @args
