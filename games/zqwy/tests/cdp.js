'use strict';

/* Минимальный CDP-клиент без внешних зависимостей.
   Рассчитан на уже запущенный Chrome с --remote-debugging-port=9222. */

const http = require('http');

/* Порт CDP можно переопределить: на машине может быть уже занят 9222. */
const CDP_PORT = Number(process.env.CDP_PORT || 9222);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const req = http.request({
      host: '127.0.0.1',
      port: CDP_PORT,
      path,
      method,
      headers: payload
        ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) }
        : undefined
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function createTarget(url) {
  const res = await request('PUT', `/json/new?${encodeURIComponent(url)}`);
  if (res.status !== 200) {
    throw new Error(`Не удалось создать вкладку CDP: ${res.status} ${res.body.slice(0, 200)}`);
  }
  return JSON.parse(res.body);
}

async function closeTarget(id) {
  try {
    await request('GET', `/json/close/${encodeURIComponent(id)}`);
  } catch (error) {
    /* закрытие не критично */
  }
}

class Page {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 0;
    this.pending = new Map();
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (!message.id || !this.pending.has(message.id)) return;
      const job = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) job.reject(new Error(JSON.stringify(message.error)));
      else job.resolve(message.result);
    };
  }

  static async open(url, options) {
    const target = await createTarget('about:blank');
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });
    const page = new Page(ws);
    page.target = target;
    await page.send('Runtime.enable');
    await page.send('Page.enable');
    /* Игра правится между прогонами, поэтому кэш браузера должен быть
       выключен: иначе тесты проверяют старую версию файлов. */
    await page.send('Network.enable');
    await page.send('Network.setCacheDisabled', { cacheDisabled: true });
    const size = options || {};
    await page.setViewport(size.width || 1600, size.height || 900);
    await page.send('Page.navigate', { url });
    await page.waitFor('Boolean(window.ZQ && window.ZQ.rt && window.ZQ.rt.world)', 15000);
    await sleep(300);
    return page;
  }

  send(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }

  async eval(expression) {
    const response = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true
    });
    if (response.exceptionDetails) {
      const detail = response.exceptionDetails.exception
        ? response.exceptionDetails.exception.description
        : response.exceptionDetails.text;
      throw new Error(detail || 'Ошибка выполнения в странице');
    }
    return response.result ? response.result.value : undefined;
  }

  async waitFor(expression, timeout) {
    const deadline = Date.now() + (timeout || 10000);
    while (Date.now() < deadline) {
      if (await this.eval(expression)) return true;
      await sleep(200);
    }
    throw new Error(`Не дождался условия: ${expression}`);
  }

  async setViewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false
    });
    await sleep(250);
  }

  async wheel(x, y, deltaY) {
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseWheel',
      x,
      y,
      deltaX: 0,
      deltaY
    });
    await sleep(350);
  }

  async drag(x1, y1, x2, y2) {
    await this.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: x1,
      y: y1,
      button: 'left',
      clickCount: 1
    });
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: x2,
      y: y2,
      button: 'left',
      buttons: 1
    });
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: x2,
      y: y2,
      button: 'left',
      clickCount: 1
    });
    await sleep(250);
  }

  async close() {
    try {
      this.ws.close();
    } catch (error) {
      /* уже закрыто */
    }
    if (this.target && this.target.id) await closeTarget(this.target.id);
  }
}

module.exports = { Page, sleep };
