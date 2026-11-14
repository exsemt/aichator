# XSatz Blog & Praxiswissen: Kleinunternehmer (§ 19 UStG), Handwerker, GoBD & DATEV

## Kleinunternehmerregelung (§ 19 UStG) in E-Rechnungen
Für Selbstständige und Nebenerwerbsgründer, die die Kleinunternehmerregelung nach § 19 UStG nutzen, bietet XSatz einen speziellen **Kleinunternehmer-Modus**:
- Auf dem sichtbaren PDF-Beleg wird automatisch der gesetzlich vorgeschriebene Hinweis auf die Steuerbefreiung nach § 19 UStG ausgegeben und keine Umsatzsteuer ausgewiesen.
- Gleichzeitig wird im eingebetteten XML-Datensatz (XRechnung / ZUGFeRD) der korrekte Umsatzsteuer-Befreiungscode (`VAT exemption reason` / Steuerkategorie `E`) nach EN 16931 gesetzt, damit die E-Rechnung jede technische KoSIT-Validierung fehlerfrei besteht.

## Funktionen speziell für Handwerker, Freelancer & Agenturen
- **Branchenübliche Einheiten (UN/ECE Rec 20):** Neben Stückzahlen unterstützt XSatz Einheiten wie Stunden (`HUR`), Arbeitstage (`DAY`), Pauschalen (`LS`), Laufmeter (`MTR`), Quadratmeter (`MTK`) und Kilogramm (`KGM`) inklusive automatischer Zuordnung der offiziellen UN/ECE-Codes im XML.
- **Angebote & 1-Klick-Rechnung:** Handwerker und Dienstleister können detaillierte Kostenvoranschläge und Angebote erstellen und nach Auftragsbestätigung mit einem Klick in eine fertige ZUGFeRD- oder XRechnung umwandeln.
- **Wiederkehrende Rechnungen & Kataloge:** Häufig genutzte Leistungen, Stundensätze und Materialien lassen sich im Katalog speichern.

## GoBD-konforme Archivierung & Rechnungseingang
- **Revisionssichere Festschreibung:** Sobald eine Rechnung in XSatz finalisiert wird, erhält sie eine lückenlose, fortlaufende Rechnungsnummer, wird vor nachträglichen Änderungen geschützt und mit einem kryptografischen **SHA-256-Fingerabdruck** sowie einem nachvollziehbaren Audit-Trail GoBD-konform auf Servern in Deutschland archiviert.
- **E-Rechnungseingang mit Dublettenprüfung:** Eingehende Lieferantenrechnungen (XML oder ZUGFeRD-PDF) können per Drag-and-Drop hochgeladen werden. XSatz prüft die Datei auf EN-16931-Konformität, warnt vor doppelt eingereichten Rechnungen (Dubletten-Check) und bereitet alle Positionen übersichtlich auf.

## DATEV-Export & Zusammenarbeit mit dem Steuerberater
- Ab dem Tarif **Solo** bietet XSatz einen direkten **DATEV-Export** (unterstützt die Kontenrahmen **SKR03** und **SKR04**), sodass Ausgangs- und Eingangsrechnungen ohne manuelles Abtippen an die Steuerkanzlei übergeben werden können.
- Zusätzlich kann dem Steuerberater ein eigener Lese-/Export-Zugang zum Workspace eingerichtet werden.
