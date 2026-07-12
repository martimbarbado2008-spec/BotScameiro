const axios = require('axios');
const db = require('./database');

const VIRTUAL_TEAMS = {
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
  ],
  "La Liga (Espanha)": [
    "Real Madrid", "Barcelona", "Atletico Madrid", "Real Sociedad", 
    "Athletic Bilbao", "Girona", "Real Betis", "Sevilla", "Valencia", "Villarreal"
  ],
  "Serie A (Itália)": [
    "Inter Milan", "AC Milan", "Juventus", "Napoli", "AS Roma", 
    "Lazio", "Atalanta", "Fiorentina", "Bologna", "Torino"
  ],
  "Bundesliga (Alemanha)": [
    "Bayern Munich", "Bayer Leverkusen", "Dortmund", "RB Leipzig", 
    "Eintracht Frankfurt", "Stuttgart", "Gladbach", "Wolfsburg", "Freiburg"
  ],
  "Ligue 1 (França)": [
    "PSG", "Marseille", "Monaco", "Lille", "Lyon", "Lens", "Rennes", "Nice"
  ],
  "Campeonato do Mundo": [
    "Portugal", "Brasil", "Argentina", "França", "Alemanha", 
    "Espanha", "Inglaterra", "Itália", "Países Baixos", "Bélgica", "Uruguai", "Croácia"
  ],
  "Campeonato da Europa": [
    "Portugal", "Espanha", "França", "Alemanha", "Inglaterra", 
    "Itália", "Bélgica", "Países Baixos", "Croácia", "Dinamarca", "Suíça"
  ]
};

const LEAGUES = [
  "Liga Portugal", "Premier League", "Champions League",
  "La Liga (Espanha)", "Serie A (Itália)", "Bundesliga (Alemanha)",
  "Ligue 1 (França)", "Campeonato do Mundo", "Campeonato da Europa"
];
const GAME_DURATION_MS = 5 * 60 * 1000;

// Variável global em memória para controlar a taxa de pedidos à API (odds-api)
let lastOddsApiFetchTime = 0;
// Variável global em memória para controlar a taxa de pedidos de resultados (football-data)
let lastResultsApiFetchTime = 0;

// Normalização para comparar nomes de equipas entre diferentes APIs
function normalizeTeam(name) {
  return name.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remover acentos
    .replace(/ fc| afc| sc| sl| de| club| union| sporting| real| atletico/g, '')
    .trim();
}

// =========================================================================
// 🌐 MODO REAL: INTEGRAÇÃO COM APIS EXTERNAS
// =========================================================================

async function fetchRealMatches(guildId) {
  const apiKey = process.env.THE_ODDS_API_KEY || process.env.API_FOOTBALL_KEY;
  if (!apiKey) return false;

  // Evitar sobrecarregar a API (máximo 1 pedido a cada 30 minutos)
  if (Date.now() - lastOddsApiFetchTime < 30 * 60 * 1000) {
    return true; // ignorar fetch, usar cache da base de dados
  }

  console.log("⚽ A carregar jogos de futebol reais do The Odds API...");
  
  const sports = [
    { key: 'soccer_portugal_primeira_liga', name: 'Liga Portugal' },
    { key: 'soccer_epl', name: 'Premier League' },
    { key: 'soccer_uefa_champs_league', name: 'Champions League' },
    { key: 'soccer_spain_la_liga', name: 'La Liga (Espanha)' },
    { key: 'soccer_italy_serie_a', name: 'Serie A (Itália)' },
    { key: 'soccer_germany_bundesliga', name: 'Bundesliga (Alemanha)' },
    { key: 'soccer_france_ligue_one', name: 'Ligue 1 (França)' },
    { key: 'soccer_fifa_world_cup', name: 'Campeonato do Mundo' },
    { key: 'soccer_uefa_european_championship', name: 'Campeonato da Europa' }
  ];

  let matchesList = db.getFootballMatches(guildId);
  // Mantemos apenas os jogos já terminados/resolvidos e jogos virtuais
  let updatedMatches = matchesList.filter(m => m.status === 'completed' || m.id.startsWith('v_'));

  try {
    for (const sport of sports) {
      const url = `https://api.the-odds-api.com/v4/sports/${sport.key}/odds/?apiKey=${apiKey}&regions=eu&markets=h2h&bookmakers=betclic,unibet,williamhill`;
      const response = await axios.get(url);
      
      if (response.data && Array.isArray(response.data)) {
        response.data.forEach(match => {
          // Apenas jogos que comecem nos próximos 35 dias (1 mês e pouco)
          const startTime = Date.parse(match.commence_time);
          if (startTime - Date.now() > 35 * 24 * 60 * 60 * 1000 || startTime < Date.now()) {
            return;
          }

          // Procurar odds do primeiro bookmaker disponível
          if (!match.bookmakers || match.bookmakers.length === 0) return;
          const bookmaker = match.bookmakers[0];
          const market = bookmaker.markets.find(m => m.key === 'h2h');
          if (!market) return;

          const outcomes = market.outcomes;
          const homeOutcome = outcomes.find(o => o.name === match.home_team);
          const awayOutcome = outcomes.find(o => o.name === match.away_team);
          const drawOutcome = outcomes.find(o => o.name.toLowerCase() === 'draw' || o.name.toLowerCase() === 'empate');

          if (!homeOutcome || !awayOutcome || !drawOutcome) return;

          updatedMatches.push({
            id: `r_${match.id}`, // prefixo 'r_' para jogos reais
            homeTeam: match.home_team,
            awayTeam: match.away_team,
            league: sport.name,
            odds: {
              home: homeOutcome.price,
              draw: drawOutcome.price,
              away: awayOutcome.price
            },
            startTime,
            status: 'pending',
            result: null,
            resolvedAt: null
          });
        });
      }
    }

    lastOddsApiFetchTime = Date.now();
    db.saveFootballMatches(guildId, updatedMatches);
    console.log(`⚽ Sincronização concluída. ${updatedMatches.length} jogos totais disponíveis.`);
    return true;
  } catch (err) {
    console.error("❌ Erro ao buscar odds reais de futebol:", err.message);
    return false; // Falha no fetch real, roda simulated mode
  }
}

async function resolveRealMatches(guildId, client) {
  const resultApiKey = process.env.FOOTBALL_DATA_API_KEY;
  
  const matches = db.getFootballMatches(guildId);
  const pendingRealMatches = matches.filter(m => m.id.startsWith('r_') && m.status === 'pending' && Date.now() >= m.startTime + 2 * 60 * 60 * 1000); // Já começaram há mais de 2 horas

  if (pendingRealMatches.length === 0) return true;

  // FALLBACK 1: Se não houver chave de API de resultados, resolvemos os jogos reais de forma simulada/aleatória após 3 horas do início
  if (!resultApiKey) {
    let changed = false;
    const bets = db.getFootballBets(guildId);
    
    pendingRealMatches.forEach(m => {
      if (Date.now() >= m.startTime + 3 * 60 * 60 * 1000) {
        const pHome = m.odds && m.odds.home ? 1 / m.odds.home : 0.33;
        const pDraw = m.odds && m.odds.draw ? 1 / m.odds.draw : 0.33;
        const pAway = m.odds && m.odds.away ? 1 / m.odds.away : 0.33;
        const sum = pHome + pDraw + pAway || 1;
        const roll = Math.random() * sum;
        let result = 'X';
        if (roll <= pHome) result = '1';
        else if (roll <= pHome + pAway) result = '2';

        m.status = 'completed';
        m.result = result;
        m.resolvedAt = Date.now();
        changed = true;

        bets.forEach(b => {
          if (b.matchId === m.id && b.status === 'pending') {
            const isWin = b.choice === result;
            if (isWin) {
              const winnings = Math.round(b.amount * b.odds);
              let net = winnings - b.amount;
              const u = db.getUser(guildId, b.userId);
              const vipPercent = u.vipLevel === 1 ? 0.10 : (u.vipLevel === 2 ? 0.20 : (u.vipLevel === 3 ? 0.35 : 0));
              const vipBonus = Math.round(net * vipPercent);
              const finalWinnings = winnings + vipBonus;
              net += vipBonus;

              db.addBalance(guildId, b.userId, finalWinnings);
              db.pushHistory(guildId, b.userId, {
                game: `Aposta Futebol Real (Simulado): ${m.homeTeam} x ${m.awayTeam}`,
                bet: b.amount,
                net: net
              });
              db.addTournamentScore(guildId, b.userId, net);
              b.status = 'won';
              b.payout = finalWinnings;

              if (client) {
                client.users.fetch(b.userId).then(uObj => {
                  uObj.send(`🏆 **Aposta Real Ganha (Simulada)!** O jogo real **${m.homeTeam} vs ${m.awayTeam}** terminou com o resultado **${result === '1' ? m.homeTeam : (result === '2' ? m.awayTeam : 'Empate')}**. Recebeste **${finalWinnings} 🪙**!`).catch(() => {});
                }).catch(() => {});
              }
            } else {
              db.pushHistory(guildId, b.userId, {
                game: `Aposta Futebol Real (Simulado): ${m.homeTeam} x ${m.awayTeam}`,
                bet: b.amount,
                net: -b.amount
              });
              db.addTournamentScore(guildId, b.userId, -b.amount);
              b.status = 'lost';
              b.payout = 0;

              if (client) {
                client.users.fetch(b.userId).then(uObj => {
                  uObj.send(`😭 **Aposta Real Perdida (Simulada).** O jogo real **${m.homeTeam} vs ${m.awayTeam}** terminou com o resultado **${result === '1' ? m.homeTeam : (result === '2' ? m.awayTeam : 'Empate')}**. Perdeste **${b.amount} 🪙**.`).catch(() => {});
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
    return true;
  }

  // Evita fazer pedidos de resultados a toda a hora (máximo a cada 10 minutos)
  if (Date.now() - lastResultsApiFetchTime < 10 * 60 * 1000) {
    return true;
  }

  console.log(`⚽ A verificar resultados de ${pendingRealMatches.length} jogos reais terminados...`);

  try {
    const url = `https://api.football-data.org/v4/matches`;
    const response = await axios.get(url, {
      headers: { 'X-Auth-Token': resultApiKey }
    });

    if (response.data && Array.isArray(response.data.matches)) {
      const apiMatches = response.data.matches;
      let changed = false;
      const bets = db.getFootballBets(guildId);

      pendingRealMatches.forEach(m => {
        // FALLBACK 2: Se o jogo começou há mais de 24 horas e ainda está pendente (por falha de nome, cancelado ou ausência na API), resolvemos como simulado
        if (Date.now() >= m.startTime + 24 * 60 * 60 * 1000) {
          const pHome = m.odds && m.odds.home ? 1 / m.odds.home : 0.33;
          const pDraw = m.odds && m.odds.draw ? 1 / m.odds.draw : 0.33;
          const pAway = m.odds && m.odds.away ? 1 / m.odds.away : 0.33;
          const sum = pHome + pDraw + pAway || 1;
          const roll = Math.random() * sum;
          let result = 'X';
          if (roll <= pHome) result = '1';
          else if (roll <= pHome + pAway) result = '2';

          m.status = 'completed';
          m.result = result;
          m.resolvedAt = Date.now();
          changed = true;

          bets.forEach(b => {
            if (b.matchId === m.id && b.status === 'pending') {
              const isWin = b.choice === result;
              if (isWin) {
                const winnings = Math.round(b.amount * b.odds);
                let net = winnings - b.amount;
                const u = db.getUser(guildId, b.userId);
                const vipPercent = u.vipLevel === 1 ? 0.10 : (u.vipLevel === 2 ? 0.20 : (u.vipLevel === 3 ? 0.35 : 0));
                const vipBonus = Math.round(net * vipPercent);
                const finalWinnings = winnings + vipBonus;
                net += vipBonus;

                db.addBalance(guildId, b.userId, finalWinnings);
                db.pushHistory(guildId, b.userId, {
                  game: `Aposta Futebol Real (Simulado 24h): ${m.homeTeam} x ${m.awayTeam}`,
                  bet: b.amount,
                  net: net
                });
                db.addTournamentScore(guildId, b.userId, net);
                b.status = 'won';
                b.payout = finalWinnings;
              } else {
                db.pushHistory(guildId, b.userId, {
                  game: `Aposta Futebol Real (Simulado 24h): ${m.homeTeam} x ${m.awayTeam}`,
                  bet: b.amount,
                  net: -b.amount
                });
                db.addTournamentScore(guildId, b.userId, -b.amount);
                b.status = 'lost';
                b.payout = 0;
              }
            }
          });
          return;
        }

        // Tenta emparelhar o jogo local com os resultados da API usando normalização
        const found = apiMatches.find(am => 
          am.status === 'FINISHED' && 
          normalizeTeam(am.homeTeam.name).includes(normalizeTeam(m.homeTeam)) &&
          normalizeTeam(am.awayTeam.name).includes(normalizeTeam(m.awayTeam))
        );

        if (found) {
          const homeScore = found.score.fullTime.home;
          const awayScore = found.score.fullTime.away;
          let result = 'X';
          if (homeScore > awayScore) result = '1';
          else if (homeScore < awayScore) result = '2';

          m.status = 'completed';
          m.result = result;
          m.resolvedAt = Date.now();
          changed = true;

          // Pagar apostas
          bets.forEach(b => {
            if (b.matchId === m.id && b.status === 'pending') {
              const isWin = b.choice === result;
              if (isWin) {
                const winnings = Math.round(b.amount * b.odds);
                let net = winnings - b.amount;

                const u = db.getUser(guildId, b.userId);
                const vipPercent = u.vipLevel === 1 ? 0.10 : (u.vipLevel === 2 ? 0.20 : (u.vipLevel === 3 ? 0.35 : 0));
                const vipBonus = Math.round(net * vipPercent);
                const finalWinnings = winnings + vipBonus;
                net += vipBonus;

                db.addBalance(guildId, b.userId, finalWinnings);
                db.pushHistory(guildId, b.userId, {
                  game: `Aposta Futebol Real: ${m.homeTeam} x ${m.awayTeam}`,
                  bet: b.amount,
                  net: net
                });
                db.addTournamentScore(guildId, b.userId, net);
                b.status = 'won';
                b.payout = finalWinnings;

                if (client) {
                  client.users.fetch(b.userId).then(uObj => {
                    uObj.send(`🏆 **Aposta Real Ganha!** O jogo real **${m.homeTeam} vs ${m.awayTeam}** terminou com o resultado **${result === '1' ? m.homeTeam : (result === '2' ? m.awayTeam : 'Empate')}** (${homeScore}-${awayScore}). Recebeste **${finalWinnings} 🪙**!${vipBonus > 0 ? ` (Inclui bónus VIP de +${vipBonus} 🪙)` : ''}`).catch(() => {});
                  }).catch(() => {});
                }
              } else {
                db.pushHistory(guildId, b.userId, {
                  game: `Aposta Futebol Real: ${m.homeTeam} x ${m.awayTeam}`,
                  bet: b.amount,
                  net: -b.amount
                });
                db.addTournamentScore(guildId, b.userId, -b.amount);
                b.status = 'lost';
                b.payout = 0;

                if (client) {
                  client.users.fetch(b.userId).then(uObj => {
                    uObj.send(`😭 **Aposta Real Perdida.** O jogo real **${m.homeTeam} vs ${m.awayTeam}** terminou com o resultado **${result === '1' ? m.homeTeam : (result === '2' ? m.awayTeam : 'Empate')}** (${homeScore}-${awayScore}).`).catch(() => {});
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

    lastResultsApiFetchTime = Date.now();
    return true;
  } catch (err) {
    console.error("❌ Erro ao buscar resultados reais de futebol:", err.message);
    return false;
  }
}

// =========================================================================
// 🤖 MODO SIMULADO (FALLBACK E PARA DESENVOLVIMENTO VIRTUAL)
// =========================================================================

function generateVirtualMatches(guildId) {
  const activeMatches = db.getFootballMatches(guildId);
  
  // Limpar jogos resolvidos há mais de 1 hora
  const cleanedMatches = activeMatches.filter(m => {
    if (m.status === 'completed' && Date.now() - m.resolvedAt > 60 * 60 * 1000) {
      return false;
    }
    return true;
  });

  const pendingCount = cleanedMatches.filter(m => m.status === 'pending').length;
  if (pendingCount >= 4) {
    db.saveFootballMatches(guildId, cleanedMatches);
    return;
  }

  const matchCount = 5;
  const newMatches = [...cleanedMatches];

  for (let i = 0; i < matchCount; i++) {
    const league = LEAGUES[Math.floor(Math.random() * LEAGUES.length)];
    const teamList = [...VIRTUAL_TEAMS[league]];
    
    const homeIndex = Math.floor(Math.random() * teamList.length);
    const homeTeam = teamList.splice(homeIndex, 1)[0];
    const awayIndex = Math.floor(Math.random() * teamList.length);
    const awayTeam = teamList[awayIndex];

    const duplicate = newMatches.some(m => 
      m.status === 'pending' && 
      ((m.homeTeam === homeTeam && m.awayTeam === awayTeam) || (m.homeTeam === awayTeam && m.awayTeam === homeTeam))
    );

    if (duplicate) continue;

    const homePower = Math.random() * 4 + 1.5;
    const awayPower = Math.random() * 4 + 1.2;
    const totalPower = homePower + awayPower;

    const pHome = (homePower / totalPower) * 0.92;
    const pAway = (awayPower / totalPower) * 0.92;
    const pDraw = 1 - pHome - pAway;

    const odds = {
      home: parseFloat((1 / pHome).toFixed(2)),
      draw: parseFloat((1 / pDraw).toFixed(2)),
      away: parseFloat((1 / pAway).toFixed(2))
    };

    const matchId = 'v_' + Math.random().toString(36).substr(2, 9); // 'v_' para virtual
    const startTime = Date.now() + 10 * 60 * 1000 + (i * 45 * 1000); 

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

function resolveVirtualMatches(guildId, client) {
  const matches = db.getFootballMatches(guildId);
  const bets = db.getFootballBets(guildId);
  let changed = false;

  matches.forEach(m => {
    // Se for um jogo virtual e já terminou
    if (m.id.startsWith('v_') && m.status === 'pending' && Date.now() >= m.startTime + GAME_DURATION_MS) {
      const pHome = 1 / m.odds.home;
      const pDraw = 1 / m.odds.draw;
      const pAway = 1 / m.odds.away;
      const sum = pHome + pDraw + pAway;

      const roll = Math.random() * sum;
      let result = 'X';
      
      if (roll <= pHome) {
        result = '1';
      } else if (roll <= pHome + pAway) {
        result = '2';
      }

      m.status = 'completed';
      m.result = result;
      m.resolvedAt = Date.now();
      changed = true;

      bets.forEach(b => {
        if (b.matchId === m.id && b.status === 'pending') {
          const isWin = b.choice === result;
          if (isWin) {
            const winnings = Math.round(b.amount * b.odds);
            let net = winnings - b.amount;

            const u = db.getUser(guildId, b.userId);
            const vipPercent = u.vipLevel === 1 ? 0.10 : (u.vipLevel === 2 ? 0.20 : (u.vipLevel === 3 ? 0.35 : 0));
            const vipBonus = Math.round(net * vipPercent);
            const finalWinnings = winnings + vipBonus;
            net += vipBonus;

            db.addBalance(guildId, b.userId, finalWinnings);
            db.pushHistory(guildId, b.userId, {
              game: `Aposta Futebol: ${m.homeTeam} x ${m.awayTeam}`,
              bet: b.amount,
              net: net
            });
            db.addTournamentScore(guildId, b.userId, net);
            b.status = 'won';
            b.payout = finalWinnings;
            
            if (client) {
              client.users.fetch(b.userId).then(uObj => {
                uObj.send(`🏆 **Aposta Desportiva Ganha!** O jogo **${m.homeTeam} vs ${m.awayTeam}** terminou com o resultado **${result === '1' ? m.homeTeam : (result === '2' ? m.awayTeam : 'Empate')}**. Apostaste **${b.amount} 🪙** e ganhaste **${finalWinnings} 🪙**!${vipBonus > 0 ? ` (Inclui bónus VIP de +${vipBonus} 🪙)` : ''}`).catch(() => {});
              }).catch(() => {});
            }
          } else {
            db.pushHistory(guildId, b.userId, {
              game: `Aposta Futebol: ${m.homeTeam} x ${m.awayTeam}`,
              bet: b.amount,
              net: -b.amount
            });
            db.addTournamentScore(guildId, b.userId, -b.amount);
            b.status = 'lost';
            b.payout = 0;

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

// =========================================================================
// 🚀 INICIALIZADOR & WATCHER DE CICLO
// =========================================================================

function startFootballWatcher(client) {
  console.log("⚽ Watcher Híbrido do Sportsbook Futebol ativado.");
  
  setInterval(async () => {
    if (!client) return;

    client.guilds.cache.forEach(async (guild) => {
      try {
        const hasRealApi = !!(process.env.THE_ODDS_API_KEY || process.env.API_FOOTBALL_KEY);

        if (hasRealApi) {
          // Busca jogos reais
          await fetchRealMatches(guild.id);
        }
        // Resolve jogos reais (sempre executado, para limpar/simular jogos pendentes da DB)
        await resolveRealMatches(guild.id, client);

        // De qualquer forma, mantemos jogos virtuais como alternativa ou para manter ativo
        generateVirtualMatches(guild.id);
        resolveVirtualMatches(guild.id, client);

      } catch (err) {
        console.error(`Erro no watcher de futebol para a guilda ${guild.id}:`, err.message);
      }
    });
  }, 60000);
}

async function generateMatchesForGuild(guildId) {
  try {
    const hasRealApi = !!(process.env.THE_ODDS_API_KEY || process.env.API_FOOTBALL_KEY);
    if (hasRealApi) {
      await fetchRealMatches(guildId);
    }
  } catch (err) {
    console.error("Erro ao pré-gerar jogos reais:", err.message);
  }

  try {
    generateVirtualMatches(guildId);
  } catch (err) {
    console.error("Erro ao pré-gerar jogos virtuais:", err.message);
  }
}

module.exports = {
  startFootballWatcher,
  generateVirtualMatches,
  resolveVirtualMatches,
  fetchRealMatches,
  resolveRealMatches,
  generateMatchesForGuild
};
