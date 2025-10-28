// api/bot.js
import { Telegraf, Markup } from 'telegraf';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const content = require('./content.json');

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) console.error('⚠️ Falta BOT_TOKEN');

const bot = new Telegraf(BOT_TOKEN);

// === MENÚ PRINCIPAL ===
const MENU_PRINCIPAL = Markup.keyboard([
  ['1️⃣ Ver planillas por carrera'],
  ['2️⃣ Fechas del proceso'],
  ['3️⃣ Reglas para votar']
]).resize();

// === MENÚ DE FACULTADES (en filas de 2 para mejor vista) ===
// === MENÚ DE FACULTADES (una por fila) ===
const listaFacultades = () => {
  const filas = [];
  const facs = content.facultades || [];

  // Cada facultad en su propia fila
  for (let i = 0; i < facs.length; i++) {
    filas.push([Markup.button.callback(facs[i].nombre, `facultad:${facs[i].id}`)]);
  }

  // Botón volver al final
  filas.push([Markup.button.callback('⬅️ Volver al menú principal', 'volver:menu')]);

  return Markup.inlineKeyboard(filas);
};


// === /start ===
bot.start((ctx) => {
  ctx.reply(
    '👋 ¡Bienvenid@ al Bot Informativo de Elecciones Estudiantiles!\n\nElige una opción:',
    MENU_PRINCIPAL
  );
});

// === OPCIÓN 1: VER PLANILLAS POR CARRERA ===
bot.hears(/^(1|1️⃣|Ver planillas)/i, async (ctx) => {
  await ctx.reply('🎓 Localiza tu facultad:', listaFacultades());
});

// === OPCIÓN 2: FECHAS DEL PROCESO ===
bot.hears(/^(2|2️⃣|Fechas)/i, async (ctx) => {
  const fechas = content.fechas;
  if (!fechas) {
    await ctx.reply('Aún no se han cargado las fechas del proceso.');
    return;
  }

  let mensaje = '🗓️ *Fechas del proceso electoral:*\n\n';
  for (const [nombre, valor] of Object.entries(fechas)) {
    mensaje += `• *${nombre}:* ${valor}\n`;
  }

  await ctx.replyWithMarkdown(mensaje);
});

// === OPCIÓN 3: REGLAS PARA VOTAR ===
bot.hears(/^(3|3️⃣|Reglas)/i, async (ctx) => {
  const reglas = content.reglas;
  if (!reglas) {
    await ctx.reply('Aún no hay reglas cargadas.');
    return;
  }

  const requisitos = (reglas['Requisitos'] || []).map((r) => `- ${r}`).join('\n');
  const pierdeDerecho = (reglas['Pierde derecho de votar si'] || []).map((r) => `- ${r}`).join('\n');

  const mensaje = `📋 *Reglas para votar*\n\n` +
    `✅ *Requisitos:*\n${requisitos || 'No especificado'}\n\n` +
    `🚫 *Pierde el derecho a votar si:*\n${pierdeDerecho || 'No especificado'}`;

  await ctx.replyWithMarkdown(mensaje);
});

// === FACULTAD SELECCIONADA ===
bot.action(/facultad:(.+)/, async (ctx) => {
  const id = ctx.match[1];
  const facultad = (content.facultades || []).find((f) => f.id === id);
  if (!facultad) return ctx.answerCbQuery('Facultad no encontrada.');

  const planillas = facultad.planillas || [];
  if (planillas.length === 0) {
    await ctx.reply(`No hay planillas registradas para ${facultad.nombre}.`);
    return ctx.answerCbQuery();
  }

  const botonesPlanillas = [];
  for (let i = 0; i < planillas.length; i += 2) {
    const fila = [];
    fila.push(Markup.button.callback(planillas[i].nombre, `planilla:${id}:${planillas[i].nombre}`));
    if (planillas[i + 1]) fila.push(Markup.button.callback(planillas[i + 1].nombre, `planilla:${id}:${planillas[i + 1].nombre}`));
    botonesPlanillas.push(fila);
  }

  // Agregar botón para volver a la lista de facultades
  botonesPlanillas.push([Markup.button.callback('⬅️ Volver a facultades', 'volver:facultades')]);

  const keyboard = Markup.inlineKeyboard(botonesPlanillas);
  await ctx.editMessageText(`📚 *${facultad.nombre}*\nSelecciona una planilla:`, {
    parse_mode: 'Markdown',
    ...keyboard,
  });
});

// === PLANILLA SELECCIONADA ===
bot.action(/planilla:(.+):(.+)/, async (ctx) => {
  const [idFacultad, nombrePlanilla] = ctx.match.slice(1);
  const facultad = (content.facultades || []).find((f) => f.id === idFacultad);
  if (!facultad) return ctx.answerCbQuery('Facultad no encontrada.');

  const planilla = facultad.planillas.find((p) => p.nombre === nombrePlanilla);
  if (!planilla) return ctx.answerCbQuery('Planilla no encontrada.');

  const texto =
    `🗳️ *${planilla.nombre}*\n` +
    `🏫 *Carrera:* ${planilla.carrera}\n\n` +
    `👥 *Candidatos:* ${planilla.candidatos?.length || 0}`;

  await ctx.replyWithMarkdown(texto);
  await ctx.answerCbQuery(`Mostrando planilla ${nombrePlanilla}`);
});

// === VOLVER A FACULTADES ===
bot.action('volver:facultades', async (ctx) => {
  await ctx.editMessageText('🎓 Localiza tu facultad:', listaFacultades());
  await ctx.answerCbQuery();
});

// === VOLVER AL MENÚ PRINCIPAL ===
bot.action('volver:menu', async (ctx) => {
  await ctx.editMessageText('👋 Volviste al menú principal.');
  await ctx.reply('Elige una opción:', MENU_PRINCIPAL);
  await ctx.answerCbQuery();
});

// === WEBHOOK HANDLER ===
const telegrafCallback = bot.webhookCallback('/api/bot');
export default async function handler(req, res) {
  try {
    if (req.method === 'POST') return telegrafCallback(req, res);
    res.status(200).send('Bot OK');
  } catch (e) {
    console.error('Error en handler:', e);
    res.status(500).end();
  }
}
