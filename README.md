# Melissa sin verden

Furry-side for Asarayja, Shadowette og dragen som kommer. Laget for GitHub Pages.

## Legge ut siden

1. Lag et repo på GitHub, f.eks. `brukernavn.github.io` (da blir adressen `https://brukernavn.github.io`).
2. Last opp **alt innholdet i denne mappen** til roten av repoet.
3. Gå til **Settings → Pages**, velg **Deploy from a branch**, branch `main` og mappe `/ (root)`.
4. Etter et par minutter er siden ute.
5. Gå til `/admin/` og trykk **Publiser** én gang. Da fylles den riktige nettadressen inn i delingsinfoen, så bildet vises når lenken deles på Discord, Messenger osv.

## Admin-panelet

Gå til `/admin/` på siden din. Første gang må du lime inn en GitHub-nøkkel. Instruksjoner står på skjermen.

- Endre tekst, legg til karakterer, last opp bilder og bytt farger.
- **Musikk:** Lag album og dra inn lydfiler (MP3 er best, maks 40 MB per fil). «Musikk» dukker opp i menyen når det finnes minst ett spor.
  Hvert album får sin egen mappe, `musikk/<album-id>/`. Endrer du id-en til et album, flyttes filene dit når du publiserer. Sletter du et spor eller et album, slettes lydfilene også når du publiserer.
- **Deling:** Under *Forside* kan du bytte bildet som vises når siden deles (1200 × 630 piksler er best).
- Trykk **Publiser** (eller Ctrl+S). Siden oppdateres etter ca. ett minutt.
- Hver publisering lagres som en commit, så du kan alltid gå tilbake til en gammel versjon på GitHub.
- Karakterstatus: **Ferdig**, **Under arbeid** (vises som silhuett med «?») eller **Skjult**.

## Filer

| Fil | Hva |
| --- | --- |
| `index.html`, `assets/` | Selve siden |
| `data/site.json` | Alt innholdet (det admin-panelet endrer) |
| `bilder/` | Bilder. Nye opplastinger havner i `bilder/uploads/`. `deling.jpg` vises når siden deles |
| `musikk/<album-id>/` | Lydfilene, én mappe per album |
| `admin/` | Admin-panelet |

## PHP-versjon

`../php-side` er den samme siden med SQL-database, til hvis du får eget domene og webhotell. Etter endringer i utseende eller funksjoner her, kjør `python3 ../synk-php.py` for å kopiere dem over.
