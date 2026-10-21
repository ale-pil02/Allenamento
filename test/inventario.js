// Legge allenamento_pro.html come testo e ne ricava l'inventario usato da
// parita-ia.test.js: i comandi che l'utente può dare dalla pagina, i dati salvati e
// ciò che sa fare e vedere l'Assistente IA. Nessuna dipendenza: solo Node.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// ALLENAMENTO_HTML permette di provare il test su una copia modificata della pagina
const FILE_APP = process.env.ALLENAMENTO_HTML || path.join(__dirname, '..', 'allenamento_pro.html');

function leggiApp(file = FILE_APP) {
    return fs.readFileSync(file, 'utf8');
}

// Blocchi <script> scritti nella pagina (non quelli caricati da fuori)
function scriptDi(html) {
    const blocchi = [];
    const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/g;
    let m;
    while ((m = re.exec(html))) {
        const attributi = m[1] || '';
        if (/\ssrc=/.test(attributi)) continue;
        blocchi.push({ modulo: /type=["']module["']/.test(attributi), codice: m[2] });
    }
    return blocchi;
}

// Da una posizione su "(" "{" o "[" alla parentesi che la chiude, saltando stringhe,
// template e commenti. Restituisce l'indice della parentesi di chiusura.
function chiusuraDi(testo, inizio) {
    const coppie = { '(': ')', '{': '}', '[': ']' };
    const pila = [];
    for (let i = inizio; i < testo.length; i++) {
        const c = testo[i];
        if (c === '/' && testo[i + 1] === '/') { i = testo.indexOf('\n', i); if (i < 0) return -1; continue; }
        if (c === '/' && testo[i + 1] === '*') { i = testo.indexOf('*/', i + 2) + 1; continue; }
        if (c === '"' || c === "'") {
            for (i++; i < testo.length && testo[i] !== c; i++) if (testo[i] === '\\') i++;
            continue;
        }
        if (c === '`') {
            for (i++; i < testo.length && testo[i] !== '`'; i++) {
                if (testo[i] === '\\') { i++; continue; }
                if (testo[i] === '$' && testo[i + 1] === '{') i = chiusuraDi(testo, i + 1);
            }
            continue;
        }
        if (coppie[c]) pila.push(coppie[c]);
        else if (c === ')' || c === '}' || c === ']') {
            if (pila.pop() !== c) return -1;
            if (!pila.length) return i;
        }
    }
    return -1;
}

// Divide gli argomenti di una chiamata (il testo fra le sue parentesi) alle virgole
// di primo livello
function argomenti(testo) {
    const parti = [];
    let inizio = 0;
    for (let i = 0; i < testo.length; i++) {
        const c = testo[i];
        if ('([{'.includes(c)) { i = chiusuraDi(testo, i); if (i < 0) break; continue; }
        if (c === '"' || c === "'" || c === '`') {
            for (i++; i < testo.length && testo[i] !== c; i++) if (testo[i] === '\\') i++;
            continue;
        }
        if (c === ',') { parti.push(testo.slice(inizio, i).trim()); inizio = i + 1; }
    }
    parti.push(testo.slice(inizio).trim());
    return parti.filter((p, i) => p || i < parti.length - 1);
}

// Corpo di "function nome(...) { ... }" (senza le graffe esterne)
function corpoFunzione(codice, nome) {
    const m = new RegExp(`function\\s+${nome}\\s*\\(`).exec(codice);
    if (!m) return null;
    const graffa = codice.indexOf('{', chiusuraDi(codice, m.index + m[0].length - 1));
    return codice.slice(graffa + 1, chiusuraDi(codice, graffa));
}

// Valore letterale di "const NOME = [...]" o "new Set([...])"
function costanteLetterale(codice, nome) {
    const m = new RegExp(`const\\s+${nome}\\s*=\\s*(new Set\\()?`).exec(codice);
    if (!m) return null;
    const inizio = m.index + m[0].length;
    const fine = chiusuraDi(codice, inizio);
    // Passa da JSON: così è un oggetto di questo Node e non della sandbox (i confronti tornano)
    return JSON.parse(vm.runInNewContext(`JSON.stringify(${codice.slice(inizio, fine + 1)})`));
}

// Funzioni dichiarate nella pagina: function nome(...) e window.nome = ...
function funzioniDichiarate(codice) {
    const nomi = new Set();
    for (const m of codice.matchAll(/(?:^|[^.\w$])function\s+([A-Za-z_$][\w$]*)\s*\(/g)) nomi.add(m[1]);
    for (const m of codice.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\()/g)) nomi.add(m[1]);
    return nomi;
}

// Funzioni scritte come frecce (const esegui = b => { … }): da sole non sono comandi,
// ma lo è ciò che chiamano. Restituisce { nome: [corpi] } (lo stesso nome può tornare
// in funzioni diverse: si tengono tutti i corpi).
function frecceLocali(codice) {
    const frecce = {};
    const re = /(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^()]*\)|[A-Za-z_$][\w$]*)\s*=>\s*/g;
    for (const m of codice.matchAll(re)) {
        const inizio = m.index + m[0].length;
        let corpo;
        if (codice[inizio] === '{') corpo = codice.slice(inizio, chiusuraDi(codice, inizio) + 1);
        else {
            const fine = codice.indexOf('\n', inizio);
            corpo = codice.slice(inizio, fine < 0 ? undefined : fine);
        }
        (frecce[m[1]] = frecce[m[1]] || []).push(corpo);
    }
    return frecce;
}

// Funzioni della pagina chiamate dentro un pezzo di codice (non i metodi: x.metodo()).
// Le frecce si attraversano: conta ciò che chiamano loro.
function chiamateIn(pezzo, dichiarate, frecce = {}, viste = new Set()) {
    const trovate = new Set();
    for (const m of pezzo.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
        if (dichiarate.has(m[1])) trovate.add(m[1]);
        else if (frecce[m[1]] && !viste.has(m[1])) {
            viste.add(m[1]);
            frecce[m[1]].forEach(c => chiamateIn(c, dichiarate, frecce, viste).forEach(n => trovate.add(n)));
        }
    }
    return trovate;
}

// Gesti dell'utente (anche uscire da un campo, che salva, e lasciare il trascinamento)
const EVENTI_UTENTE = ['click', 'dblclick', 'contextmenu', 'change', 'input', 'beforeinput', 'submit',
    'keydown', 'keyup', 'pointerdown', 'pointerup', 'pointercancel', 'blur', 'focusout', 'drop', 'paste'];

// Comandi dell'utente: ogni funzione della pagina che parte da un suo gesto.
// - attributi on…="…" (nell'HTML e nei pezzi di HTML scritti dal codice)
// - addEventListener('click' …) e simili, e .onclick = …
// Restituisce { nome: [dove compare] }.
function comandiUtente(html) {
    const codice = scriptDi(html).map(s => s.codice).join('\n');
    const dichiarate = funzioniDichiarate(codice);
    const frecce = frecceLocali(codice);
    const comandi = {};
    const annota = (nome, dove) => { (comandi[nome] = comandi[nome] || new Set()).add(dove); };
    const riga = indice => html.slice(0, indice).split('\n').length;
    // Un gestore è un nome (di funzione o di freccia) oppure un pezzo di codice
    const gestito = (gestore, dove) => {
        const pezzo = /^[A-Za-z_$][\w$]*(\s*,.*)?$/s.test(gestore) ? gestore.split(',')[0].trim() + '()' : gestore;
        chiamateIn(pezzo, dichiarate, frecce).forEach(n => annota(n, dove));
    };
    const eventi = new RegExp(`^(${EVENTI_UTENTE.join('|')})$`);

    // Il valore dell'attributo, tolte le parti ${…} che il codice riempie prima di scriverlo
    for (const m of html.matchAll(/\son([a-z]+)\s*=\s*"([^"]*)"/g)) {
        const valore = m[2].replace(/\$\{[^}]*\}/g, '');
        chiamateIn(valore, dichiarate, frecce).forEach(n => annota(n, `on${m[1]}, riga ${riga(m.index)}`));
    }

    for (const m of html.matchAll(/addEventListener\(\s*['"]([a-z]+)['"]\s*,/g)) {
        if (!eventi.test(m[1])) continue;
        const inizio = m.index + m[0].length;
        const fine = chiusuraDi(html, html.lastIndexOf('(', inizio));
        gestito(html.slice(inizio, fine).trim(), `addEventListener('${m[1]}'), riga ${riga(m.index)}`);
    }
    for (const m of html.matchAll(/\.on([a-z]+)\s*=(?!=)\s*([^;\n]+)/g)) {
        if (eventi.test(m[1])) gestito(m[2].trim(), `.on${m[1]} =, riga ${riga(m.index)}`);
    }
    return Object.fromEntries(Object.entries(comandi).map(([n, d]) => [n, [...d]]));
}

// Dati salvati: chiavi di localStorage (scritte come testo o come costante), quelle
// passate agli aiuti che le leggono (mappaStato), gli elenchi di chiavi e quelle
// sincronizzate sul cloud. Restituisce { chiave: [dove compare] }.
function datiSalvati(html) {
    const codice = scriptDi(html).map(s => s.codice).join('\n');
    const costanti = {};
    for (const m of codice.matchAll(/const\s+([A-Z][A-Z0-9_]*)\s*=\s*(['"`])([^'"`$]+)\2/g)) costanti[m[1]] = m[3];
    const dati = {};
    const annota = (chiave, dove) => { (dati[chiave] = dati[chiave] || new Set()).add(dove); };

    // Il nome della chiave: scritto tra apici, come costante, o come costante dentro un
    // pezzo di codice generato ('${COSTANTE}', nel file aggiornato da scaricare)
    for (const m of codice.matchAll(/localStorage\.(?:setItem|getItem|removeItem)\(\s*(?:(['"`])((?:(?!\1).)+)\1|([A-Z][A-Z0-9_]*)\b)/g)) {
        const generata = /^\$\{([A-Z][A-Z0-9_]*)\}$/.exec(m[2] || '');
        const chiave = generata ? costanti[generata[1]] : (m[2] || costanti[m[3]]);
        if (chiave) annota(chiave, 'localStorage');
    }
    // Aiuti che ricevono il nome della chiave come argomento (mappaStato('…'),
    // toggleMonitoraggio(this, '…', 'monEsercizioChiusa')…): si guardano le loro chiamate,
    // anche negli attributi on…="…" dell'HTML
    const aiuti = {};
    for (const m of codice.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/g)) {
        const parametri = m[2].split(',').map(p => p.trim().replace(/\s*=.*$/, ''));
        const corpo = corpoFunzione(codice, m[1]) || '';
        parametri.forEach((p, i) => {
            if (p && new RegExp(`localStorage\\.(?:setItem|getItem|removeItem)\\(\\s*${p}\\b`).test(corpo)) aiuti[m[1]] = i;
        });
    }
    for (const [nome, indice] of Object.entries(aiuti)) {
        for (const m of html.matchAll(new RegExp(`(?<![.\\w$])${nome}\\s*\\(`, 'g'))) {
            const aperta = m.index + m[0].length - 1;
            const chiusa = chiusuraDi(html, aperta);
            if (chiusa < 0) continue;
            const arg = argomenti(html.slice(aperta + 1, chiusa))[indice] || '';
            const letterale = /^(['"])([^'"]+)\1$/.exec(arg);
            if (letterale) annota(letterale[2], nome);
        }
    }
    for (const nome of ['STATI_SEZIONI', 'DATI_LEGATI_ALLA_CHIAVE']) {
        (costanteLetterale(codice, nome) || []).forEach(k => annota(k, nome));
    }
    Object.values(costanteLetterale(codice, 'SOTTO_CORREZIONI') || {}).forEach(k => annota(k, 'SOTTO_CORREZIONI'));
    (costanteLetterale(codice, 'CHIAVI_SINCRONIZZATE') || []).forEach(k => annota(k, 'CHIAVI_SINCRONIZZATE (cloud)'));
    return Object.fromEntries(Object.entries(dati).map(([k, d]) => [k, [...d]]));
}

// Altri posti dove la pagina potrebbe salvare qualcosa, che datiSalvati non legge:
// se compaiono, il test lo dice invece di non vederli
function altriArchivi(html) {
    const codice = scriptDi(html).map(s => s.codice).join('\n');
    const trovati = [];
    if (/\bsessionStorage\b/.test(codice)) trovati.push('sessionStorage');
    if (/\bindexedDB\.open\b/.test(codice)) trovati.push('indexedDB');
    if (/document\.cookie\s*=/.test(codice)) trovati.push('cookie');
    // Raccolte di Firestore sotto utenti/<uid>/…
    const raccolte = new Set([...codice.matchAll(/(?:collection|doc)\(\s*db\s*,\s*'utenti'\s*,\s*[\w.]+\s*,\s*'([^']+)'/g)].map(m => m[1]));
    return { trovati, raccolte: [...raccolte] };
}

// Ciò che sa fare e vedere l'Assistente IA
function assistente(html) {
    const codice = scriptDi(html).filter(s => !s.modulo).map(s => s.codice).join('\n');
    const casi = nome => [...(corpoFunzione(codice, nome) || '').matchAll(/case\s+'([a-z_]+)'\s*:/g)].map(m => m[1]);
    const prompt = corpoFunzione(codice, 'promptAzioniIA') || '';
    const elenco = (prompt.split('=== AZIONI DISPONIBILI')[1] || '').split('=== REGOLE GENERALI')[0];
    // Il contesto si costruisce in costruisciContestoIA e nei suoi aiuti (…IA)
    const aiuti = ['storicoIA', 'puntiBluIA', 'allenamentoInCorsoIA', 'archivioCoachIA'];
    const contesto = ['costruisciContestoIA', ...aiuti].map(n => corpoFunzione(codice, n) || '').join('\n');
    return {
        azioni: costanteLetterale(codice, 'AZIONI_VALIDE') || [],
        daConfermare: [...(costanteLetterale(codice, 'AZIONI_DA_CONFERMARE') || [])],
        ordine: costanteLetterale(codice, 'ORDINE_AZIONI') || [],
        eseguite: casi('eseguiAzione'),
        descritte: casi('descriviAzione'),
        nelPrompt: [...elenco.matchAll(/^- ([a-z_]+)\s+→/gm)].map(m => m[1]),
        prompt,
        // Campi dell'oggetto mandato all'IA: le chiavi "nome:" dei suoi oggetti (tolte le
        // opzioni delle date, { weekday: 'long' … }, che non sono campi)
        campiContesto: [...new Set([...contesto.replace(/toLocale\w*String\([^()]*\)/g, '')
            .matchAll(/(?:^|[{,])\s*([a-z_]+)\s*:(?!:)/gm)].map(m => m[1]))],
        contesto
    };
}

module.exports = { FILE_APP, leggiApp, scriptDi, chiusuraDi, corpoFunzione, costanteLetterale, funzioniDichiarate, comandiUtente, datiSalvati, altriArchivi, assistente };
