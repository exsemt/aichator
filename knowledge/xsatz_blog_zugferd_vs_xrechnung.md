# XSatz Blog & Ratgeber: ZUGFeRD vs. XRechnung – Der Unterschied einfach erklärt

## Warum ein normales PDF keine E-Rechnung mehr ist
Ein klassisches PDF-Dokument ist für Computer lediglich ein digitales Abbild von Text und Layout, das erst fehleranfällig per OCR (Texterkennung) ausgelesen werden müsste. Echte E-Rechnungen nach der EU-Norm **EN 16931** enthalten dagegen exakt definierte, maschinenlesbare **XML-Daten**, die jedes Buchhaltungsprogramm sofort fehlerfrei einlesen kann.

## Was ist XRechnung?
- **Aufbau:** Die **XRechnung** ist eine reine **XML-Datei** (in der Syntax UBL oder UN/CEFACT CII) ohne sichtbares PDF-Layout.
- **Einsatzgebiet:** Sie ist der verbindliche Standard für Rechnungen an öffentliche Auftraggeber in Deutschland (**B2G** – Bund, Länder, Kommunen, Universitäten, öffentliche Anstalten) und wird zunehmend auch im automatisierten B2B-Verkehr eingesetzt.
- **Vorteil in XSatz:** Da eine reine XML-Datei für das menschliche Auge schwer lesbar ist, bietet XSatz sowohl die normgerechte Erstellung (inklusive Leitweg-ID) als auch einen integrierten **E-Rechnungs-Visualizer**, der XRechnungs-XML-Dateien übersichtlich wie ein klassisches Rechnungsblatt darstellt.

## Was ist ZUGFeRD (Factur-X)?
- **Aufbau:** **ZUGFeRD** (*Zentraler User Guide des Forums elektronische Rechnung Deutschland*) ist ein **hybrides Rechnungsformat**. Es kombiniert ein normal lesbares **PDF/A-3-Dokument** für das menschliche Auge mit einer unsichtbar im PDF eingebetteten **XML-Datei** (`factur-x.xml`) für die Maschine.
- **Einsatzgebiet:** Ideal für den gesamten **B2B-Bereich** (Geschäftskunden, Handwerk, Dienstleister, Agenturen), da der Empfänger die Rechnung wie gewohnt als PDF öffnen und gleichzeitig automatisiert in die Buchhaltung (z. B. DATEV) importieren kann.
- **Wichtige ZUGFeRD-Profile:**
  - `MINIMUM` und `BASIC-WL`: Enthalten nur Rumpfdaten und erfüllen **nicht** die gesetzlichen Anforderungen der EN 16931 an eine echte E-Rechnung.
  - `BASIC`, `EN 16931 (COMFORT)` und `EXTENDED`: Erfüllen die gesetzliche E-Rechnungspflicht vollständig. XSatz generiert standardmäßig vollwertige, EN-16931-konforme ZUGFeRD-Rechnungen.
