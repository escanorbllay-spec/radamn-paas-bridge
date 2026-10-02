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

// Classificador Autônomo de Prompts
function classifyPrompt(promptText = '') {
  const text = promptText.toLowerCase();
  if (text.includes('erro') || text.includes('fix') || text.includes('corrigir') || text.includes('bug')) {
    return { category: 'BUG_FIX', priority: 'HIGH', strategy: 'REPAIR' };
  }
  if (text.includes('banco') || text.includes('supabase') || text.includes('sql') || text.includes('tabela')) {
    return { category: 'DATABASE_QUERY', priority: 'HIGH', strategy: 'STRUCTURED' };
  }
  if (text.includes('cor') || text.includes('botão') || text.includes('estilo') || text.includes('css')) {
    return { category: 'UI_COMPONENT', priority: 'LOW', strategy: 'FAST' };
  }
  return { category: 'FULL_APP', priority: 'MEDIUM', strategy: 'GENERATIVE' };
}

// Endpoint de Saúde
app.get('/health', checkMasterKey, (req, res) => {
  return res.status(200).json({
    status: 'ONLINE',
    system: 'Radam Nox PaaS Bridge'
  });
});

// PONTO DE CONEXÃO DIRETA: Roteamento Inteligente com Failover de Provedores (Fase 4 - Item 2)
app.post('/v1/chat', checkMasterKey, async (req, res) => {
  const PRIMARY_GATEWAY = process.env.RADAMN_GATEWAY_URL || 'https://radamn.vercel.app/api/generate';
  const FALLBACK_GATEWAY = process.env.RADAMN_FALLBACK_URL || 'https://radamn-backup.vercel.app/api/generate';
  const MASTER_KEY = process.env.RADAMN_MASTER_KEY || 'RADAMN_MASTER_KEY_2026';

  const { prompt, message, messages } = req.body;
  const payloadMessage = prompt || message || (messages && messages[messages.length - 1]?.content);
  const promptClassification = classifyPrompt(payloadMessage);

  const payload = JSON.stringify({
    message: payloadMessage,
    messages: messages || [{ role: 'user', content: payloadMessage }],
    metadata: { classification: promptClassification }
  });

  const headers = {
    'Content-Type': 'application/json',
    'x-master-key': MASTER_KEY,
    'x-radam-intent': promptClassification.category
  };

  // Tentativa 1: Gateway Principal
  try {
    const response = await fetch(PRIMARY_GATEWAY, { method: 'POST', headers, body: payload });
    if (!response.ok) throw new Error(`Primary status: ${response.status}`);
    
    const data = await response.json();
    return res.status(response.status).json({
      ...data,
      _radam_routing: { ...promptClassification, provider: 'PRIMARY' }
    });
  } catch (primaryError) {
    console.warn('Falha no Provedor Principal, acionando Failover...', primaryError.message);

    // Tentativa 2: Failover / Rotação Automática para Gateway Secundário
    try {
      const fallbackResponse = await fetch(FALLBACK_GATEWAY, { method: 'POST', headers, body: payload });
      const fallbackData = await fallbackResponse.json();
      
      return res.status(fallbackResponse.status).json({
        ...fallbackData,
        _radam_routing: { ...promptClassification, provider: 'FALLBACK', failoverReason: primaryError.message }
      });
    } catch (fallbackError) {
      return res.status(502).json({
        error: 'Erro crítico na Ponte: Falha em todos os provedores da rotação.',
        primaryError: primaryError.message,
        fallbackError: fallbackError.message
      });
    }
  }
});

// Endpoint do Live Code Canvas
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
    .pane header { background: #1e293b; padding: 10px 15px; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #38bdf8; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center; }
    .status { font-size: 11px; color: #4ade80; text-transform: none; font-weight: normal; }
    textarea { flex: 1; background: #090d16; color: #38bdf8; border: none; padding: 15px; font-family: monospace; font-size: 13px; resize: none; outline: none; line-height: 1.5; }
    iframe { flex: 1; border: none; background: #ffffff; }
  </style>
</head>
<body>
  <div class="pane">
    <header>
      <span>Editor de Código</span>
      <span id="syncStatus" class="status">● Sincronizado</span>
    </header>
    <textarea id="codeEditor" spellcheck="false" placeholder="Escreva o seu HTML/JS aqui..."><!DOCTYPE html>
<html>
<head>
  <style id="custom-style">
    body { background: #0f172a; color: #38bdf8; font-family: sans-serif; text-align: center; padding-top: 35vh; margin: 0; }
    h1 { font-size: 1.8rem; margin-bottom: 8px; }
    p { color: #94a3b8; font-size: 0.95rem; }
  </style>
</head>
<body>
  <div id="app-root">
    <h1>RADAM NOX Live Canvas</h1>
    <p>Recuperação de estado e sincronização contínua ativas.</p>
  </div>
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
    const syncStatus = document.getElementById('syncStatus');
    let timeout = null;

    const savedCode = localStorage.getItem('radam_canvas_code');
    if (savedCode) { editor.value = savedCode; }

    function updateFullPreview() {
      const code = editor.value;
      localStorage.setItem('radam_canvas_code', code);
      syncStatus.innerText = '● Sincronizado (Local)';
      syncStatus.style.color = '#4ade80';

      const doc = preview.contentDocument || preview.contentWindow.document;
      doc.open();
      doc.write(code + \`<script>
        window.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'patch') {
            const el = document.querySelector(event.data.target);
            if (el) { el.innerHTML = event.data.content; }
          }
        });
      </\script>\`);
      doc.close();
    }

    window.applyPatch = function(targetSelector, newContent) {
      if (preview.contentWindow) {
        preview.contentWindow.postMessage({
          type: 'patch',
          target: targetSelector,
          content: newContent
        }, '*');
      }
    };

    editor.addEventListener('input', () => {
      syncStatus.innerText = '○ Salvando...';
      syncStatus.style.color = '#facc15';
      clearTimeout(timeout);
      timeout = setTimeout(updateFullPreview, 250);
    });

    window.onload = updateFullPreview;
  </script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(htmlCanvas);
});

export default app;

