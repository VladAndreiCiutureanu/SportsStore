# Creeaza conturile de test testclient (User) si testadmin (Admin) in baza LocalDB
# si scrie parolele in Proiect_CE\CONTURI_TEST_LOCAL.txt. Backend-ul trebuie sa ruleze pe :5001.

$ErrorActionPreference = 'Stop'
$api = 'http://localhost:5001/api'
$out = Join-Path $PSScriptRoot '..\CONTURI_TEST_LOCAL.txt'

function New-TestPassword([string]$prefix) {
    return $prefix + [guid]::NewGuid().ToString('N').Substring(0, 8) + '1!'
}

$sql = "SET NOCOUNT ON; DELETE FROM AspNetUsers WHERE UserName IN ('testclient','testadmin');"
sqlcmd -S '(localdb)\MSSQLLocalDB' -d SportsStore -E -C -I -b -Q $sql

$pwUser = New-TestPassword 'Dev'
$pwAdmin = New-TestPassword 'Adm'

foreach ($acc in @(
        @{ username = 'testclient'; email = 'testclient@example.test'; password = $pwUser },
        @{ username = 'testadmin'; email = 'testadmin@example.test'; password = $pwAdmin })) {
    Invoke-RestMethod -Method Post "$api/Auth/register" -ContentType 'application/json' -Body ($acc | ConvertTo-Json) | Out-Null
    Write-Host "Creat: $($acc.username)"
}

$sql = "SET NOCOUNT ON; INSERT INTO AspNetUserRoles(UserId,RoleId) SELECT u.Id, r.Id FROM AspNetUsers u, AspNetRoles r WHERE u.UserName='testadmin' AND r.Name='Admin';"
sqlcmd -S '(localdb)\MSSQLLocalDB' -d SportsStore -E -C -I -b -Q $sql
Write-Host 'Rol Admin adaugat pentru testadmin'

$login = Invoke-RestMethod -Method Post "$api/Auth/login" -ContentType 'application/json' -Body (@{ usernameOrEmail = 'testadmin'; password = $pwAdmin } | ConvertTo-Json)
Write-Host "Login testadmin OK (token primit: $($login.token.Length) caractere)"

@"
CONTURI DE TEST LOCALE (doar pentru baza LocalDB de dezvoltare, nu le folosi altundeva)
=====================================================================================
User : testclient / testclient@example.test  parola: $pwUser
Admin: testadmin  / testadmin@example.test   parola: $pwAdmin

Rolul Admin a fost adaugat direct in baza (tabela AspNetUserRoles); backend-ul nu are endpoint pentru asta.
Conturile se pot recrea oricand cu: backend\create-test-accounts.ps1 (backend-ul trebuie sa ruleze).
Setarile locale (JWT, conexiune LocalDB, URL-uri Stripe) se refac cu: backend\setup-local-dev.ps1
"@ | Set-Content -Encoding utf8 $out
Write-Host "Parolele sunt in $((Resolve-Path $out).Path)"
