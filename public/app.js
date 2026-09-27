let sessionId = null;
let socket = null;
let currentPath = '/';

const connectForm = document.getElementById('connectForm');
const privateKeyFile = document.getElementById('privateKeyFile');
const privateKeyText = document.getElementById('privateKeyText');
const terminalOutput = document.getElementById('terminalOutput');
const terminalForm = document.getElementById('terminalForm');
const terminalInput = document.getElementById('terminalInput');
const statusPill = document.getElementById('statusPill');
const systemInfo = document.getElementById('systemInfo');
const fileList = document.getElementById('fileList');
const processTable = document.getElementById('processTable');
const disconnectBtn = document.getElementById('disconnectBtn');
const refreshMonitor = document.getElementById('refreshMonitor');
const remotePathInput = document.getElementById('remotePath');
const listPathBtn = document.getElementById('listPathBtn');
const goHome = document.getElementById('goHome');
const mkdirBtn = document.getElementById('mkdirBtn');
const fileUpload = document.getElementById('fileUpload');

privateKeyFile.addEventListener('change', async () => {
  const file = privateKeyFile.files[0];
  if (!file) return;
  const text = await file.text();
  privateKeyText.value = text;
});

connectForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(connectForm);
  const payload = {
    host: formData.get('host'),
    port: formData.get('port') || 22,
    username: formData.get('username'),
    password: formData.get('password') || '',
    privateKey: privateKeyText.value || '',
  };

  statusPill.textContent = 'Connecting...';
  statusPill.className = 'status-pill warning';

  try {
    const response = await fetch('/api/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || 'Connection failed');
    }

    sessionId = result.sessionId;
    currentPath = '/';
    remotePathInput.value = currentPath;
    statusPill.textContent = 'Connected';
    statusPill.className = 'status-pill success';

    connectSocket();
    loadSystemInfo();
    loadMonitor();
    loadProcesses();
    loadRemoteFiles('/');
  } catch (error) {
    statusPill.textContent = 'Connection failed';
    statusPill.className = 'status-pill warning';
    terminalOutput.textContent += `\nERROR: ${error.message}\n`;
  }
});

function connectSocket() {
  if (socket) {
    socket.close();
  }

  socket = new WebSocket(`ws://${window.location.host}/terminal?sessionId=${sessionId}`);

  socket.onopen = () => {
    terminalOutput.textContent = 'SSH session connected.\n';
  };

  socket.onmessage = (event) => {
    if (event.data === '__PONG__') return;
    terminalOutput.textContent += event.data;
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
  };

  socket.onclose = () => {
    terminalOutput.textContent += '\nConnection closed.\n';
  };
}

terminalForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    terminalOutput.textContent += '\nNo active SSH session.\n';
    return;
  }

  const value = terminalInput.value;
  if (!value.trim()) return;
  socket.send(`${value}\n`);
  terminalInput.value = '';
});

async function loadSystemInfo() {
  if (!sessionId) return;
  const res = await fetch(`/api/system/info?sessionId=${sessionId}`);
  const json = await res.json();
  if (!json.success) return;

  const raw = json.data.raw || 'No system info';
  systemInfo.textContent = raw;

  const infoLines = raw.split('\n');
  const cpuLine = infoLines.find((line) => line.toLowerCase().includes('model name')) || 'CPU: unknown';
  const loadLine = infoLines.find((line) => line.toLowerCase().includes('load')) || 'Load: unknown';
  document.getElementById('cpuMetric').textContent = cpuLine;
  document.getElementById('loadMetric').textContent = loadLine;
}

async function loadMonitor() {
  if (!sessionId) return;
  const res = await fetch(`/api/system/monitor?sessionId=${sessionId}`);
  const json = await res.json();
  if (!json.success) return;

  const { memory, disk, load, cpu } = json.data;
  const total = memory.total || 0;
  const used = memory.used || 0;
  const usage = total ? Math.round((used / total) * 100) : 0;
  document.getElementById('memoryMetric').textContent = `${usage}% (${used}MB / ${total}MB)`;
  document.getElementById('diskMetric').textContent = disk?.[0]?.usage || 'N/A';
  document.getElementById('cpuMetric').textContent = cpu ? cpu.slice(0, 80) : 'CPU: unknown';
  document.getElementById('loadMetric').textContent = load || 'N/A';
}

async function loadProcesses() {
  if (!sessionId) return;
  const res = await fetch(`/api/processes?sessionId=${sessionId}`);
  const json = await res.json();
  if (!json.success || !json.data.length) {
    processTable.innerHTML = '<p style="color: var(--muted); padding: 18px;">No process information available.</p>';
    return;
  }

  const headers = ['PID', 'PPID', 'COMMAND', '%CPU', '%MEM', 'RSS', 'STAT'];
  const rows = json.data.slice(0, 20);

  processTable.innerHTML = `
    <table>
      <thead>
        <tr>
          ${headers.map((h) => `<th>${h}</th>`).join('')}
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            <td>${row.PID || ''}</td>
            <td>${row.PPID || ''}</td>
            <td>${row.COMMAND || row.comm || ''}</td>
            <td>${row['%CPU'] || row['%cpu'] || ''}</td>
            <td>${row['%MEM'] || row['%mem'] || ''}</td>
            <td>${row.RSS || row.rss || ''}</td>
            <td>${row.STAT || row.stat || ''}</td>
            <td><button data-kill="${row.PID || row.pid || ''}">Kill</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  document.querySelectorAll('[data-kill]').forEach((button) => {
    button.addEventListener('click', async () => {
      const pid = button.getAttribute('data-kill');
      if (!pid) return;
      await fetch('/api/processes/kill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, pid, signal: 'TERM' }),
      });
      loadProcesses();
    });
  });
}

async function loadRemoteFiles(remotePath) {
  if (!sessionId) return;
  const pathToUse = remotePath || currentPath || '/';
  currentPath = pathToUse;
  remotePathInput.value = pathToUse;

  const res = await fetch(`/api/sftp/list?sessionId=${sessionId}&path=${encodeURIComponent(pathToUse)}`);
  const json = await res.json();
  if (!json.success) return;

  const items = json.data || [];
  const rows = items.map((item) => {
    const isDir = item.attrs.isDirectory;
    const mode = item.attrs.mode ? item.attrs.mode.toString(8).slice(-3) : '---';
    const size = isDir ? '-' : `${item.attrs.size || 0} B`;
    return `
      <div class="file-item">
        <div class="file-item-main" data-path="${pathToUse === '/' ? '/' + item.filename : pathToUse + '/' + item.filename}">
          <span>${isDir ? '📁' : '📄'}</span>
          <div>
            <div class="name">${item.filename}</div>
            <div class="meta">${mode} • ${size}</div>
          </div>
        </div>
        <div class="actions">
          <button data-type="chmod" data-path="${pathToUse === '/' ? '/' + item.filename : pathToUse + '/' + item.filename}">Chmod</button>
          <button data-type="delete" data-path="${pathToUse === '/' ? '/' + item.filename : pathToUse + '/' + item.filename}">Delete</button>
          <button data-type="download" data-path="${pathToUse === '/' ? '/' + item.filename : pathToUse + '/' + item.filename}">Download</button>
        </div>
      </div>
    `;
  }).join('');

  fileList.innerHTML = rows || '<div class="info-box">Empty directory.</div>';

  fileList.querySelectorAll('[data-path]').forEach((node) => {
    const target = node.getAttribute('data-path');
    node.addEventListener('click', (event) => {
      if (event.target.closest('button')) return;
      const isDirectoryTarget = target && !target.endsWith('.txt') && !target.endsWith('.log') && !target.endsWith('.json') && !target.endsWith('.js') && !target.endsWith('.yaml');
      if (isDirectoryTarget) {
        loadRemoteFiles(target);
      }
    });
  });

  fileList.querySelectorAll('[data-type]').forEach((button) => {
    button.addEventListener('click', async () => {
      const type = button.getAttribute('data-type');
      const filePath = button.getAttribute('data-path');

      if (type === 'delete') {
        await fetch('/api/sftp/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, path: filePath }),
        });
        loadRemoteFiles(currentPath);
      }

      if (type === 'download') {
        window.open(`/api/sftp/download?sessionId=${sessionId}&path=${encodeURIComponent(filePath)}`);
      }

      if (type === 'chmod') {
        const mode = prompt('Set octal mode, e.g. 755');
        if (!mode) return;
        await fetch('/api/sftp/chmod', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, path: filePath, mode }),
        });
        loadRemoteFiles(currentPath);
      }
    });
  });
}

listPathBtn.addEventListener('click', () => {
  loadRemoteFiles(remotePathInput.value || '/');
});

goHome.addEventListener('click', () => {
  currentPath = '/';
  remotePathInput.value = '/';
  loadRemoteFiles('/');
});

mkdirBtn.addEventListener('click', async () => {
  const name = prompt('Name of new directory');
  if (!name) return;
  const target = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
  await fetch('/api/sftp/mkdir', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, path: target }),
  });
  loadRemoteFiles(currentPath);
});

fileUpload.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('sessionId', sessionId);
  formData.append('path', currentPath);
  await fetch('/api/sftp/upload', { method: 'POST', body: formData });
  loadRemoteFiles(currentPath);
  fileUpload.value = '';
});

disconnectBtn.addEventListener('click', async () => {
  if (!sessionId) return;
  await fetch('/api/disconnect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });
  sessionId = null;
  if (socket) socket.close();
  statusPill.textContent = 'Disconnected';
  statusPill.className = 'status-pill';
  systemInfo.textContent = 'Not connected';
  fileList.innerHTML = '';
  processTable.innerHTML = '';
  terminalOutput.textContent = 'No active SSH session.';
});

refreshMonitor.addEventListener('click', () => {
  loadMonitor();
  loadProcesses();
  loadRemoteFiles(currentPath || '/');
});

setInterval(() => {
  if (sessionId) {
    loadMonitor();
    loadProcesses();
  }
}, 5000);
