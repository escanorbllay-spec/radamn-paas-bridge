onst { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  const masterKey = req.headers['x-master-key'];
  if (!masterKey || masterKey !== process.env.RADAMN_MASTER_KEY) {
    return res.status(401).json({ error: 'Acesso não autorizado.' });
  }

  try {
    const { projectId, projectName, newCode, action } = req.body || {};

    if (!newCode) {
      return res.status(400).json({ error: 'O parâmetro newCode é obrigatório.' });
    }

    // Se a ação for um snapshot explícito, garantimos o registo de estado
    if (action === 'snapshot' && projectId) {
      await pool.query(
        'INSERT INTO project_snapshots (project_id, code, created_at) VALUES ($1, $2, NOW())',
        [projectId, newCode]
      );
    }

    if (projectId) {
      const checkResult = await pool.query(
        'SELECT id, name, code, version, created_at, updated_at FROM projects WHERE id = $1',
        [projectId]
      );

      if (checkResult.rows.length > 0) {
        const existingProject = checkResult.rows[0];

        if (existingProject.code === newCode) {
          return res.status(200).json({
            message: 'Nenhuma alteração detectada no código. Diff-check mantido sem novo incremento de versão.',
            unchanged: true,
            project: existingProject
          });
        }
      }
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

