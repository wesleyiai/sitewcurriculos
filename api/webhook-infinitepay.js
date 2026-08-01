const { salvarPedido, buscarPedido } = require('./_lib/pedidos');

// Programa de afiliados: 50% do valor total pago, sobre tudo (plano +
// order bumps) — diferente do desconto de indicação, que só incide sobre o
// plano. Ver create-link.js para affCode/totalCents.
const COMISSAO_AFILIADO = 0.5;

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
        const affCommissionCents = pedido.affCode
          ? Math.round((pedido.totalCents || 0) * COMISSAO_AFILIADO)
          : undefined;
        await salvarPedido(orderNsu, {
          ...pedido,
          paid: true,
          paidAt: new Date().toISOString(),
          ...(affCommissionCents !== undefined ? { affCommissionCents } : {}),
        });
      }
      await notificarBotWcurriculos(orderNsu);
    }
  } catch (err) {
    console.error('Falha ao processar webhook da InfinitePay:', err);
  }

  res.status(200).json({ received: true });
};

// Avisa o bot (VM compras-bot) na hora que um pedido é confirmado, pra
// entrega imediata do currículo por WhatsApp — sem isso, o bot só descobre
// o pedido no próximo ciclo do polling de segurança (bem mais espaçado, ver
// src/index.js do bot). Best-effort e com timeout curto: se o bot estiver
// fora do ar ou a chamada travar, isso não pode nunca atrasar/derrubar a
// resposta pra InfinitePay — o polling de segurança cobre esse caso.
async function notificarBotWcurriculos(orderNsu) {
  const url = process.env.WCURRICULOS_BOT_WEBHOOK_URL;
  const secret = process.env.WCURRICULOS_BOT_WEBHOOK_SECRET;
  if (!url || !secret) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ order_nsu: orderNsu }),
      signal: controller.signal,
    });
  } catch (err) {
    console.error('Falha ao notificar bot do WCurrículos (segue via polling de segurança):', err.message);
  } finally {
    clearTimeout(timeout);
  }
}
