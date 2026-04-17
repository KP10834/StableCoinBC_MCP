import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { execSync } from "child_process";
import { z } from "zod";

const server = new McpServer({ name: "release-note-mcp", version: "1.0.0" });

const PROJECT_DIR = process.env.PROJECT_DIR || process.cwd();

function exec(cmd, timeoutMs = 15000) {
  try {
    return { ok: true, output: execSync(cmd, { encoding: "utf-8", cwd: PROJECT_DIR, timeout: timeoutMs }).trim() };
  } catch (e) {
    return { ok: false, error: e.stderr?.toString()?.trim() || e.message };
  }
}

const AREA_MAP = [
  { pattern: "account", area: "계정" },
  { pattern: "payment", area: "결제" },
  { pattern: "withdraw", area: "출금" },
  { pattern: "settlement", area: "정산" },
  { pattern: "collection", area: "집금" },
  { pattern: "reconciliation", area: "대사" },
  { pattern: "confirm", area: "트랜잭션 확인" },
  { pattern: "balance", area: "잔액" },
  { pattern: "deposit", area: "입금" },
  { pattern: "config", area: "설정" },
  { pattern: "nonce", area: "동시성 제어" },
  { pattern: "lock", area: "동시성 제어" },
  { pattern: "serial", area: "동시성 제어" },
  { pattern: "kafka", area: "메시징" },
  { pattern: "blockchain", area: "블록체인" },
  { pattern: "bundler", area: "블록체인" },
  { pattern: "persistence", area: "DB" },
  { pattern: "database", area: "DB" },
];

const TYPE_MAP = {
  feat: "새로운 기능",
  fix: "버그 수정",
  refactor: "리팩토링",
  perf: "성능 개선",
  docs: "문서",
  test: "테스트",
  chore: "기타",
  ci: "기타",
  build: "기타",
  style: "기타",
};

function parseCommit(line) {
  const match = line.match(/^([a-f0-9]+)\s+(.+)$/);
  if (!match) return null;
  const [, hash, message] = match;

  const ccMatch = message.match(/^(\w+)(?:\(([^)]*)\))?:\s*(.+)$/);
  let type = "chore";
  let scope = "";
  let description = message;

  if (ccMatch) {
    type = ccMatch[1].toLowerCase();
    scope = ccMatch[2] || "";
    description = ccMatch[3];
  }

  const breaking = message.includes("BREAKING CHANGE") || message.includes("!:");

  return { hash: hash.slice(0, 7), type, scope, description, breaking, raw: message };
}

function detectAreas(files) {
  const areas = new Set();
  for (const file of files) {
    const lower = file.toLowerCase();
    for (const { pattern, area } of AREA_MAP) {
      if (lower.includes(pattern)) {
        areas.add(area);
        break;
      }
    }
  }
  return [...areas];
}

function getChangedFiles(hash) {
  const r = exec(`git diff-tree --no-commit-id --name-only -r ${hash}`);
  if (!r.ok) return [];
  return r.output.split("\n").filter(Boolean);
}

function detectKafkaTopics(allFiles) {
  const topics = new Set();
  for (const file of allFiles) {
    if (file.includes("kafka/handlers/")) {
      const match = file.match(/([^/]+)\.handler\.ts$/);
      if (match) {
        const handler = match[1];
        topics.add(`adapter.${handler.replace("-", ".")}`);
      }
    }
  }
  return [...topics];
}

// --- 도구 ---

server.tool(
  "release_note",
  "커밋 히스토리 기반 릴리즈 노트 생성",
  {
    range: z.string().optional().describe("git ref 범위 (예: v1.0.0..v1.1.0, v1.0.0). 생략 시 최근 태그부터 HEAD"),
  },
  async ({ range }) => {
    // 범위 결정
    let gitRange = range;
    if (!gitRange) {
      const tag = exec("git describe --tags --abbrev=0");
      if (tag.ok && tag.output) {
        gitRange = `${tag.output}..HEAD`;
      } else {
        // 태그 없으면 최근 20커밋
        gitRange = "HEAD~20..HEAD";
      }
    } else if (!gitRange.includes("..")) {
      gitRange = `${gitRange}..HEAD`;
    }

    // 커밋 목록
    const logResult = exec(`git log ${gitRange} --pretty=format:"%H %s" --no-merges`, 30000);
    if (!logResult.ok) {
      return { content: [{ type: "text", text: `ERROR: ${logResult.error}` }] };
    }

    const lines = logResult.output.split("\n").filter(Boolean);
    if (lines.length === 0) {
      return { content: [{ type: "text", text: `${gitRange} 범위에 커밋 없음` }] };
    }

    // 파싱
    const commits = lines.map(parseCommit).filter(Boolean);
    const allChangedFiles = [];

    for (const commit of commits) {
      const files = getChangedFiles(commit.hash);
      commit.files = files;
      commit.areas = detectAreas(files);
      allChangedFiles.push(...files);
    }

    // 기간
    const firstDate = exec(`git log ${gitRange} --pretty=format:"%ci" --no-merges --reverse`);
    const lastDate = exec(`git log ${gitRange} --pretty=format:"%ci" --no-merges -1`);
    const from = firstDate.ok ? firstDate.output.split("\n")[0]?.slice(0, 10) : "?";
    const to = lastDate.ok ? lastDate.output.slice(0, 10) : "?";

    // 분류
    const grouped = {};
    const breakingChanges = [];

    for (const c of commits) {
      const category = TYPE_MAP[c.type] || "기타";
      if (!grouped[category]) grouped[category] = [];
      const areaTag = c.areas.length > 0 ? `**[${c.areas.join(", ")}]** ` : "";
      grouped[category].push(`- ${areaTag}${c.description} (\`${c.hash}\`)`);
      if (c.breaking) breakingChanges.push(`- ${c.description} (\`${c.hash}\`)`);
    }

    // Kafka 토픽
    const topics = detectKafkaTopics([...new Set(allChangedFiles)]);

    // 출력
    const output = [];
    output.push(`# Release Note — ${gitRange}\n`);
    output.push(`**기간**: ${from} ~ ${to}`);
    output.push(`**커밋 수**: ${commits.length}\n`);

    const order = ["새로운 기능", "버그 수정", "리팩토링", "성능 개선", "문서", "테스트", "기타"];
    for (const category of order) {
      if (grouped[category]?.length > 0) {
        output.push(`## ${category}\n`);
        output.push(grouped[category].join("\n"));
        output.push("");
      }
    }

    if (breakingChanges.length > 0) {
      output.push("## Breaking Changes\n");
      output.push(breakingChanges.join("\n"));
      output.push("");
    }

    if (topics.length > 0) {
      output.push("## 영향받는 Kafka 토픽\n");
      output.push(topics.map((t) => `- ${t}`).join("\n"));
    }

    return { content: [{ type: "text", text: output.join("\n") }] };
  },
);

server.tool(
  "release_commits",
  "릴리즈 범위의 커밋 목록 및 변경 파일 조회",
  {
    range: z.string().optional().describe("git ref 범위. 생략 시 최근 태그부터 HEAD"),
  },
  async ({ range }) => {
    let gitRange = range;
    if (!gitRange) {
      const tag = exec("git describe --tags --abbrev=0");
      gitRange = tag.ok && tag.output ? `${tag.output}..HEAD` : "HEAD~20..HEAD";
    } else if (!gitRange.includes("..")) {
      gitRange = `${gitRange}..HEAD`;
    }

    const logResult = exec(`git log ${gitRange} --pretty=format:"%H %s" --no-merges`, 30000);
    if (!logResult.ok) {
      return { content: [{ type: "text", text: `ERROR: ${logResult.error}` }] };
    }

    const lines = logResult.output.split("\n").filter(Boolean);
    if (lines.length === 0) {
      return { content: [{ type: "text", text: `${gitRange} 범위에 커밋 없음` }] };
    }

    const commits = lines.map(parseCommit).filter(Boolean);

    const output = [];
    output.push(`## 커밋 목록 (${gitRange})\n`);
    output.push("| 해시 | 타입 | 설명 | 영역 |");
    output.push("| --- | --- | --- | --- |");

    for (const c of commits) {
      const files = getChangedFiles(c.hash);
      const areas = detectAreas(files).join(", ") || "-";
      output.push(`| \`${c.hash}\` | ${c.type} | ${c.description} | ${areas} |`);
    }

    return { content: [{ type: "text", text: output.join("\n") }] };
  },
);

server.tool(
  "release_tags",
  "태그 목록 조회",
  {},
  async () => {
    const r = exec("git tag --sort=-creatordate --format='%(refname:short) %(creatordate:short)'");
    if (!r.ok || !r.output) {
      return { content: [{ type: "text", text: "태그 없음" }] };
    }

    const tags = r.output.split("\n").filter(Boolean).slice(0, 20);
    const lines = ["## 태그 목록\n", "| 태그 | 날짜 |", "| --- | --- |"];
    for (const tag of tags) {
      const [name, date] = tag.split(" ");
      lines.push(`| ${name} | ${date || "-"} |`);
    }

    return { content: [{ type: "text", text: lines.join("\n") }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
