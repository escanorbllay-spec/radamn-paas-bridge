module.exports = async (req, res) => {
  try {
    const { projectId } = req.query || {};

    // Busca o projeto pelo ID ou pega o último atualizado se não passar ID
    let result;
    if (projectId) {
      result = await pool.query(
        'SELECT name, code, version FROM projects WHERE id = $1',
        [projectId]
      );
    }

    if (!result || result.rows.length === 0) {
      // Fallback de segurança: pega o projeto mais recente da tabela
      result = await pool.query(
        'SELECT name, code, version FROM projects ORDER BY updated_at DESC LIMIT 1'
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).send('Erro 404: Nenhum projeto encontrado no banco de dados.');
    }

    const { name, code, version } = result.rows[0];

