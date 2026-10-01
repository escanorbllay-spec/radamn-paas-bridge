const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

module.exports = async (req, res) => {
  // Trata métodos diferentes de POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  // Validação do Handshake (Master Key)
  const masterKey = req.headers['x-master-key'];
  if (!masterKey || masterKey !== process.env.RADAMN_MASTER_KEY) {
    return res.status(401).json({ error: 'Acesso não autorizado.' });
  }

  try {
    const { projectId, projectName, newCode } = req.body || {};

    if (!newCode) {
      return res.status(400).json({ error: 'O parâmetro newCode é obrigatório.' });
    }

    const generatedId = projectId || 'proj_' + Math.random().toString(36).substring(2, 9);
    const name = projectName || `App ${generatedId}`;

    const queryText = `
      INSERT INTO projects (id, name, code, version, updated_at)
      VALUES ($1, $2, $3, 1, NOW())
      ON CONFLICT (id) DO UPDATE 
      SET code = EXCLUDED.code,
          name = EXCLUDED.name,
          version = projects.version + 1,
          updated_at = NOW()
      RETURNING *;
    `;

    const dbResult = await pool.query(queryText, [generatedId, name, newCode]);

    return res.status(200).json({
      message: 'Código processado e salvo com sucesso no banco!',
      project: dbResult.rows[0]
    });

  } catch (err) {
    console.error('Erro na função serverless:', err);
    return res.status(500).json({ error: 'Erro de conexão ou execução.', details: err.message });
  }
};
