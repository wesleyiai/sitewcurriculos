const { marcarSaquePago } = require('./_lib/pedidos');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
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

  const telefone = req.body && req.body.telefone;
  if (!telefone) {
    res.status(400).json({ error: 'telefone é obrigatório.' });
    return;
  }

  const resultado = await marcarSaquePago(telefone);
  if (!resultado.ok) {
    res.status(502).json({ error: resultado.error });
    return;
  }

  res.status(200).json({ ok: true, quantidadeMarcada: resultado.quantidadeMarcada });
};
