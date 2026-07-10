const { put, head } = require('@vercel/blob');

// Guarda os dados do pedido (plano + respostas do formulário) atrelados ao
// order_nsu, pra sobreviver ao fechamento da aba/navegador do cliente entre
// o checkout na InfinitePay e o retorno ao site. Ver check-payment.js.
function pedidoKey(orderNsu) {
  return `pedidos/${orderNsu}.json`;
}

async function salvarPedido(orderNsu, pedido) {
  await put(pedidoKey(orderNsu), JSON.stringify(pedido), {
    access: 'private',
    addRandomSuffix: false,
    contentType: 'application/json',
    allowOverwrite: true,
  });
}

async function buscarPedido(orderNsu) {
  try {
    const info = await head(pedidoKey(orderNsu));
    const resp = await fetch(info.downloadUrl, {
      headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch (err) {
    return null;
  }
}

module.exports = { salvarPedido, buscarPedido };
