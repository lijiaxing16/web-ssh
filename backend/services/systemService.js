class SystemService {
  constructor(sshService) {
    this.sshService = sshService;
  }

  async getSystemInfo(sessionId) {
    const result = await this.sshService.runCommand(sessionId, 'uname -a 2>/dev/null; echo "---OS---"; cat /etc/os-release 2>/dev/null | head -n 20; echo "---HOST---"; hostname 2>/dev/null; echo "---WHOAMI---"; whoami 2>/dev/null; echo "---IP---"; (hostname -I 2>/dev/null || ip addr show 2>/dev/null | grep -Eo "inet (addr:)?([0-9]+\\.){3}[0-9]+" | head -n 5 || true)');
    return { raw: result.combined, output: result.combined };
  }

  async getSystemMonitor(sessionId) {
    const memory = await this.sshService.runCommand(sessionId, 'free -m 2>/dev/null || vm_stat 2>/dev/null || true');
    const disk = await this.sshService.runCommand(sessionId, 'df -h 2>/dev/null || true');
    const load = await this.sshService.runCommand(sessionId, 'cat /proc/loadavg 2>/dev/null || uptime 2>/dev/null || true');
    const cpu = await this.sshService.runCommand(sessionId, 'grep -m1 "model name" /proc/cpuinfo 2>/dev/null || uname -m || true');

    const memoryMetrics = this.parseMemory(memory.combined);
    const diskMetrics = this.parseDisk(disk.combined);

    return {
      cpu: cpu.combined.trim(),
      load: load.combined.trim(),
      memory: memoryMetrics,
      disk: diskMetrics,
    };
  }

  parseMemory(raw) {
    const lines = raw.split('\n');
    const memLine = lines.find((line) => line.toLowerCase().startsWith('mem:'));
    if (!memLine) {
      return {
        total: 0,
        used: 0,
        free: 0,
        available: 0,
        cached: 0,
      };
    }

    const values = memLine.trim().split(/\s+/).slice(1).map(Number);
    return {
      total: values[0] || 0,
      used: values[1] || 0,
      free: values[2] || 0,
      shared: values[3] || 0,
      cache: values[4] || 0,
      available: values[5] || 0,
    };
  }

  parseDisk(raw) {
    const lines = raw.split('\n').filter(Boolean); 
    if (lines.length < 2) return [];

    return lines.slice(1).map((line) => {
      const columns = line.trim().split(/\s+/);
      if (columns.length < 6) return null;
      return {
        filesystem: columns[0],
        size: columns[1],
        used: columns[2],
        available: columns[3],
        usage: columns[4],
        mount: columns[5],
      };
    }).filter(Boolean);
  }

  async getProcesses(sessionId) {
    const command = 'ps -eo pid,ppid,comm,%cpu,%mem,rss,vsz,stat --sort=-%cpu | head -n 25 2>/dev/null || ps -A -o pid,comm,%cpu,%mem,rss,stat --sort=-%cpu 2>/dev/null || true';
    const result = await this.sshService.runCommand(sessionId, command);

    const lines = result.combined.split('\n').filter((line) => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].trim().split(/\s+/);
    const rows = lines.slice(1).map((line) => {
      const parts = line.trim().split(/\s+/);
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = parts[index] || '';
      });
      return obj;
    });

    return rows;
  }

  async killProcess(sessionId, pid, signal = 'TERM') {
    const command = `kill -${signal} ${pid} 2>/dev/null || pkill -${signal} -P ${pid} 2>/dev/null || true`;
    const result = await this.sshService.runCommand(sessionId, command);
    return { success: true, output: result.combined.trim() };
  }
}

module.exports = SystemService;
