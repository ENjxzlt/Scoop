# Scoop 🛒

Scoop ist ein selbst gehosteter Online-Shopping-Manager für TrueNAS (Docker/Docker
Compose). Du legst Listen an, fügst Produktlinks von beliebigen Shops hinzu, und
Scoop lädt automatisch Titel, Bild und Preis der Produktseite. Am unteren Rand
jeder Liste siehst du die Gesamtsumme aller Preise.

## Features

- Mehrere Listen (z. B. "Wohnzimmer", "Geburtstag", "Wunschliste")
- Produkt per Link hinzufügen – Bild, Titel und Preis werden automatisch aus der
  Seite ausgelesen (Open Graph Meta-Tags, JSON-LD `Product`/`Offer`, `itemprop`)
- Preis manuell überschreiben oder nachtragen, falls die Seite nichts liefert
- Einzelnes Produkt neu laden (⟳), z. B. wenn sich der Preis geändert hat
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

1. Erstelle im Pool ein Dataset für die Daten, z. B.
   `/mnt/<pool>/apps/scoop/data`.
2. Gehe in der TrueNAS-UI zu **Apps → Discover Apps → Custom App**
   (bzw. "Install via YAML", je nach TrueNAS-Version).
3. Repository/Image: baue das Image vorher (siehe unten) und push es in eine
   Registry (z. B. Docker Hub oder GHCR), oder nutze den YAML-Editor der
   Custom App und trage folgendes Compose-Snippet ein:

   ```yaml
   services:
     scoop:
       image: <dein-registry>/scoop:latest
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

### Image selbst bauen und in eine Registry pushen

```bash
docker build -t <dein-registry>/scoop:latest .
docker push <dein-registry>/scoop:latest
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
