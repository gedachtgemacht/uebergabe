# übergabe.

Wohnungsübergabe am Handy protokollieren: Räume, Mängel, Fotos, Zähler, Schlüssel, Unterschriften, PDF.

## Problem

Bei jedem Ein- und Auszug braucht es ein Übergabeprotokoll. Wer es digital machen will, landet bei Apps, die Teil einer Vermieter-Software sind (Immomio, deep.rent, SPS, AppMobilien), ein Konto verlangen, Daten auf fremde Server laden oder pro Protokoll bzw. im Abo kosten. Die Alternative sind Word- und PDF-Vorlagen, die man ausdruckt, von Hand ausfüllt und deren Fotos irgendwo lose im Handy liegen. Was fehlt: ein kleines Protokoll, das offline am Handy läuft, Fotos direkt dem Mangel zuordnet, von beiden Seiten am selben Gerät unterschrieben wird und als PDF und Datei herausgeht.

## Zielgruppe

- Mieterinnen und Mieter beim Ein- oder Auszug, die selbst ein sauberes Protokoll mitbringen wollen.
- Private Vermieter mit wenigen Wohnungen, die keine Verwaltungssoftware kaufen.
- WGs beim Wechsel einer Person, Hausverwaltungen im Kleinen.

## Vorbild und Abgrenzung

- **Immomio Übergabeprotokoll:** Teil der Vermieter-Plattform, Preis nur auf Anfrage für Wohnungsunternehmen, Konto nötig. Kann Räume, Mängel, Fotos, Zähler, Schlüssel, Unterschriften, PDF-Versand.
- **deep.rent Protocol, SPS Wohnungsübergabe:** App-Store-Apps mit kostenpflichtigen Protokollen oder Abo, teils mit Cloud.
- **Fossy Protokoll (offen, Android):** Mängel während der Mietzeit, ohne Zähler, Schlüssel und Gegenzeichnung.

übergabe. macht den Kern davon, kostenlos, ohne Konto, ohne Server, auf jedem Handy im Browser. Es ersetzt keine Verwaltungssoftware (kein Versand, keine Mieterverwaltung, keine Vorlagenbibliothek der Vermieter).

## Funktionen v1

- Protokolle anlegen, Liste aller Protokolle, Protokoll duplizieren (Auszug aus Einzug vorbereiten).
- Kopf: Art (Einzug, Auszug), Datum und Uhrzeit, Adresse, Lage der Wohnung, Vermieter, Mieter, weitere Anwesende.
- Räume: Vorschlagsliste (Flur, Küche, Bad, Wohnzimmer, Schlafzimmer, Balkon, Keller), frei hinzufügen, umbenennen, sortieren.
- Pro Raum: Gesamtzustand (in Ordnung, Mängel, nicht geprüft) und Mängel mit Beschreibung, Ort im Raum, Einstufung (gering, mittel, erheblich), Vermerk "vorhanden bei Einzug" bzw. "neu", bis zu 6 Fotos je Mangel (Kamera oder Galerie).
- Zähler: Typ (Strom, Gas, Wasser kalt, Wasser warm, Wärme, Heizkostenverteiler), Zählernummer, Stand, Einheit, Ablesefoto.
- Schlüssel: Art (Haustür, Wohnung, Briefkasten, Keller, Sonstiges), Anzahl, Bemerkung. Summe wird angezeigt.
- Freitext: Vereinbarungen (zum Beispiel "Mieter streicht Flur bis 15.11.").
- Unterschriften: beide Seiten unterschreiben nacheinander mit dem Finger am selben Gerät, je mit Name in Klarschrift. Vor dem Unterschreiben wird eine Prüfsumme des Inhalts berechnet und angezeigt. Nach der ersten Unterschrift ist das Protokoll gesperrt. Ändern heißt: Unterschriften verwerfen (mit Rückfrage).
- PDF-Export lokal erzeugt, mit allen Angaben, Fotos, Unterschriften und Prüfsumme. Teilen über die Share-Funktion des Systems oder Download.
- Export und Import als Datei (`.uebergabe.json`, Fotos eingebettet).
- Beispielprotokoll (als `Beispiel` markiert, mit einem Klick entfernbar).
- Hell und dunkel, installierbar, offline.

## Nicht-Ziele

- Kein Konto, keine Cloud, kein Versand per E-Mail aus der App, keine Synchronisation zwischen Geräten.
- Keine rechtsverbindliche elektronische Signatur im Sinne qualifizierter Signaturen. Die Unterschrift am Display ist ein Bild, die Prüfsumme hilft nur beim Nachweis, dass PDF und Datei zusammengehören.
- Keine Rechtsberatung, keine Bewertung, wer einen Mangel zu vertreten hat, keine Kautionsabrechnung.
- Keine Verbrauchsabrechnung oder Kostenumlage aus Zählerständen.
- Kein Fotoeditor, keine Grundrisse, keine Mehrsprachigkeit.

## Daten und Format

Speicher: **IndexedDB** (Fotos sind zu groß für localStorage). Datenbank `uebergabe`, Stores `protokolle` (Schlüssel `id`) und `fotos` (Schlüssel `id`, Wert Blob JPEG). Einstellungen (Thema) in localStorage.

Protokoll (Version 1):

```
{ format: "uebergabe", version: 1, id, beispiel: bool,
  art: "einzug"|"auszug", zeitpunkt: ISO-8601, adresse, lage,
  vermieter: { name }, mieter: { name }, anwesende: [string],
  raeume: [{ id, name, zustand: "ok"|"maengel"|"offen",
             maengel: [{ id, text, ort, stufe: "gering"|"mittel"|"erheblich",
                         vorbestehend: bool, fotos: [fotoId] }] }],
  zaehler: [{ id, typ, nummer, stand: number, einheit, foto: fotoId|null }],
  schluessel: [{ id, art, anzahl: int, bemerkung }],
  vereinbarungen: string,
  pruefsumme: string|null,
  unterschriften: [{ rolle: "vermieter"|"mieter", name, zeit: ISO-8601,
                     striche: [[[x,y], ...], ...] }] }
```

- Unterschriften als Strichlisten mit Koordinaten 0 bis 1000 (normiert, als Vektor ins PDF).
- Fotos beim Aufnehmen verkleinert auf höchstens 1600 px lange Kante, JPEG Qualität 0,75.
- Export: eine JSON-Datei, Fotos als `fotos: { fotoId: "data:image/jpeg;base64,..." }`. Import prüft `format` und `version`, legt bei gleicher `id` eine Kopie an statt zu überschreiben.

## Rechenlogik

Reine Funktionen in `logik.js`, ohne DOM:

1. `zahlLesen(text)`: deutsche Zahl zu Number. Punkt als Tausendertrenner, Komma als Dezimaltrenner, ungültig ergibt `null`.
   - `"12.345,6"` → `12345.6`, `"0815"` → `815`, `"12,3,4"` → `null`.
2. `skalieren(b, h, max)`: Zielgröße bei gleichem Seitenverhältnis, gerundet, nie vergrößern.
   - `(4032, 3024, 1600)` → `(1600, 1200)`, `(3024, 4032, 1600)` → `(1200, 1600)`, `(800, 600, 1600)` → `(800, 600)`.
3. `kanonisch(protokoll)`: JSON mit sortierten Schlüsseln, ohne `pruefsumme` und `unterschriften`, Fotos als ihre SHA-256 statt Bilddaten. `pruefsumme = SHA-256(kanonisch)` hex, im UI und PDF die ersten 16 Zeichen in Vierergruppen.
   - Prüfvektor für die Hashfunktion: SHA-256 von `"abc"` = `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad`.
   - Gleiches Protokoll mit anderer Schlüsselreihenfolge ergibt dieselbe Prüfsumme; ein geänderter Zählerstand eine andere.
4. `schluesselSumme(liste)`: Summe der Anzahlen. `[{anzahl:2},{anzahl:1},{anzahl:3}]` → `6`.
5. PDF (eigener kleiner Schreiber in `pdf.js`, keine Bibliothek): Standardschrift Helvetica mit WinAnsiEncoding, Fotos als JPEG über `DCTDecode`, Unterschriften als Pfade, A4 (595 × 842 pt), korrekte `xref`-Offsets.
   - `winAnsi("ä")` → `0xE4`, `winAnsi("ß")` → `0xDF`, `winAnsi("€")` → `0x80`. Zeichen ohne Abbildung werden zu `?`.
   - `textBreite("Bad", 10)` mit Helvetica-Breiten B 667, a 556, d 556: (667 + 556 + 556) / 1000 × 10 = `17,79` pt.
   - `umbrechen(text, breite, groesse)` bricht an Leerzeichen, nie mitten im Wort, außer ein Wort ist allein zu breit.

## Demoseite

`index.html`, ohne Server lauffähig, Handy zuerst (390 px), auf breiten Schirmen zweispaltig.

- **Liste:** alle Protokolle mit Adresse, Art, Datum, Status (`entwurf`, `unterschrieben`) in `--mono`. Knöpfe: neu, Datei importieren, Beispiel laden bzw. entfernen.
- **Kopf:** Art, Zeitpunkt, Adresse, Personen.
- **Räume:** Liste der Räume mit Zustand und Mängelzahl. Raum öffnen: Mängel anlegen, Foto aufnehmen, Fotos als Vorschaubilder.
- **Zähler und Schlüssel:** Eingabe mit Zahlentastatur, Ablesefoto, Schlüsselsumme.
- **Abschluss:** Übersicht (Räume, Mängel nach Stufe, Zähler, Schlüssel), Prüfsumme, zwei Unterschriftsfelder nacheinander (Querformat empfohlen, "Löschen" und "Fertig"), danach PDF erzeugen, teilen, Datei exportieren.
- Name `übergabe.` mit Punkt in `--ac`, Hausstil, hell und dunkel.

## Testplan

- **Funktionstests** (Node, ohne Abhängigkeiten) für alle Testvektoren aus Rechenlogik, dazu: Export und wieder Import ergibt dasselbe Protokoll und dieselbe Prüfsumme; Import mit falscher `version` wird abgelehnt.
- **PDF-Test:** erzeugtes PDF beginnt mit `%PDF-1.4`, endet mit `%%EOF`, jeder `xref`-Offset zeigt auf `n 0 obj`; Beispielprotokoll mit 3 Fotos und 2 Unterschriften erzeugt ein PDF, das sich im Browser öffnen lässt und Umlaute richtig zeigt.
- **Browsertest bei 390 und 1280 px:** Protokoll anlegen, Raum mit Mangel und Foto, Zähler, Schlüssel, zwei Unterschriften, PDF; keine horizontale Scrollleiste, Unterschriftsfeld per Touch bedienbar.
- **Sperre:** nach Unterschrift sind Felder nicht editierbar, Verwerfen setzt Status auf `entwurf`.
- **Offline-Test:** nach erstem Laden Netz aus, Neuladen, alles funktioniert inklusive PDF.
- **Keine externen Requests:** Netzwerkprotokoll beim Durchklicken zeigt nur eigene Dateien.

## Risiken

- **PDF selbst schreiben** ist der größte Brocken. Mit Standardschrift, JPEG und Pfaden bleibt es machbar, Schriften einbetten ist bewusst ausgeschlossen (nur WinAnsi-Zeichen).
- **Speicher:** viele Fotos füllen IndexedDB und machen PDF und Export groß. Verkleinerung auf 1600 px, Anzeige der Größe vor dem Export, Hinweis bei mehr als 50 Fotos.
- **Speicher kann vom Browser geleert werden**, besonders auf iOS. `navigator.storage.persist()` anfragen und deutlich zum Export raten.
- **Beweiskraft:** eine Display-Unterschrift ist kein Ersatz für eine qualifizierte Signatur. Das steht offen in App und README.
- **Kamera-Zugriff** über `<input type="file" accept="image/*" capture>` verhält sich je nach Browser unterschiedlich, Galerie bleibt als Weg.
