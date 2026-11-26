0. Hikvision CCTV / handheld terminals / printers / colour printers / thermal printer / fingerprint scanner
I think that's all the hardware, but I don't remember exactly. I should make a list to skim through and jog my memory.
1.  So, creating and maintaining a consolidated spreadsheet of all equipment.
My department had only 2 people: me and the head, plus outsourced hires separately. Scope of responsibility covered all network and digital equipment, laptops, PCs, servers and three networks. Two in Lyubertsy, the other in Yegoryevsk.
2. Yes, about 50 in the office, there are many users in production, but fewer to service — about 5 people, though more if you count the fingerprint access system. And about 15 in the warehouse.

3. Office in Lyubertsy, warehouse nearby in Lyubertsy, other warehouses without network equipment. Production in Yegoryevsk. Connectivity between the three sites: Warehouse - Office - Production

4. 1C is the hub for using and storing all data, from business to corporate. It is the main application that has to be dealt with and developed in the company: constant updates, various migrations, rollbacks, backups and so on. Overall everything there was fairly smooth and routine.

5. Yes, I did all of that — it's almost as if you know what I did for me

6. Yes, the database used to be on MSSQL, then I migrated it to PostgreSQL, which significantly sped up work with the database.

7. All the smart equipment that could be connected — though nowadays I wouldn't use Zabbix, I found a bunch of other, more useful tools, and I'd probably write something more suitable myself. Because the main architectural problem of my former system, probably, was that it was a detached application (by the way, it wasn't mine; the previous sysadmin installed it). So, detached from the one thing the system lacked most — the domain. Because that means extra authentication, an additional database and, generally, everything else that isn't quite practical given centralisation around 1C. In other words, the architecture wasn't fully finished, but I didn't change it either, because my boss didn't agree to introducing a domain — although in my view that's the first thing needed to keep everything accounted for and combined into one unified system, rather than an endless number of manual passwords.   
8. I didn't deploy it, and in my view it isn't quite the right tool. Since I worked with the network constantly, kept my finger on the pulse of the system and was always changing and improving it. So what's needed here is a more automated way of gathering network information, e.g. with LibreNMS, since that would mean less manual work. I did have a network map, though, made with MikroTik software — there's a map tool there, I don't remember its name. Overall I had a well-organised system and there were no failures on my side, not counting power outages; that's a different story where the fault isn't only mine, though I was prepared for that too with a UPS. 

9. Yes, I configured all of that: VPN (L2TP), VLAN; routes were already in place so I didn't have to configure them; DHCP, DNS, firewall. My memory might fail me, so it's better to jot more things down so I can recall them.

10. No, I didn't do a large-scale modernisation as such — everything was, let's say, in order, nothing was on fire. But I did lay a new network (mesh) in the warehouse using TP-Link. Funny that only then did I understand the difference between WAN/LAN. You'd think you know a lot, and then you confuse something so simple!
And I configured guest Wi-Fi too and added new access points. But that's a smaller scale.

11. This one needs precision: the scripts in that job were simple, basically just logs and notifications.

12. Actually it was a tricky case (half-jokingly), because it wasn't a full Samba setup — it was a NAS with a domain on it and SMB used for users. QNAP, yes, I administered it and again created the same users; all in all a rather silly situation where I had to do routine stuff that should be consolidated into a single authentication system. Overall it was easy to administer and back up; it was RAID-1, I don't remember the model. Fun and all, but the ecosystem annoys me a bit: FreeBSD with a proprietary add-on. The security side and so on also annoys me a little, but overall I don't remember anything else to add here.

13. 10 units
14. configuration and administration; I didn't do the installation. I could, but it wasn't required of me. 

15. Probably the main problems were several: task tracking. Second was choosing proprietary solutions over free ones (although in the case of the move to PostgreSQL I did manage to convince them). Third was the routine nature of the process and the lack of automation: some processes like user authentication stopped being a one-step thing and turned into a whole set of regulations on where and how to register, not to mention that the user then still has to set up logins and so on. So my initiative and autonomy were somewhat dampened in favour of stability — good on one hand, but on the other I really knew how to improve things and increase stability, and there was no response, unfortunately.

16. No problems at all; it was a good job overall and I was happy.



---



1. Supermicro and Dell. One for accounting, the other for the whole company. The third is a test self-built one. Yes, I also built computers and servers myself.

There was no hypervisor, although Hyper-V was installed and connected via RDP, so yes, Hyper-V in principle. But it was already tuned, so everything was fine.

No AD, because we couldn't agree on a domain — a flat refusal.

DNS, DHCP, SMB, file shares — yes, did that.

Linux server on Debian.

1C cluster on two servers, two nodes.

PostgreSQL version 17.

Backups were also done with 1C, but individual file ones were backed up with a script. 

There was MikroTik, Asus, D-Link, TP-Link — all good, basically.

MikroTik: CCR and RB, switches and a router with 802.11 b/g/n. 

D-Link of the same series as CCR, just some competitor.

VPN L2TP between office and production, and the warehouse too, yes.

VLAN separation for each individual user connecting over twisted pair, so that everything wasn't running in a single channel, to get parallelism. And most importantly, protection, so that each workstation was strictly tied to a specific user (but alas, we never reached that level), though that's exactly what VLAN is for — giving each device its own port.

DHCP and DNS on MikroTik: it handled issuing and reserving addresses; DNS was unfortunately simple and not, say, a filter — it only forwarded to the next server.

Firewall rules, yes, various drop/accept and so on, opening and closing ports.

Honestly, it wasn't all that convenient, but the interface was nicely done.

Wi-Fi: guest and mesh, corporate and repeaters — all cool and convenient to set up, and above all fun and enjoyable. Pity I already know all of it now :)

two internet providers, 

1C cluster: application server and DBMS, yes. 

yes, updates, migrations, rollbacks.

Zabbix monitored the network, there were triggers for disk space running out, but since I went through all of that manually anyway because I made frequent changes, I saw it anyway; but overall yes, there were notifications of that kind, yep.

PCs and laptops — as many as there were users, that much equipment.

printers in every office and department.

thermal printers, yes, 2 in the warehouse and at production.

handheld terminals too, about 7 in the warehouse.

PowerShell: notifications, logs and backups.


3. Regarding the domain

3.1 What exactly should I clarify? No decision was made
3.2 2 main ones and 1 test one 
3.3 bare metal, but Hyper-V is enabled
3.4 OK
3.5 Agreed

Let's finish this: what else do I need to clarify?
