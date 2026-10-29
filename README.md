# übergabe.

**Wohnungsübergabe am Handy protokollieren.** Räume, Mängel, Fotos, Zähler, Schlüssel, Unterschriften, PDF.

Bei jedem Ein- und Auszug braucht es ein Übergabeprotokoll. Wer es digital führen will, landet bei Apps, die Teil einer Vermieter-Software sind, ein Konto verlangen, Daten auf fremde Server laden oder pro Protokoll bzw. im Abo kosten. Die Alternative sind ausgedruckte Vorlagen, bei denen die Fotos lose im Handy liegen. übergabe. läuft offline im Browser, ordnet Fotos direkt dem Mangel zu, wird von beiden Seiten am selben Gerät unterschrieben und geht als PDF und Datei heraus.

Reine Rechnung, keine KI, kein Server. Alles bleibt auf deinem Handy.

<p align="center">
  <img src="bilder/1-uebersicht.png" width="240" alt="">
</p>

<p align="center">
  <img src="bilder/2-breit.png" width="640" alt="">
</p>

## Warum

Es gibt Übergabe-Apps, aber sie gehören zu Vermieter-Plattformen (Konto nötig, Preis auf Anfrage) oder kosten pro Protokoll bzw. im Abo, teils mit Cloud. übergabe. macht den Kern davon: kostenlos, ohne Konto, ohne Server, auf jedem Handy im Browser. Es ersetzt keine Verwaltungssoftware: kein Versand, keine Mieterverwaltung, keine Vorlagenbibliothek.

## Funktionen

- **Protokolle** anlegen, Liste aller Protokolle, Protokoll duplizieren (Auszug aus Einzug vorbereiten, Mängel gelten dann als vorhanden)
- **Kopf**: Einzug oder Auszug, Datum und Uhrzeit, Adresse, Lage, Vermieter, Mieter, weitere Anwesende
- **Räume** mit Vorschlägen (Flur, Küche, Bad, Wohnzimmer, Schlafzimmer, Balkon, Keller), frei hinzufügen, umbenennen, sortieren
- **Mängel** pro Raum mit Beschreibung, Ort, Einstufung (gering, mittel, erheblich), Vermerk vorhanden bei Einzug oder neu, bis zu 6 Fotos je Mangel (Kamera oder Galerie)
- **Zähler**: Typ, Zählernummer, Stand, Einheit, Ablesefoto
- **Schlüssel** mit Art, Anzahl und Bemerkung, die Summe wird angezeigt
- **Vereinbarungen** als Freitext
- **Unterschriften** beider Seiten nacheinander mit dem Finger am selben Gerät, je mit Name. Vorher wird eine Prüfsumme berechnet und angezeigt. Nach der ersten Unterschrift ist das Protokoll gesperrt, Ändern heißt Unterschriften verwerfen
- **PDF** lokal erzeugt, mit allen Angaben, Fotos, Unterschriften und Prüfsumme. Teilen über die Share-Funktion des Systems oder Download
- **Export und Import** als Datei (`.uebergabe.json`, Fotos eingebettet)
- **Beispielprotokoll**, als `Beispiel` markiert und mit einem Klick entfernbar
- Hell und dunkel, funktioniert offline, installierbar als App

## Datenschutz

Nichts verlässt dein Gerät. übergabe. hat keinen Server, kein Konto, keine Analyse, keine Werbung und lädt nichts aus dem Netz nach, auch keine Schriften. Protokolle und Fotos liegen nur in der lokalen Datenbank deines Browsers (IndexedDB), die Wahl von hell oder dunkel im lokalen Speicher. PDF und Dateien entstehen nur, wenn du sie selbst auslöst.

Weil die Daten nur im Browser liegen: Wer die Websitedaten löscht, löscht auch die Protokolle. Browser können Speicher außerdem selbst leeren, besonders auf iPhone und iPad. übergabe. bittet den Browser um dauerhaften Speicher, ob er das gewährt, entscheidet er. Exportiere fertige Protokolle deshalb als PDF und Datei.

## Installation

übergabe. ist eine statische Web-App. Es gibt keinen Build-Schritt und keine Abhängigkeiten.

1. Den Ordner auf einen beliebigen statischen Host legen (eigener Webspace, GitHub Pages, Netlify, ein Raspberry Pi). Für die Installation als App ist HTTPS nötig.
2. Die Adresse im Handybrowser öffnen.
3. Im Browsermenü **Zum Startbildschirm hinzufügen** wählen. Danach startet übergabe. wie eine App und funktioniert auch ohne Netz.

Lokal testen:

```
python3 -m http.server 8000
```

Dann `http://localhost:8000` im Browser öffnen.

## Wie gerechnet wird

Es gibt hier keine Kosten- oder Verbrauchsrechnung. Die Logik steckt in reinen Funktionen (`logik.js`, `pdf.js`), die ohne DOM laufen und mit `node test-calc.js` gegen Handrechnungen und Prüfvektoren getestet sind.

- **Zahlen:** deutsche Schreibweise, Punkt als Tausendertrenner, Komma als Dezimaltrenner. `12.345,6` wird `12345.6`, `12,3,4` wird abgelehnt.
- **Fotos:** beim Aufnehmen auf höchstens 1600 px lange Kante verkleinert (nie vergrößert), JPEG mit Qualität 0,75.
- **Prüfsumme:** SHA-256 über den Inhalt als JSON mit sortierten Schlüsseln, ohne Unterschriften, `id` und Beispiel-Markierung. Fotos gehen als ihre eigene SHA-256 ein. Im PDF stehen die ersten 16 Zeichen in Vierergruppen. Gleicher Inhalt in anderer Schlüsselreihenfolge ergibt dieselbe Summe, ein geänderter Zählerstand eine andere. Die eigene SHA-256 ist gegen die Standard-Prüfvektoren getestet.
- **PDF:** ein kleiner eigener Schreiber ohne Bibliothek. A4, Helvetica mit WinAnsi-Zeichensatz (Zeichen außerhalb werden zu `?`), Fotos als JPEG, Unterschriften als Vektorpfade, `xref`-Offsets im Test geprüft. Beispiel: "Bad" in 10 pt ist (667 + 556 + 556) ÷ 1000 × 10 = 17,79 pt breit.

## Grenzen

- Die Unterschrift am Display ist ein Bild, **keine qualifizierte elektronische Signatur**. Die Prüfsumme hilft nur beim Nachweis, dass PDF und Datei zusammengehören.
- Keine Rechtsberatung, keine Bewertung, wer einen Mangel zu vertreten hat, keine Kautionsabrechnung, keine Verbrauchsabrechnung.
- Kein Versand per E-Mail, keine Synchronisation zwischen Geräten, kein Fotoeditor, keine Grundrisse.
- Die Kamera-Aufnahme läuft über das Dateifeld des Browsers und verhält sich je nach Browser unterschiedlich, die Galerie bleibt als Weg.
- Viele Fotos machen PDF und Datei groß, ab 50 Fotos weist die App darauf hin.
- Die Tests prüfen Logik und PDF-Struktur. Ob sich das PDF in jedem Betrachter öffnet, ist nicht für alle Geräte geprüft.

## Lizenz

GNU Affero General Public License v3.0 (AGPL-3.0), siehe `LICENSE`.

---

**gedacht.gemacht.** Kleine, ehrliche Software. Alles bleibt auf deinem Gerät.
