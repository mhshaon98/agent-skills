# Interactive skill installer (Windows) — lists the catalog, installs what you pick.
# Usage: .\install.ps1            (run from a clone)
#        .\install.ps1 name1,name2 [-Codex] [-All]
param([string[]]$Names = @(), [switch]$Codex, [switch]$All)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$dest = if ($Codex) { Join-Path ($env:CODEX_HOME ?? (Join-Path $HOME '.codex')) 'skills' }
        else        { Join-Path $HOME '.claude\skills' }

if (-not (Test-Path 'skills.json')) { Write-Error 'skills.json not found — run from a repo clone' }
$catalog = Get-Content 'skills.json' -Raw | ConvertFrom-Json

if ($All) { $Names = $catalog.name }
elseif ($Names.Count -eq 0) {
    Write-Host "`n  Available skills`n  ----------------"
    for ($i = 0; $i -lt $catalog.Count; $i++) {
        Write-Host ("  {0,2}) {1,-24} {2}" -f ($i + 1), $catalog[$i].name, $catalog[$i].description)
    }
    $answer = Read-Host "`nInstall which? (numbers/names, space-separated, or 'all')"
    if ($answer -eq 'all') { $Names = $catalog.name }
    else {
        $Names = foreach ($tok in ($answer -split '\s+' | Where-Object { $_ })) {
            if ($tok -match '^\d+$') { $catalog[[int]$tok - 1].name } else { $tok }
        }
    }
}
if (-not $Names) { Write-Host 'Nothing selected.'; exit 0 }

New-Item -ItemType Directory -Force -Path $dest | Out-Null
foreach ($name in $Names) {
    $src = Join-Path 'skills' $name
    if (-not (Test-Path $src)) { Write-Host "  !! unknown skill: $name (skipped)"; continue }
    $target = Join-Path $dest $name
    if (Test-Path $target) {
        $r = Read-Host "  $name already exists in $dest — replace? [y/N]"
        if ($r -notmatch '^[Yy]$') { Write-Host "  -- kept existing $name"; continue }
        Remove-Item -Recurse -Force $target
    }
    Copy-Item -Recurse $src $target
    Write-Host "  ok installed $name -> $target"
}
Write-Host 'Done. New skills load on your next session.'
