param(
    [ValidateSet('Save', 'Status', 'Remove', 'Run')][string]$Action = 'Status',
    [string]$Model,
    [ValidateRange(1, 20)][int]$Limit = 1,
    [switch]$Send
)
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'This helper requires Windows DPAPI.' }
$credentialDir = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'CheckForAICopyPaste'
$credentialFile = Join-Path $credentialDir 'openai-key.dpapi'

switch ($Action) {
    'Status' {
        if (Test-Path -LiteralPath $credentialFile) { Write-Output 'A local encrypted credential file exists. Key validity has not been tested.' }
        else { Write-Output 'No saved credential. Run this script with -Action Save in your own PowerShell window.' }
    }
    'Save' {
        $secureKey = Read-Host 'Paste your OpenAI API key (hidden; Enter to save)' -AsSecureString
        try {
            if ($secureKey.Length -eq 0) { throw 'No key entered; nothing saved.' }
            New-Item -ItemType Directory -Path $credentialDir -Force | Out-Null
            # Without -Key, Windows uses DPAPI tied to the current user's account.
            $encryptedKey = ConvertFrom-SecureString -SecureString $secureKey
            [IO.File]::WriteAllText($credentialFile, $encryptedKey)
            Write-Output 'Saved encrypted credential outside the repository. No API request was made.'
        } finally { $secureKey.Dispose(); $encryptedKey = $null }
    }
    'Remove' {
        if (Test-Path -LiteralPath $credentialFile) { Remove-Item -LiteralPath $credentialFile }
        Write-Output 'Local saved credential removed. This does not revoke the key at OpenAI.'
    }
    'Run' {
        if ([string]::IsNullOrWhiteSpace($Model)) { throw 'Specify -Model with an API model ID, not a key.' }
        $runner = Join-Path $PSScriptRoot 'run-openai.mjs'
        if (-not $Send) { & node $runner --model $Model --limit $Limit; exit $LASTEXITCODE }
        if (-not (Test-Path -LiteralPath $credentialFile)) { throw 'Save your credential first.' }
        $previousKey = [Environment]::GetEnvironmentVariable('OPENAI_API_KEY', 'Process')
        $secureKey = $null
        $keyPointer = [IntPtr]::Zero
        try {
            $secureKey = ConvertTo-SecureString ([IO.File]::ReadAllText($credentialFile))
            $keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
            $env:OPENAI_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
            & node $runner --model $Model --limit $Limit --send
            $runnerExit = $LASTEXITCODE
        } finally {
            [Environment]::SetEnvironmentVariable('OPENAI_API_KEY', $previousKey, 'Process')
            if ($keyPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer) }
            if ($null -ne $secureKey) { $secureKey.Dispose() }
        }
        exit $runnerExit
    }
}
