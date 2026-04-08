import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { execSync } from "child_process";
import { z } from "zod";

const server = new McpServer({ name: "error-log-mcp", version: "1.0.0" });

const KNOWN_ERROR_CODES = [
  "VALIDATION_ERROR", "MISSING_REQUIRED_FIELD", "INVALID_STRING",
  "INVALID_ENUM_VALUE", "INVALID_POSITIVE_INT", "INVALID_ADDRESS_FORMAT",
  "INVALID_AMOUNT", "UNSUPPORTED_CHAIN",
  "NOT_FOUND", "ACCOUNT_NOT_FOUND", "TOKEN_NOT_FOUND", "SENDER_NOT_FOUND",
  "RPC_CONNECTION_TIMEOUT", "RPC_CONNECTION_REFUSED", "RPC_NOT_CONFIGURED", "RPC_CALL_FAILED",
  "BUNDLER_BUILD_FAILED", "BUNDLER_SEND_FAILED", "BUNDLER_RECEIPT_FAILED", "BUNDLER_NOT_CONFIGURED",
  "KAFKA_PUBLISH_FAILED",
  "DB_SAVE_FAILED", "DB_QUERY_FAILED",
  "LOCK_ACQUISITION_FAILED",
  "KMS_DECRYPT_FAILED", "KMS_KEY_NOT_FOUND",
  "BUSINESS_ERROR", "NO_AVAILABLE_NETWORK", "UNSUPPORTED_NETWORK",
  "INSUFFICIENT_BALANCE", "DUPLICATE_REQUEST", "ALREADY_DEPLOYED",
  "ADDRESS_MISMATCH", "TRANSACTION_FAILED",
  "UNKNOWN_ERROR",
];

function exec(cmd, timeoutMs = 15000) {
  try {
    return execSync(cmd, { encoding: "utf-8", timeout: timeoutMs }).trim();
  } catch (e) {
    return `ERROR: ${e.message}`;
  }
}

function parsePm2LogLine(line) {
  // PM2 log format: "YYYY-MM-DDTHH:mm:ss: JSON..."
  // or: "N|app-name | JSON..."
  const trimmed = line.trim();
  if (!trimmed) return null;

  let jsonPart = trimmed;

  // Strip PM2 prefix patterns
  const pm2PrefixMatch = trimmed.match(/^\d+\|[^|]+\|\s*(.+)$/);
  if (pm2PrefixMatch) {
    jsonPart = pm2PrefixMatch[1];
  }

  // Strip ISO timestamp prefix
  const tsMatch = jsonPart.match(/^\d{4}-\d{2}-\d{2}T[\d:.]+:\s*(.+)$/);
  if (tsMatch) {
    jsonPart = tsMatch[1];
  }

  try {
    return JSON.parse(jsonPart);
  } catch {
    return null;
  }
}

function isErrorLog(parsed) {
  if (!parsed) return false;
  const level = parsed.level ?? parsed.lvl ?? "";
  return level === 50 || level === "error" || level === "fatal" || level === 60;
}

function extractErrorCode(parsed) {
  if (parsed.errorCode) return parsed.errorCode;
  if (parsed.err?.code) return parsed.err.code;
  if (parsed.code) return parsed.code;

  const msg = parsed.msg || parsed.message || "";
  for (const code of KNOWN_ERROR_CODES) {
    if (msg.includes(code)) return code;
  }
  return "UNCATEGORIZED";
}

function extractTimestamp(parsed) {
  if (parsed.time) return new Date(parsed.time).toISOString();
  if (parsed.timestamp) return parsed.timestamp;
  return null;
}

function filterByTimeRange(entries, minutes) {
  if (!minutes) return entries;
  const cutoff = Date.now() - minutes * 60 * 1000;
  return entries.filter((e) => {
    const ts = extractTimestamp(e.parsed);
    if (!ts) return true;
    return new Date(ts).getTime() >= cutoff;
  });
}

function getLogLines(name, lines) {
  const target = name || "all";
  const raw = exec(`pm2 logs ${target} --nostream --lines ${lines} --err`, 30000);
  if (raw.startsWith("ERROR:")) return [];
  return raw.split("\n");
}

// 최근 에러 조회
server.tool(
  "error_recent",
  "최근 에러 로그 조회 (PM2)",
  {
    name: z.string().optional().describe("프로세스 이름 (생략 시 전체)"),
    count: z.number().default(20).describe("조회할 에러 수 (기본: 20)"),
    minutes: z.number().optional().describe("최근 N분 이내 (생략 시 전체)"),
  },
  async ({ name, count, minutes }) => {
    const lines = getLogLines(name, Math.max(count * 5, 500));
    const errors = [];

    for (const line of lines) {
      const parsed = parsePm2LogLine(line);
      if (isErrorLog(parsed)) {
        errors.push({ parsed, raw: line });
      }
    }

    const filtered = filterByTimeRange(errors, minutes).slice(-count);

    if (filtered.length === 0) {
      const scope = minutes ? `최근 ${minutes}분` : "전체";
      return { content: [{ type: "text", text: `에러 없음 (${scope})` }] };
    }

    const text = filtered
      .map((e, i) => {
        const ts = extractTimestamp(e.parsed) || "?";
        const code = extractErrorCode(e.parsed);
        const msg = e.parsed.msg || e.parsed.message || "";
        const ctx = e.parsed.requestId ? ` | requestId: ${e.parsed.requestId}` : "";
        return `**[${i + 1}]** \`${ts}\` **${code}**${ctx}\n${msg}`;
      })
      .join("\n\n---\n\n");

    return { content: [{ type: "text", text: `## 최근 에러 (${filtered.length}건)\n\n${text}` }] };
  },
);

// 에러코드별 집계
server.tool(
  "error_summary",
  "에러코드별 발생 빈도 집계",
  {
    name: z.string().optional().describe("프로세스 이름 (생략 시 전체)"),
    lines: z.number().default(1000).describe("분석할 로그 줄 수 (기본: 1000)"),
    minutes: z.number().optional().describe("최근 N분 이내 (생략 시 전체)"),
  },
  async ({ name, lines, minutes }) => {
    const logLines = getLogLines(name, lines);
    const errors = [];

    for (const line of logLines) {
      const parsed = parsePm2LogLine(line);
      if (isErrorLog(parsed)) {
        errors.push({ parsed, raw: line });
      }
    }

    const filtered = filterByTimeRange(errors, minutes);

    if (filtered.length === 0) {
      return { content: [{ type: "text", text: "에러 없음" }] };
    }

    const counts = {};
    const lastSeen = {};
    const samples = {};

    for (const e of filtered) {
      const code = extractErrorCode(e.parsed);
      counts[code] = (counts[code] || 0) + 1;
      const ts = extractTimestamp(e.parsed);
      if (ts) lastSeen[code] = ts;
      if (!samples[code]) samples[code] = e.parsed.msg || e.parsed.message || "";
    }

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    const header = "| 에러코드 | 횟수 | 마지막 발생 | 메시지 샘플 |";
    const sep = "| --- | ---: | --- | --- |";
    const rows = sorted.map(([code, cnt]) => {
      const ls = lastSeen[code] || "-";
      const sample = (samples[code] || "").slice(0, 60);
      return `| ${code} | ${cnt} | ${ls} | ${sample} |`;
    });

    const scope = minutes ? `최근 ${minutes}분` : `최근 ${lines}줄`;
    const text = `## 에러 집계 (${scope}, 총 ${filtered.length}건)\n\n${header}\n${sep}\n${rows.join("\n")}`;
    return { content: [{ type: "text", text }] };
  },
);

// 에러 패턴 검색
server.tool(
  "error_search",
  "에러 로그에서 키워드/에러코드 검색",
  {
    name: z.string().optional().describe("프로세스 이름 (생략 시 전체)"),
    query: z.string().describe("검색할 키워드 또는 에러코드 (예: RPC_CALL_FAILED, requestId, txHash)"),
    lines: z.number().default(500).describe("검색할 로그 줄 수 (기본: 500)"),
    count: z.number().default(10).describe("최대 결과 수 (기본: 10)"),
  },
  async ({ name, query, lines, count }) => {
    const logLines = getLogLines(name, lines);
    const matches = [];
    const queryLower = query.toLowerCase();

    for (const line of logLines) {
      if (!line.toLowerCase().includes(queryLower)) continue;

      const parsed = parsePm2LogLine(line);
      if (parsed) {
        matches.push({ parsed, raw: line });
      } else {
        matches.push({ parsed: null, raw: line });
      }
    }

    const results = matches.slice(-count);

    if (results.length === 0) {
      return { content: [{ type: "text", text: `"${query}" 검색 결과 없음 (${lines}줄 탐색)` }] };
    }

    const text = results
      .map((e, i) => {
        if (!e.parsed) {
          return `**[${i + 1}]** \`\`\`\n${e.raw}\n\`\`\``;
        }
        const ts = extractTimestamp(e.parsed) || "?";
        const code = extractErrorCode(e.parsed);
        const msg = e.parsed.msg || e.parsed.message || "";
        const reqId = e.parsed.requestId ? `requestId: ${e.parsed.requestId}` : "";
        const extra = [];
        if (e.parsed.txHash) extra.push(`txHash: ${e.parsed.txHash}`);
        if (e.parsed.chainId) extra.push(`chainId: ${e.parsed.chainId}`);
        if (e.parsed.address) extra.push(`address: ${e.parsed.address}`);
        const context = [reqId, ...extra].filter(Boolean).join(" | ");
        return `**[${i + 1}]** \`${ts}\` **${code}**\n${msg}${context ? `\n_${context}_` : ""}`;
      })
      .join("\n\n---\n\n");

    return {
      content: [{
        type: "text",
        text: `## "${query}" 검색 결과 (${results.length}/${matches.length}건)\n\n${text}`,
      }],
    };
  },
);

// 에러 추이 (시간대별)
server.tool(
  "error_trend",
  "시간대별 에러 발생 추이",
  {
    name: z.string().optional().describe("프로세스 이름 (생략 시 전체)"),
    lines: z.number().default(2000).describe("분석할 로그 줄 수 (기본: 2000)"),
    interval: z.enum(["10m", "30m", "1h"]).default("1h").describe("집계 구간 (기본: 1h)"),
  },
  async ({ name, lines, interval }) => {
    const logLines = getLogLines(name, lines);
    const errors = [];

    for (const line of logLines) {
      const parsed = parsePm2LogLine(line);
      if (isErrorLog(parsed)) {
        errors.push(parsed);
      }
    }

    if (errors.length === 0) {
      return { content: [{ type: "text", text: "에러 없음" }] };
    }

    const intervalMs = interval === "10m" ? 600000 : interval === "30m" ? 1800000 : 3600000;
    const buckets = {};

    for (const e of errors) {
      const ts = extractTimestamp(e);
      if (!ts) continue;
      const t = new Date(ts).getTime();
      const bucketKey = new Date(Math.floor(t / intervalMs) * intervalMs).toISOString().slice(0, 16);
      const code = extractErrorCode(e);

      if (!buckets[bucketKey]) buckets[bucketKey] = { total: 0, codes: {} };
      buckets[bucketKey].total += 1;
      buckets[bucketKey].codes[code] = (buckets[bucketKey].codes[code] || 0) + 1;
    }

    const sorted = Object.entries(buckets).sort((a, b) => a[0].localeCompare(b[0]));

    const header = "| 시간 | 건수 | 주요 에러 |";
    const sep = "| --- | ---: | --- |";
    const rows = sorted.map(([time, data]) => {
      const topCodes = Object.entries(data.codes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([code, cnt]) => `${code}(${cnt})`)
        .join(", ");
      return `| ${time} | ${data.total} | ${topCodes} |`;
    });

    const text = `## 에러 추이 (${interval} 단위)\n\n${header}\n${sep}\n${rows.join("\n")}`;
    return { content: [{ type: "text", text }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
