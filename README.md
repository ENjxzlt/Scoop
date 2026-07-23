# Scoop 🛒

Scoop ist ein selbst gehosteter Online-Shopping-Manager für TrueNAS (Docker/Docker
Compose). Du legst Listen an, fügst Produktlinks von beliebigen Shops hinzu, und
Scoop lädt automatisch Titel, Bild und Preis der Produktseite. Am unteren Rand
jeder Liste siehst du die Gesamtsumme aller Preise.

## Features

- Mehrere Listen (z. B. "Wohnzimmer", "Geburtstag", "Wunschliste")
- Produkt per Link hinzufügen – Bild, Titel und Preis werden automatisch aus der
  Seite ausgelesen (Open Graph Meta-Tags, JSON-LD `Product`/`Offer`, `itemprop`)
- Titel, Bild, Preis und Link eines Produkts jederzeit manuell bearbeiten (✎)
- Einzelnes Produkt neu laden (⟳), z. B. wenn sich der Preis geändert hat
- **Quick-Add Bookmarklet:** Für Shops mit Bot-Schutz (z. B. Amazon), bei denen
  der Server die Seite nicht laden kann – ein Lesezeichen-Link, der die
  Produktseite in deinem eigenen (bereits eingeloggten) Browser ausliest und
  Titel/Bild/Preis vorausgefüllt an Scoop übergibt. Zu finden über den
  "🔖 Quick-Add"-Button im Header
- Automatische Summenberechnung aller Preise pro Liste
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
Shops rendern Preise erst per JavaScript nach). In diesem Fall wird das
Produkt trotzdem mit dem Link angelegt, du kannst Bild/Preis dann manuell im
Karten-View eintragen oder über ⟳ einen erneuten Versuch starten.
