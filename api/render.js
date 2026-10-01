const { Pool } = require('pg');

// Conexão com o Supabase
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

module.exports = async (req, res) => {
  try {
    const { projectId } = req.query || {};

    if (!projectId) {
      return res.status(400).send('Erro: Parâmetro projectId ausente na URL.');
    }

    // Busca a versão mais recente do projeto
    const result = await pool.query(
      'SELECT name, code, version FROM projects WHERE id = $1',
      [projectId]
    );

    if (result.rows.length === 0) {
      return res.status(404).send('Erro 404: Projeto não encontrado no banco de dados.');
    }

    const { name, code, version } = result.rows[0];

    // 🚀 FASE 2: Auto-Invalidação de Cache CDN (Vercel Edge Network)
    // s-maxage=1: O CDN da Vercel segura o cache por apenas 1 segundo.
    // stale-while-revalidate: Permite servir cache antigo enquanto atualiza em background.
    res.setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate=59');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Radamn-Version', version);
    res.setHeader('X-Radamn-Project', name);

    // Se o código já for um HTML completo (<!DOCTYPE html>), serve direto
    if (code.trim().toLowerCase().startsWith('<!doctype') || code.trim().toLowerCase().startsWith('<html')) {
      return res.status(200).send(code);
    }

    // Se for apenas um trecho HTML/JS, envolvemos num template básico para rodar perfeitamente
    const htmlWrapper = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${name} - RADAM NOX PaaS</title>
        <style>
          body { font-family: system-ui, sans-serif; margin: 0; padding: 20px; background: #0f172a; color: #f8fafc; }
        </style>
      </head>
      <body>
        <div id="root">${code}</div>
      </body>
      </html>
    `;

    return res.status(200).send(htmlWrapper);

  } catch (err) {
    console.error('Erro no Engine de Deploy:', err);
    return res.status(500).send('Erro Interno no Servidor de Renderização.');
  }
};

