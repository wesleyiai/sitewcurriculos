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

// Sistema de indicação: diz se esse telefone já indicou alguém com sucesso
// antes (usado por create-link.js pra liberar o desconto de quem indicou
// na própria compra seguinte). Timeout curto e fallback seguro pra `false`
// em qualquer erro — nunca pode travar o checkout por causa disso.
async function verificarIndicacaoAnterior(telefone) {
  if (!BASE_URL || !SECRET || !telefone) return false;
  const { signal, cancel } = withTimeout(3000);
  try {
    const resp = await fetch(`${BASE_URL}/referral-check/${encodeURIComponent(telefone)}`, {
      headers: { Authorization: `Bearer ${SECRET}` },
      signal,
    });
    if (!resp.ok) return false;
    const data = await resp.json();
    return Boolean(data && data.jaIndicouComSucesso);
  } catch (err) {
    return false;
  } finally {
    cancel();
  }
}

// Programa de afiliados: cadastro (nome+telefone) e consulta de ganhos,
// mesmo padrão de proxy HTTP acima. Usado por api/afiliado-cadastro.js e
// api/afiliado-dashboard.js.
async function cadastrarAfiliado(telefone, nome) {
  if (!BASE_URL || !SECRET) return { ok: false, error: 'Serviço de afiliados indisponível no momento.' };
  const { signal, cancel } = withTimeout(5000);
  try {
    const resp = await fetch(`${BASE_URL}/afiliado/cadastro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SECRET}` },
      body: JSON.stringify({ telefone, nome }),
      signal,
    });
    if (!resp.ok) return { ok: false, error: 'Não foi possível concluir o cadastro agora.' };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: 'Não foi possível concluir o cadastro agora.' };
  } finally {
    cancel();
  }
}

async function buscarStatsAfiliado(telefone) {
  if (!BASE_URL || !SECRET) return null;
  const { signal, cancel } = withTimeout(5000);
  try {
    const resp = await fetch(`${BASE_URL}/afiliado/${encodeURIComponent(telefone)}`, {
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

// Painel admin (admin-afiliados.html): lista todos os afiliados com
// pendências e marca uma comissão específica como paga (dono já transferiu
// via Pix manualmente). A senha admin é checada antes disso em
// api/admin-afiliados-*.js — aqui é só o mesmo proxy autenticado pelo
// Bearer secret do bot, igual todo o resto deste arquivo.
async function listarTodosAfiliados() {
  if (!BASE_URL || !SECRET) return null;
  const { signal, cancel } = withTimeout(5000);
  try {
    const resp = await fetch(`${BASE_URL}/afiliados/todos`, {
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

async function marcarComissaoPaga(orderNsu) {
  if (!BASE_URL || !SECRET) return { ok: false, error: 'Serviço de afiliados indisponível no momento.' };
  const { signal, cancel } = withTimeout(5000);
  try {
    const resp = await fetch(`${BASE_URL}/afiliado/marcar-pago`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SECRET}` },
      body: JSON.stringify({ orderNsu }),
      signal,
    });
    if (!resp.ok) return { ok: false, error: 'Não foi possível marcar como pago agora.' };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: 'Não foi possível marcar como pago agora.' };
  } finally {
    cancel();
  }
}

module.exports = {
  salvarPedido, buscarPedido, verificarIndicacaoAnterior,
  cadastrarAfiliado, buscarStatsAfiliado,
  listarTodosAfiliados, marcarComissaoPaga,
};
