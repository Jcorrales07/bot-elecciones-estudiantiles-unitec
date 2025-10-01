// index.js
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');

const BOT_TOKEN = process.env.BOT_TOKEN; // setéalo en tu hosting
const bot = new Telegraf(BOT_TOKEN);

// Carga de contenido
const content = JSON.parse(fs.readFileSync('./content.json', 'utf8'));

const MENU_PRINCIPAL = Markup.keyboard([
  ['1️⃣ Planilla por carrera', '2️⃣ Información de candidatos'],
  ['3️⃣ Fechas del proceso', '4️⃣ Reglas para votar'],
  ['5️⃣ Link de consultas']
]).resize();

bot.start((ctx) => {
  ctx.reply(
    '¡Bienvenido/a al Bot de Elecciones Estudiantiles! Elige una opción 👇',
    MENU_PRINCIPAL
  );
});

bot.hears(/^(1|1️⃣|Planilla)/i, async (ctx) => {
  const lista = content.carreras.map(c => c.nombre);
  await ctx.reply('1.1 Localiza tu carrera:', Markup.keyboard(
    chunk(lista, 2).concat([['⬅️ Volver']])
  ).resize());
  ctx.session = ctx.session || {};
  ctx.session.flow = 'planillas';
});

bot.hears(/^(2|2️⃣|candidato)/i, async (ctx) => {
  const lista = content.carreras.map(c => c.nombre);
  await ctx.reply('2.1 Localiza tu carrera:', Markup.keyboard(
    chunk(lista, 2).concat([['⬅️ Volver']])
  ).resize());
  ctx.session = ctx.session || {};
  ctx.session.flow = 'candidatos';
});

bot.hears(/^(3|3️⃣|Fecha)/i, async (ctx) => {
  const f = content.fechas_proceso;
  if (f.imagen_url) await ctx.replyWithPhoto(f.imagen_url, { caption: f.descripcion || 'Fechas del proceso' });
  else await ctx.reply(f.descripcion || 'Fechas del proceso');
});

bot.hears(/^(4|4️⃣|Regla)/i, async (ctx) => {
  const r = content.reglas;
  if (r.imagen_url) await ctx.replyWithPhoto(r.imagen_url, { caption: 'Reglas para ejercer tu voto' });
  if (r.texto?.length) await ctx.reply('Reglas:\n• ' + r.texto.join('\n• '));
});

bot.hears(/^(5|5️⃣|Link)/i, async (ctx) => {
  await ctx.reply(`Más información: ${content.consultas_link}`);
});

// Manejo de selección de carrera
bot.hears(/⬅️ Volver/i, (ctx) => ctx.reply('Menú principal:', MENU_PRINCIPAL));

bot.on('text', async (ctx) => {
  const choice = ctx.message.text?.trim();
  const carrera = content.carreras.find(c => c.nombre.toLowerCase() === choice?.toLowerCase());
  if (!carrera) return; // deja pasar otros textos

  ctx.session = ctx.session || {};
  if (ctx.session.flow === 'planillas') {
    // 1.1.1 Enlistar planillas con imagen + 1.1.2 Propuestas
    if (!carrera.planillas?.length) {
      return ctx.reply('Esta carrera no tiene planillas registradas.');
    }
    for (const p of carrera.planillas) {
      if (p.imagen_url) {
        await ctx.replyWithPhoto(p.imagen_url, { caption: `Planilla: ${p.nombre}` });
      } else {
        await ctx.reply(`Planilla: ${p.nombre}`);
      }
      if (p.propuestas_url) {
        await ctx.reply(`Conoce las propuestas: ${p.propuestas_url}`);
      } else if (content.propuestas_plataforma_url) {
        await ctx.reply(`Conoce las propuestas: ${content.propuestas_plataforma_url}`);
      }
    }
    await ctx.reply('¿Necesitas ver otra carrera o regresar?', Markup.keyboard(
      chunk(content.carreras.map(c => c.nombre), 2).concat([['⬅️ Volver']])
    ).resize());
  } else if (ctx.session.flow === 'candidatos') {
    // 2.1.1 Enlistar candidatos con datos
    if (!carrera.candidatos?.length) {
      return ctx.reply('Esta carrera no tiene candidatos registrados.');
    }
    for (const cand of carrera.candidatos) {
      const msg = [
        `👤 *${cand.nombre}*`,
        cand.anio_carrera ? `📚 ${cand.anio_carrera}` : null,
        cand.intereses ? `🎯 Intereses: ${cand.intereses}` : null,
        cand.experiencias ? `💼 Experiencias: ${cand.experiencias}` : null
      ].filter(Boolean).join('\n');
      await ctx.replyWithMarkdownV2(escapeMd(msg));
    }
    await ctx.reply('¿Ver otra carrera o regresar?', Markup.keyboard(
      chunk(content.carreras.map(c => c.nombre), 2).concat([['⬅️ Volver']])
    ).resize());
  } else {
    // Si no hay flow activo, muestra menú
    await ctx.reply('Elige una opción:', MENU_PRINCIPAL);
  }
});

// Utilidades
function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function escapeMd(text) {
  // Escapa MarkdownV2 de Telegram
  return String(text).replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

bot.launch().then(() => console.log('Bot listo.'));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

module.exports = bot;