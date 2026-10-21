// Serve una copia di prova dell'app su http://localhost:8020 (o sulla porta indicata):
// senza Firebase, quindi si apre senza login e salva solo nel browser di prova, mai sui
// dati veri; e senza cache, così si vede sempre l'ultima versione del file.
// Si lancia con "npm run prova".
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const porta = Number(process.argv[2]) || 8020;
const FILE = path.join(__dirname, '..', 'allenamento_pro.html');

// Ogni valore della configurazione di Firebase diventa "DA_COMPILARE": la pagina
// allora non si collega al cloud e non chiede l'accesso
function copiaDiProva() {
    const html = fs.readFileSync(FILE, 'utf8');
    const senzaCloud = html.replace(/const CONFIG_FIREBASE = \{[\s\S]*?\};/, blocco => blocco.replace(/:\s*"[^"]*"/g, ': "DA_COMPILARE"'));
    if (senzaCloud === html) throw new Error('configurazione di Firebase non trovata: la copia di prova si collegherebbe ai dati veri');
    return senzaCloud;
}

http.createServer((req, res) => {
    const percorso = req.url.split('?')[0];
    if (percorso !== '/' && percorso !== '/index.html') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Non trovato');
        return;
    }
    try {
        const pagina = copiaDiProva();
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache, no-store, must-revalidate' });
        res.end(pagina);
    } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(e.message);
    }
}).listen(porta, () => console.log(`Allenamento di prova (senza cloud): http://localhost:${porta}`));
