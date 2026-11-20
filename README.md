# Mathe-Bingo

Bingo für den Mathematikunterricht: Thema wählen, Karten ausdrucken und die Aufgaben gemeinsam im Klassenraum spielen.

**[Mathe-Bingo direkt im Browser öffnen](https://mathe-bingo.netlify.app)**

## So funktioniert es

1. **Karten vorbereiten:** Thema und Vorlage wählen und „Bingo-Karten erzeugen“ anklicken.
2. Vorschau prüfen, die Karten als PDF mit Deckblatt speichern und ausdrucken.
3. **Mit diesem Satz spielen:** Regeln und ausgeteilte Karten einstellen, dann die Runde starten.
4. Aufgaben am Beamer zeigen und manuell oder mit Timer ziehen. Die Lernenden markieren passende Felder auf ihren Karten.
5. Bei einem Bingo **Karte prüfen** öffnen und die Kartennummer eingeben. Satzkennung, Papiermarkierungen und Gewinnmuster kontrollieren, bevor ein Punkt vergeben wird.

Die App erkennt mögliche Gewinne anhand der gezogenen Aufgaben, aber keine Markierungen auf Papier. „Vollbild“ öffnet die Präsentationsansicht; mit Escape geht es zurück.

## Vorhandene Karten wiederverwenden

- **Standardvorlagen:** Den zwölfstelligen Spielcode vom Deckblatt unter „Vorhandenen Satz laden“ eingeben und den geladenen Satz mit den Papierkarten abgleichen.
- **Freie Einstellungen:** Neben dem PDF auch die **Satzdatei (.bingo.json)** speichern und weitergeben. Über „Freien Satz aus Satzdatei laden“ wieder öffnen, Vorschau prüfen und übernehmen. Die Abgleichkennung auf einer Karte ist kein Ladecode.
- Regeln und aktive Karten vor dem Rundenstart prüfen. Ältere Spielcodeformate benötigen die dazu passende frühere App-Version.

## Ohne Internet nutzen und weitergeben

Die Datei **[index.html](index.html)** herunterladen und per Doppelklick in einem Desktop-Browser öffnen. Sie enthält alle benötigten Bibliotheken; auch der PDF-Export funktioniert offline. Kein Konto, keine Installation und kein Server erforderlich. JavaScript muss eingeschaltet sein.

Zum Weitergeben genügt die `index.html`. Für bereits vorbereitete freie Kartensätze zusätzlich PDF und Satzdatei mitgeben.

## Themen und Hinweise

Enthalten sind Multiplikation, Brüche, Terme, lineare Gleichungen, Potenzen und Wurzeln, Prozente, lineare und quadratische Funktionen, geometrische Figuren und Körper, Pythagoras sowie „Schlau rechnen“ für Klasse 5.

- Version 1.4 ist eine Desktop-Beta. iPad und Safari sind noch nicht geprüft.
- Graphen- und Figurenkarten sind auf 2×2 und 3×3 begrenzt. Große Kartensätze mit Grafiken können sehr große PDFs erzeugen.
- Lineare Funktionen (Graph ↔ Formel): Auf beiden Achsen entspricht jeder Gitterschritt 1 und ist gleich lang (quadratische Kästchen), auch im PDF. Alle Graphen eines Satzes verwenden denselben Maßstab und Achsenbereich. Lineare Graphenkarten werden für bessere Lesbarkeit mit einer Karte pro PDF-Seite ausgegeben. Bei großen frei gewählten Wertebereichen werden weniger Zahlen beschriftet; das Gitter bleibt in 1er-Schritten.
- Punkte werden nach Möglichkeit im jeweiligen Browser gespeichert. Bei gesperrtem oder vollem Speicher bleiben neue Punkte nur im geöffneten Fenster erhalten. Satzdateien enthalten keine Punkte; beim Weitergeben der App wird der Punktestand nicht übertragen.

## Quellcode bearbeiten

Für die Nutzung ist kein Build nötig. Zur Entwicklung werden Node.js und npm benötigt:

```sh
npm ci --ignore-scripts
npm run build
npm run check:build
npm test
```

`bingo_wuerfel_app_ver1.4.html` ist der bearbeitbare Quellcode. Der Build erzeugt die eigenständig nutzbare `index.html` und eine identische Kopie unter `output/portable/` für statisches Hosting. Nach Änderungen an der Quelle die `index.html` neu bauen und beide Dateien gemeinsam übernehmen.

Die Lizenztexte der eingebetteten Bibliotheken und der PDF-Schrift stehen in der fertigen HTML-Datei. Weitere Angaben zur Schrift: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
