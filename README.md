# Scoop 🛒

Scoop ist ein selbst gehosteter Online-Shopping-Manager für TrueNAS (Docker/Docker
Compose). Du legst Listen an, fügst Produktlinks von beliebigen Shops hinzu, und
Scoop lädt automatisch Titel, Bild und Preis der Produktseite. Am unteren Rand
jeder Liste siehst du die Gesamtsumme aller Preise.

> ### ⚠️ Vibe-Coded
>
> Dieses Projekt wurde praktisch vollständig von einem KI-Coding-Agenten
> (Claude Code) auf Zuruf gebaut – iterativ getestet (u. a. automatisiert per
> Playwright-Screenshots auf Desktop/Mobile) und funktionell verifiziert, aber
> **ohne klassischen menschlichen Code-Review**. Die Codebasis ist bewusst
> klein und lesbar gehalten, falls du selbst reinschauen willst.
>
> Konkret heißt das:
>
> - **Keine Authentifizierung.** Jeder mit Netzwerkzugriff auf den Port kann
>   Listen sehen, anlegen, ändern und löschen. Nur im eigenen, vertrauenswürdigen
>   Heimnetz betreiben – nicht ohne zusätzlichen Schutz (VPN, Reverse-Proxy mit
>   Auth) ins Internet exponieren.
> - **Kein Security-Audit.** Insbesondere der Scraper lädt und parst HTML von
>   beliebigen, von dir eingegebenen URLs – das ist grundsätzlich unbedenklich
>   (kein Code-Execution, nur Text-/Attribut-Extraktion via `cheerio`), aber
>   nicht gegen jedes denkbare Szenario gehärtet.
> - **Für den privaten Gebrauch gedacht**, nicht für produktiven oder
>   Multi-User-Einsatz.

## Features

- Mehrere Listen (z. B. "Wohnzimmer", "Geburtstag", "Wunschliste")
- Ein-/ausklappbare Sidebar (Desktop) bzw. Off-Canvas-Menü (Mobile) – responsives
  Layout für Desktop und Smartphone
- Produkt per Link hinzufügen – Bild, Titel und Preis werden automatisch aus der
  Seite ausgelesen (Open Graph Meta-Tags, JSON-LD `Product`/`Offer`, `itemprop`,
  plus zusätzliche Selektoren speziell für Amazon und eBay)
- Menge pro Produkt (Standard: 1) – fließt in die Summenberechnung ein
- Titel, Bild, Preis, Link und Menge eines Produkts jederzeit manuell
  bearbeiten (✎), falls die Seite nichts oder Falsches liefert
- Einzelnes Produkt neu laden (⟳), z. B. wenn sich der Preis geändert hat
- **Quick-Add Bookmarklet:** Für Shops mit Bot-Schutz (v. a. Amazon), bei denen
  der Server die Seite nicht laden kann – ein Lesezeichen-Link, der die
  Produktseite in deinem eigenen (bereits eingeloggten) Browser ausliest und
  Titel/Bild/Preis vorausgefüllt an Scoop übergibt. Zu finden über den
  "🔖 Quick-Add"-Button im Header
- Automatische Summenberechnung (Preis × Menge) aller Produkte pro Liste
- Daten werden persistent als JSON-Datei gespeichert (kein externer DB-Server nötig)

## Architektur

- **Backend:** Node.js + Express, REST-API unter `/api/*`
- **Frontend:** Vanilla HTML/CSS/JS, wird direkt vom Express-Server ausgeliefert
- **Storage:** JSON-Datei unter `DATA_DIR` (Standard: `/app/data/scoop.json`)

```
server/   Express-API, Scraper, Storage
public/   Frontend (HTML/CSS/JS)
```

## Lokal starten

```bash
cd server
npm install
DATA_DIR=../data node index.js
# -> http://localhost:3000
```

## Mit Docker Compose

```bash
docker compose up -d --build
```

Der Container lauscht auf Port `3000` und speichert Daten im Ordner `./data`
(Bind-Mount). Passe in `docker-compose.yml` bei Bedarf den Port und den Pfad
des Volumes an.

## Deployment auf TrueNAS SCALE

### Variante A: Custom App über die TrueNAS-UI

TrueNAS SCALE baut Custom Apps nicht selbst aus einem Dockerfile – es wird
immer ein fertiges Image aus einer Registry gezogen. Ein GitHub-Actions-
Workflow (`.github/workflows/docker-publish.yml`) baut das Image bei jedem
Push auf `main` automatisch und veröffentlicht es unter
`ghcr.io/enjxzlt/scoop:latest` (GitHub Container Registry). Beim ersten
Push muss das Package einmalig unter
`https://github.com/enjxzlt?tab=packages` → Package-Einstellungen auf
**Public** gestellt werden, sonst kann TrueNAS es nicht pullen (oder du
hinterlegst stattdessen Registry-Zugangsdaten in der Custom-App-UI).

1. Erstelle im Pool ein Dataset für die Daten, z. B.
   `/mnt/<pool>/apps/scoop/data`.
2. Gehe in der TrueNAS-UI zu **Apps → Discover Apps → Custom App**
   (bzw. "Install via YAML", je nach TrueNAS-Version).
3. Trage folgendes Compose-Snippet ein:

   ```yaml
   services:
     scoop:
       image: ghcr.io/enjxzlt/scoop:latest
       restart: unless-stopped
       ports:
         - "3000:3000"
       environment:
         - PORT=3000
         - DATA_DIR=/app/data
       volumes:
         - /mnt/<pool>/apps/scoop/data:/app/data
   ```

4. Speichern und starten. Die App ist danach unter
   `http://<truenas-ip>:3000` erreichbar.

Um auf eine neue Version zu aktualisieren, in der Custom-App-UI einfach
**Update** bzw. Image neu pullen (`docker compose pull && docker compose up -d`
bei Variante B).

### Variante B: Docker Compose per SSH (z. B. mit einer eigenen Compose-App/Dockge)

1. Repo auf den NAS klonen oder Dateien nach `/mnt/<pool>/apps/scoop`
   kopieren.
2. In `docker-compose.yml` den Volume-Pfad auf dein Dataset anpassen:

   ```yaml
   volumes:
     - /mnt/<pool>/apps/scoop/data:/app/data
   ```

3. Starten:

   ```bash
   docker compose up -d --build
   ```

### Image manuell bauen und pushen (optional)

Normalerweise übernimmt das der GitHub-Actions-Workflow automatisch bei
jedem Push auf `main`. Falls du dennoch manuell bauen willst (z. B. lokaler
Test oder andere Registry):

```bash
docker build -t ghcr.io/enjxzlt/scoop:latest .
docker login ghcr.io -u enjxzlt
docker push ghcr.io/enjxzlt/scoop:latest
```

## Konfiguration (Umgebungsvariablen)

| Variable   | Standard        | Beschreibung                          |
| ---------- | --------------- | -------------------------------------- |
| `PORT`     | `3000`          | Port, auf dem der Server lauscht       |
| `DATA_DIR` | `/app/data`     | Verzeichnis für die `scoop.json`       |

## Hinweise zum automatischen Auslesen

Nicht jede Produktseite liefert Preis/Bild über Standard-Metadaten (manche
Shops rendern Preise erst per JavaScript nach, andere blockieren automatisierte
Anfragen aktiv). Amazon und eBay haben eigene, zusätzliche Erkennungsregeln im
Scraper, aber besonders Amazon blockt Server-Requests trotzdem oft (Bot-/TLS-
Fingerprinting lässt sich mit einfachen HTTP-Requests nicht zuverlässig
umgehen). In dem Fall wird das Produkt trotzdem mit dem Link angelegt, und du
hast zwei Möglichkeiten:

- **Manuell nachtragen:** über ✎ Bearbeiten Titel/Bild/Preis eintragen, oder
  über ⟳ einen erneuten Scrape-Versuch starten
- **Quick-Add Bookmarklet verwenden** (siehe Features oben) – liest die Seite
  in deinem eigenen Browser aus und umgeht damit serverseitige Bot-Sperren
  komplett
