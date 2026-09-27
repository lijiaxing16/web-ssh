const { Client } = require('ssh2');
const { v4: uuidv4 } = require('uuid');

class SSHService {
  constructor() {
    this.sessions = new Map();
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  async connectHost({ host, port, username, password, privateKey, passphrase }) {
    if (!host || !username) {
      throw new Error('Host and username are required.');
    }

    const sessionId = uuidv4();
    const conn = new Client();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        conn.end();
        reject(new Error('SSH connection timed out.'));
      }, 20000);

      conn.on('ready', async () => {
        clearTimeout(timeout);

        const session = {
          id: sessionId,
          conn,
          host,
          port: Number(port || 22),
          username,
          password,
          privateKey,
          passphrase,
          createdAt: Date.now(),
          shellStream: null,
          sftp: null,
        };

        this.sessions.set(sessionId, session);
        resolve({ sessionId, status: 'connected', host, port: session.port, username });
      });

      conn.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error(err.message || 'SSH connection failed.'));
      });

      conn.connect({
        host,
        port: Number(port || 22),
        username,
        password: password || undefined,
        privateKey: privateKey || undefined,
        passphrase: passphrase || undefined,
        readyTimeout: 20000,
        keepaliveInterval: 30000,
        keepaliveCountMax: 3,
      });
    });
  }

  async disconnect(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    try {
      if (session.shellStream) session.shellStream.end();
      if (session.sftp) await new Promise((resolve) => session.sftp.end(resolve));
      session.conn.end();
    } catch (err) {
      console.error('disconnect error', err);
    }

    this.sessions.delete(sessionId);
    return { success: true };
  }

  async runCommand(sessionId, command) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found.');

    return new Promise((resolve, reject) => {
      session.conn.exec(command, (err, stream) => {
        if (err) {
          reject(err);
          return;
        }

        let stdout = '';
        let stderr = '';

        stream.on('data', (chunk) => {
          stdout += chunk.toString();
        });

        stream.stderr.on('data', (chunk) => {
          stderr += chunk.toString();
        });

        stream.on('close', (code, signal) => {
          resolve({
            code,
            signal,
            stdout,
            stderr,
            combined: `${stdout}${stderr}`,
          });
        });
      });
    });
  }

  async openShell(sessionId, ws) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      ws.close();
      return;
    }

    session.conn.shell({ term: 'xterm-256color' }, (err, stream) => {
      if (err) {
        ws.send(JSON.stringify({ type: 'error', data: err.message }));
        ws.close();
        return;
      }

      session.shellStream = stream;

      ws.on('message', (message) => {
        const payload = message.toString();
        if (payload === '__PING__') {
          ws.send('__PONG__');
          return;
        }
        stream.write(payload);
      });

      ws.on('close', () => {
        if (stream) stream.end();
      });

      stream.on('data', (chunk) => {
        ws.send(chunk.toString());
      });

      stream.on('close', () => {
        ws.close();
      });

      stream.stderr.on('data', (chunk) => {
        ws.send(chunk.toString());
      });
    });
  }

  async ensureSftp(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found.');
    if (session.sftp) return session.sftp;

    return new Promise((resolve, reject) => {
      session.conn.sftp((err, sftp) => {
        if (err) {
          reject(err);
          return;
        }
        session.sftp = sftp;
        resolve(sftp);
      });
    });
  }

  async listDirectory(sessionId, remotePath = '.') {
    const sftp = await this.ensureSftp(sessionId);
    const result = await new Promise((resolve, reject) => {
      sftp.readdir(remotePath, (err, list) => {
        if (err) return reject(err);
        const mapped = list.map((item) => ({
          filename: item.filename,
          longname: item.longname,
          attrs: {
            mode: item.attrs.mode,
            size: item.attrs.size,
            uid: item.attrs.uid,
            gid: item.attrs.gid,
            isDirectory: item.attrs.isDirectory ? true : false,
            isFile: item.attrs.isFile ? true : false,
            isSymbolicLink: item.attrs.isSymbolicLink ? true : false,
          },
        }));
        resolve(mapped);
      });
    });
    return result;
  }

  async statPath(sessionId, remotePath) {
    const sftp = await this.ensureSftp(sessionId);
    const result = await new Promise((resolve, reject) => {
      sftp.stat(remotePath, (err, stats) => {
        if (err) return reject(err);
        resolve({
          isDirectory: stats.isDirectory(),
          isFile: stats.isFile(),
          size: stats.size,
          mode: stats.mode,
          uid: stats.uid,
          gid: stats.gid,
        });
      });
    });
    return result;
  }

  async readFile(sessionId, remotePath) {
    const sftp = await this.ensureSftp(sessionId);
    return new Promise((resolve, reject) => {
      sftp.readFile(remotePath, (err, data) => {
        if (err) return reject(err);
        resolve(data);
      });
    });
  }

  async uploadFile(sessionId, remotePath, buffer) {
    const sftp = await this.ensureSftp(sessionId);
    return new Promise((resolve, reject) => {
      sftp.writeFile(remotePath, buffer, (err) => {
        if (err) return reject(err);
        resolve({ success: true, path: remotePath });
      });
    });
  }

  async mkdir(sessionId, remotePath) {
    const sftp = await this.ensureSftp(sessionId);
    return new Promise((resolve, reject) => {
      sftp.mkdir(remotePath, (err) => {
        if (err) return reject(err);
        resolve({ success: true, path: remotePath });
      });
    });
  }

  async deletePath(sessionId, remotePath) {
    const sftp = await this.ensureSftp(sessionId);
    return new Promise((resolve, reject) => {
      sftp.unlink(remotePath, (err) => {
        if (!err) return resolve({ success: true });
        sftp.rmdir(remotePath, (rmdirErr) => {
          if (rmdirErr) return reject(rmdirErr);
          resolve({ success: true });
        });
      });
    });
  }

  async rename(sessionId, oldPath, newPath) {
    const sftp = await this.ensureSftp(sessionId);
    return new Promise((resolve, reject) => {
      sftp.rename(oldPath, newPath, (err) => {
        if (err) return reject(err);
        resolve({ success: true, oldPath, newPath });
      });
    });
  }

  async chmod(sessionId, remotePath, mode) {
    const sftp = await this.ensureSftp(sessionId);
    return new Promise((resolve, reject) => {
      sftp.chmod(remotePath, mode, (err) => {
        if (err) return reject(err);
        resolve({ success: true, path: remotePath, mode });
      });
    });
  }

  async chown(sessionId, remotePath, uid, gid) {
    const sftp = await this.ensureSftp(sessionId);
    return new Promise((resolve, reject) => {
      sftp.chown(remotePath, uid, gid, (err) => {
        if (err) return reject(err);
        resolve({ success: true, path: remotePath, uid, gid });
      });
    });
  }
}

module.exports = SSHService;
