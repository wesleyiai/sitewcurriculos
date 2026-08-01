const crypto = require('crypto');
const { salvarPedido, verificarIndicacaoAnterior } = require('./_lib/pedidos');

// Sistema de indicação: 20% de desconto pra quem foi indicado, e 20% pra
// quem indicou (aplicado automaticamente na compra seguinte dela mesma,
// já que hoje não há como avisar o indicador na hora — ver
// verificarIndicacaoAnterior). Nunca soma os dois casos (máximo 20% no
// total), e nunca incide sobre os order bumps, só no valor do plano.
const DESCONTO_INDICACAO = 0.20;

function apenasDigitos(valor) {
  return String(valor || '').replace(/\D/g, '');
}

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
const MODELO_MENSAGEM = { cents: 350, description: 'Modelo de Mensagem para Vagas - WCurrículos' };
const CHECKLIST_ENTREVISTA = { cents: 190, description: 'Checklist Antes da Entrevista - WCurrículos' };

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
  const mensagemVagas = Boolean(req.body && req.body.mensagemVagas);
  const checklistEntrevista = Boolean(req.body && req.body.checklistEntrevista);
  const item = PLANOS[plano];
  if (!item) {
    res.status(400).json({ error: 'Plano inválido' });
    return;
  }

  const origin = req.headers.origin || `https://${req.headers.host}`;
  const orderNsu = crypto.randomUUID();

  // Indicação: refCode é o telefone (só dígitos) de quem indicou. Ignorado
  // se mal formado ou se for autoindicação (mesmo telefone do comprador).
  const refCodeBruto = req.body && req.body.refCode;
  const refCode = apenasDigitos(refCodeBruto);
  const telefoneComprador = apenasDigitos(dados && dados.tel);
  const refCodeValido = refCode.length >= 8 && refCode.length <= 13 && refCode !== telefoneComprador;

  const jaIndicouAntes = telefoneComprador
    ? await verificarIndicacaoAnterior(telefoneComprador)
    : false;

  const temDesconto = refCodeValido || jaIndicouAntes;
  const precoComDesconto = temDesconto
    ? Math.round(item.cents * (1 - DESCONTO_INDICACAO))
    : item.cents;

  const items = [{ quantity: 1, price: precoComDesconto, description: item.description }];
  if (cartaApresentacao) {
    items.push({ quantity: 1, price: CARTA_APRESENTACAO.cents, description: CARTA_APRESENTACAO.description });
  }
  if (mensagemVagas) {
    items.push({ quantity: 1, price: MODELO_MENSAGEM.cents, description: MODELO_MENSAGEM.description });
  }
  if (checklistEntrevista) {
    items.push({ quantity: 1, price: CHECKLIST_ENTREVISTA.cents, description: CHECKLIST_ENTREVISTA.description });
  }

  // Programa de afiliados: affCode é o telefone (só dígitos) de quem
  // recrutou o cliente através do próprio link (?aff=<telefone>). Diferente
  // do refCode acima (indicação entre clientes, 20% de desconto), este não
  // dá desconto ao comprador — só gera comissão de 50% pro afiliado sobre o
  // valor total pago, calculada no webhook quando o pagamento é confirmado
  // (ver webhook-infinitepay.js). Autoindicação também é bloqueada aqui.
  const affCodeBruto = req.body && req.body.affCode;
  const affCode = apenasDigitos(affCodeBruto);
  const affCodeValido = affCode.length >= 8 && affCode.length <= 13 && affCode !== telefoneComprador;
  const totalCents = items.reduce((soma, i) => soma + i.price * i.quantity, 0);

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
        await salvarPedido(orderNsu, {
          plano, dados, cartaApresentacao, mensagemVagas, checklistEntrevista,
          paid: false,
          refCode: refCodeValido ? refCode : null,
          affCode: affCodeValido ? affCode : null,
          totalCents,
          createdAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Falha ao salvar pedido:', err);
      }
    }

    res.status(200).json({ url: data.url });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao comunicar com a InfinitePay' });
  }
};
