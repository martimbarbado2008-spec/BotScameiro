const { SlashCommandBuilder } = require('discord.js');
const db = require('../utils/database');
const { baseEmbed, fmt, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('investir')
    .setDescription('Interface de investimento em criptomoedas fictícias')
    .addSubcommand(subcommand =>
      subcommand.setName('cotacao')
        .setDescription('Vê a cotação atual das criptomoedas')
    )
    .addSubcommand(subcommand =>
      subcommand.setName('carteira')
        .setDescription('Vê a tua carteira de investimentos e lucros')
    )
    .addSubcommand(subcommand =>
      subcommand.setName('comprar')
        .setDescription('Compra frações ou unidades de uma criptomoeda')
        .addStringOption(option =>
          option.setName('moeda')
            .setDescription('Moeda a comprar')
            .setRequired(true)
            .addChoices(
              { name: 'Bitcoin (BTC)', value: 'BTC' },
              { name: 'Ethereum (ETH)', value: 'ETH' },
              { name: 'Solana (SOL)', value: 'SOL' },
              { name: 'Dogecoin (DOGE)', value: 'DOGE' }
            )
        )
        .addNumberOption(option =>
          option.setName('quantia')
            .setDescription('Quantidade a comprar (pode ser fracionária)')
            .setRequired(true)
            .setMinValue(0.0001)
        )
    )
    .addSubcommand(subcommand =>
      subcommand.setName('vender')
        .setDescription('Vende frações ou unidades de uma criptomoeda')
        .addStringOption(option =>
          option.setName('moeda')
            .setDescription('Moeda a vender')
            .setRequired(true)
            .addChoices(
              { name: 'Bitcoin (BTC)', value: 'BTC' },
              { name: 'Ethereum (ETH)', value: 'ETH' },
              { name: 'Solana (SOL)', value: 'SOL' },
              { name: 'Dogecoin (DOGE)', value: 'DOGE' }
            )
        )
        .addNumberOption(option =>
          option.setName('quantia')
            .setDescription('Quantidade a vender (pode ser fracionária)')
            .setRequired(true)
            .setMinValue(0.0001)
        )
    ),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const subcommand = interaction.options.getSubcommand();

    const prices = db.getCryptoPrices();
    const user = db.getUser(guildId, userId);

    if (subcommand === 'cotacao') {
      const embed = baseEmbed('📈 Mercado de Criptomoedas', COLORS.gold)
        .setDescription('As cotações flutuam a cada 5 minutos. Investe com cuidado!')
        .addFields(
          { name: '🪙 Bitcoin (BTC)', value: `${fmt(prices.BTC)}`, inline: true },
          { name: '🔷 Ethereum (ETH)', value: `${fmt(prices.ETH)}`, inline: true },
          { name: '☀️ Solana (SOL)', value: `${fmt(prices.SOL)}`, inline: true },
          { name: '🐶 Dogecoin (DOGE)', value: `${prices.DOGE.toFixed(3)} 🪙`, inline: true }
        );

      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'carteira') {
      if (!user.crypto) user.crypto = { BTC: 0, ETH: 0, SOL: 0, DOGE: 0 };
      
      const btcVal = (user.crypto.BTC || 0) * prices.BTC;
      const ethVal = (user.crypto.ETH || 0) * prices.ETH;
      const solVal = (user.crypto.SOL || 0) * prices.SOL;
      const dogeVal = (user.crypto.DOGE || 0) * prices.DOGE;
      const totalPortfolio = btcVal + ethVal + solVal + dogeVal;

      const embed = baseEmbed('💼 Carteira de Cripto', COLORS.info)
        .setDescription(`Aqui está o teu portfólio de investimentos virtuais.`)
        .addFields(
          { name: 'Saldo em carteira', value: fmt(user.balance), inline: false },
          { name: 'Valor total em Crypto', value: fmt(totalPortfolio), inline: false },
          { name: '🪙 Bitcoin (BTC)', value: `Holdings: **${(user.crypto.BTC || 0).toFixed(4)}**\nValor: ${fmt(btcVal)}`, inline: true },
          { name: '🔷 Ethereum (ETH)', value: `Holdings: **${(user.crypto.ETH || 0).toFixed(4)}**\nValor: ${fmt(ethVal)}`, inline: true },
          { name: '☀️ Solana (SOL)', value: `Holdings: **${(user.crypto.SOL || 0).toFixed(4)}**\nValor: ${fmt(solVal)}`, inline: true },
          { name: '🐶 Dogecoin (DOGE)', value: `Holdings: **${(user.crypto.DOGE || 0).toFixed(2)}**\nValor: ${fmt(dogeVal)}`, inline: true }
        );

      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'comprar') {
      const coin = interaction.options.getString('moeda');
      const amount = interaction.options.getNumber('quantia');
      const price = prices[coin];
      const cost = Math.round(amount * price);

      if (user.balance < cost) {
        return interaction.reply({ content: `Não tens moedas suficientes! Comprar ${amount} ${coin} custa **${fmt(cost)}**, mas só tens ${fmt(user.balance)}.`, ephemeral: true });
      }

      const result = db.buyCrypto(guildId, userId, coin, amount, price);
      if (!result) {
        return interaction.reply({ content: 'Ocorreu um erro ao processar a compra.', ephemeral: true });
      }

      db.pushHistory(guildId, userId, { game: `Crypto Buy (${coin})`, bet: cost, net: -cost });

      const embed = baseEmbed('🟩 Compra Realizada', COLORS.win)
        .setDescription(`Compraste **${amount.toFixed(4)} ${coin}** por **${fmt(cost)}**!`)
        .addFields(
          { name: 'Holdings atuais', value: `${result.holdings.toFixed(4)} ${coin}`, inline: true },
          { name: 'Novo Saldo', value: fmt(result.balance), inline: true }
        );

      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'vender') {
      const coin = interaction.options.getString('moeda');
      const amount = interaction.options.getNumber('quantia');
      const price = prices[coin];
      
      if (!user.crypto || (user.crypto[coin] || 0) < amount) {
        const currentHoldings = user.crypto ? (user.crypto[coin] || 0) : 0;
        return interaction.reply({ content: `Não tens holdings suficientes! Tens **${currentHoldings.toFixed(4)} ${coin}**, mas tentaste vender ${amount.toFixed(4)} ${coin}.`, ephemeral: true });
      }

      const gain = Math.round(amount * price);
      const result = db.sellCrypto(guildId, userId, coin, amount, price);
      if (!result) {
        return interaction.reply({ content: 'Ocorreu um erro ao processar a venda.', ephemeral: true });
      }

      db.pushHistory(guildId, userId, { game: `Crypto Sell (${coin})`, bet: 0, net: gain });

      const embed = baseEmbed('🟥 Venda Realizada', COLORS.win)
        .setDescription(`Vendeste **${amount.toFixed(4)} ${coin}** por **${fmt(gain)}**!`)
        .addFields(
          { name: 'Holdings atuais', value: `${result.holdings.toFixed(4)} ${coin}`, inline: true },
          { name: 'Novo Saldo', value: fmt(result.balance), inline: true }
        );

      return interaction.reply({ embeds: [embed] });
    }
  }
};
