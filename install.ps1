# agent-skills installer for Windows PowerShell 5.1+ and PowerShell 7.
# Lists the catalog and installs the skills you pick.
#
# From a clone:  .\install.ps1 [-Names a,b] [-List] [-All] [-Codex] [-Project] [-Dest DIR] [-Force]
# Without git:   irm https://raw.githubusercontent.com/mhshaon98/agent-skills/main/install.ps1 | iex
#   (piped through iex, options come from environment variables instead:
#    AGENT_SKILLS = "name1,name2" or "all", AGENT_SKILLS_LIST=1, AGENT_SKILLS_CODEX=1,
#    AGENT_SKILLS_FORCE=1, AGENT_SKILLS_PROJECT=1, AGENT_SKILLS_DEST=DIR)
# -Force replaces same-name skills; the old copy is moved to <skills dir>-backup\.
# This file is ASCII only on purpose: Windows PowerShell 5.1 reads BOM-less files as ANSI.
param(
    [string[]]$Names = @(),
    [switch]$List,
    [switch]$All,
    [switch]$Codex,
    [switch]$Project,
    [string]$Dest = '',
    [switch]$Force
)

function Install-AgentSkills {
    param([string[]]$Names, [bool]$List, [bool]$All, [bool]$Codex, [bool]$Project, [string]$Dest, [bool]$Force)
    $ErrorActionPreference = 'Stop'

    $rawBase = 'https://raw.githubusercontent.com/mhshaon98/agent-skills/main/'
    if ($env:AGENT_SKILLS_RAW_BASE) { $rawBase = $env:AGENT_SKILLS_RAW_BASE }
    if (-not $rawBase.EndsWith('/')) { $rawBase += '/' }

    # Environment variables fill in whatever was not passed as a parameter (the irm | iex route).
    if ($Names.Count -eq 0 -and $env:AGENT_SKILLS) {
        $Names = @($env:AGENT_SKILLS -split '[,\s]+' | Where-Object { $_ })
    }
    # "-Names a,b" arrives as ONE string under "powershell -File"; split it either way.
    $Names = @($Names | ForEach-Object { $_ -split '[,\s]+' } | Where-Object { $_ })
    if ($Names.Count -eq 1 -and $Names[0] -eq 'all') { $All = $true; $Names = @() }
    if ($env:AGENT_SKILLS_LIST -eq '1')    { $List = $true }
    if ($env:AGENT_SKILLS_CODEX -eq '1')   { $Codex = $true }
    if ($env:AGENT_SKILLS_FORCE -eq '1')   { $Force = $true }
    if ($env:AGENT_SKILLS_PROJECT -eq '1') { $Project = $true }
    if (-not $Dest -and $env:AGENT_SKILLS_DEST) { $Dest = $env:AGENT_SKILLS_DEST }
    # One-shot: clear the selection so a later bare 'irm | iex' shows the menu instead of repeating it.
    foreach ($v in 'AGENT_SKILLS','AGENT_SKILLS_LIST','AGENT_SKILLS_CODEX','AGENT_SKILLS_FORCE','AGENT_SKILLS_PROJECT','AGENT_SKILLS_DEST') { Remove-Item -Path "Env:$v" -ErrorAction SilentlyContinue }

    $target = 'claude'
    if ($Codex) { $target = 'codex' }
    if (-not $Dest) {
        if ($Project) {
            $Dest = Join-Path (Get-Location).Path '.claude\skills'
        } elseif ($Codex) {
            $codexHome = $env:CODEX_HOME
            if (-not $codexHome) { $codexHome = Join-Path $HOME '.codex' }
            $Dest = Join-Path $codexHome 'skills'
        } else {
            $Dest = Join-Path $HOME '.claude\skills'
        }
    }
    $Dest = $Dest.TrimEnd('\', '/')
    $backup = $Dest + '-backup'

    # Local clone when this file sits next to skills.json; otherwise download raw files.
    $srcDir = ''
    if ($PSScriptRoot -and (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'skills.json'))) { $srcDir = $PSScriptRoot }
    if (-not $srcDir) {
        try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }
    }
    $tmp = Join-Path ([IO.Path]::GetTempPath()) ('agent-skills-' + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Force -Path $tmp | Out-Null

    function Get-Raw([string]$relPath, [string]$outFile) {
        $enc = ($relPath -split '/' | ForEach-Object { [Uri]::EscapeDataString($_) }) -join '/'
        $dl = Join-Path $tmp 'download'
        Invoke-WebRequest -UseBasicParsing -Uri ($rawBase + $enc) -OutFile $dl
        Move-Item -LiteralPath $dl -Destination $outFile -Force
    }

    try {
        if ($srcDir) {
            $catalogFile = Join-Path $srcDir 'skills.json'
        } else {
            $catalogFile = Join-Path $tmp 'skills.json'
            Get-Raw 'skills.json' $catalogFile
        }
        $catalog = Get-Content -LiteralPath $catalogFile -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($catalog -is [array]) { $skills = @($catalog) } else { $skills = @($catalog.skills) }
        if ($skills.Count -eq 0 -or -not $skills[0].name) { throw 'the catalog lists no skills (is skills.json valid?)' }

        function Get-Targets($s) { if ($s.targets) { @($s.targets) } else { @('claude', 'codex') } }
        function Get-OnlyNote($s) {
            $t = Get-Targets $s
            if ($t.Count -eq 1 -and $t[0] -eq 'codex') { return ' [Codex CLI only]' }
            if ($t.Count -eq 1 -and $t[0] -eq 'claude') { return ' [Claude Code only]' }
            return ''
        }
        function Show-Catalog {
            $last = ''
            for ($i = 0; $i -lt $skills.Count; $i++) {
                $s = $skills[$i]
                if ($s.category -ne $last) { Write-Host ''; Write-Host ('  ' + $s.category); $last = $s.category }
                Write-Host ('  {0,2}) {1,-22} {2}{3}' -f ($i + 1), $s.name, $s.description, (Get-OnlyNote $s))
            }
            Write-Host ''
        }

        if ($List) { Show-Catalog; return 0 }

        # Update notice for skills already installed in the destination.
        $updates = @()
        foreach ($s in $skills) {
            $stamp = Join-Path (Join-Path $Dest $s.name) '.agent-skills.json'
            if (Test-Path -LiteralPath $stamp) {
                try {
                    $have = (Get-Content -LiteralPath $stamp -Raw | ConvertFrom-Json).version
                    if ($have -and $s.version -and $have -ne $s.version) { $updates += $s.name }
                } catch { }
            }
        }
        if ($updates.Count -gt 0) {
            Write-Host ('Updates available in ' + $Dest + ': ' + ($updates -join ' '))
            Write-Host '  (install them again with -Force to update; the old copy is backed up)'
        }

        $interactive = [Environment]::UserInteractive -and -not [Console]::IsInputRedirected
        if (-not $All -and $Names.Count -eq 0) {
            if (-not $interactive) { throw 'no skills named and no console for the menu; pass -Names or -All (see -List)' }
            Write-Host ('  Available skills (installing for ' + $target + ' into ' + $Dest + ')')
            Show-Catalog
            $answer = Read-Host "Install which? (numbers or names, space or comma separated, or 'all')"
            foreach ($tok in ($answer -split '[,\s]+' | Where-Object { $_ })) {
                if ($tok -eq 'all') { $All = $true }
                elseif ($tok -match '^\d+$') {
                    $n = [int]$tok
                    if ($n -ge 1 -and $n -le $skills.Count) { $Names += $skills[$n - 1].name }
                    else { Write-Host ('  !! no skill numbered ' + $tok + ' (valid: 1-' + $skills.Count + ')') }
                }
                else { $Names += $tok }
            }
        }
        if ($All) { $Names = @($skills | Where-Object { (Get-Targets $_) -contains $target } | ForEach-Object { $_.name }) }
        if ($Names.Count -eq 0) { Write-Host 'Nothing selected.'; return 0 }

        New-Item -ItemType Directory -Force -Path $Dest | Out-Null
        $failed = 0
        foreach ($name in $Names) {
            $s = $skills | Where-Object { $_.name -eq $name } | Select-Object -First 1
            if (-not $s) { Write-Host ('  !! unknown skill: ' + $name + ' (see -List)'); $failed = 1; continue }
            if ((Get-Targets $s) -notcontains $target) {
                if ((Get-Targets $s) -contains 'codex') { Write-Host ('  !! ' + $name + ' is for Codex CLI only; skipped (install it with -Codex)') }
                else { Write-Host ('  !! ' + $name + ' is for ' + ((Get-Targets $s) -join ',') + ' only; skipped') }
                continue
            }
            $targetDir = Join-Path $Dest $name
            if ((Test-Path -LiteralPath $targetDir) -and -not $Force) {
                if ($interactive) {
                    $r = Read-Host ('  ' + $name + ' already exists in ' + $Dest + ' - replace it? (the old copy is backed up) [y/N]')
                    if ($r -notmatch '^[Yy]') { Write-Host ('  -- kept existing ' + $name); continue }
                } else {
                    Write-Host ('  -- ' + $name + ' already exists in ' + $Dest + '; skipped (use -Force to replace)'); continue
                }
            }

            $stage = Join-Path (Join-Path $tmp 'stage') $name
            New-Item -ItemType Directory -Force -Path $stage | Out-Null
            if ($srcDir) {
                Copy-Item -Path (Join-Path (Join-Path (Join-Path $srcDir 'skills') $name) '*') -Destination $stage -Recurse -Force
            } else {
                # schema 1 catalogs stored a file COUNT here; only a list of paths is usable
                $files = @($s.files | Where-Object { $_ -is [string] -and $_ })
                if ($files.Count -eq 0) { $sp = if ($s.path) { $s.path } else { 'skills/' + $name }; $files = @($sp + '/SKILL.md') }
                $prefix = 'skills/' + $name + '/'
                $ok = $true
                foreach ($p in $files) {
                    $rel = $p
                    if ($rel.StartsWith($prefix)) { $rel = $rel.Substring($prefix.Length) }
                    $out = Join-Path $stage ($rel -replace '/', '\')
                    New-Item -ItemType Directory -Force -Path ([IO.Path]::GetDirectoryName($out)) | Out-Null
                    try { Get-Raw $p $out } catch { Write-Host ('  !! download failed: ' + $p); $ok = $false; break }
                }
                if (-not $ok -or -not (Test-Path -LiteralPath (Join-Path $stage 'SKILL.md'))) {
                    Write-Host ('  !! could not download ' + $name + '; nothing changed'); $failed = 1; continue
                }
            }
            $stampText = '{"name": "' + $name + '", "version": "' + $s.version + '", "source": "https://github.com/mhshaon98/agent-skills", "installed": "' + (Get-Date -Format 'yyyy-MM-dd') + '"}' + "`n"
            [IO.File]::WriteAllText((Join-Path $stage '.agent-skills.json'), $stampText, (New-Object Text.UTF8Encoding $false))

            if (Test-Path -LiteralPath $targetDir) {
                New-Item -ItemType Directory -Force -Path $backup | Out-Null
                $moved = Join-Path $backup ($name + '-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
                Move-Item -LiteralPath $targetDir -Destination $moved
                Write-Host ('  -- backed up the old ' + $name + ' to ' + $moved)
            }
            Move-Item -LiteralPath $stage -Destination $targetDir
            Write-Host ('  ok installed ' + $name + ' -> ' + $targetDir)
        }
        Write-Host 'Done. New skills load the next time the agent starts a session.'
        return $failed
    } finally {
        Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
    }
}

$code = 1
try {
    $code = Install-AgentSkills -Names $Names -List $List.IsPresent -All $All.IsPresent -Codex $Codex.IsPresent `
        -Project $Project.IsPresent -Dest $Dest -Force $Force.IsPresent
} catch {
    Write-Host ('error: ' + $_.Exception.Message)
}
# Only exit when run as a script file; under "irm | iex" exit would close the user's window.
if ($PSCommandPath -and $MyInvocation.InvocationName -ne '') { exit $code }
