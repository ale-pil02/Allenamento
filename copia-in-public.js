// Copia l'app nella cartella pubblicata. Viene eseguito da "firebase deploy"
// (hook predeploy in firebase.json), così online finisce sempre l'ultima versione.
const fs = require('fs');
const path = require('path');

const sorgente = path.join(__dirname, 'allenamento_pro.html');
const destinazione = path.join(__dirname, 'public', 'index.html');

if (!fs.existsSync(sorgente)) {
    console.error('ERRORE: allenamento_pro.html non trovato in ' + __dirname);
    process.exit(1);
}

fs.mkdirSync(path.dirname(destinazione), { recursive: true });
fs.copyFileSync(sorgente, destinazione);

const kb = (fs.statSync(destinazione).size / 1024).toFixed(0);

// Controlla il blocco di configurazione, non tutto il file: la stringa
// "DA_COMPILARE" compare anche nella riga che rileva se è stato compilato
const blocco = (fs.readFileSync(destinazione, 'utf8').match(/const CONFIG_FIREBASE = \{([\s\S]*?)\};/) || [])[1] || '';
const progetto = (blocco.match(/projectId:\s*"([^"]+)"/) || [])[1];
const configurato = progetto && progetto !== 'DA_COMPILARE';

console.log(`app copiata in public/index.html (${kb} KB)`);
console.log(configurato
    ? `Firebase configurato sul progetto "${progetto}"`
    : 'ATTENZIONE: configurazione Firebase mancante — online il cloud resterà spento');
