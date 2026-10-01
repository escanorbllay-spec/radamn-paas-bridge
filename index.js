import express from 'express';

const app = express();
app.use(express.json());

// Validação da Master Key na Ponte
const checkMasterKey = (req, res, next) => {
  const masterKey = req.headers['x-master-key'];
  const VALID_KEY = process.env.RADAMN_MASTER_KEY || 'RADAMN_MASTER_KEY_2026';

  if (!masterKey || masterKey !== VALID_KEY) {
    return res.status(401).json({ error: 'Acesso não autorizado: Master Key inválida ou ausente.' });
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

export default app;
