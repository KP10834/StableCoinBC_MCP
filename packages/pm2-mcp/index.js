import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { execSync } from "child_process";
import { z } from "zod";

const server = new McpServer({ name: "pm2-mcp", version: "1.0.0" });

function exec(cmd) {
  try {
    return execSync(cmd, { encoding: "utf-8", timeout: 10000 }).trim();
  } catch (e) {
    return `ERROR: ${e.message}`;
  }
}

// PM2 프로세스 목록
server.tool(
  "pm2_list",
  "PM2 프로세스 목록 및 상태 조회",
  {},
  async () => {
    try {
      const raw = exec("pm2 jlist");
      const processes = JSON.parse(raw);
      if (processes.length === 0) {
        return { content: [{ type: "text", text: "실행 중인 PM2 프로세스 없음" }] };
      }
      const lines = processes.map((p) => {
        const mem = (p.monit?.memory / 1024 / 1024).toFixed(1);
        const cpu = p.monit?.cpu ?? 0;
        const uptime = p.pm2_env?.pm_uptime ? new Date(p.pm2_env.pm_uptime).toISOString() : "-";
        const restarts = p.pm2_env?.restart_time ?? 0;
        return [
          `### ${p.name} (id: ${p.pm_id})`,
          `- **status**: ${p.pm2_env?.status}`,
          `- **pid**: ${p.pid}`,
          `- **memory**: ${mem} MB`,
          `- **cpu**: ${cpu}%`,
          `- **restarts**: ${restarts}`,
          `- **uptime since**: ${uptime}`,
        ].join("\n");
      });
      return { content: [{ type: "text", text: lines.join("\n\n") }] };
    } catch (e) {
      return { content: [{ type: "text", text: `ERROR: ${e.message}` }] };
    }
  },
);

// PM2 로그 조회
server.tool(
  "pm2_logs",
  "PM2 프로세스 최근 로그 조회",
  {
    name: z.string().optional().describe("프로세스 이름 또는 ID (생략 시 전체)"),
    lines: z.number().default(30).describe("로그 줄 수 (기본: 30)"),
    err: z.boolean().default(false).describe("에러 로그만 보기 (기본: false)"),
  },
  async ({ name, lines, err }) => {
    const target = name || "all";
    const errFlag = err ? " --err" : "";
    const output = exec(`pm2 logs ${target} --nostream --lines ${lines}${errFlag}`);
    return { content: [{ type: "text", text: `## PM2 Logs (${target}, ${lines}줄)\n\`\`\`\n${output}\n\`\`\`` }] };
  },
);

// PM2 프로세스 상세 정보
server.tool(
  "pm2_describe",
  "PM2 프로세스 상세 정보 조회",
  {
    name: z.string().describe("프로세스 이름 또는 ID"),
  },
  async ({ name }) => {
    try {
      const raw = exec(`pm2 jlist`);
      const processes = JSON.parse(raw);
      const p = processes.find((proc) => proc.name === name || String(proc.pm_id) === name);
      if (!p) {
        return { content: [{ type: "text", text: `프로세스 '${name}' 없음` }] };
      }
      const env = p.pm2_env || {};
      const lines = [
        `## ${p.name}`,
        `- **id**: ${p.pm_id}`,
        `- **status**: ${env.status}`,
        `- **pid**: ${p.pid}`,
        `- **memory**: ${(p.monit?.memory / 1024 / 1024).toFixed(1)} MB`,
        `- **cpu**: ${p.monit?.cpu}%`,
        `- **restarts**: ${env.restart_time}`,
        `- **exec_mode**: ${env.exec_mode}`,
        `- **node_version**: ${env.node_version}`,
        `- **script**: ${env.pm_exec_path}`,
        `- **cwd**: ${env.pm_cwd}`,
        `- **created**: ${new Date(env.created_at).toISOString()}`,
        `- **uptime since**: ${new Date(env.pm_uptime).toISOString()}`,
      ];
      if (env.env) {
        const safeKeys = Object.keys(env.env).filter((k) => !k.toLowerCase().includes("password") && !k.toLowerCase().includes("secret") && !k.toLowerCase().includes("key"));
        if (safeKeys.length) {
          lines.push(`\n### Environment (safe keys)`);
          safeKeys.slice(0, 20).forEach((k) => lines.push(`- ${k}: ${env.env[k]}`));
        }
      }
      return { content: [{ type: "text", text: lines.join("\n") }] };
    } catch (e) {
      return { content: [{ type: "text", text: `ERROR: ${e.message}` }] };
    }
  },
);

// PM2 restart
server.tool(
  "pm2_restart",
  "PM2 프로세스 재시작",
  {
    name: z.string().describe("프로세스 이름 또는 ID"),
  },
  async ({ name }) => {
    const output = exec(`pm2 restart ${name}`);
    return { content: [{ type: "text", text: `## Restart: ${name}\n\`\`\`\n${output}\n\`\`\`` }] };
  },
);

// PM2 monit (snapshot)
server.tool(
  "pm2_monit",
  "PM2 전체 프로세스 모니터링 스냅샷 (CPU, 메모리)",
  {},
  async () => {
    try {
      const raw = exec("pm2 jlist");
      const processes = JSON.parse(raw);
      if (processes.length === 0) {
        return { content: [{ type: "text", text: "실행 중인 PM2 프로세스 없음" }] };
      }
      const header = "| Name | ID | Status | CPU | Memory | Restarts |";
      const sep = "| --- | --- | --- | --- | --- | --- |";
      const rows = processes.map((p) => {
        const mem = (p.monit?.memory / 1024 / 1024).toFixed(1);
        return `| ${p.name} | ${p.pm_id} | ${p.pm2_env?.status} | ${p.monit?.cpu}% | ${mem}MB | ${p.pm2_env?.restart_time} |`;
      });
      return { content: [{ type: "text", text: `## PM2 Monitor\n\n${header}\n${sep}\n${rows.join("\n")}` }] };
    } catch (e) {
      return { content: [{ type: "text", text: `ERROR: ${e.message}` }] };
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
