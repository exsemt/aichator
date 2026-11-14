# XSatz Blog & Ratgeber: Leitweg-ID bei der XRechnung – Aufbau, Suche & Praxis

## Was ist die Leitweg-ID?
Die **Leitweg-ID** ist eine eindeutige Adressierungskennung („digitale Postleitzahl“) für elektronische Rechnungen (**XRechnung**) an öffentliche Auftraggeber in Deutschland (Bund, Länder, Städte, Gemeinden und öffentliche Einrichtungen). Sie sorgt dafür, dass eine eingereichte XRechnung auf Rechnungseingangsplattformen wie der **ZRE** (Zentrale Rechnungseingangsplattform des Bundes) oder der **OZG-RE** vollautomatisch dem richtigen Rechnungsempfänger und der zuständigen Abteilung zugeordnet wird.

## Wie ist eine Leitweg-ID aufgebaut?
Eine Leitweg-ID besteht aus bis zu drei Teilen, die durch Bindestriche getrennt sind (Beispiel: `991-12345-67`):
1. **Grobadressierung (vor dem ersten Bindestrich):** Gibt die Verwaltungsebene an (z. B. `991` für den Bund oder den amtlichen Gemeindeschlüssel für Bundesländer und Kommunen, wie `05` für Nordrhein-Westfalen oder `09` für Bayern).
2. **Feinadressierung (zwischen den Bindestrichen):** Identifiziert die konkrete Behörde, Dienststelle oder Kostenstelle (bis zu 30 alphanumerische Zeichen).
3. **Prüfziffer (nach dem zweiten Bindestrich):** Eine zweistellige Prüfsumme nach dem **Modulo-97-Verfahren** (analog zur IBAN-Prüfziffer), mit der Tippfehler sofort erkannt werden.

## Wo trägt man die Leitweg-ID ein und wie vermeidet man Fehler?
- **Pflichtfeld `BT-10` (Buyer reference / Käuferreferenz):** Im XML-Datensatz der XRechnung muss die Leitweg-ID exakt im Feld `BT-10` hinterlegt sein.
- **Typischer Fehler `[BR-DE-15]`:** Fehlt die Leitweg-ID oder ist das Feld `BT-10` leer, lehnt der KoSIT-Validator bzw. das Behördenportal die Rechnung mit dem Validierungsfehler `[BR-DE-15]` ab.
- **Woher bekommt man die Leitweg-ID?** Öffentliche Auftraggeber teilen ihre Leitweg-ID im Auftragsschreiben, in den Vergabeunterlagen oder auf ihrer Website im Impressum mit.
- **Umsetzung in XSatz:** In XSatz kann die Leitweg-ID direkt im Kundenprofil gespeichert oder beim Erstellen einer XRechnung eingegeben werden. Der integrierte Validator prüft vor dem Export automatisch, ob das Pflichtfeld korrekt befüllt ist.
