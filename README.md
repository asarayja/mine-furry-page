# Melissa sin verden

Furry-side for Asarayja, Shadowette og dragen som kommer. Laget for GitHub Pages.

## Legge ut siden

1. Lag et repo på GitHub, f.eks. `brukernavn.github.io` (da blir adressen `https://brukernavn.github.io`).
2. Last opp **alt innholdet i denne mappen** til roten av repoet.
3. Gå til **Settings → Pages**, velg **Deploy from a branch**, branch `main` og mappe `/ (root)`.
4. Etter et par minutter er siden ute.

## Admin-panelet

Gå til `/admin/` på siden din. Første gang må du lime inn en GitHub-nøkkel. Instruksjoner står på skjermen.

- Endre tekst, legg til karakterer, last opp bilder og bytt farger.
- Trykk **Publiser** (eller Ctrl+S). Siden oppdateres etter ca. ett minutt.
- Hver publisering lagres som en commit, så du kan alltid gå tilbake til en gammel versjon på GitHub.
- Karakterstatus: **Ferdig**, **Under arbeid** (vises som silhuett med «?») eller **Skjult**.

## Filer

| Fil | Hva |
| --- | --- |
| `index.html`, `assets/` | Selve siden |
| `data/site.json` | Alt innholdet (det admin-panelet endrer) |
| `bilder/` | Bilder. Nye opplastinger havner i `bilder/uploads/` |
| `admin/` | Admin-panelet |

## PHP-versjon

`../php-side` er den samme siden med SQL-database, til hvis du får eget domene og webhotell. `assets/` og `admin/admin.js` + `admin/admin.css` er helt like i begge mappene. Endrer du dem i den ene, kopier dem til den andre.
