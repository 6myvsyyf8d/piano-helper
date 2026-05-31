#!/usr/bin/env node
/**
 * 🎹 钢琴陪练助手 — 局域网同步服务器
 *
 * 零依赖，仅使用 Node.js 内置模块。
 * 启动后在手机浏览器打开显示的地址即可使用。
 *
 * 用法:
 *   node piano-sync-server.js
 *   node piano-sync-server.js --port 8080
 *
 * 数据文件: ~/.piano-sync/data.json
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ===== CONFIGURATION =====
const args = process.argv.slice(2);
const portArg = args.indexOf('--port');
const PORT = (portArg >= 0 && args[portArg + 1]) ? parseInt(args[portArg + 1]) : 3456;

const DATA_DIR = path.join(os.homedir(), '.piano-sync');
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const HTML_FILE = path.join(__dirname, 'piano-helper.html');

// ===== INIT DATA DIR =====
fs.mkdirSync(DATA_DIR, { recursive: true });

// ===== DATA HELPERS =====
function loadData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { lessons: [], logs: [], _serverStartAt: new Date().toISOString() };
  }
}

function saveData(data) {
  data._serverSavedAt = new Date().toISOString();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function getLocalIPs() {
  const ips = [];
  const ifaces = os.networkInterfaces();
  for (const [name, addrs] of Object.entries(ifaces)) {
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        ips.push({ name, ip: addr.address });
      }
    }
  }
  return ips;
}

// ===== HELPERS =====
function sendJSON(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function sendHTML(res, html) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => resolve(body));
  });
}

// ===== ROUTER =====
const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, 'http://localhost');

  // GET /data — fetch server data
  if (req.method === 'GET' && url.pathname === '/data') {
    sendJSON(res, 200, loadData());
    return;
  }

  // POST /data — save data to server
  if (req.method === 'POST' && url.pathname === '/data') {
    try {
      const body = await readBody(req);
      const data = JSON.parse(body);
      saveData(data);
      sendJSON(res, 200, { ok: true, time: data._serverSavedAt });
    } catch (e) {
      sendJSON(res, 400, { ok: false, error: e.message });
    }
    return;
  }

  // POST /merge — merge local data into server (local wins on conflict)
  if (req.method === 'POST' && url.pathname === '/merge') {
    try {
      const body = await readBody(req);
      const localData = JSON.parse(body);
      const serverData = loadData();

      // Merge: union by id, local wins for same-id conflicts
      const merged = mergeData(serverData, localData, 'local');
      saveData(merged);

      sendJSON(res, 200, {
        ok: true,
        time: merged._serverSavedAt,
        serverRecords: { lessons: serverData.lessons.length, logs: serverData.logs.length },
        localRecords: { lessons: localData.lessons?.length || 0, logs: localData.logs?.length || 0 },
        mergedRecords: { lessons: merged.lessons.length, logs: merged.logs.length },
      });
    } catch (e) {
      sendJSON(res, 400, { ok: false, error: e.message });
    }
    return;
  }

  // GET /ping — check if server is reachable
  if (req.method === 'GET' && url.pathname === '/ping') {
    sendJSON(res, 200, { ok: true, time: new Date().toISOString() });
    return;
  }

  // GET / — serve the HTML app
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/piano-helper.html')) {
    try {
      const html = fs.readFileSync(HTML_FILE, 'utf8');
      sendHTML(res, html);
    } catch {
      sendJSON(res, 404, { ok: false, error: 'HTML file not found at: ' + HTML_FILE });
    }
    return;
  }

  // 404
  sendJSON(res, 404, { ok: false, error: 'Not found' });
});

// ===== MERGE LOGIC =====
function mergeData(serverData, localData, winner) {
  const base = winner === 'local' ? localData : serverData;
  const other = winner === 'local' ? serverData : localData;

  // Merge lessons by id
  const lessonMap = new Map();
  for (const l of (other.lessons || [])) lessonMap.set(l.id, l);
  for (const l of (base.lessons || [])) lessonMap.set(l.id, l); // base wins
  const lessons = [...lessonMap.values()].sort((a, b) => b.date.localeCompare(a.date));

  // Merge logs by id
  const logMap = new Map();
  for (const l of (other.logs || [])) logMap.set(l.id, l);
  for (const l of (base.logs || [])) logMap.set(l.id, l); // base wins
  const logs = [...logMap.values()].sort((a, b) => b.date.localeCompare(a.date));

  return { lessons, logs };
}

// ===== START =====
server.listen(PORT, () => {
  console.log('');
  console.log('  🎹  Piano Sync Server 已启动！');
  console.log('');
  console.log('  ┌─────────────────────────────────────┐');
  console.log('  │  数据文件: ' + DATA_FILE.padEnd(24) + ' │');

  const ips = getLocalIPs();
  console.log('  │  本机访问: http://localhost:' + String(PORT).padEnd(8) + '  │');
  for (const { ip } of ips) {
    const url = 'http://' + ip + ':' + PORT;
    console.log('  │  手机访问: ' + url.padEnd(26) + ' │');
  }
  console.log('  └─────────────────────────────────────┘');
  console.log('');
  console.log('  手机上打开上面的地址就能用，数据自动同步。');
  console.log('  Ctrl+C 停止服务器。');
  console.log('');
});
