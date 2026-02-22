[CmdletBinding()]
param(
  [string]$OutDir = "dist",
  [switch]$Clean
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$moduleJsonPath = Join-Path $repoRoot "module.json"
if (!(Test-Path $moduleJsonPath)) {
  throw "module.json not found at $moduleJsonPath"
}

$module = Get-Content -Raw -Path $moduleJsonPath | ConvertFrom-Json
$moduleId = [string]$module.id
$version = [string]$module.version

if ([string]::IsNullOrWhiteSpace($moduleId)) { throw "module.json is missing 'id'" }
if ([string]::IsNullOrWhiteSpace($version)) { throw "module.json is missing 'version'" }

$outDirPath = Join-Path $repoRoot $OutDir
$stagingRoot = Join-Path $outDirPath "staging"
$stageDir = Join-Path $stagingRoot $moduleId
$zipPath = Join-Path $outDirPath ("{0}-v{1}.zip" -f $moduleId, $version)

if ($Clean) {
  if (Test-Path $outDirPath) {
    Remove-Item -Recurse -Force -Path $outDirPath
  }
}

New-Item -ItemType Directory -Force -Path $stageDir | Out-Null

$include = @(
  "module.json",
  "LICENSE",
  "README.md",
  "lang",
  "styles",
  "templates",
  "src"
)

foreach ($rel in $include) {
  $src = Join-Path $repoRoot $rel
  if (!(Test-Path $src)) { continue }

  $dst = Join-Path $stageDir $rel
  if (Test-Path $src -PathType Container) {
    Copy-Item -Recurse -Force -Path $src -Destination $dst
  } else {
    $dstParent = Split-Path -Parent $dst
    New-Item -ItemType Directory -Force -Path $dstParent | Out-Null
    Copy-Item -Force -Path $src -Destination $dst
  }
}

New-Item -ItemType Directory -Force -Path $outDirPath | Out-Null
if (Test-Path $zipPath) { Remove-Item -Force -Path $zipPath }

Push-Location $stagingRoot
try {
  Compress-Archive -Path $moduleId -DestinationPath $zipPath -CompressionLevel Optimal
}
finally {
  Pop-Location
}

Write-Host "Built: $zipPath"
