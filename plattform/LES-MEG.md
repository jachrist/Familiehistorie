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

### Operativsystem

**Ubuntu Server 24.04 LTS (64-bit)**, ikke Raspberry Pi OS. Grunnen er at
prøvebenken skal ligne målet: VPS-en kommer til å kjøre Ubuntu, og da er
hver kommando du lærer her direkte overførbar.

Bruk Raspberry Pi Imager og åpne **innstillinger før du skriver**:

- vertsnavn, f.eks. `pi-apper`
- SSH på, med **offentlig nøkkel** — ikke passord
- brukernavn, tidssone, tastatur

Da trenger du aldri koble til tastatur og skjerm.

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
   `arp -a 192.168.68.118` viser MAC-adressen; Raspberry Pi begynner på
   `2c:cf:67`, `d8:3a:dd`, `e4:5f:01` eller `b8:27:eb`. Ellers: klientlista i
   ruteren.
3. **Bruk riktig bruker.** `root` er avslått. Bruk brukeren du satte i Imager,
   eller `ubuntu` hvis du ikke satte noen. Prøv gjerne vertsnavnet:
   `ssh jan@pi-apper.local`.
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

# Slå av passordinnlogging
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart ssh
```

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
