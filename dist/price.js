import {createMailFlight} from "./mail-flight.js";

const priceDialog = document.querySelector("#price-dialog");
const priceForm = document.querySelector("#price-form");
const priceStatus = document.querySelector("#price-status");
const done = document.querySelector("#price-done");
const flight = createMailFlight(priceDialog.querySelector(".mail-flight"));
const submit = priceForm.querySelector("[type=submit]");
const endpoint = priceForm.dataset.endpoint || (location.hostname === "127.0.0.1" ? "/price" : "");
const isAppsScript = /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(endpoint);
let sending = false;
let sent = false;

for (const opener of document.querySelectorAll("[data-price-open]")) {
  opener.addEventListener("click", () => {
    priceDialog.showModal();
  });
}
document.querySelector("#price-close").onclick = () => priceDialog.close();
done.onclick = () => priceDialog.close();
priceDialog.addEventListener("close", () => {
  flight.reset();
  if (sent) {
    sent = false;
    priceForm.hidden = false;
    done.hidden = true;
    priceStatus.textContent = "";
  }
});

if (!endpoint) {
  submit.disabled = true;
  priceStatus.textContent = "Отправка прайса пока недоступна.";
}

function submitToAppsScript(fields) {
  return new Promise((resolve, reject) => {
    const nonce = crypto.randomUUID();
    const frame = document.createElement("iframe");
    frame.hidden = true;
    frame.name = "betar-price-" + nonce;
    frame.title = "Отправка запроса прайса";

    const form = document.createElement("form");
    form.hidden = true;
    form.method = "POST";
    form.action = endpoint;
    form.target = frame.name;
    for (const [name, value] of [...fields, ["nonce", nonce]]) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.append(input);
    }

    function cleanup() {
      clearTimeout(timeout);
      window.removeEventListener("message", receive);
      form.remove();
      frame.remove();
    }

    function receive(event) {
      if (!/^https:\/\/(?:script\.google\.com|[a-z0-9-]+\.googleusercontent\.com)$/.test(event.origin)) return;
      if (event.data?.type !== "betar-price" || event.data.nonce !== nonce) return;
      cleanup();
      resolve(event.data);
    }

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Apps Script response timed out"));
    }, 45000);
    window.addEventListener("message", receive);
    document.body.append(frame, form);
    form.submit();
  });
}

async function requestPrice(fields) {
  if (isAppsScript) return submitToAppsScript(fields);
  const response = await fetch(endpoint, {
    method: "POST",
    body: new URLSearchParams(fields),
    signal: AbortSignal.timeout(45000),
  });
  if (response.status === 429) return { ok: false, code: "rate_limit" };
  return response.ok ? response.json() : { ok: false };
}

priceForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!endpoint || sending) return;
  const fields = new FormData(priceForm);
  sending = true;
  submit.disabled = true;
  priceStatus.textContent = "Отправляем прайс…";
  flight.start();
  try {
    const result = await requestPrice(fields);
    if (!result.ok) flight.reset();
    if (result.code === "rate_limit") {
      priceStatus.textContent = "Прайс недавно запрашивали или превышен лимит отправки. Попробуйте позже.";
      return;
    }
    if (result.code === "test_recipient") {
      priceStatus.textContent = "Для проверки введите email, указанный в настройках тестовой отправки.";
      return;
    }
    if (!result.ok) throw new Error();
    sent = true;
    priceStatus.textContent = `Прайс отправлен на ${fields.get("email").trim()}. Проверьте папку «Спам».`;
    priceForm.reset();
    priceForm.hidden = true;
    flight.succeed();
    done.hidden = false;
    done.focus();
  } catch {
    flight.reset();
    priceStatus.textContent = "Не удалось подтвердить отправку. Попробуйте позже.";
  } finally {
    sending = false;
    submit.disabled = false;
  }
});
