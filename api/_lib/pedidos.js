// Guarda os dados do pedido (plano + respostas do formulário) atrelados ao
// order_nsu, pra sobreviver ao fechamento da aba/navegador do cliente entre
// o checkout na InfinitePay e o retorno ao site. Ver check-payment.js.
//
// Armazenado direto na VM do bot (compras-bot), não no Vercel Blob — o Blob
// tem cota grátis pequena e, uma vez estourada, trava por 30 dias sem opção
// de pagar; a VM já roda 24h de qualquer forma pra entregar o currículo por
// WhatsApp, então guardar os dados ali também não tem custo nenhum.

const BASE_URL = process.env.WCURRICULOS_BOT_BASE_URL;
const SECRET = process.env.WCURRICULOS_BOT_WEBHOOK_SECRET;

function withTimeout(ms) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(timeout) };
}

async function salvarPedido(orderNsu, pedido) {
  if (!BASE_URL || !SECRET) {
    console.error('WCURRICULOS_BOT_BASE_URL/WCURRICULOS_BOT_WEBHOOK_SECRET não configurados — pedido não persistido.');
    return;
  }
  const { signal, cancel } = withTimeout(5000);
  try {
    await fetch(`${BASE_URL}/pedido/${encodeURIComponent(orderNsu)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SECRET}` },
      body: JSON.stringify(pedido),
      signal,
    });
  } finally {
    cancel();
  }
}

async function buscarPedido(orderNsu) {
  if (!BASE_URL || !SECRET) return null;
  const { signal, cancel } = withTimeout(5000);
  try {
    const resp = await fetch(`${BASE_URL}/pedido/${encodeURIComponent(orderNsu)}`, {
      headers: { Authorization: `Bearer ${SECRET}` },
      signal,
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch (err) {
    return null;
  } finally {
    cancel();
  }
}

module.exports = { salvarPedido, buscarPedido };
