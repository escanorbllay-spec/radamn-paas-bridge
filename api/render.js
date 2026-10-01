const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

module.exports = async (req, res) => {
  try {
    // Busca sempre o projeto mais recente da tabela de forma segura
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

    if (code.trim().toLowerCase().startsWith('<!doctype')) {
      return res.status(200).send(code);
    }

    const htmlWrapper = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name} - RADAM NOX PaaS</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; background: #0f172a; color: #38bdf8; }
  </style>
</head>
<body>
  <div id="root">${code}</div>
</body>
</html>`;

    return res.status(200).send(htmlWrapper);
  } catch (err) {
    return.res.status(500).send('Erro interno no servidor: ' + err.message);
  }
};

