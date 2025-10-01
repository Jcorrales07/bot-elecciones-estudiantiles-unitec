// bot/index.js
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
if (!process.env.BOT_TOKEN) throw new Error('Falta BOT_TOKEN');

function loadContent() {
  // Lee una sola vez y cachea en caliente
  if (!globalThis._content) {
    globalThis._content = JSON.parse(fs.readFileSync('./content.json', 'utf8'));
  }
  return globalThis._content;
}

function escapeMdV2(text) {
  return String(text).replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function carrerasKeyboard(prefix, carreras) {
  const rows = chunk(
    carreras.map(c => Markup.button.callback(c.nombre, `${prefix}:${c.id}`)),
    2
  );
  rows.push([Markup.button.callback('⬅️ Menú principal', 'menu:root')]);
  return Markup.inlineKeyboard(rows);
}

function mainMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('1️⃣ Planilla por carrera', 'menu:planillas')],
    [Markup.button.callback('2️⃣ Información de candidatos', 'menu:candidatos')],
    [Markup.button.callback('3️⃣ Fechas del proceso', 'menu:fechas')],
    [Markup.button.callback('4️⃣ Reglas para votar', 'menu:reglas')],
    [Markup.button.callback('5️⃣ Link de consultas', 'menu:consultas')]
  ]);
}

function getBot() {
  if (globalThis._bot) return globalThis._bot;

  const bot = new Telegraf(process.env.BOT_TOKEN, { handlerTimeout: 30_000 });
  const content = loadContent();

  // ---- /start y texto libre -> mostrar menú
  bot.start(ctx => ctx.reply(
    '¡Bienvenido/a al Bot de Elecciones Estudiantiles! Elige una opción 👇',
    mainMenuKeyboard()
  ));
  bot.on('message', ctx => ctx.reply('Elige una opción 👇', mainMenuKeyboard()));

  // ---- Menú principal
  bot.action('menu:root', ctx => {
    ctx.answerCbQuery().catch(()=>{});
    return ctx.editMessageText('Menú principal 👇', mainMenuKeyboard()).catch(async () => {
      // Si no se puede editar (mensaje antiguo), envía uno nuevo
      await ctx.reply('Menú principal 👇', mainMenuKeyboard());
    });
  });

  // ---- Opción 1: Planillas -> listar carreras
  bot.action('menu:planillas', async ctx => {
    await ctx.answerCbQuery().catch(()=>{});
    const kb = carrerasKeyboard('planillas', content.carreras);
    return ctx.editMessageText('1.1 Localiza tu carrera:', kb).catch(async () => {
      await ctx.reply('1.1 Localiza tu carrera:', kb);
    });
  });

  // ---- Opción 2: Candidatos -> listar carreras
  bot.action('menu:candidatos', async ctx => {
    await ctx.answerCbQuery().catch(()=>{});
    const kb = carrerasKeyboard('candidatos', content.carreras);
    return ctx.editMessageText('2.1 Localiza tu carrera:', kb).catch(async () => {
      await ctx.reply('2.1 Localiza tu carrera:', kb);
    });
  });

  // ---- Selección de carrera para planillas
  bot.action(/^planillas:(.+)$/, async ctx => {
    await ctx.answerCbQuery().catch(()=>{});
    const id = ctx.match[1];
    const carrera = content.carreras.find(c => c.id === id);
    if (!carrera) return ctx.reply('Carrera no encontrada.');

    if (!carrera.planillas?.length) {
      await ctx.reply('Esta carrera no tiene planillas registradas.');
    } else {
      for (const p of carrera.planillas) {
        if (p.imagen_url) {
          await ctx.replyWithPhoto(p.imagen_url, { caption: `Planilla: ${p.nombre}` });
        } else {
          await ctx.reply(`Planilla: ${p.nombre}`);
        }
        const url = p.propuestas_url || content.propuestas_plataforma_url;
        if (url) await ctx.reply(`Conoce las propuestas: ${url}`);
      }
    }
    return ctx.reply('¿Ver otra carrera o volver al menú?', carrerasKeyboard('planillas', content.carreras));
  });

  // ---- Selección de carrera para candidatos
  bot.action(/^candidatos:(.+)$/, async ctx => {
    await ctx.answerCbQuery().catch(()=>{});
    const id = ctx.match[1];
    const carrera = content.carreras.find(c => c.id === id);
    if (!carrera) return ctx.reply('Carrera no encontrada.');

    if (!carrera.candidatos?.length) {
      await ctx.reply('Esta carrera no tiene candidatos registrados.');
    } else {
      for (const cand of carrera.candidatos) {
        const msg = [
          `👤 *${escapeMdV2(cand.nombre)}*`,
          cand.anio_carrera && `📚 ${escapeMdV2(cand.anio_carrera)}`,
          cand.intereses && `🎯 Intereses: ${escapeMdV2(cand.intereses)}`,
          cand.experiencias && `💼 Experiencias: ${escapeMdV2(cand.experiencias)}`
        ].filter(Boolean).join('\n');
        await ctx.replyWithMarkdownV2(msg);
      }
    }
    return ctx.reply('¿Ver otra carrera o volver al menú?', carrerasKeyboard('candidatos', content.carreras));
  });

  // ---- Opción 3: Fechas (imagen o texto)
  bot.action('menu:fechas', async ctx => {
    await ctx.answerCbQuery().catch(()=>{});
    const f = content.fechas_proceso || {};
    if (f.imagen_url) {
      await ctx.replyWithPhoto(f.imagen_url, { caption: f.descripcion || 'Fechas del proceso' });
    } else {
      await ctx.reply(f.descripcion || 'Fechas del proceso');
    }
    return ctx.reply('⬅️ Menú principal', mainMenuKeyboard());
  });

  // ---- Opción 4: Reglas (imagen y/o texto)
  bot.action('menu:reglas', async ctx => {
    await ctx.answerCbQuery().catch(()=>{});
    const r = content.reglas || {};
    if (r.imagen_url) await ctx.replyWithPhoto(r.imagen_url, { caption: 'Reglas para ejercer tu voto' });
    if (Array.isArray(r.texto) && r.texto.length) {
      await ctx.reply('Reglas:\n• ' + r.texto.join('\n• '));
    }
    return ctx.reply('⬅️ Menú principal', mainMenuKeyboard());
  });

  // ---- Opción 5: Link de consultas
  bot.action('menu:consultas', async ctx => {
    await ctx.answerCbQuery().catch(()=>{});
    const url = content.consultas_link || 'https://vida-estudiantil/';
    await ctx.reply(`Más información: ${url}`);
    return ctx.reply('⬅️ Menú principal', mainMenuKeyboard());
  });

  globalThis._bot = bot;
  return bot;
}

module.exports = getBot();
