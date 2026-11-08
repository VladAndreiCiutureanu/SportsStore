# Configureaza backend-ul SportsStore.API pentru dezvoltare locala pe acest calculator.
# Seteaza user-secrets (in afara proiectului, in %APPDATA%\Microsoft\UserSecrets)
# si creeaza baza de date in LocalDB din migrarile existente.
# Se poate rula de mai multe ori: cheia JWT se genereaza doar daca lipseste.

$ErrorActionPreference = 'Stop'
$project = Join-Path $PSScriptRoot 'back-end\SportsStore.API\SportsStore.API'
Set-Location $project

Write-Host '== Fisiere frontend vizibile?' -ForegroundColor Cyan
$fe = Join-Path $PSScriptRoot 'front-end'
'proxy.conf.json', 'src\app\core\api.service.ts', 'src\environments\environment.development.ts' | ForEach-Object {
    Write-Host ("  {0,-45} {1}" -f $_, (Test-Path (Join-Path $fe $_)))
}

Write-Host '== User-secrets' -ForegroundColor Cyan
$existing = dotnet user-secrets list 2>$null
if (-not ($existing -match '^Jwt:Key = ')) {
    $bytes = New-Object byte[] 64
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    dotnet user-secrets set 'Jwt:Key' ([Convert]::ToBase64String($bytes)) | Out-Null
    Write-Host '  Jwt:Key generat'
} else {
    Write-Host '  Jwt:Key exista deja'
}
dotnet user-secrets set 'Jwt:Issuer' 'SportsStore.API' | Out-Null
dotnet user-secrets set 'Jwt:Audience' 'SportsStore.Frontend' | Out-Null
dotnet user-secrets set 'ConnectionStrings:DefaultConnection' 'Server=(localdb)\MSSQLLocalDB;Database=SportsStore;Trusted_Connection=True;MultipleActiveResultSets=true;TrustServerCertificate=True' | Out-Null
dotnet user-secrets set 'Stripe:SuccessUrl' 'http://localhost:4200/checkout/success?orderId={ORDER_ID}' | Out-Null
dotnet user-secrets set 'Stripe:CancelUrl' 'http://localhost:4200/checkout/cancel?orderId={ORDER_ID}' | Out-Null
dotnet user-secrets list | ForEach-Object { '  ' + ($_ -split ' = ')[0] }

Write-Host '== LocalDB' -ForegroundColor Cyan
sqllocaldb start MSSQLLocalDB | Out-Null
Write-Host '  MSSQLLocalDB pornit'

Write-Host '== Baza de date (migrari)' -ForegroundColor Cyan
if (-not (Get-Command dotnet-ef -ErrorAction SilentlyContinue)) {
    Write-Host '  dotnet-ef lipseste, il instalez...'
    dotnet tool install --global dotnet-ef | Out-Null
    $env:PATH += ";$env:USERPROFILE\.dotnet\tools"
}
dotnet ef database update 2>&1 | Select-Object -Last 3

Write-Host '== Gata. Porneste backend-ul cu: dotnet run --launch-profile http' -ForegroundColor Green
