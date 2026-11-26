Variante A. Block für den Lebenslauf (kurz)

Domix LLC — Systemadministrator, separate Niederlassung (Ljuberzy)
April 2023 – August 2024

Aufgaben:

    Administration von 3 Servern (Supermicro, Dell; Bare Metal, Hyper-V) und eines Linux-Servers mit Debian: DNS, DHCP, SMB/Dateifreigaben.

    Betreuung des 1C-Clusters (2 Knoten: Anwendungsserver + DBMS) mit PostgreSQL 17: Updates, Migrationen, Rollbacks, Backups.

    Unterstützung des Netzwerks an drei Standorten (Büro und Lager in Ljuberzy, Produktion in Jegorjewsk): MikroTik (CCR, RB, Switches), D-Link, TP-Link, Asus; L2TP-VPN, VLAN, DHCP/DNS, Firewall, 2 Internetanbieter.

    Einrichtung von Wi-Fi: Firmennetz, Gästenetz, Mesh-Netz und Repeater.

    Administration eines QNAP NAS (RAID-1, SMB), Hikvision-Videoüberwachung (10 Kameras).

    Betreuung des PC-/Laptop-Parks (~70 Nutzer), Drucker (auch Farb- und Thermodrucker), 7 Handheld-Terminals, Fingerabdruckscanner.

    Erstellung von Bash-/PowerShell-Skripten für Logs, Benachrichtigungen und Backups von Dateifreigaben.

Erfolge:

    Migration der 1C-Datenbank von MSSQL auf PostgreSQL 17 — deutlich schnellere Datenbankarbeit für alle 1C-Nutzer.

    Audit und Erstellung einer konsolidierten Karte des gesamten Netzwerks an drei Standorten; Beseitigung der Unordnung bei Adressierung und Konfiguration; Aufbau einer einheitlichen Datenbank für Benutzer, Zugangsdaten und Dienste.

    Einrichtung des Fernzugriffs (RDP, AnyDesk, Ammyy Admin) für die verteilten Standorte.

    Aufbau eines TP-Link-Mesh-Netzes im Lager, wodurch die Abdeckungslücken behoben wurden — Handheld-Terminals verloren keine Verbindung mehr.

    Erstellung eines einheitlichen Ausrüstungsregisters für das Unternehmen (vorher gab es keine Inventarführung).

    Ersetzung von Acronis durch eine effizientere Backup-Methode; dauerhaft funktionierender Backups gab es keine nennenswerten Ausfallzeiten.

    Vorschlag zur Zentralisierung der Authentifizierung über eine AD-Domäne zur Beseitigung verstreuter Konten; die Geschäftsleitung hat nicht zugestimmt.

Variante B. Ausführliche Beschreibung (für das Vorstellungsgespräch / das Anschreiben)

Kontext. Arbeitete von April 2023 bis August 2024 bei Domix LLC (Herstellung professioneller Kosmetik) als Systemadministrator der separaten Niederlassung in Ljuberzy. Die Abteilung bestand aus zwei Personen — mir und dem Leiter — sowie hinzugezogenen externen Kräften. Verantwortungsbereich: die gesamte Netzwerk- und Digitaltechnik des Unternehmens an drei Standorten: Büro und Lager in Ljuberzy, Produktion in Jegorjewsk. Etwa 70 Nutzer: ~50 im Büro, ~15 im Lager, ~5 in der Produktion (zzgl. des Fingerabdruck-Zeiterfassungssystems).

Infrastruktur und Server. Betreute drei Server — zwei Produktivserver (Supermicro und Dell: einer für die Buchhaltung, einer für allgemeine Unternehmensaufgaben) und einen selbstgebauten Testserver; Bare Metal mit konfiguriertem Hyper-V. Linux-Server auf Debian. Rollen: DNS, DHCP, SMB/Dateifreigaben. Computer und Server habe ich selbst gebaut.

1C und Daten. Zweiknoten-1C-Cluster (Anwendungsserver + DBMS), PostgreSQL 17. Updates, Migrationen, Rollbacks, Backups (mit 1C-Mitteln sowie per Skript für Dateifreigaben). Wichtigster Erfolg — Migration der Datenbank von MSSQL auf PostgreSQL 17, was die Datenbankarbeit für alle 1C-Nutzer deutlich beschleunigte.

Netzwerk. Drei Standorte, verbunden über L2TP-VPN. Hardware: MikroTik (CCR, RB, Switches, Router mit 802.11 b/g/n), D-Link, TP-Link, Asus. VLAN-Konfiguration (Trennung des Datenverkehrs und Bindung an einen Arbeitsplatz), DHCP/DNS auf MikroTik, Firewall (drop/accept, Ports), zwei Internetanbieter. Wi-Fi: Firmennetz, Gästenetz, Mesh und Repeater. Separat — ein Netzwerk-Audit: Bei meinem Antritt herrschte Unordnung bei Adressen und Einstellungen; ich erstellte eine konsolidierte Karte des gesamten Netzwerks sowie eine einheitliche Datenbank mit Benutzern, Logins, Passwörtern und Diensten. Fernzugriff eingerichtet (RDP, AnyDesk, Ammyy Admin).

Monitoring und Automatisierung. Pflegte und konfigurierte Zabbix (Netzwerküberwachung, Trigger für volle Datenträger), eine Netzwerkkarte mit MikroTik-Mitteln, USV-Überwachung. Skripte in Bash und PowerShell — Logs, Benachrichtigungen, Backups von Dateifreigaben. Acronis durch eine effizientere Backup-Methode ersetzt.

Peripherie. PC-/Laptop-Park entsprechend der Nutzerzahl, Drucker in jedem Büro/jeder Abteilung (einschließlich Farbdrucker), 2 Thermodrucker im Lager + in der Produktion, 7 Handheld-Terminals im Lager, Fingerabdruckscanner, Hikvision-Videoüberwachung (10 Kameras), QNAP NAS (RAID-1, SMB). Führte eine Sammeltabelle der gesamten Ausrüstung — vor mir gab es praktisch keine Inventarführung.

Architektonische Initiative. Vorschlag zur Zentralisierung der Authentifizierung über eine AD-Domäne, um von verstreuten manuellen Konten wegzukommen und die Systeme zu einem einheitlichen Verbund zusammenzuführen; die Geschäftsleitung hat nicht zugestimmt. Ebenso schlug ich stärker automatisierte Monitoring-Tools (z. B. LibreNMS) statt manueller Kontrollen vor — aus denselben Gründen blieb es bei einem Vorschlag.

Ergebnis. Die Infrastruktur lief stabil, es gab keine schweren Störungen oder Ausfallzeiten; Stromausfälle waren durch USV-Anlagen abgedeckt. Die wichtigsten Verbesserungspunkte, die ich sah — zentrale Authentifizierung und Automatisierung der Routinetätigkeiten — scheiterten an der Zustimmung der Geschäftsleitung.
