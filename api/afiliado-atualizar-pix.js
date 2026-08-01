const { atualizarChavePix } = require('./_lib/pedidos');

function apenasDigitos(valor) {
  return String(valor || '').replace(/\D/g, '');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  const telefone = apenasDigitos(req.body && req.body.telefone);
  const chavePix = String((req.body && req.body.chavePix) || '').trim();

  if (telefone.length < 10 || telefone.length > 13) {
    res.status(400).json({ error: 'Informe um WhatsApp válido, com DDD.' });
    return;
  }
  if (!chavePix) {
    res.status(400).json({ error: 'Informe sua chave Pix.' });
    return;
  }

  const resultado = await atualizarChavePix(telefone, chavePix);
  if (!resultado.ok) {
    res.status(resultado.notFound ? 404 : 502).json({ error: resultado.error });
    return;
  }

  res.status(200).json({ ok: true });
};
