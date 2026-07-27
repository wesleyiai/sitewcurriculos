const crypto = require('crypto');
const { salvarPedido } = require('./_lib/pedidos');

// Substitui create-link.js no fluxo normal do cliente: não há mais
// integração automática de pagamento (InfinitePay) — a tela de pagamento
// mostra uma chave Pix estática e o currículo é entregue por tempo (ver
// WCURRICULOS_DELIVERY_DELAY_MS abaixo), não por confirmação de pagamento.
// create-link.js/webhook-infinitepay.js/check-payment.js continuam
// existindo intactos, só deixam de ser chamados.
const PLANOS_VALIDOS = new Set(['basico', 'premium']);

// Nunca vem do cliente — sempre calculado aqui. Só deve ser reduzido via env
// var no ambiente de Preview da Vercel (pra testar sem esperar 10min de
// verdade); nunca em Production.
const DELIVERY_DELAY_MS = Number(process.env.WCURRICULOS_DELIVERY_DELAY_MS) || 10 * 60 * 1000;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  const plano = req.body && req.body.plano;
  const dados = req.body && req.body.dados;
  const cartaApresentacao = Boolean(req.body && req.body.cartaApresentacao);
  const mensagemVagas = Boolean(req.body && req.body.mensagemVagas);
  const checklistEntrevista = Boolean(req.body && req.body.checklistEntrevista);

  if (!PLANOS_VALIDOS.has(plano)) {
    res.status(400).json({ error: 'Plano inválido' });
    return;
  }
  if (!dados) {
    res.status(400).json({ error: 'Dados obrigatórios' });
    return;
  }

  const orderNsu = crypto.randomUUID();
  const createdAt = new Date();
  const entregarEm = new Date(createdAt.getTime() + DELIVERY_DELAY_MS).toISOString();

  // Diferente de create-link.js (onde salvarPedido é best-effort, porque o
  // pedido ia ser pago via InfinitePay de qualquer forma): aqui é o único
  // jeito do bot saber que existe algo pra entregar, então uma falha aqui
  // tem que virar erro pro cliente, não uma resposta de sucesso vazia.
  if (!process.env.WCURRICULOS_BOT_BASE_URL || !process.env.WCURRICULOS_BOT_WEBHOOK_SECRET) {
    res.status(500).json({ error: 'Servidor de entrega não configurado' });
    return;
  }

  try {
    await salvarPedido(orderNsu, {
      plano,
      dados,
      cartaApresentacao,
      mensagemVagas,
      checklistEntrevista,
      paid: false,
      entregaAutomatica: true,
      entregarEm,
      createdAt: createdAt.toISOString(),
    });
  } catch (err) {
    res.status(502).json({ error: 'Não foi possível registrar o pedido agora. Tente novamente.' });
    return;
  }

  res.status(200).json({ orderNsu, entregarEm });
};
