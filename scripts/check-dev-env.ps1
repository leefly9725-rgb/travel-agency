$ErrorActionPreference = "Stop"

$tools = @(
    @{ Name = "node"; Command = "node"; Args = @("-v"); Required = $true },
    @{ Name = "npm"; Command = "npm"; Args = @("-v"); Required = $true },
    @{ Name = "git"; Command = "git"; Args = @("--version"); Required = $true },
    @{ Name = "dotnet"; Command = "dotnet"; Args = @("--info"); Required = $false },
    @{ Name = "python"; Command = "python"; Args = @("--version"); Required = $false }
)

$missingRequired = @()

foreach ($tool in $tools) {
    $command = Get-Command $tool.Command -ErrorAction SilentlyContinue
    if (-not $command) {
        $status = if ($tool.Required) { "MISSING (required)" } else { "MISSING (optional)" }
        Write-Output ("[{0}] {1}" -f $tool.Name, $status)
        if ($tool.Required) {
            $missingRequired += $tool.Name
        }
        continue
    }

    $output = & $tool.Command @($tool.Args) 2>&1 | Select-Object -First 3
    Write-Output ("[{0}] OK" -f $tool.Name)
    $output | ForEach-Object { Write-Output ("  " + $_) }
}

Write-Output ""
Write-Output "[env] PATH"
$env:PATH.Split(";") | Where-Object { $_ } | ForEach-Object { Write-Output ("  " + $_) }

if ($missingRequired.Count -gt 0) {
    throw ("Missing required tools: " + ($missingRequired -join ", "))
}
