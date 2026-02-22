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

$repoUrl = [string]$module.url

if ([string]::IsNullOrWhiteSpace($repoUrl)) { throw "module.json is missing 'url' (repository URL)" }

if ([string]::IsNullOrWhiteSpace($moduleId)) { throw "module.json is missing 'id'" }
if ([string]::IsNullOrWhiteSpace($version)) { throw "module.json is missing 'version'" }

$outDirPath = Join-Path $repoRoot $OutDir
$stagingRoot = Join-Path $outDirPath "staging"
$stageDir = Join-Path $stagingRoot $moduleId
$zipVersionedPath = Join-Path $outDirPath ("{0}-v{1}.zip" -f $moduleId, $version)
$zipStablePath = Join-Path $outDirPath ("{0}.zip" -f $moduleId)
$releaseManifestPath = Join-Path $outDirPath "module.json"

# Build a release-ready manifest (module.json) that Foundry can use for installs and updates.
$release = ($module | ConvertTo-Json -Depth 20) | ConvertFrom-Json
$release | Add-Member -NotePropertyName manifest -NotePropertyValue "$repoUrl/releases/latest/download/module.json" -Force
$release | Add-Member -NotePropertyName download -NotePropertyValue "$repoUrl/releases/download/v$version/$moduleId.zip" -Force

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

  # Special-case: stage the release-ready manifest instead of the repo's module.json.
  if ($rel -eq "module.json") {
    Set-Content -Path $dst -Value ($release | ConvertTo-Json -Depth 20) -Encoding UTF8
    continue
  }

  if (Test-Path $src -PathType Container) {
    Copy-Item -Recurse -Force -Path $src -Destination $dst
  } else {
    $dstParent = Split-Path -Parent $dst
    New-Item -ItemType Directory -Force -Path $dstParent | Out-Null
    Copy-Item -Force -Path $src -Destination $dst
  }
}

New-Item -ItemType Directory -Force -Path $outDirPath | Out-Null
if (Test-Path $zipVersionedPath) { Remove-Item -Force -Path $zipVersionedPath }
if (Test-Path $zipStablePath) { Remove-Item -Force -Path $zipStablePath }

Push-Location $stagingRoot
try {
  Compress-Archive -Path $moduleId -DestinationPath $zipStablePath -CompressionLevel Optimal
}
finally {
  Pop-Location
}

# Also emit a versioned copy (nice for humans / historical browsing)
Copy-Item -Force -Path $zipStablePath -Destination $zipVersionedPath

# Emit a release-ready module.json (manifest) at dist/module.json.
# Foundry expects this URL to exist, and expects the JSON to include `manifest` and `download`.
Set-Content -Path $releaseManifestPath -Value ($release | ConvertTo-Json -Depth 20) -Encoding UTF8

Write-Host "Built: $zipStablePath"
Write-Host "Built: $zipVersionedPath"
Write-Host "Built: $releaseManifestPath"
