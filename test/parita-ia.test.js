// Regola dell'app (decisa dall'utente il 21/10/2026, vale per sempre):
// TUTTO CIÒ CHE L'UTENTE PUÒ VEDERE O MODIFICARE, L'ASSISTENTE IA DEVE POTERLO
// LEGGERE E MODIFICARE.
//
// Questo test legge allenamento_pro.html e trova da solo:
//   - ogni comando della pagina (pulsanti, campi, menu, trascinamento, scorciatoie);
//   - ogni dato salvato (le chiavi di localStorage e quelle sincronizzate sul cloud).
// Ognuno deve comparire qui sotto con l'azione dell'assistente che fa la stessa cosa
// (fa), il campo del contesto in cui l'assistente lo legge (legge), oppure un motivo
// scritto per cui resta fuori (escluso). Un comando o un dato nuovo che non è qui fa
// fallire il test: va aggiunta l'azione all'assistente (in allenamento_pro.html:
// AZIONI_VALIDE, eseguiAzione, descriviAzione, ORDINE_AZIONI, le istruzioni in
// promptAzioniIA e SCHEMA_RISPOSTA_IA) e poi la voce qui sotto.
//
// Si lancia con "npm test"; gira anche da solo prima di ogni "firebase deploy".
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const inv = require('./inventario.js');

const fa = (...azioni) => ({ fa: azioni });
const legge = (...campi) => ({ legge: campi });
const escluso = motivo => ({ escluso: motivo });

// Motivi di esclusione che valgono per più voci
const VISTA = "cambia solo cosa vedi sullo schermo (pagina, pannello, sezione aperta o chiusa, filtro): non è un dato dell'allenamento";
const MODO = "attiva o chiude un modo di lavorare sullo schermo: quello che poi scrivi, l'assistente lo fa con le sue azioni sulla scheda";
const FILE = "lavora con un file del dispositivo (backup, export di Discord): l'assistente non ha file, e i dati dentro li modifica già una voce alla volta";
const ACCESSO = "accesso al cloud con il tuo account Google: riguarda la sicurezza, non i dati dell'allenamento";
const CHIAVE = "chiave API di Gemini: resta privata sul dispositivo e l'assistente non la vede mai";
const TIMER = "timer di riposo: un conto alla rovescia sullo schermo, non un dato che si salva";
const CHAT_COACH = "conversazione con l'altro assistente, la chat «Chiedi al coach»: è il modo di parlargli, non un dato dell'allenamento";
const IMPOSTAZIONI_COACH = "impostazioni della chat «Chiedi al coach» (il tuo nome su Discord e le sue istruzioni): sono la configurazione di un assistente, come chiave e modello; il nome l'assistente lo legge in archivio_coach";

// Scrivere nella scheda (testo dei punti, a capo, rientri): l'assistente riscrive
// correzioni e nomi con le sue azioni
const SCRITTURA = fa('correzioni', 'correzioni_personali', 'rinomina_giorno', 'rinomina_esercizio');

const COMANDI = {
    // --- Scheda: struttura, testo e formattazione ---
    toggleModifica: escluso(MODO),
    toggleModificaEsercizio: escluso(MODO),
    fineModifica: escluso(MODO),
    salvaScheda: SCRITTURA,
    salvaSchedaPresto: SCRITTURA,
    conSelezione: SCRITTURA,
    cursoreInTestoModificabile: SCRITTURA,
    puntiDaRientrare: SCRITTURA,
    rientraPunto: SCRITTURA,
    esciDalPunto: SCRITTURA,
    gestisciInvio: SCRITTURA,
    getSelectionLi: SCRITTURA,
    esercizioDi: SCRITTURA,
    assicuraRigaCorrezioni: SCRITTURA,
    aggiornaSottoCorrezioni: SCRITTURA,
    // Uscendo dalla scheda dopo aver scritto: si salva e si ridisegna
    syncInlineTrackers: SCRITTURA,
    syncManagementControls: SCRITTURA,
    syncDayActions: SCRITTURA,
    popolaSelectEsercizi: SCRITTURA,
    aggiungiGiorno: fa('crea_giorno'),
    aggiungiEsercizio: fa('crea_esercizio'),
    eliminaBlocco: fa('elimina_giorno', 'elimina_esercizio'),
    iniziaTrascinamento: fa('sposta_giorno', 'sposta_esercizio'),
    completaTrascinamento: fa('sposta_giorno', 'sposta_esercizio'),
    aggiungiTeoria: fa('correzioni'),
    aggiungiCorrezioneMia: fa('correzioni_personali'),
    toggleEvidenza: fa('evidenzia'),
    usaChip: fa('evidenzia'),
    apriSpaziatura: fa('spaziatura'),
    apriSpaziaturaDaBarra: fa('spaziatura'),
    chiudiSpaziaturaFuori: escluso(VISTA),
    escSpaziatura: escluso(VISTA),
    clickSpaziatura: fa('spaziatura'),
    applicaSp: fa('spaziatura'),
    valoreSp: fa('spaziatura'),
    renderSpaziatura: fa('spaziatura'),
    chiudiTuttoIlGiorno: escluso(VISTA),
    filtraEsercizi: escluso(VISTA),
    toggleCorrezioni: escluso(VISTA),
    toggleTeoria: escluso(VISTA),
    toggleFoto: escluso(VISTA),
    toggleSchema: escluso(VISTA),
    toggleSottoCorrezioni: escluso(VISTA),
    toggleSottoCorrezioniSessione: escluso(VISTA),

    // --- Schema serie, riposo, nota tecnica ---
    aggiungiSerieSchema: fa('schema_serie'),
    eliminaSerieSchema: fa('schema_serie'),
    cambiaTipoSerie: fa('schema_serie'),
    modificaSerieSchema: fa('schema_serie'),
    modificaRiposoSchema: fa('riposo'),
    modificaNotaSchema: fa('nota'),

    // --- Foto degli esercizi ---
    aggiungiFoto: escluso("caricare una foto: l'assistente non ha immagini da caricare, le scatti o le scegli tu dal telefono"),
    eliminaFoto: fa('elimina_foto'),
    apriLightbox: legge('foto'),
    navigaLightbox: legge('foto'),
    chiudiLightbox: escluso(VISTA),
    mostraFotoSessione: legge('foto'),

    // --- Note degli allenamenti ---
    modificaNota: fa('modifica_nota_allenamento'),
    salvaModificaNota: fa('modifica_nota_allenamento'),
    eliminaNota: fa('elimina_nota_allenamento'),
    aggiornaNoteEsercizio: escluso("«Annulla» mentre modifichi una nota: chiude il campo senza cambiare niente"),
    mostraTutteLeNote: legge('note_allenamenti'),

    // --- Allenamento in corso ---
    avviaSessione: fa('avvia_allenamento'),
    apriSessione: escluso(VISTA),
    minimizzaSessione: escluso(VISTA),
    togglePannello: escluso(VISTA),
    apriNotaSessione: escluso(VISTA),
    completaSerie: fa('serie_in_corso'),
    modificaSerieSessione: fa('serie_in_corso'),
    cambiaTipoSerieSessione: fa('serie_in_corso'),
    aggiungiSerieSessione: fa('serie_in_corso'),
    scriviNotaSessione: fa('nota_in_corso'),
    terminaSessione: fa('termina_allenamento'),
    chiudiRiepilogo: fa('termina_allenamento'),
    registraAttivita: escluso("riprende l'allenamento dalla pausa automatica: succede da solo a ogni modifica, anche a quelle dell'assistente"),
    avviaRiposo: escluso(TIMER),
    regolaRiposo: escluso(TIMER),
    fermaRiposo: escluso(TIMER),

    // --- Monitoraggio ---
    aggiungiLog: fa('registra_carichi'),
    rimuoviSessione: fa('elimina_carichi'),
    eliminaSessioneStorico: fa('elimina_allenamento'),
    aggiornaVistaLog: legge('storico_carichi'),
    aggiornaGraficoRoutine: legge('allenamenti_salvati'),
    cambiaMetricaRoutine: legge('allenamenti_salvati'),
    toggleUnisciGiorni: escluso(VISTA),
    toggleMonitoraggio: escluso(VISTA),

    // --- Assistente IA: modello e impostazioni ---
    aggiornaConIA: escluso("è il pulsante che manda il messaggio all'assistente stesso"),
    annullaUltimaIA: escluso("«Annulla ultima modifica IA»: è la rete di sicurezza contro gli errori dell'assistente, deve restare in mano tua"),
    cambiaModello: fa('imposta_modello'),
    aggiungiModello: fa('imposta_modello'),
    rimuoviModello: fa('rimuovi_modello'),
    aggiornaElencoModelli: escluso("chiede a Google, con la tua chiave, quali modelli esistono: l'assistente legge l'elenco in modello_ia e lo cambia con imposta_modello e rimuovi_modello"),
    cambiaRicercaWebIA: fa('imposta_ricerca_web'),
    salvaApiKey: escluso(CHIAVE),
    apriAggiuntaModello: escluso(VISTA),
    apriConfigurazioneIA: escluso(VISTA),
    toggleApiPanel: escluso(VISTA),

    // --- Coach: archivio dei messaggi e chat ---
    analizzaIncollaCoach: fa('aggiungi_messaggi_coach'),
    modificaAnteprimaCoach: fa('aggiungi_messaggi_coach'),
    togliDaAnteprimaCoach: fa('aggiungi_messaggi_coach'),
    confermaAnteprimaCoach: fa('aggiungi_messaggi_coach'),
    annullaAnteprimaCoach: escluso("chiude l'anteprima dei messaggi incollati senza aggiungere niente"),
    eliminaMessaggioCoach: fa('elimina_messaggio_coach'),
    annullaImportCoach: fa('elimina_messaggio_coach'),
    importaFileCoach: escluso(FILE),
    annullaSostituzioneCoach: escluso("annulla l'import da file dell'export di Discord, che resta a te: " + FILE),
    portaInSchedaCoach: escluso("copia i messaggi del coach nella casella dell'Assistente IA: è già il modo di passarglieli"),
    renderArchivioCoachPresto: legge('archivio_coach'),
    cambiaFiltroCoach: legge('archivio_coach'),
    cambiaAtletaCoach: escluso(IMPOSTAZIONI_COACH),
    salvaPromptCoach: escluso(IMPOSTAZIONI_COACH),
    ripristinaPromptCoach: escluso(IMPOSTAZIONI_COACH),
    inviaDomandaCoach: escluso(CHAT_COACH),
    riprovaDomandaCoach: escluso(CHAT_COACH),
    nuovaChatCoach: escluso(CHAT_COACH),
    aggiornaAvvisiCoach: escluso(VISTA),
    toggleCardCoach: escluso(VISTA),
    toggleImpostazioniCoach: escluso(VISTA),
    adattaAltezza: escluso("allarga il campo di testo mentre scrivi: solo aspetto"),

    // --- Backup, cloud e vista generale ---
    esportaBackup: escluso(FILE),
    importaBackup: escluso(FILE),
    scaricaFileAggiornato: escluso(FILE),
    accedi: escluso(ACCESSO),
    cloudEsci: escluso(ACCESSO),
    cambiaVista: escluso(VISTA),
    toggleSidebar: escluso(VISTA),
    toggleSezione: escluso(VISTA),
    toggleDarkMode: escluso(VISTA)
};

const STATO_SEZIONE = "sezione aperta o chiusa di ogni esercizio: " + VISTA;

const DATI = {
    allenamentoScheda: {
        legge: ['giorni'],
        fa: ['correzioni', 'correzioni_personali', 'evidenzia', 'spaziatura', 'crea_giorno', 'crea_esercizio',
            'rinomina_giorno', 'rinomina_esercizio', 'sposta_giorno', 'sposta_esercizio', 'elimina_giorno', 'elimina_esercizio']
    },
    allenamentoSchemaSerie: { legge: ['programmazione'], fa: ['schema_serie', 'riposo', 'nota'] },
    allenamentoLogCarichi: { legge: ['storico_carichi'], fa: ['registra_carichi', 'registra_allenamento', 'elimina_carichi', 'termina_allenamento'] },
    allenamentoSessioni: { legge: ['allenamenti_salvati'], fa: ['registra_allenamento', 'elimina_allenamento', 'termina_allenamento'] },
    allenamentoNoteAllenamenti: { legge: ['note_allenamenti'], fa: ['aggiungi_nota_allenamento', 'modifica_nota_allenamento', 'elimina_nota_allenamento'] },
    allenamentoSpaziatura: { legge: ['spaziatura_scheda'], fa: ['spaziatura'] },
    // Le immagini le riceve quando il messaggio parla di foto (allegatiFotoIA); caricarne di nuove resta a te
    allenamentoFotoEsercizi: { legge: ['foto'], fa: ['elimina_foto'] },
    allenamentoSessioneAttiva: { legge: ['allenamento_in_corso'], fa: ['avvia_allenamento', 'serie_in_corso', 'nota_in_corso', 'termina_allenamento'] },
    coachDiscordArchivio: { legge: ['archivio_coach'], fa: ['aggiungi_messaggi_coach', 'elimina_messaggio_coach'] },
    gemini_model: { legge: ['modello_ia'], fa: ['imposta_modello'] },
    gemini_models: { legge: ['modello_ia'], fa: ['imposta_modello', 'rimuovi_modello'] },
    gemini_ricerca_web: { legge: ['modello_ia'], fa: ['imposta_ricerca_web'] },

    coachDiscordImpostazioni: escluso(IMPOSTAZIONI_COACH),
    coachDiscordChat: escluso(CHAT_COACH),
    coachDiscordFiltro: escluso(VISTA),
    gemini_api_key: escluso(CHIAVE),
    schedaPrimaIA: escluso("fotografia per «Annulla ultima modifica IA»: la rete di sicurezza contro l'assistente resta in mano tua"),
    correzioniNascoste: escluso(STATO_SEZIONE),
    correzioniCoachChiuse: escluso(STATO_SEZIONE),
    correzioniMieChiuse: escluso(STATO_SEZIONE),
    correzioniNoteChiuse: escluso(STATO_SEZIONE),
    teoriaAperta: escluso(STATO_SEZIONE),
    fotoAperte: escluso(STATO_SEZIONE),
    schemaAperto: escluso(STATO_SEZIONE),
    darkMode: escluso(VISTA),
    sidebarNascosta: escluso(VISTA),
    apiPanelHidden: escluso(VISTA),
    iaSectionHidden: escluso(VISTA),
    backupSectionHidden: escluso(VISTA),
    vistaAttiva: escluso(VISTA),
    monUnisciGiorni: escluso(VISTA),
    monEsercizioChiusa: escluso(VISTA),
    monGiornataChiusa: escluso(VISTA),
    coachImportChiuso: escluso(VISTA),
    coachArchivioChiuso: escluso(VISTA),
    accessoAutorizzato: escluso("segno tecnico che questo browser ha già fatto l'accesso: " + ACCESSO),
    idDispositivo: escluso("codice tecnico del dispositivo, serve solo alla sincronizzazione col cloud"),
    ultimoBackup: escluso("data dell'ultimo backup su file: " + FILE)
};

const html = inv.leggiApp();
const comandi = inv.comandiUtente(html);
const dati = inv.datiSalvati(html);
const ia = inv.assistente(html);

const elencoErrori = righe => righe.map(r => '  - ' + r).join('\n');

test("gli script della pagina non hanno errori di sintassi", () => {
    inv.scriptDi(html).forEach((s, i) => {
        assert.doesNotThrow(() => new vm.Script(s.codice, { filename: `script ${i + 1} di allenamento_pro.html` }));
    });
});

test("l'inventario trova i comandi, i dati e le azioni dell'assistente", () => {
    // Se uno di questi crolla, è il test a non leggere più bene la pagina
    assert.ok(Object.keys(comandi).length > 80, `comandi trovati: ${Object.keys(comandi).length}`);
    assert.ok(Object.keys(dati).length > 25, `dati trovati: ${Object.keys(dati).length}`);
    assert.ok(ia.azioni.length > 20, `azioni dell'assistente trovate: ${ia.azioni.length}`);
    assert.ok(ia.prompt.length > 5000, 'istruzioni dell\'assistente non trovate');
});

test("l'inventario si accorge di un pulsante e di un dato nuovi (prova su una pagina finta)", () => {
    const finta = `<button onclick="salvaPesoCorporeo(this.value)">Peso</button>
        <h3 onclick="apriChiudi(this, 'pannello', 'misureChiuse')">Misure</h3>
        <div id="x"></div>
        <script>
            const MISURE_KEY = "misureCorporee";
            function salvaPesoCorporeo(v) { localStorage.setItem(MISURE_KEY, v); }
            function apriMisure() { localStorage.getItem('misureAperte'); }
            function apriChiudi(el, id, chiaveStato) { localStorage.setItem(chiaveStato, 'true'); }
            document.getElementById('x').addEventListener('click', () => { apriMisure(); });
            const riga = \`<input onchange="segnaCirconferenza('\${'k'}', this.value)">\`;
            function segnaCirconferenza(k, v) {}
            // Un pulsante che passa da una freccia, e la fine di un trascinamento
            const esegui = b => { if (b) segnaInBlu(b); };
            document.body.addEventListener('pointerdown', ev => { esegui(ev.target); });
            function segnaInBlu(b) {}
            const lascia = () => { posaMisura(); };
            document.addEventListener('pointerup', lascia);
            function posaMisura() {}
        </script>`;
    assert.deepEqual(Object.keys(inv.comandiUtente(finta)).sort(), ['apriChiudi', 'apriMisure', 'posaMisura', 'salvaPesoCorporeo', 'segnaCirconferenza', 'segnaInBlu']);
    assert.deepEqual(Object.keys(inv.datiSalvati(finta)).sort(), ['misureAperte', 'misureChiuse', 'misureCorporee']);
});

test("la pagina salva i dati solo dove questo test sa guardare", () => {
    const { trovati, raccolte } = inv.altriArchivi(html);
    assert.deepEqual(trovati, [], `La pagina usa anche ${trovati.join(', ')}: insegna a test/inventario.js a leggerne le chiavi, poi classificale in DATI.`);
    // Su Firestore "dati" contiene le chiavi di CHIAVI_SINCRONIZZATE e "foto" le foto (allenamentoFotoEsercizi)
    assert.deepEqual(raccolte.sort(), ['dati', 'foto'], 'Raccolta nuova su Firestore: aggiungila all\'inventario e classificala in DATI.');
});

test("ogni comando della pagina ha la sua azione dell'assistente, o un motivo scritto per restarne fuori", () => {
    const mancanti = Object.keys(comandi).filter(n => !COMANDI[n]).sort();
    assert.deepEqual(mancanti, [], `Comandi nuovi senza la corrispondente azione dell'assistente:\n${elencoErrori(mancanti.map(n => `${n} (${comandi[n].join('; ')})`))}\n`
        + "Regola: ciò che l'utente può fare, l'assistente deve poterlo fare. Aggiungi l'azione all'assistente in allenamento_pro.html "
        + "(AZIONI_VALIDE, eseguiAzione, descriviAzione, ORDINE_AZIONI, promptAzioniIA) e poi la voce in COMANDI qui; "
        + "escluso('motivo') solo se non riguarda i dati dell'allenamento (accesso, chiave, sola vista).");
});

test("ogni dato salvato è letto e modificabile dall'assistente, o ha un motivo scritto per restarne fuori", () => {
    const mancanti = Object.keys(dati).filter(k => !DATI[k]).sort();
    assert.deepEqual(mancanti, [], `Dati nuovi che l'assistente non legge e non modifica:\n${elencoErrori(mancanti.map(k => `${k} (${dati[k].join(', ')})`))}\n`
        + "Regola: ciò che l'utente vede o modifica, l'assistente deve poterlo leggere e modificare. Mettilo in costruisciContestoIA, "
        + "aggiungi le azioni che lo cambiano e poi la voce in DATI qui (o escluso('motivo') se non è un dato dell'allenamento).");
});

test("ogni dato letto dall'assistente si può anche modificare, e ogni dato modificato si può leggere", () => {
    const zoppi = Object.entries(DATI)
        .filter(([, v]) => !v.escluso && (!(v.legge || []).length || !(v.fa || []).length))
        .map(([k]) => k);
    assert.deepEqual(zoppi, [], `Dati con solo metà della regola (servono sia "legge" sia "fa"):\n${elencoErrori(zoppi)}`);
});

test("l'elenco qui sopra non ha voci rimaste di comandi o dati che non esistono più", () => {
    const vecchiComandi = Object.keys(COMANDI).filter(n => !comandi[n]);
    const vecchiDati = Object.keys(DATI).filter(k => !dati[k]);
    assert.deepEqual(vecchiComandi.concat(vecchiDati), [], `Voci da togliere (nella pagina non ci sono più):\n${elencoErrori(vecchiComandi.concat(vecchiDati))}`);
});

test("le azioni e i campi citati qui esistono davvero nell'assistente", () => {
    const voci = Object.entries(COMANDI).concat(Object.entries(DATI));
    const errori = [];
    voci.forEach(([nome, v]) => {
        (v.fa || []).forEach(a => { if (!ia.azioni.includes(a)) errori.push(`${nome}: l'azione «${a}» non è in AZIONI_VALIDE`); });
        (v.legge || []).forEach(c => {
            if (!new RegExp(`\\b${c}\\s*[:,}]`).test(ia.contesto)) errori.push(`${nome}: il campo «${c}» non è nel contesto (costruisciContestoIA)`);
        });
        if ('escluso' in v && String(v.escluso).trim().length < 20) errori.push(`${nome}: il motivo dell'esclusione è troppo corto`);
        if (!v.escluso && !(v.fa || []).length && !(v.legge || []).length) errori.push(`${nome}: voce vuota`);
    });
    assert.deepEqual(errori, [], elencoErrori(errori));
});

test("ogni azione dell'assistente è completa: eseguita, descritta, spiegata nelle istruzioni e in ordine", () => {
    const errori = [];
    ia.azioni.forEach(a => {
        if (!ia.eseguite.includes(a)) errori.push(`${a}: manca il "case" in eseguiAzione`);
        if (!ia.descritte.includes(a)) errori.push(`${a}: manca il "case" in descriviAzione`);
        if (!ia.nelPrompt.includes(a)) errori.push(`${a}: non è nell'elenco AZIONI DISPONIBILI di promptAzioniIA`);
        if (!ia.ordine.includes(a)) errori.push(`${a}: non è in ORDINE_AZIONI`);
        if (/^(elimina|rinomina|sposta|termina)_/.test(a) && !ia.daConfermare.includes(a)) errori.push(`${a}: elimina, rinomina, sposta o chiude qualcosa ma non è in AZIONI_DA_CONFERMARE`);
    });
    ia.eseguite.filter(a => !ia.azioni.includes(a)).forEach(a => errori.push(`${a}: eseguita ma non è in AZIONI_VALIDE`));
    ia.nelPrompt.filter(a => !ia.azioni.includes(a)).forEach(a => errori.push(`${a}: nelle istruzioni ma non è in AZIONI_VALIDE`));
    ia.ordine.filter(a => !ia.azioni.includes(a)).forEach(a => errori.push(`${a}: in ORDINE_AZIONI ma non è in AZIONI_VALIDE`));
    assert.deepEqual(errori, [], elencoErrori(errori));
});

test("ogni azione dell'assistente corrisponde a qualcosa che l'utente può fare", () => {
    const usate = new Set(Object.values(COMANDI).concat(Object.values(DATI)).flatMap(v => v.fa || []));
    const orfane = ia.azioni.filter(a => !usate.has(a));
    assert.deepEqual(orfane, [], `Azioni senza un comando o un dato collegato qui sopra:\n${elencoErrori(orfane)}`);
});

test("le istruzioni dell'assistente spiegano ogni campo del contesto", () => {
    const muti = ia.campiContesto.filter(c => !new RegExp(`\\b${c}\\b`).test(ia.prompt));
    assert.deepEqual(muti, [], `Campi mandati all'assistente ma mai nominati in promptAzioniIA:\n${elencoErrori(muti)}`);
});

test("i dati arrivano all'assistente con tutti i loro campi, anche quelli aggiunti in futuro", () => {
    // Il contesto copia i record così come sono salvati (senzaCampi toglie solo i doppioni):
    // un campo nuovo in un allenamento, una nota, una foto o un messaggio arriva all'IA da solo.
    const copie = {
        'allenamenti salvati': /\.\.\.senzaCampi\(s, 'inizio'/,
        'note degli allenamenti': /senzaCampi\(n, /,
        'foto': /senzaCampi\(f, 'src'/,
        'schema serie': /\.\.\.\(schemi\[chiave\] \|\| \{\}\)/,
        'serie della programmazione': /schema\.serie\.map\(s => \(\{ \.\.\.s \}\)\)/,
        'allenamento in corso': /\.\.\.senzaCampi\(s, 'inizio'.*'esercizi'\)/,
        'esercizi dell\'allenamento in corso': /\.\.\.senzaCampi\(es, 'key', 'serie'\)/,
        'messaggi del coach': /\.\.\.senzaCampi\(m, 'agg'\)/,
        'serie dello storico': /\.map\(serieIA\)/
    };
    const persi = Object.entries(copie).filter(([, re]) => !re.test(ia.contesto)).map(([nome]) => nome);
    assert.deepEqual(persi, [], `Questi dati non vengono più copiati per intero nel contesto dell'assistente:\n${elencoErrori(persi)}\n`
        + 'Scegliere i campi a mano fa sparire all\'IA quelli aggiunti dopo: copia il record e togli solo ciò che è già detto altrove.');
});
