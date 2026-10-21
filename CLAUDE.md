# Allenamento

App di allenamento in un solo file, `allenamento_pro.html` (HTML, CSS e JavaScript senza framework), pubblicata su Firebase Hosting con i dati su Firestore. Dentro c'è un Assistente IA (Gemini) che modifica i dati con un elenco di azioni.

## Regola: parità con l'assistente

**Tutto ciò che l'utente può vedere o modificare nell'app, l'Assistente IA deve poterlo leggere e modificare.** L'utente l'ha deciso il 21/10/2026 e vale per sempre, per ogni modifica del codice, sua o di Claude. Esempio dell'utente: se si aggiungono delle note, l'assistente deve poterle leggere e ci deve poter scrivere.

Quando aggiungi o cambi un comando (pulsante, campo, menu, trascinamento) o un dato salvato, nella stessa modifica:

1. fai arrivare il dato all'assistente in `costruisciContestoIA` (o nei suoi aiuti `…IA`). Copia il record intero con `senzaCampi`, non scegliere i campi a mano: così anche i campi aggiunti dopo arrivano da soli;
2. aggiungi l'azione che lo modifica: `AZIONI_VALIDE`, `eseguiAzione`, `descriviAzione`, `ORDINE_AZIONI`, `SCHEMA_RISPOSTA_IA` e l'elenco e le regole in `promptAzioniIA`. Ciò che elimina, rinomina, sposta o chiude va anche in `AZIONI_DA_CONFERMARE`. Ciò che l'azione cambia va scritto nel `diario`, così «Annulla ultima modifica IA» lo rimette a posto;
3. aggiungi la voce in `test/parita-ia.test.js` (`COMANDI` o `DATI`).

Restano fuori solo le cose che non sono dati dell'allenamento, sempre con il motivo scritto nel test: accesso al cloud, chiave API, backup su file, sola vista (pagine, pannelli, sezioni aperte o chiuse), timer di riposo, impostazioni e conversazione della chat «Chiedi al coach». Se un caso è dubbio, chiedi all'utente.

Scelte dell'utente del 21/10/2026:
- l'assistente comanda anche l'allenamento in corso: serie, note, avvio; salvarlo o scartarlo chiede conferma;
- dell'archivio del coach legge per intero solo gli ultimi 60 giorni (`GIORNI_ARCHIVIO_IA`). Può aggiungere ed eliminare messaggi;
- le immagini delle foto gli arrivano solo quando il messaggio parla di foto (`parlaDiFoto`).

## Controlli

- `npm test` lancia `test/parita-ia.test.js`. Il test trova da solo nel file ogni comando e ogni dato salvato, e fallisce se uno è senza azione, senza lettura e senza esclusione scritta. Controlla anche che ogni azione sia completa: eseguita, descritta, spiegata nelle istruzioni e messa in ordine.
- Lo stesso test parte prima di ogni `firebase deploy` (`predeploy` in `firebase.json`): se fallisce, la pubblicazione si ferma. Così vale anche per le modifiche fatte a mano.
- In Claude Code parte anche dopo ogni modifica di `allenamento_pro.html` o dei test, con l'hook `../.claude/hooks/allenamento-controlli.mjs`.

## Provare l'app

`npm run prova` serve una copia senza cloud su http://localhost:8020 (in Claude Code: `preview_start` con `allenamento-prova`). La pagina si apre senza login e salva solo nel browser di prova, mai sui dati veri. Le risposte di Gemini si possono simulare sostituendo `fetch` nella pagina.

## Pubblicazione

- Prima di ogni modifica salva una copia in `Backup/pre-<cosa>_<AAAAMMGG-HHMM>.html` (cartella esclusa da git).
- Il repository è pubblico su GitHub (ale-pil02/Allenamento). Prima di un push serve l'ok esplicito dell'utente e un controllo che non ci siano dati personali o chiavi. La apiKey web di Firebase nel file va bene, una chiave di Gemini no.
- `firebase deploy` lo lancia l'utente.
