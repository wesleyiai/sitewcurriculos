const { salvarPedido, buscarPedido } = require('./_lib/pedidos');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  const handle = process.env.INFINITEPAY_HANDLE;
  if (!handle) {
    res.status(500).json({ error: 'INFINITEPAY_HANDLE não configurado no servidor' });
    return;
  }

  const { order_nsu, transaction_nsu, slug } = req.query;
  if (!order_nsu || !transaction_nsu || !slug) {
    res.status(400).json({ error: 'Parâmetros order_nsu, transaction_nsu e slug são obrigatórios' });
    return;
  }

  try {
    const ipRes = await fetch('https://api.checkout.infinitepay.io/payment_check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle, order_nsu, transaction_nsu, slug }),
    });

    const data = await ipRes.json();

    if (!ipRes.ok) {
      res.status(ipRes.status).json({ error: data.message || 'Erro ao consultar pagamento' });
      return;
    }

    const paid = Boolean(data.paid);
    let pedido = null;

    if (paid) {
      // Recupera plano+dados salvos no create-link, pra o site conseguir
      // gerar/baixar o currículo mesmo se o cliente fechou a aba ou o
      // sessionStorage/localStorage daquele navegador não tiver mais nada.
      pedido = await buscarPedido(order_nsu);
      if (pedido) {
        try {
          await salvarPedido(order_nsu, { ...pedido, paid: true, paidAt: new Date().toISOString() });
        } catch (err) {
          console.error('Falha ao atualizar pedido no Blob:', err);
        }
      }
    }

    res.status(200).json({
      paid,
      amount: data.amount,
      paid_amount: data.paid_amount,
      capture_method: data.capture_method,
      pedido: pedido ? { plano: pedido.plano, dados: pedido.dados, cartaApresentacao: Boolean(pedido.cartaApresentacao), mensagemVagas: Boolean(pedido.mensagemVagas), checklistEntrevista: Boolean(pedido.checklistEntrevista) } : null,
    });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao comunicar com a InfinitePay' });
  }
};
