// Registro paralelo dos pagamentos confirmados pela InfinitePay.
// Não é usado para liberar o currículo (isso é feito por api/check-payment.js
// quando o cliente volta do checkout) — serve só de log/backup nos logs da Vercel.
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  console.log('InfinitePay webhook:', JSON.stringify(req.body));
  res.status(200).json({ received: true });
};
