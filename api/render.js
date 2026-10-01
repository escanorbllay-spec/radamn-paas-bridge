const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

module.exports = async (req, res) => {
  try {
    // Permite checar se o evento de geração foi concluído caso seja enviado via query ou body
    const eventStatus = req.query.event || req.body?.status;
    if (eventStatus && eventStatus !== 'generation.complete' && eventStatus !== 'complete') {
      return res.status(202).json({ 
        status: 'pending', 
        message: 'Deploy em espera: aguardando evento generation.complete.' 
      });
    }

    const result = await pool.query(
      'SELECT name, code, version FROM projects ORDER BY updated_at DESC LIMIT 1'
    );

    if (result.rows.length === 0) {
      return res.status(404).send('Erro 404: Nenhum projeto encontrado no banco de dados.');
    }

    const { name, code, version } = result.rows[0];

    res.setHeader('Cache-Control', 'public, s-maxage=1, stale-while-revalidate');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Radam-Version', version);
    res.setHeader('X-Radam-Project', name);
    res.setHeader('X-Radam-Deploy-Event', 'generation.complete');

    if (code && code.trim().toLowerCase().startsWith('<!doctype')) {
      return res.status(200).send(code);
    }

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${name || 'RADAM NOX'}</title>
  <style>body { background: #0f172a; color: #38bdf8; font-family: sans-serif; text-align: center; padding-top: 20vh; }</style>
</head>
<body>
  <h1>${name || 'RADAM NOX PaaS - Event-Driven Deploy'}</h1>
  <div>${code || ''}</div>
</body>
</html>`;

    return res.status(200).send(html);
  } catch (err) {
    return res.status(500).send('Erro interno: ' + err.message);
  }
};

