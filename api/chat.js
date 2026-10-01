module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const masterKey = req.headers['x-master-key'];
  const VALID_KEY = process.env.RADAMN_MASTER_KEY || 'RADAMN_MASTER_KEY_2026';

  if (!masterKey || masterKey !== VALID_KEY) {
    return res.status(401).json({ error: 'Acesso não autorizado: Master Key inválida ou ausente.' });
  }

  const GATEWAY_URL = process.env.RADAMN_GATEWAY_URL || 'https://radamn.vercel.app/api/generate';

  try {
    const { prompt, message, messages } = req.body || {};
    const payloadMessage = prompt || message || (messages && messages[messages.length - 1]?.content);

    const response = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${masterKey}`,
        'x-master-key': masterKey
      },
      body: JSON.stringify({
        message: payloadMessage,
        messages: messages || [{ role: 'user', content: payloadMessage }]
      })
    });

    const textResponseBody = await response.text();

    try {
      const data = JSON.parse(textResponseBody);
      return res.status(response.status).json(data);
    } catch (e) {
      return res.status(response.status).json({
        error: 'O Gateway não retornou um JSON válido.',
        status: response.status,
        rawResponse: textResponseBody.slice(0, 300)
      });
    }

  } catch (error) {
    return res.status(500).json({
      error: 'Erro na Ponte ao conectar com o Gateway',
      details: error.message
    });
  }
};
