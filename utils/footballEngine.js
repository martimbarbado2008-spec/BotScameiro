const db = require('./database');

const TEAMS = {
  "Liga Portugal": [
    "Benfica", "Porto", "Sporting CP", "Braga", "Vitória SC", 
    "Famalicão", "Moreirense", "Gil Vicente", "Boavista"
  ],
  "Premier League": [
    "Manchester City", "Arsenal", "Liverpool", "Aston Villa", 
    "Tottenham", "Chelsea", "Manchester United", "Newcastle", "West Ham"
  ],
  "Champions League": [
    "Real Madrid", "Barcelona", "Bayern Munich", "PSG", "Inter Milan", 
    "Dortmund", "Atletico Madrid", "Juventus", "AC Milan", "Leverkusen"
  ]
};

const LEAGUES = ["Liga Portugal", "Premier League", "Champions League"];

// Duração do jogo (em milissegundos) para a simulação virtual (5 minutos é o ideal)
const GAME_DURATION_MS = 5 * 60 * 1000;
// Intervalo de novos jogos (a cada 15 minutos há um novo ciclo de jogos)
const ROUND_INTERVAL_MS = 15 * 60 * 1000;

function generateMatchesForGuild(guildId) {
  const activeMatches = db.getFootballMatches(guildId);
  
  // Limpar jogos terminados há mais de 1 hora
  const cleanedMatches = activeMatches.filter(m => {
    if (m.status === 'completed' && Date.now() - m.resolvedAt > 60 * 60 * 1000) {
      return false;
    }
    return true;
  });

  // Se já temos jogos pendentes que ainda não começaram, não geramos novos em excesso
  const pendingCount = cleanedMatches.filter(m => m.status === 'pending').length;
  if (pendingCount >= 4) {
    db.saveFootballMatches(guildId, cleanedMatches);
    return;
  }

  // Gerar um novo ciclo de 4 a 6 jogos
  const matchCount = 5;
  const newMatches = [...cleanedMatches];

  // Escolhe uma liga aleatória para esta ronda
  for (let i = 0; i < matchCount; i++) {
    const league = LEAGUES[Math.floor(Math.random() * LEAGUES.length)];
    const teamList = [...TEAMS[league]];
    
    // Escolhe dois clubes diferentes aleatoriamente
    const homeIndex = Math.floor(Math.random() * teamList.length);
    const homeTeam = teamList.splice(homeIndex, 1)[0];
    const awayIndex = Math.floor(Math.random() * teamList.length);
    const awayTeam = teamList[awayIndex];

    // Evita gerar jogos duplicados na lista ativa
    const duplicate = newMatches.some(m => 
      m.status === 'pending' && 
      ((m.homeTeam === homeTeam && m.awayTeam === awayTeam) || (m.homeTeam === awayTeam && m.awayTeam === homeTeam))
    );

    if (duplicate) continue;

    // Calcular Odds de forma probabilística
    const homePower = Math.random() * 4 + 1.5;
    const awayPower = Math.random() * 4 + 1.2;
    const totalPower = homePower + awayPower;

    // Margem da casa de 8% nas odds
    const pHome = (homePower / totalPower) * 0.92;
    const pAway = (awayPower / totalPower) * 0.92;
    const pDraw = 1 - pHome - pAway;

    const odds = {
      home: parseFloat((1 / pHome).toFixed(2)),
      draw: parseFloat((1 / pDraw).toFixed(2)),
      away: parseFloat((1 / pAway).toFixed(2))
    };

    const matchId = 'm_' + Math.random().toString(36).substr(2, 9);
    // Próximo jogo começará em 12 minutos
    const startTime = Date.now() + 12 * 60 * 1000 + (i * 30 * 1000); // escalonados ligeiramente

    newMatches.push({
      id: matchId,
      homeTeam,
      awayTeam,
      league,
      odds,
      startTime,
      status: 'pending',
      result: null,
      resolvedAt: null
    });
  }

  db.saveFootballMatches(guildId, newMatches);
}

function resolveMatchesForGuild(guildId, client) {
  const matches = db.getFootballMatches(guildId);
  const bets = db.getFootballBets(guildId);
  let changed = false;

  matches.forEach(m => {
    // Se o jogo está pendente e já passou o tempo dele começar + a duração da simulação (5 mins)
    if (m.status === 'pending' && Date.now() >= m.startTime + GAME_DURATION_MS) {
      // Resolver resultado
      const pHome = 1 / m.odds.home;
      const pDraw = 1 / m.odds.draw;
      const pAway = 1 / m.odds.away;
      const sum = pHome + pDraw + pAway;

      const roll = Math.random() * sum;
      let result = 'X'; // Empate padrão
      
      if (roll <= pHome) {
        result = '1'; // Vitória da Casa
      } else if (roll <= pHome + pAway) {
        result = '2'; // Vitória de Fora
      }

      m.status = 'completed';
      m.result = result;
      m.resolvedAt = Date.now();
      changed = true;

      // Resolver apostas neste jogo
      bets.forEach(b => {
        if (b.matchId === m.id && b.status === 'pending') {
          const isWin = b.choice === result;
          const user = db.getUser(guildId, b.userId);

          if (isWin) {
            const winnings = Math.round(b.amount * b.odds);
            db.addBalance(guildId, b.userId, winnings);
            db.pushHistory(guildId, b.userId, {
              game: `Aposta Futebol: ${m.homeTeam} x ${m.awayTeam}`,
              bet: b.amount,
              net: winnings - b.amount
            });
            b.status = 'won';
            b.payout = winnings;
            
            // Tenta enviar mensagem privada informando a vitória
            if (client) {
              client.users.fetch(b.userId).then(uObj => {
                uObj.send(`🏆 **Aposta Desportiva Ganha!** O jogo **${m.homeTeam} vs ${m.awayTeam}** terminou com o resultado **${result === '1' ? m.homeTeam : (result === '2' ? m.awayTeam : 'Empate')}**. Apostaste **${b.amount} 🪙** e ganhaste **${winnings} 🪙**!`).catch(() => {});
              }).catch(() => {});
            }
          } else {
            db.pushHistory(guildId, b.userId, {
              game: `Aposta Futebol: ${m.homeTeam} x ${m.awayTeam}`,
              bet: b.amount,
              net: -b.amount
            });
            b.status = 'lost';
            b.payout = 0;

            // Tenta enviar mensagem privada informando a derrota
            if (client) {
              client.users.fetch(b.userId).then(uObj => {
                uObj.send(`😭 **Aposta Desportiva Perdida.** O jogo **${m.homeTeam} vs ${m.awayTeam}** terminou com o resultado **${result === '1' ? m.homeTeam : (result === '2' ? m.awayTeam : 'Empate')}**. Perdeste **${b.amount} 🪙** da tua aposta.`).catch(() => {});
              }).catch(() => {});
            }
          }
        }
      });
    }
  });

  if (changed) {
    db.saveFootballMatches(guildId, matches);
    db.saveFootballBets(guildId, bets);
  }
}

function startFootballWatcher(client) {
  console.log("⚽ Watcher do Sportsbook Futebol ativado.");
  
  // Roda o loop a cada 45 segundos
  setInterval(() => {
    // Obter todas as guildas com utilizadores ativos na base de dados
    const allGuilds = Object.keys(db.getGuildConfig ? db.getGuildConfig : {});
    // Para simplificar, o bot pode carregar as guildas onde está presente
    if (client) {
      client.guilds.cache.forEach(guild => {
        try {
          generateMatchesForGuild(guild.id);
          resolveMatchesForGuild(guild.id, client);
        } catch (err) {
          console.error(`Erro no watcher de futebol para guilda ${guild.id}:`, err);
        }
      });
    }
  }, 45000);
}

module.exports = {
  startFootballWatcher,
  generateMatchesForGuild,
  resolveMatchesForGuild
};
