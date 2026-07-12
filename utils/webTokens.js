const crypto = require('crypto');

// tokens de curta duração em memória: cada link do /trabalhar só serve para
// um jogador, expira sozinho e só pode ser usado uma vez.
const tokens = new Map(); // token -> { guildId, userId, expiresAt, used }

const TOKEN_TTL_MS = 60 * 60 * 1000; // 60 minutos para abrir o link e jogar

function createToken(guildId, userId) {
  const token = crypto.randomBytes(24).toString('hex');
  tokens.set(token, {
    guildId,
    userId,
    expiresAt: Date.now() + TOKEN_TTL_MS,
    used: false
  });
  return token;
}

function peekToken(token) {
  const entry = tokens.get(token);
  if (!entry) return null;
  if (entry.used || Date.now() > entry.expiresAt) return null;
  return entry;
}

// consome o token de forma atómica para que não dê para submeter o mesmo link duas vezes
function consumeToken(token) {
  const entry = peekToken(token);
  if (!entry) return null;
  entry.used = true;
  return entry;
}

// limpeza periódica para não acumular tokens expirados em memória
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of tokens.entries()) {
    if (entry.used || now > entry.expiresAt) tokens.delete(token);
  }
}, 5 * 60 * 1000);

module.exports = { createToken, peekToken, consumeToken, TOKEN_TTL_MS };