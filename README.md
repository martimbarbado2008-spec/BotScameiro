# Casino Bot 🎰

Bot de Discord estilo casino completo: economia virtual, mais de uma dezena de jogos, progressão por níveis, conquistas, cargos automáticos, torneios (manuais e semanais automáticos), lotaria, empréstimos, roubo, mesa multijogador e muito mais.

> Usa moeda virtual sem qualquer ligação a dinheiro real.

## Comandos

### 🎮 Jogos
| Comando | Descrição |
|---|---|
| `/slots` | Slot machine com multiplicadores |
| `/blackjack` | Blackjack contra o dealer (Hit/Stand) |
| `/blackjack-mesa` | Mesa de blackjack **multijogador**: outros entram e jogam por turnos contra o dealer |
| `/roleta` | Roleta europeia (cor, par/ímpar, número exato) |
| `/dados` | Aposta em par, ímpar ou total exato |
| `/poker` | 5 card draw contra o bot, com troca de cartas |
| `/coinflip` | Cara ou coroa rápido, sem precisar de oponente |
| `/higherlower` | Adivinha se a próxima carta é maior ou menor; saca a qualquer momento |
| `/mines` | Campo minado: escolhe o nº de minas, revela células, saca quando quiseres |
| `/crash` | O multiplicador sobe em tempo real — saca antes que rebente |
| `/lotaria comprar` / `/lotaria info` | Bilhetes semanais, jackpot acumulado, sorteio automático |
| `/apostar` | Desafia outro jogador para um coin flip |
| `/duelo` | Desafia outro jogador para pedra-papel-tesoura ao melhor de 3 |

### 💰 Economia
| Comando | Descrição |
|---|---|
| `/saldo [utilizador]` | Vê o saldo (carteira + banco) |
| `/diario` | Bónus diário com streak |
| `/trabalhar` | Ganha dinheiro sem risco (cooldown) |
| `/banco depositar` / `/banco levantar` | Guarda dinheiro no banco — protegido de roubos |
| `/emprestimo pedir` / `pagar` / `estado` | Empréstimo do casino, com juro e prazo |
| `/roubar utilizador` | Tenta roubar % da carteira de outro jogador (risco de multa) |
| `/leaderboard` | Ranking dos mais ricos do servidor |
| `/loja` | Compra VIP (Bronze/Prata/Ouro) e cosméticos |

### 📈 Progressão
| Comando | Descrição |
|---|---|
| `/perfil [utilizador]` | Cartão de perfil: nível, XP, saldo, estatísticas, conquistas |
| `/conquistas [utilizador]` | Lista de conquistas e quais já foram desbloqueadas |
| `/historico [utilizador]` | Últimas jogadas de um jogador |

Ganha-se XP por jogar (não só por ganhar), com subida de nível automática. Conquistas desbloqueiam-se sozinhas ao atingir marcos (nº de jogadas, saldo acumulado, nível, streaks de jackpot, etc). Cargos podem ser atribuídos automaticamente por nível ou por saldo via `/casino-config`.

### 🏆 Torneios
| Comando | Descrição |
|---|---|
| `/torneio` | Estado e tabela classificativa do torneio ativo |
| `/torneio-admin criar` / `terminar` | Admin: gere torneios manuais |
| `/casino-config torneio-automatico` | Admin: liga torneios semanais automáticos (dia/hora/duração configuráveis) |

### 🛠️ Administração
Requer permissão de gerir servidor (ou administrador, no caso de `/reset-saldo` e `/parar-bot`).

| Comando | Descrição |
|---|---|
| `/casino-config ver` | Mostra a configuração atual |
| `/casino-config definir campo valor` | Altera valores numéricos (apostas, trabalho, juros, roubo, empréstimos, lotaria, limiar de prémio grande...) |
| `/casino-config canal-logs` | Define o canal onde o bot regista jogadas e anuncia prémios grandes |
| `/casino-config cargo-nivel` / `cargo-saldo` | Cargos automáticos por nível ou por saldo |
| `/casino-config torneio-automatico` | Ativa/desativa torneios semanais automáticos |
| `/reset-saldo jogador` / `todos` | Reseta o saldo de um jogador ou de todo o servidor |
| `/parar-bot` | Desliga o bot em segurança |

## Instalação

1. Instala as dependências:
   ```bash
   npm install
   ```

2. Cria uma aplicação em https://discord.com/developers/applications, ativa um Bot e copia o **Token** e o **Client ID**.

3. Copia `.env.example` para `.env` e preenche:
   ```
   TOKEN=o_teu_token
   CLIENT_ID=o_teu_client_id
   GUILD_ID=id_do_servidor_de_testes   # opcional, regista comandos mais rápido
   ```

4. Convida o bot para o teu servidor com os scopes `bot` e `applications.commands`. Permissões mínimas recomendadas: `Send Messages`, `Embed Links`, `Use Slash Commands`. Para os cargos automáticos (`/casino-config cargo-nivel` / `cargo-saldo`) o bot precisa também de `Manage Roles`, e o cargo do bot tem de estar **acima** dos cargos que vai atribuir na hierarquia do servidor.

5. Regista os slash commands:
   ```bash
   npm run deploy
   ```

6. Arranca o bot:
   ```bash
   npm start
   ```

## Como funcionam os torneios

Um admin corre `/torneio-admin criar` com a duração (em horas), e opcionalmente um nome, um prémio e o canal onde o resultado deve ser anunciado. A partir daí, o bot soma automaticamente os ganhos líquidos (ganhos menos apostas) de cada jogador em **qualquer jogo** — slots, blackjack, roleta, dados, poker, mines, crash, coinflip, higher/lower, apostar e duelo — enquanto o torneio estiver ativo.

Qualquer pessoa pode consultar `/torneio` a qualquer momento para ver a tabela classificativa em tempo real. Quando o tempo acaba, o bot deteta isso automaticamente (verificação a cada 30s) e publica o pódio no canal escolhido, atribuindo o prémio ao vencedor. Um admin também pode terminar o torneio mais cedo com `/torneio-admin terminar`.

Também é possível ativar **torneios semanais automáticos** com `/casino-config torneio-automatico ativar:true`, escolhendo o dia da semana, a hora e a duração — o bot cria-os sozinho todas as semanas, sem intervenção manual.

Só pode existir um torneio ativo de cada vez por servidor.

## Como funciona a lotaria

Qualquer pessoa pode comprar bilhetes com `/lotaria comprar quantidade` (preço configurável via `/casino-config definir campo:lotteryTicketPrice`). 80% do valor de cada bilhete engorda o jackpot acumulado. O sorteio acontece automaticamente todas as semanas (dia/hora configuráveis nos campos `lotteryDrawDay`/`lotteryDrawHour`), escolhendo um vencedor com peso proporcional ao número de bilhetes comprados, e anuncia o resultado no canal de logs (ou no primeiro canal de texto disponível, se não houver canal de logs definido).

## Progressão, conquistas e cargos automáticos

Cada jogo (novo ou original) atribui XP ao jogador, mesmo quando perde — jogar tem sempre alguma recompensa, para não incentivar só o risco. Ao subir de nível, e sempre que o saldo total (carteira + banco) ultrapassa um limiar configurado, o bot atribui automaticamente os cargos definidos em `/casino-config cargo-nivel` e `/casino-config cargo-saldo`. As conquistas (`/conquistas`) desbloqueiam-se sozinhas quando as condições são cumpridas, e aparecem como notificação privada assim que acontecem.

## Logs e alertas

Define um canal com `/casino-config canal-logs` para o bot passar a registar todas as jogadas ali (jogador, jogo, aposta, resultado) e anunciar automaticamente sempre que alguém ganha um prémio igual ou superior ao limiar definido em `bigWinThreshold` (por omissão 10.000).

## Armazenamento de dados

Os dados ficam guardados em ficheiros JSON dentro de `data/` (criados automaticamente): `economy.json` (jogadores), `guilds.json` (configuração por servidor), `tournaments.json` (torneios) e `lottery.json` (lotaria). Não precisas de base de dados externa. Se quiseres migrar para MongoDB/PostgreSQL mais tarde, todo o acesso a dados passa por `utils/database.js` — só precisas de reescrever essas funções, mantendo as mesmas assinaturas.

Contas e servidores criados antes destas funcionalidades são **migrados automaticamente** na primeira vez que são acedidos (ganham os campos novos com valores por omissão, sem perder o que já tinham).

## Personalizar

- Multiplicadores e símbolos dos slots: `commands/slots.js`
- Fórmula de multiplicador do Mines: `commands/mines.js`
- Curva de crash: `commands/crash.js`
- Itens da loja: `commands/shop.js`
- Lista de conquistas: `utils/progression.js`
- Regras por servidor (apostas, trabalho, juros, roubo, empréstimos, lotaria, torneios automáticos): `/casino-config` em runtime, ou `DEFAULT_GUILD_CONFIG` em `utils/database.js`
- Cores dos embeds: `utils/embeds.js`

## Notas

- Todos os comandos têm cooldowns configuráveis para evitar abuso.
- O saldo inicial de cada novo jogador é 1000 moedas (configurável).
- O dinheiro no banco (`/banco depositar`) está protegido de `/roubar` e rende juros periódicos automaticamente.
- Este bot usa moeda virtual sem qualquer ligação a dinheiro real.
