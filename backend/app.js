const express = require('express');
const path = require('path');
const http = require('http');
const fs = require('fs');
const WebSocket = require('ws');
const dotenv = require('dotenv');
const { upload } = require('./services/upload');
const SSHService = require('./services/sshService');
const SystemService = require('./services/systemService');
const config = require('./config');

dotenv.config();

const app = express();
const server = http.createServer(app);
const sshService = new SSHService();
const systemService = new SystemService(sshService);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

const port = config.port;
const host = config.host;

app.get('/api/health', (req, res) => {
  res.json({ ok: true, app: config.appName, time: new Date().toISOString() });
});

app.post('/api/connect', async (req, res) => {
  try {
    const { host, port, username, password, privateKey, passphrase } = req.body;
    const data = await sshService.connectHost({
      host,
      port,
      username,
      password,
      privateKey,
      passphrase,
    });
    res.json({ success: true, ...data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Connection failed' });
  }
});

app.post('/api/disconnect', async (req, res) => {
  try {
    const { sessionId } = req.body;
    const result = await sshService.disconnect(sessionId);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Disconnect failed' });
  }
});

app.get('/api/system/info', async (req, res) => {
  try {
    const { sessionId } = req.query;
    const result = await systemService.getSystemInfo(sessionId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'System info failed' });
  }
});

app.get('/api/system/monitor', async (req, res) => {
  try {
    const { sessionId } = req.query;
    const result = await systemService.getSystemMonitor(sessionId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'System monitor failed' });
  }
});

app.get('/api/processes', async (req, res) => {
  try {
    const { sessionId } = req.query;
    const result = await systemService.getProcesses(sessionId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Process list failed' });
  }
});

app.post('/api/processes/kill', async (req, res) => {
  try {
    const { sessionId, pid, signal } = req.body;
    const result = await systemService.killProcess(sessionId, pid, signal || 'TERM');
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Process kill failed' });
  }
});

app.get('/api/sftp/list', async (req, res) => {
  try {
    const { sessionId, path: remotePath } = req.query;
    const result = await sshService.listDirectory(sessionId, remotePath || '.');
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'List directory failed' });
  }
});

app.get('/api/sftp/stat', async (req, res) => {
  try {
    const { sessionId, path: remotePath } = req.query;
    const result = await sshService.statPath(sessionId, remotePath);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Stat failed' });
  }
});

app.post('/api/sftp/mkdir', async (req, res) => {
  try {
    const { sessionId, path: remotePath } = req.body;
    const result = await sshService.mkdir(sessionId, remotePath);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Create directory failed' });
  }
});

app.post('/api/sftp/rename', async (req, res) => {
  try {
    const { sessionId, oldPath, newPath } = req.body;
    const result = await sshService.rename(sessionId, oldPath, newPath);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Rename failed' });
  }
});

app.post('/api/sftp/delete', async (req, res) => {
  try {
    const { sessionId, path: remotePath } = req.body;
    const result = await sshService.deletePath(sessionId, remotePath);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Delete failed' });
  }
});

app.post('/api/sftp/chmod', async (req, res) => {
  try {
    const { sessionId, path: remotePath, mode } = req.body;
    const result = await sshService.chmod(sessionId, remotePath, parseInt(mode, 8));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Chmod failed' });
  }
});

app.post('/api/sftp/chown', async (req, res) => {
  try {
    const { sessionId, path: remotePath, uid, gid } = req.body;
    const result = await sshService.chown(sessionId, remotePath, Number(uid), Number(gid));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Chown failed' });
  }
});

app.post('/api/sftp/upload', upload.single('file'), async (req, res) => {
  try {
    const { sessionId, path: remoteDir } = req.body;
    const tempPath = req.file.path;
    const fileBuffer = fs.readFileSync(tempPath);
    const targetPath = remoteDir ? `${remoteDir}/${req.file.originalname}` : req.file.originalname;
    await sshService.uploadFile(sessionId, targetPath, fileBuffer);
    fs.unlinkSync(tempPath);
    res.json({ success: true, path: targetPath });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Upload failed' });
  }
});

app.get('/api/sftp/download', async (req, res) => {
  try {
    const { sessionId, path: remotePath } = req.query;
    const buffer = await sshService.readFile(sessionId, remotePath);
    const filename = remotePath.split('/').pop();
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Download failed' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const wss = new WebSocket.Server({ server, path: '/terminal' });

wss.on('connection', (ws, req) => {
  const sessionId = new URL(req.url, 'http://localhost').searchParams.get('sessionId');
  if (!sessionId) {
    ws.close();
    return;
  }
  sshService.openShell(sessionId, ws);
});

server.listen(port, host, () => {
  console.log(`Web SSH server running on http://${host}:${port}`);
});
