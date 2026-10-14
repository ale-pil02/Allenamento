# Passare al cloud con Firebase

Fino a quando non completi il **passo 4**, la pagina funziona esattamente come adesso,
salvando tutto solo nel browser. Nessun rischio di rompere niente a metà strada.

Serve una sola volta, circa 15 minuti.

---

## Prima di tutto: salva i dati che hai adesso

I dati attuali sono legati al file locale. Passando a un indirizzo web il browser
li considera un sito diverso, quindi **non li ritroveresti in automatico**.

1. Apri `allenamento_pro.html` come fai di solito
2. Pannello **💾 Backup Dati** → **⬇️ Esporta JSON**
3. Tieni da parte il file scaricato: lo reimporterai al passo 6

---

## 1. Crea il progetto Firebase

1. Vai su https://console.firebase.google.com e accedi col tuo account Google
2. **Aggiungi progetto** → dai un nome (es. `allenamento-ale`) → puoi disattivare Google Analytics
3. Attendi la creazione

## 2. Attiva l'accesso con Google

1. Menu a sinistra → **Build** → **Authentication** → **Get started**
2. Scheda **Sign-in method** → **Google** → attiva l'interruttore
3. Scegli un'email di assistenza → **Salva**

## 3. Crea il database

1. Menu a sinistra → **Build** → **Firestore Database** → **Crea database**
2. Scegli la modalità **produzione** (le regole di sicurezza le carichiamo noi al passo 5)
3. Come località scegli `eur3 (europe-west)`

## 4. Configurazione — ✅ GIÀ FATTO

La configurazione del progetto `allenamento-ale` è già inserita nella pagina,
e `.firebaserc` punta già al progetto giusto. Non devi toccare niente.

> I valori della configurazione sono pubblici per definizione: vengono spediti al
> browser di chiunque apra la pagina, non sono una password. A proteggere i dati
> sono le regole del passo 5, che li legano al tuo account Google.

## 5. Pubblica il sito e le regole

Apri il **Prompt dei comandi** nella cartella `Desktop\App mie\Allenamento` ed esegui,
una riga alla volta:

```bash
npm install -g firebase-tools
```

```bash
firebase login
```

```bash
firebase deploy
```

Al termine il terminale mostra l'indirizzo, tipo `https://allenamento-ale.web.app`.
**È il tuo nuovo indirizzo: usa quello, non più il file locale.**

## 6. Primo accesso e recupero dei dati

1. Apri l'indirizzo **sul PC**
2. Pannello **☁️ Cloud** → **Accedi con Google**
3. Pannello **💾 Backup Dati** → **⬆️ Importa JSON** → scegli il file del passo iniziale
4. Il pallino accanto a "Cloud" diventa verde: i dati sono online

Poi apri lo stesso indirizzo **sul telefono** e accedi con lo stesso account:
ritrovi tutto. Da Chrome, menu **⋮ → Aggiungi a schermata Home**, e si comporta come un'app.

> Fai il primo accesso dal PC **dopo** aver importato il backup. Se accedi prima dal
> telefono, il cloud si popola con la scheda vuota di partenza.

---

## Cosa cambia nell'uso

| | Prima | Ora |
|---|---|---|
| Foto | ~15-25 in tutto (limite 5 MB) | migliaia (1 GiB gratuito) |
| PC e telefono | export/import manuale | allineati da soli |
| Senza rete | funziona | funziona, e sincronizza al ritorno del segnale |
| Backup JSON | unica rete di sicurezza | resta disponibile, ora è un extra |

**Cosa NON viene sincronizzato**, di proposito:

- la **chiave API Gemini**, che resta privata su ogni dispositivo
- l'**allenamento in corso**, che appartiene al telefono che hai in palestra
- la **conversazione con l'assistente** della vista Coach Discord (l'archivio dei
  messaggi del coach e le impostazioni dell'assistente invece si sincronizzano)
- tema chiaro/scuro e pannelli aperti o chiusi, che sono preferenze del singolo schermo

Mentre stai scrivendo una correzione o mentre un allenamento è in corso, gli
aggiornamenti in arrivo da un altro dispositivo vengono rimandati: non ti si
cancella il testo sotto le dita.

---

## Accesso privato

La pagina è raggiungibile da chiunque abbia l'indirizzo, ma si usa solo dopo l'accesso
con l'account autorizzato:

- `firestore.rules` accetta letture e scritture **solo** dall'account indicato nella
  funzione `proprietario` (oggi `alessandropillot01@gmail.com`). Per cambiarlo, modifica
  l'email lì e rilancia `firebase deploy`.
- All'apertura la pagina resta coperta dalla schermata 🔒 finché il server non conferma
  che l'account è autorizzato. Un altro account viene disconnesso subito.
- Un browser già verificato si apre direttamente, anche senza rete. Premendo **Esci** nel
  pannello ☁️ Cloud la pagina si blocca di nuovo fino al prossimo accesso.
- La scheda non è più scritta dentro la pagina: arriva dal cloud dopo l'accesso.
- Aperta come file dal disco (`file://`) la pagina non viene bloccata.

**Importante:** pubblica sempre insieme pagina e regole con `firebase deploy` (senza
`--only hosting`), altrimenti il controllo non ha effetto.

---

## Se qualcosa non va

**"L'account … non è autorizzato" anche col tuo account**
Controlla che l'email nella funzione `proprietario` di `firestore.rules` sia esattamente
quella dell'account Google con cui accedi, poi rilancia `firebase deploy`.

**Il pallino resta grigio e vedi l'avviso "non ancora configurato"**
La configurazione del passo 4 non è stata sostituita: è rimasto qualche `DA_COMPILARE`.

**"auth/unauthorized-domain" quando accedi**
Console Firebase → **Authentication** → **Settings** → **Authorized domains**:
aggiungi il dominio da cui apri la pagina. Quello `.web.app` c'è già di suo.

**L'accesso non funziona aprendo il file locale**
È previsto: Firebase non autorizza il protocollo `file://`. Usa l'indirizzo del passo 5.

**"Missing or insufficient permissions"**
Le regole non sono state caricate: rilancia `firebase deploy` dalla cartella giusta.

**Dopo una modifica alla pagina non vedo il cambiamento online**
Rilancia `firebase deploy`: la copia in `public/index.html` viene rigenerata da sola.
