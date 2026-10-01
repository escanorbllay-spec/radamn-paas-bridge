const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

// Conexão com o banco de dados PostgreSQL (Supabase)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Middleware de Autenticação (Handshake)
app.use((req, res, next) => {
  const masterKey = req.headers['x-master-key'];
  if (!masterKey || masterKey !== process.env.RADAMN_MASTER_KEY) {
    return res.status(401).json({ error: 'Acesso não autorizado.' });
  }
  next();
});

// Handler central para salvar/atualizar projetos no Supabase
const handleGenerate = async (req, res) => {
  try {
    const { projectId, projectName, newCode } = req.body;

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
    console.error('Erro na rota generate:', err);
    return res.status(500).json({ error: 'Erro interno no servidor.', details: err.message });
  }
};

app.all('*', handleGenerate);

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`RADAM NOX PaaS rodando na porta ${PORT}`));
}
