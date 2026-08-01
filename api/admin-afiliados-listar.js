const { listarTodosAfiliados } = require('./_lib/pedidos');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  const senhaEsperada = process.env.ADMIN_AFILIADOS_SENHA;
  if (!senhaEsperada) {
    res.status(500).json({ error: 'ADMIN_AFILIADOS_SENHA não configurada no servidor' });
    return;
  }

  const senha = req.headers['x-admin-senha'];
  if (senha !== senhaEsperada) {
    res.status(401).json({ error: 'Senha incorreta.' });
    return;
  }

  const afiliados = await listarTodosAfiliados();
  if (!afiliados) {
    res.status(502).json({ error: 'Não foi possível buscar os afiliados agora.' });
    return;
  }

  res.status(200).json(afiliados);
};
