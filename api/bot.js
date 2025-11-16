// api/bot.js
import { Telegraf, Markup } from 'telegraf';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const content = require('./content.json');

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) console.error('⚠️ Falta BOT_TOKEN');

const bot = new Telegraf(BOT_TOKEN);

// tracking de usuarios para sacar estadisticas
import axios from "axios";

const SHEETDB_USERS = "https://sheetdb.io/api/v1/hf1bioefj9483";  // <= CAMBIA ESTO
const SHEETDB_EVENTS = "https://sheetdb.io/api/v1/1vg3wy8gzp0nh"; // <= CAMBIA ESTO

function formatTimestamp() {
  const d = new Date();
  const pad = (n) => (n < 10 ? "0" + n : n);

  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();

  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());

  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

// 💾 Guardar o actualizar usuario
async function upsertUser(ctx) {
  if (!ctx.from || !ctx.chat) return;

  const u = ctx.from;
  const ts = formatTimestamp();

  try {
    // Intentar actualizar si existe
    await axios.patch(`${SHEETDB_USERS}/user_id/${u.id}`, {
      data: {
        username: u.username || "",
        first_name: u.first_name || "",
        chat_id: ctx.chat.id,
        last_seen: ts
      }
    });
  } catch (err) {
    // Si no existe, insertar nuevo
    if (err.response && err.response.status === 404) {
      await axios.post(SHEETDB_USERS, {
        data: [
          {
            user_id: u.id,
            username: u.username || "",
            first_name: u.first_name || "",
            chat_id: ctx.chat.id,
            last_seen: ts
          }
        ]
      });
    } else {
      console.error("Error upsertUser:", err.message);
    }
  }
}

// 💾 Guardar evento
async function logEvent(ctx) {
  const u = ctx.from;
  const chat = ctx.chat;
  const ts = Math.floor(Date.now() / 1000);

  if (!u || !chat) return;

  const text =
    (ctx.message && ctx.message.text) ||
    (ctx.callbackQuery && ctx.callbackQuery.data) ||
    "";

  await axios.post(SHEETDB_EVENTS, {
    data: [
      {
        user_id: u.id,
        update_type: ctx.updateType,
        text,
        chat_id: chat.id,
        ts
      }
    ]
  });
}

// === MIDDLEWARE GLOBAL ===
bot.use(async (ctx, next) => {
  try {
    await upsertUser(ctx);
    await logEvent(ctx);
  } catch (err) {
    console.error("Error logging:", err.message);
  }
  return next();
});


function escapeMarkdownV2(text) {
  return text
    .replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&'); // escapado de caracteres especiales
}

// === MENÚ PRINCIPAL ===
const MENU_PRINCIPAL = Markup.keyboard([
  ['1️⃣ Ver planillas por carrera'],
  ['2️⃣ Fechas del proceso'],
  ['3️⃣ Reglas para votar'],
  ['ℹ️ Desarrollador del Chatbot']
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

// === NUEVA OPCIÓN: DESARROLLADOR DEL CHATBOT CON IMAGEN ===
bot.hears(/^(ℹ️|Desarrollador del Chatbot)/i, async (ctx) => {
    // 1. URL de la imagen que quieres usar
    const URL_IMAGEN_INFO = 'https://res.cloudinary.com/dt6rtc4ve/image/upload/v1763006049/Imagen_de_WhatsApp_2025-11-12_a_las_21.53.37_7b811375_iygwyv.jpg'; 
    // Asegúrate de que esta URL sea pública y accesible para Telegram.

    // 2. Definición del mensaje (Caption de la foto)
    const infoDesarrollador = `🤖 *Desarrollado y Mantenido por:*\n\n` +
        `*Joe Corrales*\n\n` +
        `📞 *Contacto para Soporte y Retroalimentación:*\n\n` +
        `Si encuentras algún error (bug), tienes sugerencias de mejora o necesitas reportar información incorrecta, por favor escríbe directamente.\n\n` +
        `➡️ *Telegram:* @jcorrales07\n\n` + 
        `_Gracias por ayudarnos a mejorar el proceso electoral._\n` +
        `*Versión:* 1.0.0`;

    // 3. Envío de la foto con el mensaje como caption
    try {
        await ctx.replyWithPhoto(
            { url: URL_IMAGEN_INFO },
            { 
                caption: infoDesarrollador, 
                parse_mode: 'Markdown' 
            }
        );
    } catch (error) {
        // En caso de que la URL de la imagen falle, se envía solo el texto como respaldo.
        console.error('Error al enviar la foto del desarrollador:', error);
        await ctx.replyWithMarkdown(`⚠️ No se pudo cargar la imagen.\n\n${infoDesarrollador}`);
    }
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

  // Encabezado general
  const encabezado =
    `🗳️ *${planilla.nombre}*\n` +
    `🏫 *Carrera:* ${planilla.carrera}\n` +
    `👥 *Cantidad de candidatos:* ${planilla.candidatos?.length || 0}\n\n` +
    `A continuación los integrantes de la planilla:\n`;

  await ctx.replyWithMarkdown(encabezado);

  // Mostrar cada candidato individualmente
  // Mostrar cada candidato individualmente
  if (planilla.candidatos && planilla.candidatos.length > 0) {
    for (const cand of planilla.candidatos) {
      const encabezado = `👤 *${cand.puesto}:* ${cand.nombre}\n📘 *Año académico:* ${cand.anio}\n`;

      let detalles = "";

      if (cand.experiencia?.length) {
        detalles += `\n🎓 *Experiencia académica:*\n`;
        for (const exp of cand.experiencia) detalles += `• ${exp}\n`;
      }

      if (cand.propuestas?.length) {
        detalles += `\n💡 *Principales propuestas:*\n`;
        for (const prop of cand.propuestas) detalles += `• ${prop}\n`;
      }

      if (cand.hobbies?.length) {
        detalles += `\n🎨 *Hobbies:*\n${cand.hobbies.join(', ')}\n`;
      }

      try {
        if (cand.foto) {
          // Enviar la foto con un caption corto (máximo 1024 caracteres)
          await ctx.replyWithPhoto(
            { url: cand.foto },
            { caption: encabezado, parse_mode: 'Markdown' }
          );

          // Enviar el resto del texto en un mensaje separado
          if (detalles.trim().length > 0) {
            await ctx.replyWithMarkdown(detalles);
          }
        } else {
          // Si no hay foto, envía todo en un solo mensaje
          await ctx.replyWithMarkdown(encabezado + detalles);
        }

        // Pequeña pausa para evitar límite de velocidad de Telegram
        await new Promise(res => setTimeout(res, 400));

      } catch (err) {
        console.error(`❌ Error enviando candidato ${cand.nombre}:`, err.response?.description || err.message);
        await ctx.replyWithMarkdown(`⚠️ No se pudo mostrar la foto de *${cand.nombre}*`);
      }
    }
  } else {
    await ctx.reply('No hay candidatos registrados para esta planilla.');
  }

  // Botón volver al final
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('⬅️ Volver a planillas', `facultad:${idFacultad}`)],
  ]);

  await ctx.reply('Selecciona otra planilla o regresa al menú:', keyboard);
  await ctx.answerCbQuery();
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
