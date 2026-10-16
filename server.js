const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');
const qrcode = require('qrcode-terminal');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Inicialização do Banco de Dados SQLite
const db = new sqlite3.Database('./estufa.db', (err) => {
  if (err) console.error('Erro ao conectar ao banco:', err.message);
  else console.log('Conectado ao banco de dados SQLite.');
});

db.run(`
  CREATE TABLE IF NOT EXISTS leituras (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    temperatura REAL,
    umidade_ar REAL,
    umidade_solo REAL,
    luminosidade REAL,
    distancia_agua_cm REAL,
    data_hora DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Rota POST para receber dados dos sensores (Mantém apenas os últimos 5 registros)
app.post('/api/dados', (req, res) => {
  const { temperatura, umidade_ar, umidade_solo, luminosidade, distancia_agua_cm } = req.body;

  const sqlInsert = `INSERT INTO leituras (temperatura, umidade_ar, umidade_solo, luminosidade, distancia_agua_cm) VALUES (?, ?, ?, ?, ?)`;

  db.run(sqlInsert, [temperatura, umidade_ar, umidade_solo, luminosidade, distancia_agua_cm], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    // Apaga os registros antigos mantendo apenas os 5 mais recentes com base no ID
    const sqlCleanup = `
      DELETE FROM leituras 
      WHERE id NOT IN (
        SELECT id FROM leituras ORDER BY id DESC LIMIT 5
      )
    `;

    db.run(sqlCleanup, (cleanupErr) => {
      if (cleanupErr) {
        console.error('Erro ao limpar leituras antigas:', cleanupErr.message);
      }
      res.json({ status: 'sucesso', id: this.lastID });
    });
  });
});

// Rota GET para consultar o histórico das 5 últimas leituras
app.get('/api/leituras', (req, res) => {
  db.all(`SELECT * FROM leituras ORDER BY id DESC LIMIT 5`, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows.reverse());
  });
});

// Descobrir o IP local na rede Wi-Fi / Ethernet
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

app.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  const urlAcesso = `http://${localIp}:${PORT}`;

  console.log(`\n==================================================`);
  console.log(`🚀 Servidor rodando com sucesso!`);
  console.log(`💻 Acesso local (seu PC): http://localhost:${PORT}`);
  console.log(`📱 Acesso no celular: ${urlAcesso}`);
  console.log(`==================================================\n`);
  console.log(`Escaneie o QR Code abaixo com a câmera do celular (mesmo Wi-Fi):\n`);

  // Gera o QR Code no próprio terminal
  qrcode.generate(urlAcesso, { small: true });
});