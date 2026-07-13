const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const db = require('../utils/database');
const { baseEmbed, fmt, COLORS } = require('../utils/embeds');

const ITEMS = [
  { id: 'vip1', name: '👑 VIP Bronze', price: 5000, desc: '+10% de ganhos em jogos', vipLevel: 1 },
  { id: 'vip2', name: '👑 VIP Prata', price: 20000, desc: '+20% de ganhos em jogos e menos cooldowns', vipLevel: 2 },
  { id: 'vip3', name: '👑 VIP Ouro', price: 75000, desc: '+35% de ganhos em jogos e cooldowns mínimos', vipLevel: 3 },
  { id: 'frame_gold', name: '🖼️ Moldura Dourada', price: 3000, desc: 'Borda dourada brilhante para o teu avatar' },
  { id: 'frame_neon', name: '🖼️ Moldura Neon', price: 5000, desc: 'Borda neon verde com efeito pulsar' },
  { id: 'frame_ruby', name: '🖼️ Moldura Rubi', price: 7500, desc: 'Borda rubi avermelhada brilhante' },
  { id: 'frame_rainbow', name: '🖼️ Moldura RGB', price: 15000, desc: 'Borda arco-íris rotativa animada' },
  { id: 'bg_matrix', name: '🌌 Banner Matrix', price: 10000, desc: 'Banner animado de chuva de códigos Matrix' },
  { id: 'bg_casino', name: '🌌 Banner Las Vegas', price: 15000, desc: 'Banner animado neon retro Las Vegas' },
  { id: 'bg_space', name: '🌌 Banner Espacial', price: 20000, desc: 'Banner animado de nebulosa espacial realista' },
  { id: 'bg_anime', name: '🌌 Banner Anime', price: 25000, desc: 'Banner estilizado anime de alta definição com foto' }
];

module.exports = {
  ITEMS,
  data: new SlashCommandBuilder()
    .setName('loja')
    .setDescription('Vê e compra itens da loja do casino'),

  async execute(interaction) {
    const embed = baseEmbed('🛒 Loja do casino', COLORS.gold)
      .setDescription(ITEMS.map(i => `**${i.name}** — ${fmt(i.price)}\n${i.desc}`).join('\n\n'));

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('shop_buy')
        .setPlaceholder('Escolhe um item para comprar')
        .addOptions(ITEMS.map(i => ({ label: `${i.name} — ${i.price} 🪙`, value: i.id, description: i.desc.slice(0, 90) })))
    );

    const reply = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

    const collector = reply.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 30000 });

    collector.on('collect', async i => {
      const item = ITEMS.find(x => x.id === i.values[0]);
      const user = db.getUser(interaction.guildId, interaction.user.id);

      if (user.balance < item.price) {
        return i.reply({ content: `Não tens saldo suficiente para **${item.name}**.`, ephemeral: true });
      }
      if (user.inventory.includes(item.id)) {
        return i.reply({ content: `Já tens **${item.name}**.`, ephemeral: true });
      }

      user.balance -= item.price;
      user.inventory.push(item.id);
      if (item.vipLevel) user.vipLevel = Math.max(user.vipLevel, item.vipLevel);
      db.saveUser(interaction.guildId, interaction.user.id, user);

      return i.reply({ content: `Compraste **${item.name}**! Novo saldo: ${fmt(user.balance)}`, ephemeral: true });
    });
  }
};
