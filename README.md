# SportsStore

Magazin online de articole sportive: **ASP.NET Core 10 Web API** (backend) + **Angular 21 si Bootstrap 5** (frontend).

## Structura

```
back-end/SportsStore.API/   API REST (.NET 10, EF Core, SQL Server, Identity + JWT, Stripe)
front-end/                  aplicatia Angular (catalog, cos, favorite, autentificare, panou Admin)
GHID_INTEGRARE_FRONTEND.txt rutele API si regulile pentru frontend
TESTARE_API_BACKEND.txt     transcriptul testelor API
setup-local-dev.ps1         configurare locala (user-secrets + baza de date)
create-test-accounts.ps1    conturi de test (User si Admin)
```

## Pornire locala

Cerinte: .NET 10 SDK, Node.js (cu npm), SQL Server LocalDB.

1. **Configurare (o singura data pe calculator)**, din folderul radacina al repo-ului:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\setup-local-dev.ps1
   ```
   Seteaza in user-secrets cheia JWT, conexiunea la LocalDB si adresele de intoarcere Stripe,
   apoi creeaza baza de date din migrari. Nimic secret nu se salveaza in repo.

2. **Backend**: Visual Studio (profilul `http`) sau:
   ```powershell
   cd back-end\SportsStore.API\SportsStore.API
   dotnet run --launch-profile http
   ```
   API-ul porneste pe http://localhost:5001.

3. **Frontend**:
   ```powershell
   cd front-end
   npm install
   npm start
   ```
   Aplicatia porneste pe http://localhost:4200. Proxy-ul (`front-end/proxy.conf.json`) trimite
   `/api` si `/images` la backend, deci nu e nevoie de CORS.

4. **Conturi de test** (optional, cu backend-ul pornit):
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\create-test-accounts.ps1
   ```
   Creeaza `testclient` (User) si `testadmin` (Admin); parolele se scriu intr-un fisier in afara repo-ului.
   Rolul Admin se acorda direct in baza (tabela `AspNetUserRoles`): API-ul nu are endpoint pentru asta.

5. **Plati Stripe (optional)**: seteaza cheia de test in user-secrets:
   ```powershell
   cd back-end\SportsStore.API\SportsStore.API
   dotnet user-secrets set "Stripe:SecretKey" "sk_test_..."
   ```

## Note

- `Program.cs` foloseste cultura invarianta: altfel, pe un Windows in romana (separator zecimal `,`),
  validarea `[Range(typeof(decimal), "0.01", ...)]` din DTO-uri arunca exceptie (500).
- Imaginile de produs incarcate din panoul Admin se salveaza in
  `back-end/SportsStore.API/SportsStore.API/wwwroot/images/products/` si **nu** intra in Git.
