// api/bot.js
import { Telegraf, Markup } from 'telegraf';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);           // ✅ permite require en ESM
const content = require('./content.json');                // ✅ carga JSON sin assert

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) console.error('Falta BOT_TOKEN');

const bot = new Telegraf(BOT_TOKEN);

const MENU_PRINCIPAL = Markup.keyboard([
  ['1️⃣ Planilla por facultad'],
  ['2️⃣ Fechas del proceso', '3️⃣ Reglas para votar']
]).resize();

const listaCarreras = () =>
  (content.carreras || []).map((c) => [Markup.button.callback(c.nombre, `carrera:${c.id}`)]);
const listaCarrerasInline = Markup.inlineKeyboard(listaCarreras());

// Inicio
bot.start((ctx) => {
  ctx.reply('¡Bienvenid@ al Bot Informativo de Elecciones Estudiantiles! Elige una opción 👇', MENU_PRINCIPAL);
});

// Opción 1
bot.hears(/^(1|1️⃣|Planilla)/i, async (ctx) => {
  await ctx.reply('1.1 Localiza tu carrera:', listaCarrerasInline);
  // if (content.links?.propuestas) {
  //   await ctx.reply('1.1.2 Conoce las propuestas:', Markup.inlineKeyboard([
  //     [Markup.button.url('Ver propuestas', content.links.propuestas)]
  //   ]));
  // }
});

// Opción 2
bot.hears(/^(2|2️⃣|Información de candidatos)/i, async (ctx) => {
  await ctx.reply('2.1 Localiza tu carrera:', listaCarrerasInline);
});

// Opción 3
bot.hears(/^(3|3️⃣|Fechas)/i, async (ctx) => {
  if (content.fechas_img) {
    await ctx.replyWithPhoto({ url: content.fechas_img }, { caption: 'Fechas clave del proceso electoral' });
  } else {
    await ctx.reply('Aún no se cargó la imagen de fechas.');
  }
});

// Opción 4
bot.hears(/^(4|4️⃣|Reglas)/i, async (ctx) => {
  const reglas = (content.reglas || []).map((r, i) => `${i + 1}. ${r}`).join('\n');
  await ctx.reply(`Reglas para ejercer tu voto:\n\n${reglas || 'Aún no hay reglas cargadas.'}`);
});

// Opción 5
bot.hears(/^(5|5️⃣|Link de consultas)/i, async (ctx) => {
  if (content.links?.consultas) {
    await ctx.reply(
      'Consulta más información aquí:',
      Markup.inlineKeyboard([[Markup.button.url('Página Vida Estudiantil', content.links.consultas)]])
    );
  } else {
    await ctx.reply('Aún no hay link de consultas.');
  }
});

// Submenú por carrera
bot.action(/carrera:(.+)/, async (ctx) => {
  const id = ctx.match[1];
  const carrera = (content.carreras || []).find((c) => c.id === id);
  if (!carrera) return ctx.answerCbQuery('Carrera no encontrada');

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('📄 Ver planillas (imágenes)', `planillas:${id}`)],
    [Markup.button.callback('👤 Ver candidatos', `candidatos:${id}`)],
    [Markup.button.url('🔗 Ver propuestas', carrera.propuestas_url || content.links?.propuestas || 'https://google.com')]
  ]);
  await ctx.editMessageText(`Carrera: ${carrera.nombre}\nElige una opción:`, keyboard);
});

// Planillas
bot.action(/planillas:(.+)/, async (ctx) => {
  const id = ctx.match[1];
  const carrera = (content.carreras || []).find((c) => c.id === id);
  if (!carrera) return ctx.answerCbQuery('Carrera no encontrada');

  if (!carrera.planillas_img?.length) {
    await ctx.reply(`No hay imágenes de planillas para ${carrera.nombre}.`);
  } else {
    for (const imgUrl of carrera.planillas_img) {
      try {
        await ctx.replyWithPhoto({ url: imgUrl }, { caption: `Planilla - ${carrera.nombre}` });
      } catch (e) {
        console.error('Error enviando imagen:', imgUrl, e);
        await ctx.reply(`No pude cargar una imagen (${imgUrl}).`);
      }
    }
  }
  await ctx.answerCbQuery('Planillas enviadas');
});

// Candidatos
bot.action(/candidatos:(.+)/, async (ctx) => {
  const id = ctx.match[1];
  const carrera = (content.carreras || []).find((c) => c.id === id);
  if (!carrera) return ctx.answerCbQuery('Carrera no encontrada');

  if (!carrera.candidatos?.length) {
    await ctx.reply(`No hay candidatos cargados para ${carrera.nombre} aún.`);
    return ctx.answerCbQuery();
  }

  const esc = (t) => String(t).replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
  for (const cand of carrera.candidatos) {
    const msg =
      `👤 *${esc(cand.nombre)}*\n` +
      `📘 ${esc(cand.anio)}\n` +
      `⭐ Intereses: ${esc(cand.intereses)}\n` +
      `🧩 Experiencia: ${esc(cand.experiencia)}`;
    await ctx.replyWithMarkdownV2(msg);
  }
  await ctx.answerCbQuery('Candidatos mostrados');
});

// Webhook handler
const telegrafCallback = bot.webhookCallback('/api/bot');
export default async function handler(req, res) {
  try {
    if (req.method === 'POST') return telegrafCallback(req, res);
    res.status(200).send('Bot OK');
  } catch (e) {
    console.error(e);
    res.status(200).end();
  }
}
