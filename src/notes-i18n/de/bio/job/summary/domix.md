0. Hikvision-Videoüberwachung / Handheld-Terminals / Drucker / Farbdrucker / Thermodrucker / Fingerabdruckscanner
Das dürfte die ganze Hardware sein, aber ich weiß es nicht genau. Ich sollte eine Liste machen, um sie durchzugehen und mich zu erinnern.
1.  Also: eine Sammeltabelle für die gesamte Ausrüstung anlegen und pflegen.
In meiner Abteilung waren nur 2 Leute: ich und der Leiter, dazu separat extern engagierte Kräfte. Der Verantwortungsbereich umfasste die gesamte Netzwerk- und Digitaltechnik, Laptops, PCs, Server und drei Netze. Zwei in Ljuberzy, das andere in Jegorjewsk.
2. Ja, etwa 50 im Büro, in der Produktion sind es viele Nutzer, aber weniger zu betreuen — rund 5 Leute, mehr, wenn man das Fingerabdruck-Zutrittssystem mitzählt. Und im Lager etwa 15.

3. Büro in Ljuberzy, Lager in der Nähe in Ljuberzy, andere Lager ohne Netzwerktechnik. Produktion in Jegorjewsk. Verbindung zwischen den drei Standorten: Lager - Büro - Produktion

4. 1C ist der Hub für die Nutzung und Speicherung aller Daten, vom Geschäftlichen bis zum Unternehmensweiten. Es ist die Hauptanwendung, mit der man sich in der Firma befassen und die man weiterentwickeln muss: ständige Updates, verschiedene Migrationen, Rollbacks, Backups und so weiter. Insgesamt lief dort alles ziemlich reibungslos und routinemäßig.

5. Ja, das habe ich alles gemacht — fast so, als wüsstest du, was ich getan habe

6. Ja, früher war die Datenbank auf MSSQL, dann habe ich sie auf PostgreSQL migriert, das hat die Arbeit mit der DB deutlich beschleunigt.

7. Alle intelligenten Geräte, die sich anschließen ließen — übrigens würde ich heute kein Zabbix mehr einsetzen, ich habe eine ganze Reihe anderer, nützlicherer Tools gefunden und würde wohl selbst etwas Passenderes schreiben. Denn das Hauptarchitekturproblem meines früheren Systems war wohl, dass es eine abgesetzte Anwendung war (die übrigens nicht von mir stammte; der frühere Sysadmin hatte sie installiert). Also eine Anwendung, getrennt von dem, was dem System am meisten fehlte: der Domäne. Denn das bedeutet zusätzliche Authentifizierung, eine zusätzliche Datenbank und überhaupt alles, was angesichts der Zentralisierung auf 1C nicht sonderlich praktisch ist. Die Architektur war also nicht ganz fertig, aber ich habe sie auch nicht geändert, weil mein Chef der Einführung einer Domäne nicht zustimmte — obwohl das meiner Ansicht nach das Erste wäre, was nötig ist, damit alles erfasst und zu einem einheitlichen System zusammengeführt wird, statt einer endlosen Zahl manueller Passwörter.   
8. Ich habe es nicht eingeführt, und meiner Meinung nach ist es auch nicht das passende Tool. Da ich ständig mit dem Netz gearbeitet, das System buchstäblich am Puls gehabt und es immer wieder verändert und verbessert habe. Hier wäre eine stärker automatisierte Erfassung von Netzwerkinformationen nötig, z. B. mit LibreNMS, denn das wäre weniger Handarbeit. Eine Netzwerkkarte hatte ich allerdings, erstellt mit Software von MikroTik — dort gibt es so ein Kartentool, ich weiß den Namen nicht mehr. Insgesamt hatte ich ein gut organisiertes System und keine Ausfälle meinerseits, Stromausfälle nicht mitgerechnet — das ist eine andere Geschichte, bei der die Schuld nicht nur meine ist, aber auch darauf war ich mit einer USV vorbereitet. 

9. Ja, das habe ich alles konfiguriert: VPN (L2TP), VLAN; Routen waren schon da, ich musste sie nicht einrichten; DHCP, DNS, Firewall. Mein Gedächtnis lässt mich vielleicht im Stich, daher besser noch mehr Notizen, damit ich mich erinnere.

10. Nein, eine so große Modernisierung habe ich nicht durchgeführt — alles war, sagen wir, in Ordnung, nichts brannte. Aber im Lager habe ich ein neues Netz (Mesh-Netz) mit TP-Link verlegt. Komisch, dass ich erst da den Unterschied zwischen WAN/LAN verstanden habe. Man glaubt, viel zu wissen, und verwechselt dann etwas so Einfaches!
Außerdem habe ich Gast-Wi-Fi eingerichtet und neue Access Points ergänzt. Aber das war kleineren Ausmaßes.

11. Hier ist Genauigkeit gefragt: Die Skripte in dieser Stelle waren ganz einfach, im Grunde nur Logs und Benachrichtigungen.

12. Eigentlich war das ein schwieriger Fall (halbscherzhaft), denn es war kein richtiges Samba — es war ein NAS, auf dem eine Domäne lief und SMB für die Benutzer genutzt wurde. QNAP, ja, das habe ich administriert und wieder genau dieselben Benutzer angelegt; insgesamt eine ziemlich dumme Situation, in der ich Routinetätigkeiten verrichten musste, die in einem einheitlichen Authentifizierungssystem zusammengefasst gehören. Insgesamt ließ es sich leicht verwalten und sichern, es war RAID-1, das Modell weiß ich nicht. Schön und gut, aber das Ökosystem nervt mich etwas: FreeBSD mit einer proprietären Komponente. Auch die Sicherheit und dergleichen nerven mich ein bisschen, aber insgesamt fällt mir nichts mehr ein.

13. 10 Stück
14. Konfiguration und Administration; die Installation habe ich nicht gemacht. Ich könnte es zwar, aber es wurde nicht von mir verlangt. 

15. Wohl gab es mehrere Hauptprobleme: die Aufgabenverwaltung. Zweitens die Entscheidung für proprietäre statt freier Lösungen (obwohl ich bei der Umstellung auf PostgreSQL überzeugen konnte). Drittens die Routinemäßigkeit des Prozesses und das Fehlen von Automatisierung: Bestimmte Abläufe wie die Benutzerauthentifizierung waren nicht mehr ein einzelner Schritt, sondern wurden zu einer ganzen Regelung darüber, wo und wie man registriert, ganz zu schweigen davon, dass der Benutzer danach noch die Anmeldungen einrichten muss. Meine Initiative und Eigenständigkeit wurden also zugunsten der Stabilität etwas gedämpft — einerseits gut, andererseits wusste ich wirklich, wie man es verbessern und die Stabilität erhöhen konnte, und es kam keine Antwort, leider.

16. Keine Probleme, insgesamt eine gute Stelle und ich war zufrieden.



---



1. Supermicro und Dell. Einer für die Buchhaltung, der andere für die ganze Firma. Der dritte ist ein selbstgebautes Testgerät. Ja, ich habe auch Computer und Server selbst gebaut.

Einen Hypervisor gab es nicht, obwohl Hyper-V installiert und per RDP erreichbar war, also schon Hyper-V. Aber es war bereits sauber eingestellt, daher war alles in Ordnung.

AD gab es nicht, weil wir uns auf keine Domäne einigen konnten — eine glatte Absage.

DNS, DHCP, SMB, Dateifreigaben — ja, das war so.

Linux-Server auf Debian.

1C-Cluster auf zwei Servern, zwei Knoten.

PostgreSQL-Version 17.

Backups liefen auch über 1C, aber einzelne Dateien wurden per Skript gesichert. 

Es gab MikroTik, Asus, D-Link, TP-Link — eigentlich alles bestens.

MikroTik: CCR und RB, Switches und ein Router mit 802.11 b/g/n. 

D-Link derselben Serie wie CCR, nur ein anderer Anbieter.

VPN L2TP zwischen Büro und Produktion und auch zum Lager, ja.

VLAN-Trennung für jeden einzelnen Benutzer, der über Twisted Pair angeschlossen war, damit nicht alles in einem Kanal läuft, damit Parallelität entsteht. Und vor allem Schutz, damit jeder Platz strikt einem bestimmten Benutzer zugeordnet ist (leider haben wir das nie erreicht), wofür VLAN eigentlich gedacht ist: jedem Gerät einen eigenen Port geben.

DHCP und DNS auf dem MikroTik: Er vergab und reservierte Adressen; DNS war leider einfach und kein Filter, sondern leitete nur an den nächsten Server weiter.

Firewall-Regeln, ja, allerlei drop/accept und so weiter, Ports öffnen und schließen.

Eigentlich war das nicht alles besonders praktisch, aber die Oberfläche war nett gemacht.

Wi-Fi: Gast und Mesh, Firmen-Wi-Fi und Repeater — alles toll und bequem einzurichten, vor allem aber lustig und spaßig. Schade, dass ich das jetzt schon alles weiß :)

zwei Internetanbieter, 

1C-Cluster: Anwendungsserver und DBMS, ja. 

ja, Updates, Migrationen, Rollbacks.

Zabbix überwachte das Netz, es gab Trigger für volle Festplatten, aber da ich alles ohnehin manuell durchging, weil ich oft Änderungen machte, sah ich es sowieso; aber ja, es gab Benachrichtigungen dieser Art, genau.

PCs und Laptops — so viele wie Benutzer, ebenso viel Equipment.

Drucker in jedem Büro und jeder Abteilung.

Thermodrucker, ja, 2 im Lager und in der Produktion.

Handheld-Terminals ebenfalls, etwa 7 im Lager.

PowerShell: Benachrichtigungen, Logs und Backups.


3. Zur Domäne

3.1 Was soll ich genau klären? Es wurde keine Entscheidung getroffen
3.2 2 Hauptgeräte und 1 Testgerät 
3.3 bare metal, aber Hyper-V ist aktiviert
3.4 Okay
3.5 Einverstanden

Lass uns das fertigstellen: Was muss ich noch klären?
