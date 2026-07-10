const { salvarPedido, buscarPedido } = require('./_lib/pedidos');

// Registro paralelo dos pagamentos confirmados pela InfinitePay.
// Não é usado para liberar o currículo na hora (isso é feito por
// api/check-payment.js quando o cliente volta do checkout) — mas, como esse
// webhook é chamado direto pela InfinitePay independente do navegador do
// cliente ainda estar aberto, também aproveitamos pra marcar o pedido salvo
// como pago (best-effort) — assim o pedido fica corretamente registrado
// mesmo se o cliente nunca mais voltar ao site.
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  console.log('InfinitePay webhook:', JSON.stringify(req.body));

  try {
    const orderNsu = req.body && (req.body.order_nsu || req.body.orderNsu);
    if (orderNsu) {
      const pedido = await buscarPedido(orderNsu);
      if (pedido && !pedido.paid) {
        await salvarPedido(orderNsu, { ...pedido, paid: true, paidAt: new Date().toISOString() });
      }
    }
  } catch (err) {
    console.error('Falha ao processar webhook da InfinitePay:', err);
  }

  res.status(200).json({ received: true });
};
