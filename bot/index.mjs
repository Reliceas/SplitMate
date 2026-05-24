import process from "node:process";
import { Telegraf, Markup } from "telegraf";
import dotenv from "dotenv";

dotenv.config();

const token = process.env.BOT_TOKEN;
const miniAppUrl = normalizeUrl(process.env.MINI_APP_URL || "http://localhost:3000");
const supportUsername = process.env.SUPPORT_USERNAME || "";
const botUsername = process.env.BOT_USERNAME || "";
const isLocalMiniApp = miniAppUrl.startsWith("http://localhost") || miniAppUrl.startsWith("http://127.0.0.1");
const chatEvents = new Map();

if (!token) {
  console.error("BOT_TOKEN is missing. Create .env and add BOT_TOKEN from @BotFather.");
  process.exit(1);
}

const bot = new Telegraf(token);

bot.telegram.setMyCommands([
  { command: "start", description: "Главное меню SplitMate" },
  { command: "app", description: "Открыть Mini App" },
  { command: "new", description: "Создать расчёт: /new Поездка в Алматы" },
  { command: "people", description: "Добавить участников: /people Амир, Али, Даник" },
  { command: "add", description: "Добавить расход: /add 12000 Амир такси" },
  { command: "expenses", description: "Показать расходы" },
  { command: "balance", description: "Посчитать баланс" },
  { command: "split", description: "Быстро разделить сумму: /split 12000 3 такси" },
  { command: "group", description: "Как использовать в групповом чате" },
  { command: "summary", description: "Пример итогового расчёта" },
  { command: "reset", description: "Сбросить текущий расчёт" },
  { command: "help", description: "Помощь" },
]);

bot.start(async (ctx) => {
  const name = ctx.from?.first_name || "друг";
  await ctx.reply(startText(name), mainKeyboard());
});

bot.help(async (ctx) => {
  await ctx.reply(helpText(), mainKeyboard());
});

bot.command("app", async (ctx) => {
  await ctx.reply(appText(), appKeyboard());
});

bot.command("group", async (ctx) => {
  await ctx.reply(groupText(), groupKeyboard());
});

bot.command("summary", async (ctx) => {
  await ctx.reply(demoSummary(), mainKeyboard());
});

bot.command("split", async (ctx) => {
  const result = parseSplitCommand(ctx.message.text);

  if (!result.ok) {
    await ctx.reply(splitHelpText(), splitKeyboard());
    return;
  }

  await ctx.reply(formatQuickSplit(result), splitKeyboard());
});

bot.command("new", async (ctx) => {
  const title = commandPayload(ctx.message.text) || "Общий расчёт";
  const event = createEvent(title);
  chatEvents.set(chatKey(ctx), event);
  await ctx.reply(formatEventCreated(event), eventKeyboard());
});

bot.command("people", async (ctx) => {
  const event = getEvent(ctx);
  const names = parseParticipants(commandPayload(ctx.message.text));

  if (names.length === 0) {
    await ctx.reply(peopleHelpText(), eventKeyboard());
    return;
  }

  event.participants = mergeParticipants(event.participants, names);
  await ctx.reply(formatParticipants(event), eventKeyboard());
});

bot.command("add", async (ctx) => {
  const event = getEvent(ctx);
  const result = parseAddCommand(commandPayload(ctx.message.text), event);

  if (!result.ok) {
    await ctx.reply(result.message, eventKeyboard());
    return;
  }

  event.expenses.push(result.expense);
  await ctx.reply(formatExpenseAdded(event, result.expense), balanceKeyboard());
});

bot.command("expenses", async (ctx) => {
  await ctx.reply(formatExpenses(getEvent(ctx)), eventKeyboard());
});

bot.command("balance", async (ctx) => {
  await ctx.reply(formatBalance(getEvent(ctx)), balanceKeyboard());
});

bot.command("reset", async (ctx) => {
  chatEvents.delete(chatKey(ctx));
  await ctx.reply("Текущий расчёт сброшен. Начни заново: /new Поездка в Алматы", eventKeyboard());
});

bot.action("how_it_works", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(howItWorksText(), mainKeyboard());
});

bot.action("demo_summary", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(demoSummary(), mainKeyboard());
});

bot.action("quick_split_help", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(splitHelpText(), splitKeyboard());
});

bot.action("group_help", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(groupText(), groupKeyboard());
});

bot.action("event_help", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(eventHelpText(), eventKeyboard());
});

bot.action("current_balance", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(formatBalance(getEvent(ctx)), balanceKeyboard());
});

bot.on("text", async (ctx) => {
  if (looksLikeAmount(ctx.message.text)) {
    await ctx.reply(
      [
        "Похоже, ты хочешь быстро разделить сумму.",
        "",
        "Если это простой расчёт, напиши так:",
        "/split 12000 3 такси",
        "",
        "Если ведёшь событие с участниками:",
        "/add 12000 Амир такси",
        "",
        "И я посчитаю долю каждого.",
      ].join("\n"),
      splitKeyboard(),
    );
    return;
  }

  await ctx.reply(
    [
      "Я помогу разделить расходы без Excel и споров.",
      "",
      "Попробуй:",
      "• /new Поездка в Алматы — создать расчёт",
      "• /people Амир, Али, Даник — добавить участников",
      "• /add 12000 Амир такси — добавить расход",
      "• /balance — показать кто кому должен",
      "• /app — открыть полноценное приложение",
      "• /split 12000 3 такси — быстрый расчёт",
    ].join("\n"),
    mainKeyboard(),
  );
});

bot.catch((error, ctx) => {
  console.error(`Bot error for update ${ctx.update.update_id}:`, error);
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

bot.launch().then(() => {
  console.log("SplitMate bot is running.");
  console.log(`Mini App URL: ${miniAppUrl}`);

  if (isLocalMiniApp) {
    console.log("Warning: Telegram Mini Apps require HTTPS in production. localhost is only for local development.");
  }

  if (supportUsername) {
    console.log(`Support: ${supportUsername}`);
  }
});

function mainKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.webApp("Открыть SplitMate", miniAppUrl)],
    [
      Markup.button.callback("Учёт в чате", "event_help"),
      Markup.button.callback("Баланс", "current_balance"),
    ],
    [
      Markup.button.callback("Быстрый расчёт", "quick_split_help"),
      Markup.button.callback("Для группы", "group_help"),
    ],
    [Markup.button.callback("Как работает", "how_it_works")],
    [Markup.button.callback("Пример итога", "demo_summary")],
  ]);
}

function appKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.webApp("Открыть SplitMate", miniAppUrl)],
    [Markup.button.callback("Как использовать", "how_it_works")],
  ]);
}

function splitKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.webApp("Открыть полный расчёт", miniAppUrl)],
    [
      Markup.button.callback("Учёт в чате", "event_help"),
      Markup.button.callback("Пример итога", "demo_summary"),
    ],
  ]);
}

function eventKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("Баланс", "current_balance"),
      Markup.button.callback("Быстрый расчёт", "quick_split_help"),
    ],
    [Markup.button.webApp("Открыть Mini App", miniAppUrl)],
  ]);
}

function balanceKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Показать баланс", "current_balance")],
    [Markup.button.webApp("Открыть Mini App", miniAppUrl)],
  ]);
}

function groupKeyboard() {
  const rows = [[Markup.button.webApp("Открыть SplitMate", miniAppUrl)]];

  if (botUsername) {
    rows.unshift([Markup.button.url("Добавить бота в группу", `https://t.me/${botUsername}?startgroup=true`)]);
  }

  return Markup.inlineKeyboard(rows);
}

function startText(name) {
  return [
    `Привет, ${name}! Я SplitMate.`,
    "",
    "Я помогаю делить общие расходы в поездках, кафе, на подарках и тусовках.",
    "",
    "Главные режимы:",
    "• Mini App — полноценный расчёт с участниками и расходами",
    "• Chat mode — /new, /people, /add, /balance прямо в Telegram",
    "• Быстрый расчёт — команда /split прямо в чате",
    "• Group mode — удобно для компаний друзей",
    "",
    isLocalMiniApp
      ? "Сейчас Mini App URL локальный. Для Telegram нужен HTTPS-деплой."
      : "Нажми кнопку ниже, чтобы открыть приложение.",
  ].join("\n");
}

function appText() {
  return [
    "Открывай SplitMate Mini App.",
    "",
    "Там можно создать событие, добавить участников, внести расходы и получить минимальные переводы.",
    "",
    isLocalMiniApp
      ? "Важно: localhost не откроется внутри Telegram у других пользователей. Для продакшена нужен HTTPS URL."
      : "Готово к открытию внутри Telegram.",
  ].join("\n");
}

function helpText() {
  return [
    "Команды SplitMate:",
    "",
    "/start — главное меню",
    "/app — открыть Mini App",
    "/new Поездка в Алматы — создать расчёт",
    "/people Амир, Али, Даник — добавить участников",
    "/add 12000 Амир такси — добавить расход",
    "/expenses — список расходов",
    "/balance — баланс и переводы",
    "/split 12000 3 такси — быстро разделить сумму",
    "/group — как использовать в группе",
    "/summary — пример итогового расчёта",
    "/reset — сбросить текущий расчёт",
    "/help — помощь",
    "",
    "Мини-сценарий:",
    "/new Поездка",
    "/people Амир, Али, Даник",
    "/add 12000 Амир такси",
    "/balance",
    "",
    "Формат быстрого расчёта:",
    "/split <сумма> <кол-во людей> <описание>",
  ].join("\n");
}

function howItWorksText() {
  return [
    "Как работает SplitMate:",
    "",
    "1. Создаёшь событие: поездка, кафе или подарок.",
    "2. Добавляешь участников.",
    "3. Вносишь расходы и выбираешь, кто оплатил.",
    "4. SplitMate считает paid/share/net для каждого.",
    "5. Алгоритм упрощает долги до минимальных переводов.",
    "6. Итог можно отправить в Telegram-чат.",
    "",
    "В боте это можно сделать командами /new, /people, /add и /balance.",
  ].join("\n");
}

function groupText() {
  return [
    "SplitMate в групповом чате:",
    "",
    "1. Добавь бота в группу друзей.",
    "2. Создай событие: /new Поездка в Алматы",
    "3. Добавь участников: /people Амир, Али, Даник",
    "4. Добавляй траты: /add 12000 Амир такси",
    "5. Смотри итог: /balance",
    "",
    "Для совсем быстрого расчёта:",
    "/split 18000 4 ужин",
    "",
    "Ответ:",
    "Каждый платит 4 500 ₸.",
  ].join("\n");
}

function splitHelpText() {
  return [
    "Быстрый расчёт расходов:",
    "",
    "Формат:",
    "/split <сумма> <кол-во людей> <описание>",
    "",
    "Примеры:",
    "/split 12000 3 такси",
    "/split 25000 5 ужин",
    "/split 9900 2 билеты",
  ].join("\n");
}

function eventHelpText() {
  return [
    "Учёт расходов прямо в Telegram:",
    "",
    "1. /new Поездка в Алматы",
    "2. /people Амир, Али, Даник",
    "3. /add 12000 Амир такси",
    "4. /add 7800 Али кофе",
    "5. /balance",
    "",
    "Формат расхода:",
    "/add <сумма> <кто_платил> <описание>",
    "",
    "Состояние хранится в памяти запущенного бота. Для постоянного хранения следующим шагом нужен Supabase.",
  ].join("\n");
}

function peopleHelpText() {
  return [
    "Добавь участников через запятую:",
    "",
    "/people Амир, Али, Даник",
    "",
    "После этого добавляй расходы:",
    "/add 12000 Амир такси",
  ].join("\n");
}

function demoSummary() {
  return [
    "SplitMate · Поездка в Алматы",
    "Общая сумма: 19 800 ₸",
    "",
    "Кто кому переводит:",
    "Даник → Амир: 2 600 ₸",
    "Даник → Али: 4 000 ₸",
    "",
    "Открой Mini App, чтобы сделать свой расчёт.",
  ].join("\n");
}

function chatKey(ctx) {
  return String(ctx.chat?.id || ctx.from?.id);
}

function commandPayload(text) {
  return text.replace(/^\/[a-zA-Z0-9_]+(?:@[a-zA-Z0-9_]+)?\s*/, "").trim();
}

function createEvent(title) {
  return {
    title,
    participants: [],
    expenses: [],
  };
}

function getEvent(ctx) {
  const key = chatKey(ctx);

  if (!chatEvents.has(key)) {
    chatEvents.set(key, createEvent("Общий расчёт"));
  }

  return chatEvents.get(key);
}

function parseParticipants(payload) {
  return payload
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

function mergeParticipants(current, names) {
  const result = [...current];
  const known = new Set(current.map((name) => normalizeName(name)));

  for (const name of names) {
    const key = normalizeName(name);

    if (!known.has(key)) {
      result.push(name);
      known.add(key);
    }
  }

  return result;
}

function parseAddCommand(payload, event) {
  const parts = payload.split(/\s+/).filter(Boolean);
  const amount = parseAmount(parts[0]);
  const payerName = parts[1];
  const title = parts.slice(2).join(" ").trim() || "расход";

  if (event.participants.length === 0) {
    return {
      ok: false,
      message: "Сначала добавь участников: /people Амир, Али, Даник",
    };
  }

  if (!Number.isFinite(amount) || amount <= 0 || !payerName) {
    return {
      ok: false,
      message: [
        "Не понял расход.",
        "",
        "Формат:",
        "/add <сумма> <кто_платил> <описание>",
        "",
        "Пример:",
        "/add 12000 Амир такси",
      ].join("\n"),
    };
  }

  const payer = findParticipant(event, payerName);

  if (!payer) {
    return {
      ok: false,
      message: [
        `Не нашёл участника "${payerName}".`,
        "",
        "Текущие участники:",
        event.participants.join(", "),
        "",
        "Добавить участников можно так:",
        "/people Амир, Али, Даник",
      ].join("\n"),
    };
  }

  return {
    ok: true,
    expense: {
      id: Date.now().toString(36),
      amount,
      payer,
      title,
      splitWith: [...event.participants],
    },
  };
}

function findParticipant(event, name) {
  const key = normalizeName(name);
  return event.participants.find((participant) => normalizeName(participant) === key);
}

function normalizeName(name) {
  return name.trim().toLowerCase();
}

function formatEventCreated(event) {
  return [
    `Создан расчёт: ${event.title}`,
    "",
    "Теперь добавь участников:",
    "/people Амир, Али, Даник",
    "",
    "Потом добавляй расходы:",
    "/add 12000 Амир такси",
  ].join("\n");
}

function formatParticipants(event) {
  return [
    `Участники для "${event.title}":`,
    "",
    ...event.participants.map((name, index) => `${index + 1}. ${name}`),
    "",
    "Теперь добавляй расходы:",
    "/add 12000 Амир такси",
  ].join("\n");
}

function formatExpenseAdded(event, expense) {
  return [
    `Добавлен расход: ${expense.title}`,
    "",
    `Сумма: ${formatMoney(expense.amount)}`,
    `Оплатил: ${expense.payer}`,
    `Делим между: ${expense.splitWith.join(", ")}`,
    "",
    `Всего расходов: ${event.expenses.length}`,
    "",
    "Посмотреть итог: /balance",
  ].join("\n");
}

function formatExpenses(event) {
  if (event.expenses.length === 0) {
    return [
      `В "${event.title}" пока нет расходов.`,
      "",
      "Добавь первый:",
      "/add 12000 Амир такси",
    ].join("\n");
  }

  const total = event.expenses.reduce((sum, expense) => sum + expense.amount, 0);

  return [
    `Расходы · ${event.title}`,
    `Итого: ${formatMoney(total)}`,
    "",
    ...event.expenses.map((expense, index) => `${index + 1}. ${expense.title} — ${formatMoney(expense.amount)} · ${expense.payer}`),
    "",
    "Посчитать баланс: /balance",
  ].join("\n");
}

function formatBalance(event) {
  if (event.participants.length === 0) {
    return [
      "Участники ещё не добавлены.",
      "",
      "Начни так:",
      "/people Амир, Али, Даник",
    ].join("\n");
  }

  if (event.expenses.length === 0) {
    return [
      `В "${event.title}" пока нет расходов.`,
      "",
      "Добавь расход:",
      "/add 12000 Амир такси",
    ].join("\n");
  }

  const balances = calculateBalances(event);
  const transfers = simplifyTransfers(balances);
  const total = event.expenses.reduce((sum, expense) => sum + expense.amount, 0);

  return [
    `SplitMate · ${event.title}`,
    `Общая сумма: ${formatMoney(total)}`,
    "",
    "Баланс:",
    ...balances.map((balance) => `${balance.name}: ${signedMoney(balance.net)} · оплатил ${formatMoney(balance.paid)} · доля ${formatMoney(balance.share)}`),
    "",
    transfers.length > 0 ? "Кто кому переводит:" : "Все в расчёте. Долгов нет.",
    ...transfers.map((transfer) => `${transfer.from} → ${transfer.to}: ${formatMoney(transfer.amount)}`),
  ].join("\n");
}

function calculateBalances(event) {
  return event.participants.map((name) => {
    const paid = event.expenses
      .filter((expense) => expense.payer === name)
      .reduce((sum, expense) => sum + expense.amount, 0);

    const share = event.expenses.reduce((sum, expense) => {
      if (!expense.splitWith.includes(name) || expense.splitWith.length === 0) {
        return sum;
      }

      return sum + expense.amount / expense.splitWith.length;
    }, 0);

    return {
      name,
      paid,
      share,
      net: paid - share,
    };
  });
}

function simplifyTransfers(balances) {
  const debtors = balances
    .filter((balance) => balance.net < -0.5)
    .map((balance) => ({ name: balance.name, amount: -balance.net }))
    .sort((a, b) => b.amount - a.amount);

  const creditors = balances
    .filter((balance) => balance.net > 0.5)
    .map((balance) => ({ name: balance.name, amount: balance.net }))
    .sort((a, b) => b.amount - a.amount);

  const transfers = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = Math.min(debtor.amount, creditor.amount);

    if (amount > 0.5) {
      transfers.push({
        from: debtor.name,
        to: creditor.name,
        amount,
      });
    }

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount <= 0.5) {
      debtorIndex += 1;
    }

    if (creditor.amount <= 0.5) {
      creditorIndex += 1;
    }
  }

  return transfers;
}

function parseSplitCommand(text) {
  const parts = text.trim().split(/\s+/);
  const amount = parseAmount(parts[1]);
  const people = Number(parts[2]);
  const title = parts.slice(3).join(" ").trim() || "расход";

  if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(people) || people <= 1) {
    return { ok: false };
  }

  return {
    ok: true,
    amount,
    people,
    title,
    perPerson: amount / people,
  };
}

function formatQuickSplit(result) {
  return [
    `SplitMate · ${capitalize(result.title)}`,
    "",
    `Сумма: ${formatMoney(result.amount)}`,
    `Людей: ${result.people}`,
    `Доля каждого: ${formatMoney(result.perPerson)}`,
    "",
    "Для сложного расчёта с разными плательщиками открой Mini App.",
  ].join("\n");
}

function looksLikeAmount(text) {
  return /^\d[\d\s.,]*(\s|$)/.test(text.trim());
}

function parseAmount(value) {
  if (!value) {
    return Number.NaN;
  }

  return Number(value.replace(/\s/g, "").replace(",", "."));
}

function formatMoney(value) {
  return new Intl.NumberFormat("ru-KZ", {
    style: "currency",
    currency: "KZT",
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

function signedMoney(value) {
  return `${value >= 0 ? "+" : ""}${formatMoney(value)}`;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function normalizeUrl(value) {
  try {
    return new URL(value).toString();
  } catch {
    console.error(`Invalid MINI_APP_URL: ${value}`);
    process.exit(1);
  }
}
