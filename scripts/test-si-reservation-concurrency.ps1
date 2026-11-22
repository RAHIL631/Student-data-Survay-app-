$ErrorActionPreference = 'Stop'

$supabaseCli = Join-Path $PSScriptRoot '..\node_modules\.bin\supabase.cmd'
if (-not (Test-Path -LiteralPath $supabaseCli)) {
  throw 'Install project dependencies before running the local SI concurrency test.'
}

function Invoke-LocalSupabaseQuery([string]$Sql, [switch]$ReadOnly) {
  $queryFile = Join-Path $PSScriptRoot ('.si-concurrency-' + [Guid]::NewGuid().ToString('N') + '.sql')
  Set-Content -LiteralPath $queryFile -Value $Sql -Encoding Ascii
  $arguments = @('db', 'query')
  if ($ReadOnly) { $arguments += '--read-only' }
  $arguments += @('--file', $queryFile)
  $previousErrorAction = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $output = & $supabaseCli @arguments 2>&1
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorAction
    Remove-Item -LiteralPath $queryFile -Force -ErrorAction SilentlyContinue
  }
  $text = $output -join "`n"
  $jsonStart = $text.IndexOf('{')
  if ($jsonStart -lt 0) {
    throw "The local Supabase SQL query failed (exit code $exitCode, JSON output detected: $($jsonStart -ge 0)). Confirm the local stack is running."
  }
  $jsonMatch = [regex]::Match($text.Substring($jsonStart), '(?s)(\{.*\})(?:\s*A new version of Supabase CLI.*)?\s*$')
  if (-not $jsonMatch.Success) { throw 'The local Supabase query result could not be parsed.' }
  $decoded = $jsonMatch.Groups[1].Value | ConvertFrom-Json
  if ($exitCode -ne 0) {
    $errorCode = $decoded.error.code
    $errorMessage = $decoded.error.message
    throw "The local Supabase SQL query failed ($errorCode): $errorMessage"
  }
  return $decoded
}

$metadataSql = @'
SELECT jsonb_build_object(
  'actor_id', p.id::TEXT,
  'session_id', s.id::TEXT
) AS metadata
FROM public.profiles p
JOIN public.session_assignments sa ON sa.enumerator_id = p.id
JOIN public.screening_sessions s ON s.id = sa.session_id
WHERE p.role = 'enumerator' AND p.is_active AND s.status = 'active'
ORDER BY p.id, s.id
LIMIT 1;
'@
$metadataResult = Invoke-LocalSupabaseQuery -Sql $metadataSql -ReadOnly
$metadata = $metadataResult.rows[0].metadata
if (-not $metadata.actor_id -or -not $metadata.session_id) {
  throw 'The local database needs an active enumerator assigned to an active screening session.'
}

$siNumber = 'CONCURRENCY-' + [Guid]::NewGuid().ToString('N')
$requestKeys = @([Guid]::NewGuid().ToString(), [Guid]::NewGuid().ToString())
$actorId = $metadata.actor_id
$sessionId = $metadata.session_id
$jsonClaims = '{"sub":"' + $actorId + '","role":"authenticated"}'
$jobs = @()

try {
  foreach ($requestKey in $requestKeys) {
    $sql = @"
WITH claims AS MATERIALIZED (
  SELECT
    set_config('request.jwt.claim.sub', '$actorId', TRUE),
    set_config('request.jwt.claims', '$jsonClaims', TRUE)
)
SELECT public.reserve_student_si_number(
  '$sessionId', '$siNumber', '$requestKey', NULL
) AS reservation_id
FROM claims;
"@
    $queryFile = Join-Path $PSScriptRoot ('.si-concurrency-' + [Guid]::NewGuid().ToString('N') + '.sql')
    Set-Content -LiteralPath $queryFile -Value $sql -Encoding Ascii
    $jobs += Start-Job -ArgumentList $supabaseCli, $queryFile -ScriptBlock {
      param($CliPath, $QueryFile)
      $previousErrorAction = $ErrorActionPreference
      $ErrorActionPreference = 'Continue'
      $result = & $CliPath db query --file $QueryFile 2>&1
      $ErrorActionPreference = $previousErrorAction
      [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = ($result -join "`n") }
    }
  }

  $results = @($jobs | Wait-Job | Receive-Job)
  $succeeded = @($results | Where-Object { $_.ExitCode -eq 0 }).Count
  $conflicted = @($results | Where-Object {
    $_.ExitCode -ne 0 -and $_.Output -match '23505|currently reserved'
  }).Count
  if ($succeeded -ne 1 -or $conflicted -ne 1) {
    throw 'Expected exactly one parallel reservation to succeed and one to receive a conflict.'
  }

  Write-Output 'PASS: two concurrent requests produced one reservation and one conflict.'
} finally {
  $jobs | Remove-Job -Force -ErrorAction SilentlyContinue
  Get-ChildItem -LiteralPath $PSScriptRoot -Filter '.si-concurrency-*.sql' -File -ErrorAction SilentlyContinue |
    Remove-Item -Force -ErrorAction SilentlyContinue
  $cleanupSql = "UPDATE public.student_si_reservations SET expires_at = now() - interval '1 second' WHERE si_number = '$siNumber' AND consumed_at IS NULL;"
  try { $null = Invoke-LocalSupabaseQuery -Sql $cleanupSql } catch { }
}
