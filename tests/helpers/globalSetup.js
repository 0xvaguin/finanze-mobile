// Fuso fixo para tornar deterministicos os testes de data local (Brasil, UTC-3).
module.exports = async () => {
  process.env.TZ = 'America/Sao_Paulo';
};
