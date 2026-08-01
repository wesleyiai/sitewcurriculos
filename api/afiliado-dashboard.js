const { buscarStatsAfiliado } = require('./_lib/pedidos');

function apenasDigitos(valor) {
  return String(valor || '').replace(/\D/g, '');
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  const telefone = apenasDigitos(req.query && req.query.telefone);
  if (telefone.length < 10 || telefone.length > 13) {
    res.status(400).json({ error: 'Informe um WhatsApp válido, com DDD.' });
    return;
  }

  const stats = await buscarStatsAfiliado(telefone);
  if (!stats) {
    res.status(404).json({ error: 'Nenhum cadastro de afiliado encontrado para esse WhatsApp.' });
    return;
  }

  res.status(200).json(stats);
};
