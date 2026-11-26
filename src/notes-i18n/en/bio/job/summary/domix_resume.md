Option A. Résumé block (short)

Domix LLC — System Administrator, separate subdivision (Lyubertsy)
April 2023 – August 2024

Responsibilities:

    Administering 3 servers (Supermicro, Dell; bare metal, Hyper-V) and a Linux server on Debian: DNS, DHCP, SMB/file shares.

    Maintaining the 1C cluster (2 nodes: application server + DBMS) on PostgreSQL 17: updates, migrations, rollbacks, backups.

    Supporting the network across three sites (office and warehouse in Lyubertsy, production in Yegoryevsk): MikroTik (CCR, RB, switches), D-Link, TP-Link, Asus; L2TP VPN, VLAN, DHCP/DNS, firewall, 2 internet providers.

    Configuring Wi-Fi: corporate, guest, mesh network and repeaters.

    Administering QNAP NAS (RAID-1, SMB), Hikvision video surveillance (10 cameras).

    Maintaining the PC/laptop fleet (~70 users), printers (including colour and thermal), 7 handheld terminals, fingerprint scanners.

    Writing Bash/PowerShell scripts for logs, notifications and file-share backups.

Achievements:

    Migrated the 1C database from MSSQL to PostgreSQL 17 — noticeably sped up database work for all 1C users.

    Conducted an audit and compiled a consolidated map of the entire network across three sites, resolving confusion in addressing and configuration; created a unified database of users, credentials and services.

    Set up remote access (RDP, AnyDesk, Ammyy Admin) for the distributed sites.

    Deployed a TP-Link mesh network in the warehouse, eliminating coverage gaps — handheld terminals stopped losing connectivity.

    Created a unified register of company equipment (there was no inventory before).

    Replaced Acronis with a more efficient backup method; thanks to working backups there were no serious downtimes.

    Proposed centralising authentication via an AD domain to eliminate scattered accounts; management did not approve the decision.

Option B. Detailed description (for an interview / cover letter)

Context. Worked at Domix LLC (professional cosmetics manufacturing) as a system administrator of the separate subdivision in Lyubertsy from April 2023 to August 2024. The department had two people — me and the head — plus outsourced staff. Area of responsibility: all network and digital equipment of the company across three sites: the office and warehouse in Lyubertsy, production in Yegoryevsk. Around 70 users: ~50 in the office, ~15 in the warehouse, ~5 in production (plus the fingerprint attendance system).

Infrastructure and servers. Maintained three servers — two production ones (Supermicro and Dell: one for accounting, one for general company tasks) and a self-built test one; bare metal with Hyper-V configured. Linux server on Debian. DNS, DHCP and SMB/file-share roles. Built computers and servers myself.

1C and data. Two-node 1C cluster (application server + DBMS), PostgreSQL 17. Updates, migrations, rollbacks, backups (via 1C tools and scripts for file shares). Key achievement — migration of the database from MSSQL to PostgreSQL 17, which noticeably sped up database work for all 1C users.

Network. Three sites connected via L2TP VPN. Hardware: MikroTik (CCR, RB, switches, router with 802.11 b/g/n), D-Link, TP-Link, Asus. VLAN configuration (traffic separation and binding to a workstation), DHCP/DNS on MikroTik, firewall (drop/accept, ports), two internet providers. Wi-Fi: corporate, guest, mesh and repeaters. Separately — a network audit: when I arrived there was confusion in addressing and settings; I compiled a consolidated map of the whole network and a unified database of users, logins, passwords and services. Set up remote access (RDP, AnyDesk, Ammyy Admin).

Monitoring and automation. Maintained and configured Zabbix (network monitoring, disk-full triggers), a network map using MikroTik tools, UPS monitoring. Bash and PowerShell scripts — logs, notifications, file-share backups. Replaced Acronis with a more efficient backup method.

Peripherals. PC/laptop fleet matching the number of users, printers in every office/department (including colour ones), 2 thermal printers in the warehouse + in production, 7 handheld terminals in the warehouse, fingerprint scanners, Hikvision video surveillance (10 cameras), QNAP NAS (RAID-1, SMB). Maintained a consolidated spreadsheet of all equipment — before me there was effectively no inventory.

Architectural initiative. Proposed centralising authentication via an AD domain to move away from scattered manual accounts and combine the systems into a unified perimeter; management did not approve. Also proposed more automated monitoring tools (e.g. LibreNMS) instead of manual checks — for the same reasons it remained at the proposal stage.

Result. The infrastructure ran stably, there were no serious failures or downtimes; power outages were covered by UPS units. The main growth points I saw — centralised authentication and automation of routine work — were blocked by the need for management approval.
