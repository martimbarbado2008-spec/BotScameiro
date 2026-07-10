const RANK_ORDER = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

const HAND_NAMES = [
  'Carta alta', 'Par', 'Dois pares', 'Trinca', 'Sequência',
  'Flush', 'Full house', 'Quadra', 'Straight flush'
];

function rankValue(rank) {
  return RANK_ORDER.indexOf(rank);
}

// devolve { score, name, tiebreak: [...] } - score maior = mão melhor
function evaluateHand(cards) {
  const ranks = cards.map(c => rankValue(c.rank)).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);
  const counts = {};
  for (const r of ranks) counts[r] = (counts[r] || 0) + 1;
  const groups = Object.entries(counts)
    .map(([r, n]) => ({ rank: parseInt(r, 10), count: n }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);

  const isFlush = suits.every(s => s === suits[0]);
  const uniqueRanks = [...new Set(ranks)];
  let isStraight = false;
  let straightHigh = null;
  if (uniqueRanks.length === 5) {
    if (uniqueRanks[0] - uniqueRanks[4] === 4) { isStraight = true; straightHigh = uniqueRanks[0]; }
    // Ás baixo (A,2,3,4,5)
    if (uniqueRanks.join(',') === [12,3,2,1,0].join(',')) { isStraight = true; straightHigh = 3; }
  }

  const tiebreak = groups.map(g => g.rank);

  if (isStraight && isFlush) return { score: 8, name: HAND_NAMES[8], tiebreak: [straightHigh] };
  if (groups[0].count === 4) return { score: 7, name: HAND_NAMES[7], tiebreak };
  if (groups[0].count === 3 && groups[1].count === 2) return { score: 6, name: HAND_NAMES[6], tiebreak };
  if (isFlush) return { score: 5, name: HAND_NAMES[5], tiebreak: ranks };
  if (isStraight) return { score: 4, name: HAND_NAMES[4], tiebreak: [straightHigh] };
  if (groups[0].count === 3) return { score: 3, name: HAND_NAMES[3], tiebreak };
  if (groups[0].count === 2 && groups[1].count === 2) return { score: 2, name: HAND_NAMES[2], tiebreak };
  if (groups[0].count === 2) return { score: 1, name: HAND_NAMES[1], tiebreak };
  return { score: 0, name: HAND_NAMES[0], tiebreak: ranks };
}

// devolve 1 se a > b, -1 se b > a, 0 se empate
function compareHands(a, b) {
  if (a.score !== b.score) return a.score > b.score ? 1 : -1;
  for (let i = 0; i < Math.max(a.tiebreak.length, b.tiebreak.length); i++) {
    const av = a.tiebreak[i] ?? -1;
    const bv = b.tiebreak[i] ?? -1;
    if (av !== bv) return av > bv ? 1 : -1;
  }
  return 0;
}

module.exports = { evaluateHand, compareHands, HAND_NAMES };
