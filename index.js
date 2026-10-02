import express from 'express';

const app = express();
app.use(express.json());

// Telemetria e Métricas em Memória
const metrics = {
  startTime: new Date().toISOString(),
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  failoverTriggers: 0,
  selfHealingCount: 0,
  recentLogs: []
};

function logEvent(type, details) {
  const entry = { timestamp: new Date().toISOString(), type, details };
  metrics.recentLogs.unshift(entry);
  if (metrics.recentLogs.length > 20) metrics.recentLogs.pop();
}

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

// Endpoint de Telemetria e Saúde
app.get('/health', checkMasterKey, (req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - new Date(metrics.startTime).getTime()) / 1000);
  return res.status(200).json({
    status: 'ONLINE',
    system: 'Radam Nox PaaS Bridge',
    uptime: `${uptimeSeconds}s`,
    metrics: {
      totalRequests: metrics.totalRequests,
      successfulRequests: metrics.successfulRequests,
      failedRequests: metrics.failedRequests,
      failoverTriggers: metrics.failoverTriggers,
      selfHealingCount: metrics.selfHealingCount
    },
    recentLogs: metrics.recentLogs
  });
});

// PAINEL VISUAL DE OBSERVABILIDADE (Fase 5 - Item 2)
app.get('/dashboard', (req, res) => {
  const htmlDashboard = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RADAM NOX - Telemetry Dashboard</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #0b0f19; color: #f8fafc; font-family: system-ui, sans-serif; padding: 20px; }
    h1 { color: #38bdf8; font-size: 1.5rem; margin-bottom: 5px; }
    .subtitle { color: #64748b; font-size: 0.85rem; margin-bottom: 20px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-bottom: 25px; }
    .card { background: #1e293b; padding: 15px; border-radius: 8px; border: 1px solid #334155; }
    .card h3 { margin: 0 0 8px 0; font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
    .card .val { font-size: 1.5rem; font-weight: bold; color: #38bdf8; }
    .logs-box { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 15px; font-family: monospace; font-size: 0.8rem; height: 300px; overflow-y: auto; }
    .log-item { margin-bottom: 8px; border-bottom: 1px solid #1e293b; padding-bottom: 5px; }
    .tag { padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; margin-right: 6px; }
    .tag-SUCCESS { background: #065f46; color: #34d399; }
    .tag-FAILOVER { background: #854d0e; color: #facc15; }
    .tag-FAILED { background: #991b1b; color: #fca5a5; }
  </style>
</head>
<body>
  <h1>RADAM NOX PaaS - Live Telemetry</h1>
  <div class="subtitle">Monitorização em tempo real da Ponte de Conexão</div>

  <div class="grid">
    <div class="card"><h3>Total Requests</h3><div class="val" id="totalReqs">-</div></div>
    <div class="card"><h3>Success</h3><div class="val" id="successReqs" style="color: #4ade80;">-</div></div>
    <div class="card"><h3>Failover Triggers</h3><div class="val" id="failovers" style="color: #facc15;">-</div></div>
    <div class="card"><h3>Self-Healing</h3><div class="val" id="healings" style="color: #c084fc;">-</div></div>
  </div>

  <h2>Logs Recentes de Operação</h2>
  <div class="logs-box" id="logsContainer">A carregar logs...</div>

  <script>
    async function fetchTelemetry() {
      try {
        const res = await fetch('/health', {
          headers: { 'x-master-key': 'RADAMN_MASTER_KEY_2026' }
        });
        const data = await res.json();
        
        document.getElementById('totalReqs').innerText = data.metrics.totalRequests;
        document.getElementById('successReqs').innerText = data.metrics.successfulRequests;
        document.getElementById('failovers').innerText = data.metrics.failoverTriggers;
        document.getElementById('healings').innerText = data.metrics.selfHealingCount;

        const container = document.getElementById('logsContainer');
        container.innerHTML = data.recentLogs.map(l => \`
          <div class="log-item">
            <span class="tag tag-\${l.type.includes('SUCCESS') ? 'SUCCESS' : l.type.includes('FAILOVER') ? 'FAILOVER' : 'FAILED'}">\${l.type}</span>
            <span style="color: #64748b;">[\${new Date(l.timestamp).toLocaleTimeString()}]</span>
            <span style="color: #cbd5e1;">\${JSON.stringify(l.details)}</span>
          </div>
        \`).join('') || '<div style="color: #64748b;">Nenhum evento registado até ao momento.</div>';
      } catch (err) {
        console.error('Erro ao atualizar telemetria:', err);
      }
    }
    setInterval(fetchTelemetry, 3000);
    fetchTelemetry();
  </script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(htmlDashboard);
});

// Roteamento Inteligente com Failover
app.post('/v1/chat', checkMasterKey, async (req, res) => {
  metrics.totalRequests++;
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

  try {
    const response = await fetch(PRIMARY_GATEWAY, { method: 'POST', headers, body: payload });
    if (!response.ok) throw new Error(`Primary status: ${response.status}`);
    
    const data = await response.json();
    metrics.successfulRequests++;
    logEvent('CHAT_SUCCESS', { provider: 'PRIMARY', category: promptClassification.category });

    return res.status(response.status).json({
      ...data,
      _radam_routing: { ...promptClassification, provider: 'PRIMARY' }
    });
  } catch (primaryError) {
    metrics.failoverTriggers++;
    logEvent('FAILOVER_TRIGGERED', { primaryError: primaryError.message });

    try {
      const fallbackResponse = await fetch(FALLBACK_GATEWAY, { method: 'POST', headers, body: payload });
      const fallbackData = await fallbackResponse.json();
      
      metrics.successfulRequests++;
      logEvent('CHAT_SUCCESS', { provider: 'FALLBACK', category: promptClassification.category });

      return res.status(fallbackResponse.status).json({
        ...fallbackData,
        _radam_routing: { ...promptClassification, provider: 'FALLBACK', failoverReason: primaryError.message }
      });
    } catch (fallbackError) {
      metrics.failedRequests++;
      logEvent('CHAT_FAILED', { primaryError: primaryError.message, fallbackError: fallbackError.message });

      return res.status(502).json({
        error: 'Erro crítico na Ponte: Falha em todos os provedores da rotação.',
        primaryError: primaryError.message,
        fallbackError: fallbackError.message
      });
    }
  }
});

// Endpoint de Self-Healing
app.post('/v1/heal', checkMasterKey, async (req, res) => {
  metrics.totalRequests++;
  metrics.selfHealingCount++;
  const GATEWAY_URL = process.env.RADAMN_GATEWAY_URL || 'https://radamn.vercel.app/api/generate';
  const MASTER_KEY = process.env.RADAMN_MASTER_KEY || 'RADAMN_MASTER_KEY_2026';

  try {
    const { brokenCode, errorStack, context } = req.body;

    if (!brokenCode || !errorStack) {
      return res.status(400).json({ error: 'Os parâmetros brokenCode e errorStack são obrigatórios.' });
    }

    const repairPrompt = `System: Você é o agente de Self-Healing do RADAM NOX PaaS.
O seguinte código apresentou um erro em runtime/sintaxe.
Erro detetado: ${errorStack}
Contexto do Erro: ${context || 'Nenhum contexto adicional fornecido.'}

Código com Erro:
\`\`\`html
${brokenCode}
\`\`\`

Por favor, corrija o código garantindo que o erro seja corrigido sem alterar a funcionalidade principal. Devolva apenas o código corrigido dentro de um bloco HTML.`;

    const response = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-master-key': MASTER_KEY,
        'x-radam-intent': 'BUG_FIX'
      },
      body: JSON.stringify({
        message: repairPrompt,
        metadata: { strategy: 'SELF_HEALING', originalError: errorStack }
      })
    });

    const data = await response.json();
    metrics.successfulRequests++;
    logEvent('HEAL_SUCCESS', { errorStack });

    return res.status(200).json({
      status: 'HEALED',
      fixedCode: data.response || data.result || data,
      repairLogs: { originalError: errorStack, timestamp: new Date().toISOString() }
    });
  } catch (error) {
    metrics.failedRequests++;
    logEvent('HEAL_FAILED', { error: error.message });

    return res.status(500).json({
      error: 'Falha no processo de Self-Healing.',
      details: error.message
    });
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

