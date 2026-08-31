# Plattformoppsett

En oppskrift for å kjøre flere små private apper på én maskin — først en
Raspberry Pi 5 som prøvebenk, senere en VPS. Samme oppskrift begge steder.

Prøveappen i `proev-app/` er poengløs med vilje. Den skal bevise at
*infrastrukturen* henger sammen: reverse proxy, TLS, container som starter på
nytt av seg selv, disk som overlever omstart, utrulling som faktisk traff, og
sikkerhetskopi som får med seg dataene. Når den står, flytter du en ekte app
inn på en pipeline du vet virker.

---

## 1. Pi-en

### Maskinvare

**Ikke kjør fra SD-kort.** Logger og byggeartefakter sliter det ut på
månedsbasis. Pi 5 har PCIe for NVMe via en M.2-HAT, som er best. Ellers en
SSD på USB 3.0. De store diskene dine passer til `/srv` og som lokalt
kopimål.

Sett bootrekkefølgen så den starter fra SSD-en:

```bash
sudo raspi-config     # Advanced Options → Boot Order → NVMe/USB
```

### Fast IP-adresse

Pi-en må ha en adresse som ikke flytter seg. Ellers må `~/.ssh/config`,
DNS-oppføringene og alt annet som peker på den rettes hver gang DHCP-leien
fornyes.

**Gjør det i ruteren, ikke på Pi-en.** En DHCP-reservasjon binder adressen til
MAC-adressen, og Pi-en fortsetter å spørre om adresse som før — den kan ikke
konfigureres feil på en måte som stenger deg ute. På et hjemmenett med skjult
maskin uten skjerm er det argumentet tungt nok alene. Finn MAC-adressen:

```bash
ip -brief link show | grep -v LOOPBACK
```

Legg den inn under DHCP-reservasjoner i ruteren, velg en adresse, og start
Pi-en på nytt.

Vil du likevel sette den på maskinen, bruk `netplan try` — den ruller tilbake
av seg selv etter to minutter hvis du mister forbindelsen:

```bash
ip route get 1.1.1.1        # viser grensesnittnavn og gateway

sudo tee /etc/netplan/99-statisk.yaml >/dev/null <<'EOF'
network:
  version: 2
  ethernets:
    eth0:
      dhcp4: false
      addresses: [192.168.68.50/24]
      routes:
        - to: default
          via: 192.168.68.1
      nameservers:
        addresses: [192.168.68.1, 1.1.1.1]
EOF
sudo chmod 600 /etc/netplan/99-statisk.yaml
sudo netplan try
```

Er Pi-en på wifi, heter blokka `wifis:` og trenger `access-points:` med
SSID-en — da er reservasjon i ruteren enda mer verdt. Velg uansett en adresse
**utenfor** ruterens DHCP-område, ellers deler to enheter adresse en dag.

Hindre at cloud-init skriver over nettverksoppsettet ved oppstart:

```bash
echo 'network: {config: disabled}' \
  | sudo tee /etc/cloud/cloud.cfg.d/99-disable-network-config.cfg
```

**Uansett metode:** installer mDNS, så finner du maskinen på navn den dagen
adressen likevel er feil.

```bash
sudo apt install -y avahi-daemon
```

Da svarer den på `pi-apper.local`, og `~/.ssh/config` kan peke på navnet i
stedet for en adresse som kan endre seg.

### Den store disken

`/srv` er der appdata og containervolumer havner. Slik monterer du disken der.
Finn den først — sjekk nøye at du ser på riktig enhet før du partisjonerer,
`sdb` i dag kan være `sda` i morgen:

```bash
lsblk -o NAME,SIZE,MODEL,MOUNTPOINT
```

Partisjoner, formater og monter (bytt `sda` mot din enhet — dette **sletter**
alt på disken):

```bash
sudo parted /dev/sda --script mklabel gpt mkpart primary ext4 0% 100%
sudo mkfs.ext4 -L data /dev/sda1
sudo mkdir -p /srv
sudo mount /dev/sda1 /srv
sudo chown "$USER:$USER" /srv
```

Gjør den permanent. Bruk **UUID**, aldri `/dev/sda1` — enhetsnavn bytter plass
mellom oppstarter, og en Pi som monterer feil disk er verre enn en som ikke
monterer noe:

```bash
sudo blkid /dev/sda1        # noter UUID
echo 'UUID=<uuid>  /srv  ext4  defaults,noatime,nofail,x-systemd.device-timeout=10  0  2' \
  | sudo tee -a /etc/fstab
sudo systemctl daemon-reload
sudo mount -a && df -h /srv
```

`nofail` er ikke pynt: uten den blir en Pi som ikke finner disken stående i
nødmodus ved oppstart — uten skjerm og uten SSH.

Docker legger som standard bilder og volumer på systemdisken. Flytt dem hit
*før* du bygger noe, mens katalogen er tom:

```bash
sudo systemctl stop docker
sudo mkdir -p /srv/docker
echo '{ "data-root": "/srv/docker" }' | sudo tee /etc/docker/daemon.json
sudo systemctl start docker
docker info | grep 'Docker Root Dir'
```

### Operativsystem

**Ubuntu Server 24.04 LTS (64-bit)**, ikke Raspberry Pi OS. Grunnen er at
prøvebenken skal ligne målet: VPS-en kommer til å kjøre Ubuntu, og da er
hver kommando du lærer her direkte overførbar.

Bruk Raspberry Pi Imager og åpne **innstillinger før du skriver**:

- vertsnavn, f.eks. `pi-apper`
- brukernavn og **passord**
- SSH på, med **passordinnlogging**
- tidssone, tastatur

Da trenger du aldri koble til tastatur og skjerm.

**Start med passord, ikke nøkkel.** Det er fristende å legge inn den
offentlige nøkkelen med én gang og hoppe over passordsteget, men da har du
ingen vei inn hvis nøkkelen ikke kom fram — og uten skjerm ingen måte å finne
ut hvorfor. Med passord kommer du alltid inn, og nøkkelen legger du på
etterpå med én kommando. Passordinnlogging slås av igjen under
[Grunnsikring](#grunnsikring), som er der den hører hjemme uansett.

Når du er inne første gang, kopier nøkkelen over fra Windows (`ssh-copy-id`
finnes ikke der, men røret gjør samme jobb):

```powershell
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh jan@192.168.68.121 `
  "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

Logg ut, og logg inn på nytt. Kommer du inn **uten** å bli spurt om passord,
virker nøkkelen — og først da er det trygt å slå av passordinnlogging.

#### SSH-nøkkel

Har du ingen fra før, i PowerShell på Windows (OpenSSH er innebygd):

```powershell
ssh-keygen -t ed25519 -C "jan@pi-apper"          # Enter for standard sti, sett en passphrase
Get-Content ~\.ssh\id_ed25519.pub | Set-Clipboard
```

Den offentlige nøkkelen ligger nå på utklippstavla og limes inn i Imager.
Filen uten `.pub` er den private — den deles aldri.

Slipp å skrive passphrase hver gang (de to første linjene som administrator):

```powershell
Get-Service ssh-agent | Set-Service -StartupType Automatic
Start-Service ssh-agent
ssh-add ~\.ssh\id_ed25519
```

Et kortnavn i `~\.ssh\config` gjør `ssh pi` til alt du trenger:

```
Host pi
    HostName 192.168.1.50
    User jan
    IdentityFile ~/.ssh/id_ed25519
```

> **Ta vare på den private nøkkelen.** Den ligger bare på maskinen din. En
> reinstallasjon av Windows tar den med seg, og da kommer du ikke inn.

**Har du allerede `~\.ssh\id_ed25519`?** Ikke skriv over den. `ssh-keygen`
overskriver uten mulighet for angring, og er nøkkelen lagt inn på GitHub eller
en annen server, mister du tilgangen der. Én nøkkel kan brukes mot så mange
maskiner du vil — sjekk at den er hel og gjenbruk den:

```powershell
Get-ChildItem ~\.ssh                        # begge filene skal ligge her
ssh-keygen -l -f ~\.ssh\id_ed25519.pub      # skriver ut fingeravtrykk hvis paret er gyldig
Get-Content ~\.ssh\id_ed25519.pub | Set-Clipboard
```

Vil du likevel ha en egen nøkkel til Pi'en, gi den et eget navn i stedet for å
røre den gamle, og pek på den fra `Host pi`-blokka med
`IdentityFile ~/.ssh/id_pi`:

```powershell
ssh-keygen -t ed25519 -f ~\.ssh\id_pi -C "jan@pi-apper"
```
> Legg den i passordbehandleren. På Pi-en redder fysisk tilgang deg —
> på VPS-en gjør den ikke det.

Gi den fast adresse i ruteren (DHCP-reservasjon er enklere enn statisk
oppsett på maskinen).

### Kommer ikke inn med SSH

`Connection refused` betyr noe helt annet enn `Permission denied`. Refused =
maskinen svarte og sa at *ingenting lytter på port 22*. Feil brukernavn eller
feil nøkkel gir aldri refused. Sjekk i denne rekkefølgen:

1. **Vent.** Første oppstart av Ubuntu kjører cloud-init, som setter opp bruker
   og nøkler og starter om én gang. Det tar noen minutter, og i mellomtiden er
   port 22 stengt selv om maskinen svarer på ping.
2. **Er det virkelig Pi-en?** Ping beviser bare at *noe* har den adressen. En
   skriver eller en TV som har fått IP-en fra DHCP svarer like fint.
   `arp -a <adresse>` viser MAC-adressen; Raspberry Pi begynner på `2c:cf:67`,
   `d8:3a:dd`, `e4:5f:01`, `28:cd:c1`, `dc:a6:32` eller `b8:27:eb`. Står det
   noe annet, leter du på feil maskin. Slik finner du den rette — pinger hele
   nettet for å fylle ARP-tabellen, og siler ut Pi-adressene (PowerShell):

   ```powershell
   1..254 | ForEach-Object {
       (New-Object System.Net.NetworkInformation.Ping).SendPingAsync("192.168.68.$_", 300)
   } | Out-Null
   Start-Sleep -Seconds 5
   arp -a | Select-String '2c-cf-67|d8-3a-dd|e4-5f-01|28-cd-c1|dc-a6-32|b8-27-eb'
   ```

   Tomt svar betyr at Pi-en ikke er på nettet i det hele tatt — da er det
   oppstart eller wifi-oppsettet som er feil, ikke SSH. Klientlista i ruteren
   er fasit hvis du vil ha vertsnavn også.
3. **Bruk riktig bruker.** `root` er avslått. Bruk brukeren du satte i Imager,
   eller `ubuntu` hvis du ikke satte noen. Vertsnavnet — `ssh
   jan@pi-apper.local` — virker bare hvis mDNS finnes: Raspberry Pi OS har det
   installert, Ubuntu Server har det ikke før du kjører
   `sudo apt install avahi-daemon`.
4. **Ble tilpasningen i Imager faktisk skrevet?** Imager spør «Bruk
   OS-tilpasning?» rett før skriving, og et feilklikk der gir et image helt
   uten SSH-nøkkel. Sett mediet i PC-en og se etter `user-data` på
   `system-boot`-partisjonen — brukernavnet og nøkkelen din skal stå der.
5. **Skjerm og tastatur.** Det raskeste når resten ikke gir svar:

   ```bash
   sudo systemctl enable --now ssh
   ip addr             # bekreft adressen mens du er der
   ```

Test porten uten å blande inn nøkler:

```powershell
Test-NetConnection 192.168.68.118 -Port 22
```

`TcpTestSucceeded : False` med `PingSucceeded : True` er nøyaktig bildet over.

### «REMOTE HOST IDENTIFICATION HAS CHANGED»

Denne handler om **tjenerens** nøkkel, ikke din egen — til tross for
formuleringen. Hver SSH-tjener har sin egen vertsnøkkel, og `known_hosts`
husker hvilken nøkkel som hørte til hvilken IP-adresse. Får en nyinstallert
maskin en IP-adresse som tidligere tilhørte en annen, ser `ssh` en ny nøkkel på
en kjent adresse og nekter. På et hjemmenett med DHCP er det dagligdags, og har
ingenting med et angrep å gjøre.

Slett den utdaterte linja og koble til på nytt:

```powershell
ssh-keygen -R 192.168.68.117
ssh jan@192.168.68.117          # svar «yes» på fingeravtrykket
```

Vil du være helt sikker på at du snakker med Pi-en, les fingeravtrykket fra
konsollen på Pi-en før du svarer ja:

```bash
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

Merk også at meldingen er et *godt* tegn: den beviser at en SSH-tjener svarer
på adressen. Da er du forbi «Connection refused» og bare et fingeravtrykk unna.

### Får passordspørsmål i stedet for nøkkelinnlogging

To ting er galt samtidig når dette skjer: nøkkelen ble ikke godtatt, *og*
tjeneren tillater fortsatt passord. Nesten alltid betyr det at
OS-tilpasningen fra Imager ikke ble skrevet — da finnes verken brukeren din
eller nøkkelen din på maskinen.

Merk at `Permission denied` på passord ikke betyr at passordet var feil.
Finnes ikke brukeren, spør SSH om passord likevel og avviser alt du taster —
den røper aldri om det var brukernavnet eller passordet som var ukjent.

Start med å se hva som faktisk skjer:

```powershell
ssh -v jan@192.168.68.121
```

Linja `Authentications that can continue: publickey,password` etterfulgt av
`Offering public key` og så passordspørsmål betyr at tjeneren så nøkkelen din
og ikke kjente den igjen. Står det aldri `Offering public key`, er det klienten
din som ikke fant nøkkelen — pek på den direkte med `-i ~\.ssh\id_ed25519`.

Prøv standardbrukeren før du gjør noe mer: Ubuntu-imaget har `ubuntu` (passord
`ubuntu`, må byttes ved første innlogging), Raspberry Pi OS har `pi`.

```powershell
ssh ubuntu@192.168.68.121
```

Virker den, er saken klar: tilpasningen ble aldri brukt.

**Uten skjerm:** ta bootmediet ut av Pi-en og sett det i PC-en.
`system-boot`-partisjonen er FAT32 og leses fint av Windows. Åpne `user-data`
og se etter brukernavnet ditt og `ssh_authorized_keys`. Mangler de, er
raskeste vei å skrive mediet på nytt med Imager — og denne gangen bekrefte
dialogen «Bruk OS-tilpasning?» før skrivingen starter.

### Grunnsikring

```bash
sudo apt update && sudo apt full-upgrade -y

# Automatiske sikkerhetsoppdateringer
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades

# Brannmur. Gjør SSH først — ellers stenger du deg ute.
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp
sudo ufw --force enable

# Slå av passordinnlogging. Bekreft at nøkkelen din virker FØR du kjører dette.
sudo tee /etc/ssh/sshd_config.d/99-hardening.conf >/dev/null <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
EOF
sudo sshd -t && sudo systemctl restart ssh
```

Legg merke til at innstillingene skrives til `sshd_config.d/`, ikke til
`sshd_config` selv. Ubuntu leser inn `sshd_config.d/*.conf` **først**, og i
OpenSSH vinner den verdien som settes først. Satte du passord i Imager, har
cloud-init lagt igjen `50-cloud-init.conf` med `PasswordAuthentication yes` —
og da har en endring i hovedfila ingen virkning i det hele tatt. Filnavnet
`99-` sorterer etter, men `Include`-linja står på toppen av `sshd_config`, så
det er filene i katalogen som gjelder. Er du i tvil, slett cloud-init-fila:

```bash
sudo rm -f /etc/ssh/sshd_config.d/50-cloud-init.conf
sudo systemctl restart ssh
```

Kontroller alltid resultatet mot den *virksomme* konfigurasjonen, ikke mot
fila du skrev:

```bash
sudo sshd -T | grep -E 'passwordauthentication|permitrootlogin'
```

Svaret skal være `passwordauthentication no` og `permitrootlogin no`.

> På Pi-en kan du koble til tastatur hvis noe går galt. På VPS-en er samme
> feil en støttehenvendelse. Bruk anledningen til å gjøre feilene her.

### Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
newgrp docker
docker run --rm hello-world
```

**Hvorfor container og ikke bare `systemd` + nvm:** Node-versjonen pinnes i
Dockerfilen, ikke på verten. Nøyaktig den klassen problemer som koster mest
tid ellers — en oppgradering av verten som velter en app — kan ikke oppstå.
Hver app kan dessuten ha sin egen versjon.

### Caddy

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

Legg inn konfigurasjonen og last den:

```bash
sudo cp /srv/plattform/caddy/Caddyfile /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile        # bytt domene og e-post
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

---

## 2. Domene og TLS

**Du trenger ikke et nytt domene.** Et domene er ikke bundet til én tjener —
hvert subdomene er en egen DNS-post som peker hvor du vil:

| Navn | Type | Peker på | Merknad |
|---|---|---|---|
| `spill` | CNAME | Azure | uendret |
| `proev` | A | Pi-ens adresse | ny |
| `familie` | A | VPS-en | senere |

Azure-appen merker ingenting.

Velg én av tre, i stigende rekkefølge etter hva du trenger:

### a) Bare IP-adresse — kom i gang på fem minutter

Fjern domenenavnet i Caddyfile og bruk `:80` som blokknavn. Ingen TLS, ingen
DNS. Godt nok for å se at ting kjører.

### b) Subdomene mot LAN-adressen — anbefalt til test

Lag en A-post `proev.dittdomene.no` → `192.168.x.x`. DNS bryr seg ikke om at
adressen er privat. Behold `tls internal` i Caddyfile: du får et sertifikat
fra Caddys egen rot, nettleseren advarer én gang, og **hele reverse
proxy-oppsettet blir testet**. Forskjellen på VPS-en er at du fjerner den ene
linja.

### c) Cloudflare Tunnel — når det skal nås utenfra

Gir ekte Let's Encrypt-sertifikat og tilgang hjemmefra **uten å åpne porter i
ruteren**. Klart å foretrekke framfor portåpning når maskinen står i stua.

```bash
# Etter «cloudflared tunnel login»
cloudflared tunnel create pi-apper
cloudflared tunnel route dns pi-apper proev.dittdomene.no
```

---

## 3. Legg ut prøveappen

```bash
sudo mkdir -p /srv && sudo chown "$USER":"$USER" /srv
git clone -b <gren> https://github.com/jachrist/Familiehistorie.git /srv/familiehistorie
ln -s /srv/familiehistorie/plattform /srv/plattform

/srv/plattform/deploy.sh proev-app
```

Skriptet henter siste kode, bygger imaget med commit-summen som versjon,
starter containeren, og **venter til `/helse` faktisk svarer** før det sier
seg ferdig. Feiler den, får du de siste logglinjene i stedet for stillhet.

### Sjekklisten som beviser at plattformen står

| Test | Slik | Forventet |
|---|---|---|
| Appen svarer | Åpne adressen | Siden vises |
| TLS virker | Se på hengelåsen | Sertifikat fra Caddy eller Let's Encrypt |
| Disken skriver | Slipp inn en fil | Den dukker opp i listen |
| Data overlever omstart | `docker compose restart proev-app` | Filen er der fortsatt |
| Data overlever *ny* container | `deploy.sh proev-app` igjen | Filen er der fortsatt |
| Utrulling er synlig | `/versjon` | Ny commit-sum |
| Restart ved krasj | `docker kill proev-app` | Kommer opp igjen selv |
| Overlever strømbrudd | Trekk ut strømmen | Alt er oppe etter oppstart |

Den nest siste og siste er de som skiller «det kjører» fra «det står».

---

## 4. Sikkerhetskopi

Opprett `/etc/familiehistorie/restic.env`, eid av root med rettighet 600:

```bash
RESTIC_REPOSITORY=b2:ditt-boettenavn:pi-apper
RESTIC_PASSWORD=<lang tilfeldig streng>
B2_ACCOUNT_ID=...
B2_ACCOUNT_KEY=...
```

> **Mister du `RESTIC_PASSWORD`, er kopiene tapt for godt.** Legg den i en
> passordbehandler før du går videre.

```bash
sudo apt install -y restic
sudo restic init                     # med env-filen lastet

sudo cp /srv/plattform/sikkerhetskopi/sikkerhetskopi.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now sikkerhetskopi.timer
systemctl list-timers sikkerhetskopi.timer
```

### Det ene steget folk hopper over

```bash
/srv/plattform/sikkerhetskopi/gjenopprett-proeve.sh
```

Den henter siste kopi til en midlertidig katalog og viser hva som kom
tilbake. **Kjør den før du legger inn ekte data**, og et par ganger i året
etterpå. En sikkerhetskopi du aldri har gjenopprettet fra, er en antakelse.

---

## 5. Ny app senere

1. Kopier `proev-app/` som utgangspunkt, eller legg appen i sin egen katalog
2. Ny tjeneste i `docker-compose.yml`, med **neste ledige port** på `127.0.0.1`
3. Fire linjer i `Caddyfile`, og `sudo systemctl reload caddy`
4. `./deploy.sh <navn>`

Sikkerhetskopien tar den med automatisk, siden den dekker hele `/srv`.

---

## Hva som ikke er testet her

Prøveappens kode er kjørt og verifisert: opplasting, henting, avvisning av
filtyper, blokkering av stitraversering, og æøå i filnavn.

**Dockerfilen, compose-oppsettet og Caddy-konfigurasjonen er ikke bygget og
kjørt** — utviklingsmiljøet hadde ingen Docker-daemon. Strukturen er
gjennomgått og compose-filen validerer, men regn med at det kan sitte en
skrivefeil i dem. Første `deploy.sh` er derfor også en test av oppskriften.
