import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "cross-impact-mcp", version: "2.0.0" });

// REPOS format: {"adapter": {"repo": "org/repo", "base": "main"}, "backend": {"repo": "org/repo", "base": "master"}}
//   또는 단축: {"adapter": "org/repo"} (base 기본값: main)
const RAW_REPOS = JSON.parse(process.env.REPOS || "{}");
const REPOS = {};
for (const [name, val] of Object.entries(RAW_REPOS)) {
  REPOS[name] = typeof val === "string"
    ? { repo: val, base: "main" }
    : { repo: val.repo, base: val.base || "main" };
}
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_API = (process.env.GITHUB_API_URL || "https://api.github.com").replace(/\/$/, "");

const KAFKA_TOPIC_MAP = [
  { topic: "adapter.account.create", direction: "BE→Adapter", adapterPath: "src/adapter/in/kafka/handlers/", backendPath: "apps/worker/walletcreate/" },
  { topic: "adapter.account.created", direction: "Adapter→BE", adapterPath: "src/adapter/out/kafka/", backendPath: "apps/listener/" },
  { topic: "adapter.account.deploy", direction: "BE→Adapter", adapterPath: "src/adapter/in/kafka/handlers/", backendPath: "apps/worker/deploy/" },
  { topic: "adapter.account.deployed", direction: "Adapter→BE", adapterPath: "src/adapter/out/kafka/", backendPath: "apps/listener/" },
  { topic: "adapter.withdraw.request", direction: "BE→Adapter", adapterPath: "src/adapter/in/kafka/handlers/", backendPath: "apps/worker/withdraw/" },
  { topic: "adapter.withdraw.result", direction: "Adapter→BE", adapterPath: "src/adapter/out/kafka/", backendPath: "apps/listener/" },
  { topic: "adapter.payment.request", direction: "BE→Adapter", adapterPath: "src/adapter/in/kafka/handlers/", backendPath: "apps/worker/payment/" },
  { topic: "adapter.payment.result", direction: "Adapter→BE", adapterPath: "src/adapter/out/kafka/", backendPath: "apps/listener/" },
  { topic: "adapter.settlement.request", direction: "BE→Adapter", adapterPath: "src/adapter/in/kafka/handlers/", backendPath: "apps/settlement-batch/" },
  { topic: "adapter.settlement.result", direction: "Adapter→BE", adapterPath: "src/adapter/out/kafka/", backendPath: "apps/listener/" },
  { topic: "adapter.balance.inquiry", direction: "BE→Adapter", adapterPath: "src/adapter/in/kafka/handlers/", backendPath: "apps/worker/kcpwallet/" },
  { topic: "adapter.balance.result", direction: "Adapter→BE", adapterPath: "src/adapter/out/kafka/", backendPath: "apps/listener/" },
  { topic: "adapter.deposit.detected", direction: "Adapter→BE", adapterPath: "src/adapter/out/kafka/", backendPath: "apps/listener/" },
  { topic: "adapter.reconciliation.inquiry", direction: "BE→Adapter", adapterPath: "src/adapter/in/kafka/handlers/", backendPath: "apps/settlement-batch/walletvalidation/" },
  { topic: "adapter.reconciliation.result", direction: "Adapter→BE", adapterPath: "src/adapter/out/kafka/", backendPath: "apps/listener/" },
  { topic: "adapter.common.confirm", direction: "BE→Adapter", adapterPath: "src/adapter/in/kafka/handlers/", backendPath: "apps/tx-reconciler/" },
  { topic: "adapter.common.confirmed", direction: "Adapter→BE", adapterPath: "src/adapter/out/kafka/", backendPath: "apps/listener/" },
];

// --- GitHub API ---

async function ghFetch(path) {
  const url = path.startsWith("http") ? path : `${GITHUB_API}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

async function getChangedFiles(repo, base, head) {
  const data = await ghFetch(
    `/repos/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`,
  );
  return (data.files || []).map((f) => ({
    filename: f.filename,
    status: f.status,
    patch: f.patch || "",
  }));
}

async function getFileContent(repo, filePath, ref = BASE_BRANCH) {
  try {
    const data = await ghFetch(
      `/repos/${repo}/contents/${filePath}?ref=${encodeURIComponent(ref)}`,
    );
    if (data.encoding === "base64" && data.content) {
      return Buffer.from(data.content, "base64").toString("utf-8");
    }
    return null;
  } catch {
    return null;
  }
}

async function searchCode(repo, query) {
  try {
    const q = encodeURIComponent(`${query} repo:${repo}`);
    const data = await ghFetch(`/search/code?q=${q}&per_page=10`);
    return (data.items || []).map((i) => i.path);
  } catch {
    return [];
  }
}

async function getTree(repo, ref = BASE_BRANCH) {
  try {
    const data = await ghFetch(
      `/repos/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
    );
    return (data.tree || []).filter((t) => t.type === "blob").map((t) => t.path);
  } catch {
    return [];
  }
}

// --- Analysis helpers ---

function identifyAffectedTopics(changedFiles) {
  const affected = [];
  for (const file of changedFiles) {
    for (const mapping of KAFKA_TOPIC_MAP) {
      if (
        file.filename.includes("kafka/handlers/") ||
        file.filename.includes("adapter/out/kafka/") ||
        file.filename.includes("domain/port/") ||
        file.filename.includes("domain/model/")
      ) {
        const topicKey = mapping.topic.split(".").slice(-1)[0];
        const fileKey = file.filename.toLowerCase();
        if (fileKey.includes(topicKey.replace(".", "-")) || fileKey.includes(topicKey.replace(".", "_"))) {
          affected.push({ ...mapping, changedFile: file.filename });
        }
      }
    }
  }
  return affected;
}

// --- Tools ---

server.tool(
  "cross_impact_changes",
  "원격 레포의 변경 파일 목록과 영향받는 cross-repo 연결 지점 조회",
  {
    repo: z.string().describe("분석할 레포 이름 (예: adapter, backend, listener)"),
    head: z.string().describe("비교할 브랜치 또는 태그 (예: feature/abc, v1.2.0)"),
    base: z.string().optional().describe("기준 브랜치 (생략 시 레포별 기본 브랜치)"),
  },
  async ({ repo, head, base }) => {
    const entry = REPOS[repo];
    if (!entry) {
      const available = Object.keys(REPOS).join(", ");
      return { content: [{ type: "text", text: `레포 "${repo}" 없음. 사용 가능: ${available}` }] };
    }

    const baseBranch = base || entry.base;

    try {
      const changedFiles = await getChangedFiles(entry.repo, baseBranch, head);
      if (changedFiles.length === 0) {
        return { content: [{ type: "text", text: "변경 파일 없음" }] };
      }

      const affected = identifyAffectedTopics(changedFiles);

      const result = {
        repo,
        repoFullName: entry.repo,
        base: baseBranch,
        head,
        changedFiles: changedFiles.map((f) => `${f.status} ${f.filename}`),
        affectedTopics: affected,
        summary: `변경 파일 ${changedFiles.length}개, 연결 지점 ${affected.length}개`,
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `ERROR: ${e.message}` }] };
    }
  },
);

server.tool(
  "cross_impact_compare",
  "특정 Kafka 토픽의 양쪽 레포 코드를 원격에서 가져와 비교 데이터 반환",
  {
    topic: z.string().describe("비교할 토픽 (예: adapter.account.create)"),
    sourceRepo: z.string().describe("변경이 발생한 레포 (예: adapter)"),
    head: z.string().describe("변경 브랜치 (예: feature/abc)"),
    base: z.string().optional().describe("기준 브랜치 (생략 시 레포별 기본 브랜치)"),
  },
  async ({ topic, sourceRepo, head, base }) => {
    const sourceEntry = REPOS[sourceRepo];
    if (!sourceEntry) {
      return { content: [{ type: "text", text: `레포 "${sourceRepo}" 없음` }] };
    }

    const mapping = KAFKA_TOPIC_MAP.find((m) => m.topic === topic);
    if (!mapping) {
      const available = KAFKA_TOPIC_MAP.map((m) => m.topic).join("\n  ");
      return { content: [{ type: "text", text: `토픽 "${topic}" 매핑 없음. 사용 가능:\n  ${available}` }] };
    }

    const baseBranch = base || sourceEntry.base;

    try {
      const result = { topic, direction: mapping.direction, source: {}, targets: {} };

      // source: 변경된 파일의 diff
      const changedFiles = await getChangedFiles(sourceEntry.repo, baseBranch, head);
      const topicKey = topic.split(".").pop();
      const relevantChanges = changedFiles.filter((f) =>
        f.filename.toLowerCase().includes(topicKey),
      );

      result.source = {
        repo: sourceRepo,
        repoFullName: sourceEntry.repo,
        head,
        changedFiles: relevantChanges.map((f) => f.filename),
        diffs: {},
      };

      for (const file of relevantChanges) {
        result.source.diffs[file.filename] = file.patch;
      }

      // targets: 상대 레포에서 관련 파일 내용 수집
      for (const [repoName, entry] of Object.entries(REPOS)) {
        if (repoName === sourceRepo || repoName === "docs") continue;

        const relatedFiles = await searchCode(entry.repo, topic);
        if (relatedFiles.length === 0) continue;

        result.targets[repoName] = {};
        for (const filePath of relatedFiles.slice(0, 5)) {
          const content = await getFileContent(entry.repo, filePath, entry.base);
          if (!content) continue;

          const lines = content.split("\n");
          const relevantLines = [];
          lines.forEach((line, i) => {
            if (line.includes(topic) || line.includes(topicKey)) {
              const start = Math.max(0, i - 10);
              const end = Math.min(lines.length, i + 20);
              relevantLines.push({
                file: filePath,
                lineStart: start + 1,
                content: lines.slice(start, end).join("\n"),
              });
            }
          });
          result.targets[repoName][filePath] =
            relevantLines.length > 0
              ? relevantLines
              : [{ file: filePath, lineStart: 1, content: content.slice(0, 3000) }];
        }
      }

      // docs: asyncapi.yaml 체크
      const docsEntry = REPOS["docs"];
      if (docsEntry) {
        const asyncapi = await getFileContent(docsEntry.repo, "asyncapi.yaml", docsEntry.base);
        if (asyncapi) {
          const lines = asyncapi.split("\n");
          const relevantLines = [];
          lines.forEach((line, i) => {
            if (line.includes(topic)) {
              const start = Math.max(0, i - 5);
              const end = Math.min(lines.length, i + 30);
              relevantLines.push({
                lineStart: start + 1,
                content: lines.slice(start, end).join("\n"),
              });
            }
          });
          if (relevantLines.length > 0) {
            result.targets["docs"] = { "asyncapi.yaml": relevantLines };
          }
        }
      }

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `ERROR: ${e.message}` }] };
    }
  },
);

server.tool(
  "cross_impact_repos",
  "등록된 레포 목록 및 연결 관계 조회",
  {},
  async () => {
    const repos = Object.entries(REPOS).map(([name, entry]) => ({ name, ...entry }));
    const text = [
      "## 등록된 레포",
      ...repos.map((r) => `- **${r.name}**: ${r.repo} (base: ${r.base})`),
      "",
      "## 연결 관계",
      "- adapter ↔ backend: Kafka 메시지",
      "- adapter ↔ listener: WebSocket",
      "- adapter ↔ docs: AsyncAPI 스키마",
      "",
      `## Kafka 토픽 (${KAFKA_TOPIC_MAP.length}개)`,
      ...KAFKA_TOPIC_MAP.map((m) => `- ${m.topic} (${m.direction})`),
    ].join("\n");
    return { content: [{ type: "text", text }] };
  },
);

server.prompt(
  "cross-impact-analyze",
  "Cross-repo 영향 분석 프롬프트",
  {
    repo: z.string().describe("분석할 레포 이름"),
    head: z.string().describe("비교할 브랜치"),
    base: z.string().optional().describe("기준 브랜치"),
  },
  ({ repo, head, base }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `현재 ${repo} 레포의 ${head} 브랜치 변경이 연관 프로젝트에 미치는 영향을 분석해줘.

## 분석 절차

1. cross_impact_changes 도구로 변경 파일과 영향받는 연결 지점을 조회해.
   - repo: "${repo}", head: "${head}"${base ? `, base: "${base}"` : ""}
2. 연결 지점이 있으면 cross_impact_compare 도구로 각 토픽의 양쪽 코드를 비교해.
3. 아래 기준으로 호환성을 판단해:

### 심각도 기준
- **CRITICAL**: 배포 시 즉시 에러 (필드명 변경, 필수 필드 누락, 타입 불일치)
- **WARNING**: 동작하지만 데이터 유실 가능 (새 필드 무시됨, 선택 필드 변경)
- **INFO**: 문서 업데이트 필요 (AsyncAPI 불일치)

### 체크 항목
- 필드명 불일치 (한쪽에서 변경, 상대쪽 미반영)
- 필드 추가/삭제 (상대쪽 파싱 문제)
- 타입 변경 (string→number 등)
- 필수/선택 변경
- 토픽명 변경
- WebSocket 메시지 포맷 변경
- AsyncAPI 스키마 불일치

## 출력 형식

# Cross-Repo 영향 분석

## 변경 범위
- 프로젝트: ...
- 비교: ${base || "main"} → ${head}
- 변경 파일 수: N개
- 연결 지점 변경: N개

## 영향 분석 결과

### CRITICAL
| 대상 프로젝트 | 파일 | 내용 | 조치 |
|-------------|------|------|------|

### WARNING
| 대상 프로젝트 | 파일 | 내용 | 조치 |
|-------------|------|------|------|

### INFO
| 대상 프로젝트 | 파일 | 내용 | 조치 |
|-------------|------|------|------|

## 요약
- CRITICAL: N건
- WARNING: N건
- INFO: N건`,
      },
    }],
  }),
);

const transport = new StdioServerTransport();
await server.connect(transport);
