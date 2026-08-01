const { solicitarSaque } = require('./_lib/pedidos');

function apenasDigitos(valor) {
  return String(valor || '').replace(/\D/g, '');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  const telefone = apenasDigitos(req.body && req.body.telefone);
  if (telefone.length < 10 || telefone.length > 13) {
    res.status(400).json({ error: 'Informe um WhatsApp válido, com DDD.' });
    return;
  }

  const resultado = await solicitarSaque(telefone);
  if (!resultado.ok) {
    res.status(400).json({ error: resultado.error });
    return;
  }

  res.status(200).json({ ok: true });
};
