const EMAIL_PATTERN = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i;
const HEADERS = [
  "Email", "Регион", "Отправка прайса", "Статус", "Изменение статуса",
  "Message-ID прайса", "Message-ID дожима", "Отправка дожима",
];
const COL = { email: 0, region: 1, sent: 2, status: 3, changed: 4, priceId: 5, followId: 6, followAt: 7 };
const STATUS = { sent: "Отправлен", replied: "Ответ получен", follow: "Дожим", after: "Ответ после дожима" };

function settings_() {
  const props = PropertiesService.getScriptProperties().getProperties();
  for (const key of ["SHEET_ID", "PRICE_FOLDER_ID", "SITE_ORIGIN"]) {
    if (!props[key]) throw new Error("Missing Script Property: " + key);
  }
  if (!/^https?:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(props.SITE_ORIGIN)) {
    throw new Error("SITE_ORIGIN must be an origin without a path");
  }
  const days = Number(props.FOLLOW_UP_DELAY_DAYS ?? 7);
  const enabled = props.FOLLOW_UP_ENABLED ?? "false";
  if (!Number.isSafeInteger(days) || days < 1 || !["true", "false"].includes(enabled)) {
    throw new Error("Invalid follow-up settings");
  }
  const testEmail = (props.TEST_RECIPIENT_EMAIL || "").trim().toLowerCase();
  if (testEmail && (testEmail.length > 254 || !EMAIL_PATTERN.test(testEmail))) {
    throw new Error("Invalid TEST_RECIPIENT_EMAIL");
  }
  return { ...props, days, enabled: enabled === "true", testEmail };
}

function sheet_(book, name, headers) {
  const sheet = book.getSheetByName(name) || book.insertSheet(name);
  if (!sheet.getLastRow()) sheet.appendRow(headers);
  return sheet;
}

function workbook_(config) {
  return SpreadsheetApp.openById(config.SHEET_ID);
}

function rows_(sheet, width) {
  return sheet.getLastRow() < 2 ? [] : sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getValues();
}

function locked_(callback) {
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    return callback();
  } finally {
    try {
      SpreadsheetApp.flush();
    } finally {
      lock.releaseLock();
    }
  }
}

function mail_(config, email, followId) {
  const files = DriveApp.getFolderById(config.PRICE_FOLDER_ID).getFiles();
  if (!files.hasNext()) throw new Error("Price folder is empty");
  const file = files.next();
  if (files.hasNext()) throw new Error("Price folder must contain exactly one file");
  if (file.getMimeType().startsWith("application/vnd.google-apps.")) {
    throw new Error("Use an uploaded attachment such as XLSX or PDF");
  }
  let subject = config.PRICE_SUBJECT || "Оптовый прайс БЕТАР";
  let body = config.PRICE_BODY || "Добрый день!\n\nВо вложении актуальный оптовый прайс БЕТАР. Если есть вопросы, ответьте на это письмо.";
  if (followId) {
    subject = config.FOLLOW_UP_SUBJECT || "Оптовый прайс БЕТАР — обсудим поставку?";
    body = config.FOLLOW_UP_BODY || "Добрый день!\n\nПрикладываем актуальный прайс БЕТАР. Ответьте на это письмо, чтобы обсудить условия поставки и сотрудничество.";
  }
  const options = { attachments: [file.getBlob().setName(file.getName())] };
  const sent = GmailApp.createDraft(email, subject, body, options).send();
  return sent.getHeader("Message-ID");
}

function submit_(config, email, region) {
  return locked_(() => {
    const book = workbook_(config);
    const leads = sheet_(book, "Заявки", HEADERS);
    const log = sheet_(book, "Отправки", ["Email", "Дата"]);
    const cutoff = Date.now() - 3600000;
    const previous = rows_(log, 2);
    const active = previous.filter(row => +new Date(row[1]) > cutoff);
    if (active.length >= 60 || active.filter(row => row[0] === email).length >= 2) {
      return { ok: false, code: "rate_limit" };
    }
    if (previous.length > active.length) log.deleteRows(2, previous.length - active.length);
    const requests = rows_(leads, HEADERS.length);
    const index = requests.findIndex(row => row[COL.email] === email);
    const id = mail_(config, email);
    const now = new Date();
    // Force user-entered strings to be shown as text in Sheets.
    const text = value => "'" + value;
    const request = [text(email), region ? text(region) : "", now, STATUS.sent, now, id, "", ""];
    leads.getRange(index < 0 ? leads.getLastRow() + 1 : index + 2, 1, 1, HEADERS.length).setValues([request]);
    log.appendRow([text(email), now]);
    return { ok: true };
  });
}

function doPost(event) {
  const config = settings_();
  const values = event?.parameter || {};
  const nonce = values.nonce || "";
  let result = { ok: false, code: "invalid" };
  const email = (values.email || "").trim().toLowerCase();
  const region = (values.region || "").trim();
  if (/^[a-f0-9-]{36}$/.test(nonce) && email.length <= 254 && EMAIL_PATTERN.test(email) && region.length <= 100) {
    try {
      result = config.testEmail && email !== config.testEmail
        ? { ok: false, code: "test_recipient" }
        : submit_(config, email, region);
    } catch (error) {
      console.error(error);
      result = { ok: false, code: "unavailable" };
    }
  }
  const payload = JSON.stringify({ type: "betar-price", nonce, ...result }).replace(/</g, "\\u003c");
  return HtmlService.createHtmlOutput(
    "<!doctype html><script>window.top.postMessage(" + payload + "," +
    JSON.stringify(config.SITE_ORIGIN) + ");</script>",
  ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function sender_(value) {
  return (value.match(/<([^<>]+)>\s*$/)?.[1] || value).trim().toLowerCase();
}

function replyStatus_(message, row) {
  const header = name => message.getHeader(name) || "";
  const received = message.getDate();
  if (sender_(message.getFrom()) !== row[COL.email] || received < row[COL.sent] ||
      header("Return-Path").trim() === "<>" || header("List-Id") ||
      /^(bulk|list|junk)$/i.test(header("Precedence").trim()) ||
      (header("Auto-Submitted") && !/^no$/i.test(header("Auto-Submitted").trim())) ||
      /^multipart\/report/i.test(header("Content-Type"))) return null;
  const refs = (header("In-Reply-To") + " " + header("References")).match(/<[^<>\s]+>/g) || [];
  if (refs.length && !refs.includes(row[COL.priceId]) && !refs.includes(row[COL.followId])) return null;
  return row[COL.followAt] && received >= row[COL.followAt] ? STATUS.after : STATUS.replied;
}

function findReply_(row) {
  const start = Math.floor(new Date(row[COL.sent]).getTime() / 1000) - 1;
  const query = "from:(" + row[COL.email] + ") after:" + start;
  let earliest = null;
  for (let offset = 0; ; offset += 50) {
    const threads = GmailApp.search(query, offset, 50);
    for (const thread of threads) {
      for (const message of thread.getMessages()) {
        const status = replyStatus_(message, row);
        if (status && (!earliest || message.getDate() < earliest.date)) {
          earliest = { status, date: message.getDate() };
        }
      }
    }
    if (threads.length < 50) return earliest;
  }
}

function runMaintenance() {
  const config = settings_();
  const leads = sheet_(workbook_(config), "Заявки", HEADERS);
  const snapshot = rows_(leads, HEADERS.length);
  const cutoff = Date.now() - config.days * 86400000;
  for (const [index, saved] of snapshot.entries()) {
    if (![STATUS.sent, STATUS.follow].includes(saved[COL.status])) continue;
    try {
      locked_(() => {
        const range = leads.getRange(index + 2, 1, 1, HEADERS.length);
        const [row] = range.getValues();
        if (row[COL.priceId] !== saved[COL.priceId] || ![STATUS.sent, STATUS.follow].includes(row[COL.status])) return;
        const reply = findReply_(row);
        if (reply) {
          row[COL.status] = reply.status;
          row[COL.changed] = reply.date;
        } else if (
          config.enabled && (!config.testEmail || row[COL.email] === config.testEmail) &&
          row[COL.status] === STATUS.sent && +new Date(row[COL.changed]) < cutoff
        ) {
          row[COL.followId] = mail_(config, row[COL.email], row[COL.priceId]);
          row[COL.changed] = row[COL.followAt] = new Date();
          row[COL.status] = STATUS.follow;
        } else {
          return;
        }
        // Reassert text encoding when rewriting user-supplied sheet cells.
        row[COL.email] = "'" + row[COL.email];
        if (row[COL.region]) row[COL.region] = "'" + row[COL.region];
        range.setValues([row]);
      });
    } catch (error) {
      console.error(error);
    }
  }
}

function installDailyTrigger() {
  settings_();
  const triggers = ScriptApp.getProjectTriggers().filter(trigger => trigger.getHandlerFunction() === "runMaintenance");
  if (!triggers.length) ScriptApp.newTrigger("runMaintenance").timeBased().everyDays(1).atHour(9).create();
}
