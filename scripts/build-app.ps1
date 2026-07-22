<#
.SYNOPSIS
  Build Weft into a runnable Windows app and (optionally) drop a desktop shortcut.

.DESCRIPTION
  Wraps the repeatable "make me a clickable app" flow:
    1. (optional) rebuild node-pty for Electron's ABI  -- needed on Windows
    2. build the app via electron-vite + electron-builder
    3. create a Desktop shortcut pointing at the built Weft.exe

  Default build is the unpacked, run-in-place directory (release\win-unpacked\Weft.exe).
  Pass -Installer to build the NSIS installer instead (release\Weft *.exe); the
  installer creates its own shortcuts, so the shortcut step is skipped in that mode.

.PARAMETER Installer
  Build the NSIS installer (pnpm package) instead of the unpacked dir (pnpm package:dir).

.PARAMETER Rebuild
  Run `pnpm rebuild:native` first. Needed after a fresh `pnpm install` on Windows.

.PARAMETER NoShortcut
  Skip creating the desktop shortcut (unpacked build only).

.EXAMPLE
  pnpm package:app
  pnpm package:app -- -Rebuild
  pnpm package:app -- -Installer
#>
[CmdletBinding()]
param(
  [switch]$Installer,
  [switch]$Rebuild,
  [switch]$NoShortcut
)

$ErrorActionPreference = "Stop"

# Repo root = parent of this script's folder, regardless of where it's invoked from.
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

function Invoke-Step($label, [scriptblock]$block) {
  Write-Host "==> $label" -ForegroundColor Cyan
  & $block
  if ($LASTEXITCODE -ne 0) { throw "$label failed (exit $LASTEXITCODE)" }
}

if ($Rebuild) {
  Invoke-Step "Rebuilding node-pty for Electron" { pnpm rebuild:native }
}

if ($Installer) {
  Invoke-Step "Building NSIS installer" { pnpm package }
  $out = Join-Path $repoRoot "release"
  Write-Host "Installer written to: $out" -ForegroundColor Green
  Get-ChildItem $out -Filter "*.exe" | Select-Object Name, Length | Format-Table -AutoSize
  Write-Host "Run the installer to install Weft (it creates its own shortcuts)." -ForegroundColor Green
  return
}

Invoke-Step "Building unpacked app" { pnpm package:dir }

$exe = Join-Path $repoRoot "release\win-unpacked\Weft.exe"
if (-not (Test-Path $exe)) { throw "Expected build output not found: $exe" }
Write-Host "Built: $exe" -ForegroundColor Green

if ($NoShortcut) { return }

$lnk = Join-Path ([Environment]::GetFolderPath("Desktop")) "Weft.lnk"
$sc  = (New-Object -ComObject WScript.Shell).CreateShortcut($lnk)
$sc.TargetPath       = $exe
$sc.WorkingDirectory = Split-Path $exe
$sc.IconLocation     = $exe
$sc.Description       = "Weft - Claude Code sessions IDE"
$sc.Save()
Write-Host "Desktop shortcut: $lnk" -ForegroundColor Green
