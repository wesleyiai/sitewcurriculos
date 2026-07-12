const crypto = require('crypto');
const { salvarPedido } = require('./_lib/pedidos');

// O preço nunca vem do navegador: o cliente só manda qual plano escolheu,
// e o valor cobrado é sempre o definido aqui no servidor.
const PLANOS = {
  basico: { cents: 990, description: 'Currículo Básico - WCurrículos' },
  premium: { cents: 1490, description: 'Currículo Premium - WCurrículos' },
};

// Order bump opcional (tela de pagamento): carta de apresentação
// personalizada. Mesma regra acima — o cliente só manda um booleano, o
// preço cobrado vem sempre daqui.
const CARTA_APRESENTACAO = { cents: 290, description: 'Carta de Apresentação personalizada - WCurrículos' };

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  const handle = process.env.INFINITEPAY_HANDLE;
  if (!handle) {
    res.status(500).json({ error: 'INFINITEPAY_HANDLE não configurado no servidor' });
    return;
  }

  const plano = req.body && req.body.plano;
  const dados = req.body && req.body.dados;
  const cartaApresentacao = Boolean(req.body && req.body.cartaApresentacao);
  const item = PLANOS[plano];
  if (!item) {
    res.status(400).json({ error: 'Plano inválido' });
    return;
  }

  const origin = req.headers.origin || `https://${req.headers.host}`;
  const orderNsu = crypto.randomUUID();

  const items = [{ quantity: 1, price: item.cents, description: item.description }];
  if (cartaApresentacao) {
    items.push({ quantity: 1, price: CARTA_APRESENTACAO.cents, description: CARTA_APRESENTACAO.description });
  }

  try {
    const ipRes = await fetch('https://api.checkout.infinitepay.io/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        handle,
        items,
        order_nsu: orderNsu,
        redirect_url: `${origin}/`,
        webhook_url: `${origin}/api/webhook-infinitepay`,
      }),
    });

    const data = await ipRes.json();

    if (!ipRes.ok || !data.url) {
      res.status(ipRes.status || 502).json({ error: data.message || 'Erro ao criar link de pagamento' });
      return;
    }

    // Best-effort: se o navegador do cliente fechar antes de voltar do
    // checkout, esses dados guardados são o que permite ao check-payment.js
    // reconstruir o currículo depois, sem depender de sessionStorage/localStorage.
    if (dados) {
      try {
        await salvarPedido(orderNsu, { plano, dados, cartaApresentacao, paid: false, createdAt: new Date().toISOString() });
      } catch (err) {
        console.error('Falha ao salvar pedido no Blob:', err);
      }
    }

    res.status(200).json({ url: data.url });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao comunicar com a InfinitePay' });
  }
};
