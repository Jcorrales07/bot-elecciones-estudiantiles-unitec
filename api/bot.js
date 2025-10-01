// api/bot.js
import { Telegraf, Markup } from 'telegraf';
import fs from 'fs';

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) console.error('Falta BOT_TOKEN');

const content = JSON.parse(fs.readFileSync('../content.json', 'utf8'));
const bot = new Telegraf(BOT_TOKEN);

const MENU_PRINCIPAL = Markup.keyboard([
  ['1️⃣ Planilla por carrera', '2️⃣ Información de candidatos'],
  ['3️⃣ Fechas del proceso', '4️⃣ Reglas para votar'],
  ['5️⃣ Link de consultas']
]).resize();

const listaCarreras = () =>
  content.carreras.map((c) => [Markup.button.callback(c.nombre, `carrera:${c.id}`)]);
const listaCarrerasInline = Markup.inlineKeyboard(listaCarreras());

// Inicio
bot.start((ctx) => {
  ctx.reply('¡Bienvenido/a al Bot de Elecciones Estudiantiles! Elige una opción 👇', MENU_PRINCIPAL);
});

// Opción 1
bot.hears(/^(1|1️⃣|Planilla)/i, async (ctx) => {
  await ctx.reply('1.1 Localiza tu carrera:', listaCarrerasInline);
  await ctx.reply('1.1.2 Conoce las propuestas:', Markup.inlineKeyboard([
    [Markup.button.url('Ver propuestas', content.links.propuestas)]
  ]));
});

// Opción 2
bot.hears(/^(2|2️⃣|Información de candidatos)/i, async (ctx) => {
  await ctx.reply('2.1 Localiza tu carrera:', listaCarrerasInline);
});

// Opción 3 (fechas: imagen en la nube)
bot.hears(/^(3|3️⃣|Fechas)/i, async (ctx) => {
  await ctx.replyWithPhoto({ url: content.fechas_img }, { caption: 'Fechas clave del proceso electoral' });
});

// Opción 4 (reglas)
bot.hears(/^(4|4️⃣|Reglas)/i, async (ctx) => {
  const reglas = content.reglas.map((r, i) => `${i + 1}. ${r}`).join('\n');
  await ctx.reply(`Reglas para ejercer tu voto:\n\n${reglas}`);
});

// Opción 5 (link consultas)
bot.hears(/^(5|5️⃣|Link de consultas)/i, async (ctx) => {
  await ctx.reply(
    'Consulta más información aquí:',
    Markup.inlineKeyboard([[Markup.button.url('Página Vida Estudiantil', content.links.consultas)]])
  );
});

// Submenú por carrera
bot.action(/carrera:(.+)/, async (ctx) => {
  const id = ctx.match[1];
  const carrera = content.carreras.find((c) => c.id === id);
  if (!carrera) return ctx.answerCbQuery('Carrera no encontrada');

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('📄 Ver planillas (imágenes)', `planillas:${id}`)],
    [Markup.button.callback('👤 Ver candidatos', `candidatos:${id}`)],
    [Markup.button.url('🔗 Ver propuestas', carrera.propuestas_url || content.links.propuestas)]
  ]);

  await ctx.editMessageText(`Carrera: ${carrera.nombre}\nElige una opción:`, keyboard);
});

// Planillas: enviar todas las URLs
bot.action(/planillas:(.+)/, async (ctx) => {
  const id = ctx.match[1];
  const carrera = content.carreras.find((c) => c.id === id);
  if (!carrera) return ctx.answerCbQuery('Carrera no encontrada');

  for (const imgUrl of carrera.planillas_img) {
    await ctx.replyWithPhoto({ url: imgUrl }, { caption: `Planilla - ${carrera.nombre}` });
  }
  await ctx.answerCbQuery('Planillas enviadas');
});

// Candidatos (texto)
bot.action(/candidatos:(.+)/, async (ctx) => {
  const id = ctx.match[1];
  const carrera = content.carreras.find((c) => c.id === id);
  if (!carrera) return ctx.answerCbQuery('Carrera no encontrada');

  if (!carrera.candidatos?.length) {
    await ctx.reply(`No hay candidatos cargados para ${carrera.nombre} aún.`);
    return ctx.answerCbQuery();
  }

  for (const cand of carrera.candidatos) {
    const msg =
      `👤 *${escapeMD(cand.nombre)}*\n` +
      `📘 ${escapeMD(cand.anio)}\n` +
      `⭐ Intereses: ${escapeMD(cand.intereses)}\n` +
      `🧩 Experiencia: ${escapeMD(cand.experiencia)}`;
    await ctx.replyWithMarkdownV2(msg);
  }
  await ctx.answerCbQuery('Candidatos mostrados');
});

function escapeMD(text) {
  return String(text).replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

// Handler Serverless Vercel
export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      await bot.handleUpdate(req.body);
      return res.status(200).end();
    } catch (e) {
      console.error(e);
      return res.status(200).end();
    }
  }
  res.status(200).send('Bot OK');
}
