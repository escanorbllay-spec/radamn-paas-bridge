import express from 'express';

const app = express();
app.use(express.json());

// Validação da Master Key na Ponte
const checkMasterKey = (req, res, next) => {
  const masterKey = req.headers['x-master-key'];
  const VALID_KEY = process.env.RADAMN_MASTER_KEY || 'RADAMN_MASTER_KEY_2026';

  if (!masterKey || masterKey !== VALID_KEY) {
    return res.status(401).json({ error: 'Acesso não autorizado. Master Key inválida ou ausente.' });
  }
  next();
};

// Endpoint de Saúde
app.get('/health', checkMasterKey, (req, res) => {
  return res.status(200).json({
    status: 'ONLINE',
    system: 'Radam Nox PaaS Bridge'
  });
});

// PONTO DE CONEXÃO DIRETA: Roteamento para o Gateway (Radamn)
app.post('/v1/chat', checkMasterKey, async (req, res) => {
  const GATEWAY_URL = process.env.RADAMN_GATEWAY_URL || 'https://radamn.vercel.app/api/generate';
  const MASTER_KEY = process.env.RADAMN_MASTER_KEY || 'RADAMN_MASTER_KEY_2026';

  try {
    const { prompt, message, messages } = req.body;
    const payloadMessage = prompt || message || (messages && messages[messages.length - 1]?.content);

    const response = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-master-key': MASTER_KEY
      },
      body: JSON.stringify({
        message: payloadMessage,
        messages: messages || [{ role: 'user', content: payloadMessage }]
      })
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({
      error: 'Erro na Ponte ao conectar com o Gateway',
      details: error.message
    });
  }
});

// Endpoint do Live Code Canvas (Fase 3 - Item 1: Auto-Sync Bidirecional Refinado)
app.get('/canvas', (req, res) => {
  const htmlCanvas = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RADAM NOX - Live Code Canvas</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #0f172a; color: #f8fafc; font-family: system-ui, sans-serif; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
    @media (min-width: 768px) { body { flex-direction: row; } }
    .pane { flex: 1; display: flex; flex-direction: column; border-bottom: 1px solid #334155; }
    @media (min-width: 768px) { .pane { border-bottom: none; border-right: 1px solid #334155; } }
    .pane header { background: #1e293b; padding: 10px 15px; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #38bdf8; border-bottom: 1px solid #334155; }
    textarea { flex: 1; background: #090d16; color: #38bdf8; border: none; padding: 15px; font-family: monospace; font-size: 13px; resize: none; outline: none; line-height: 1.5; }
    iframe { flex: 1; border: none; background: #ffffff; }
  </style>
</head>
<body>
  <div class="pane">
    <header>Editor de Código (Auto-Sync)</header>
    <textarea id="codeEditor" spellcheck="false" placeholder="Escreva o seu HTML/JS aqui..."><!DOCTYPE html>
<html>
<head>
  <style>
    body { background: #0f172a; color: #38bdf8; font-family: sans-serif; text-align: center; padding-top: 35vh; margin: 0; }
    h1 { font-size: 1.8rem; margin-bottom: 8px; }
    p { color: #94a3b8; font-size: 0.95rem; }
  </style>
</head>
<body>
  <h1>RADAM NOX Live Canvas</h1>
  <p>Edite o código à esquerda para sincronizar em tempo real.</p>
</body>
</html></textarea>
  </div>
  <div class="pane">
    <header>Live Preview</header>
    <iframe id="previewFrame"></iframe>
  </div>
  <script>
    const editor = document.getElementById('codeEditor');
    const preview = document.getElementById('previewFrame');
    let timeout = null;

    // Carrega código salvo localmente se existir
    const savedCode = localStorage.getItem('radam_canvas_code');
    if (savedCode) { editor.value = savedCode; }

    function updatePreview() {
      const code = editor.value;
      localStorage.setItem('radam_canvas_code', code);
      
      const doc = preview.contentDocument || preview.contentWindow.document;
      doc.open();
      doc.write(code);
      doc.close();
    }

    // Debounce de 250ms para sincronização fluida no mobile
    editor.addEventListener('input', () => {
      clearTimeout(timeout);
      timeout = setTimeout(updatePreview, 250);
    });

    window.onload = updatePreview;
  </script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(htmlCanvas);
});

export default app;

