# 리팩토링 제안 & 린트/타입 자동 수정 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** qa-mcp에 `qa_refactor_check`, `qa_lint_fix` 도구를 추가하고, `/refactor`, `/lint-fix` slash command를 작성한다.

**Architecture:** qa-mcp의 기존 `exec()`, `getChangedFiles()` 헬퍼를 재사용해 두 도구를 추가한다. Slash command는 도구 호출 방법과 결과 해석 절차를 기술하는 마크다운 파일이다.

**Tech Stack:** Node.js ESM, @modelcontextprotocol/sdk, execSync, zod

---

## 파일 변경 목록

| 파일 | 변경 유형 |
|------|---------|
| `mcp/qa-mcp/index.js` | `qa_refactor_check`, `qa_lint_fix` 도구 추가 |
| `commands/refactor.md` | 신규 생성 |
| `commands/lint-fix.md` | 신규 생성 |

---

## Task 1: `qa_refactor_check` 도구 추가

**Files:**
- Modify: `mcp/qa-mcp/index.js` (Tools 섹션 끝부분에 추가)

- [ ] **Step 1: `qa_lint_fix` 도구 등록 바로 위에 `qa_refactor_check` 도구 코드 삽입**

`mcp/qa-mcp/index.js`의 마지막 `server.tool(...)` 블록 이후, `server.connect(...)` 호출 이전에 아래 코드를 추가한다.

```js
server.tool(
  "qa_refactor_check",
  "현재 브랜치의 변경 파일과 diff를 반환 — Claude가 리팩토링 제안에 사용",
  {
    base: z.string().optional().describe("비교 기준 브랜치 (기본: BASE_BRANCH 환경변수)"),
  },
  async ({ base }) => {
    const baseBranch = base || detectParentBranch();
    const changedFiles = getChangedFiles(baseBranch);

    if (changedFiles.length === 0) {
      return { content: [{ type: "text", text: `변경된 파일이 없습니다. (기준: ${baseBranch})` }] };
    }

    const files = [];
    for (const file of changedFiles) {
      const absPath = resolve(PROJECT_DIR, file);
      if (!existsSync(absPath)) continue;

      const content = readFileSync(absPath, "utf-8");
      const diffResult = exec(`git diff ${baseBranch} -- ${file}`, PROJECT_DIR, 10000);
      files.push({
        path: file,
        content,
        diff: diffResult.ok ? diffResult.output : "",
      });
    }

    const lines = [
      `## 변경 파일 목록 (기준: ${baseBranch})\n`,
      `총 ${files.length}개 파일\n`,
    ];

    for (const f of files) {
      lines.push(`### ${f.path}\n`);
      lines.push("**diff:**");
      lines.push("```diff");
      lines.push(f.diff || "(diff 없음)");
      lines.push("```\n");
      lines.push("**전체 내용:**");
      lines.push("```typescript");
      lines.push(f.content);
      lines.push("```\n");
    }

    return { content: [{ type: "text", text: lines.join("\n") }] };
  },
);
```

- [ ] **Step 2: 동작 확인 (수동)**

```bash
cd C:/Users/yrbyun/IdeaProjects/StableCoinMCP
node mcp/qa-mcp/index.js
# 프로세스가 에러 없이 시작되면 OK (Ctrl+C로 종료)
```

Expected: 프로세스가 에러 없이 대기 상태 진입

- [ ] **Step 3: 커밋**

```bash
git add mcp/qa-mcp/index.js
git commit -m "feat(qa-mcp): qa_refactor_check 도구 추가"
```

---

## Task 2: `qa_lint_fix` 도구 추가

**Files:**
- Modify: `mcp/qa-mcp/index.js` (Task 1 코드 이후에 추가)

- [ ] **Step 1: tsc 에러 파싱 헬퍼 함수 추가**

`exec` 함수 정의 바로 아래에 추가한다.

```js
// ─── tsc 에러 파싱 ──────────────────────────────────────────────

function parseTscErrors(output) {
  const errors = [];
  const pattern = /^(.+)\((\d+),(\d+)\): error (TS\d+): (.+)$/gm;
  let match;
  while ((match = pattern.exec(output)) !== null) {
    errors.push({
      file: match[1].trim(),
      line: parseInt(match[2]),
      column: parseInt(match[3]),
      code: match[4],
      message: match[5].trim(),
    });
  }
  return errors;
}
```

- [ ] **Step 2: `qa_lint_fix` 도구 등록**

`qa_refactor_check` 도구 코드 이후에 추가한다.

```js
server.tool(
  "qa_lint_fix",
  "eslint --fix 자동 수정 실행 후 tsc 타입 에러 반환",
  {},
  async () => {
    const lines = ["## 린트 & 타입 검사 결과\n"];

    // 1. eslint --fix
    const eslintResult = exec("npx eslint --fix src/", PROJECT_DIR, 60000);
    const eslintFixed = [];

    if (eslintResult.ok || eslintResult.output) {
      // eslint --fix는 수정 후 exit 0, 수정 불가 에러는 non-zero
      lines.push("### ESLint");
      if (eslintResult.output) {
        lines.push("```");
        lines.push(eslintResult.output.slice(-2000));
        lines.push("```\n");
      } else {
        lines.push("자동 수정 완료 (에러 없음)\n");
      }
    } else {
      lines.push("### ESLint");
      lines.push("```");
      lines.push((eslintResult.error || "").slice(-2000));
      lines.push("```\n");
    }

    // 2. tsc --noEmit
    const tscResult = exec("npx tsc --noEmit", PROJECT_DIR, 120000);
    lines.push("### TypeScript 타입 검사");

    if (tscResult.ok) {
      lines.push("타입 에러 없음 ✅\n");
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }

    const rawOutput = (tscResult.output || "") + (tscResult.error || "");
    const errors = parseTscErrors(rawOutput);

    if (errors.length === 0) {
      lines.push("```");
      lines.push(rawOutput.slice(-3000));
      lines.push("```\n");
    } else {
      lines.push(`\n총 ${errors.length}개 타입 에러:\n`);
      lines.push("| 파일 | 라인 | 코드 | 메시지 |");
      lines.push("| --- | ---: | --- | --- |");
      for (const e of errors) {
        lines.push(`| ${e.file} | ${e.line} | ${e.code} | ${e.message} |`);
      }

      lines.push("\n### 에러 상세\n");
      lines.push("```");
      lines.push(rawOutput.slice(-4000));
      lines.push("```");
    }

    return { content: [{ type: "text", text: lines.join("\n") }] };
  },
);
```

- [ ] **Step 3: 동작 확인 (수동)**

```bash
node mcp/qa-mcp/index.js
# 에러 없이 시작되면 OK
```

- [ ] **Step 4: 커밋**

```bash
git add mcp/qa-mcp/index.js
git commit -m "feat(qa-mcp): qa_lint_fix 도구 추가"
```

---

## Task 3: `/refactor` slash command 작성

**Files:**
- Create: `commands/refactor.md`

- [ ] **Step 1: 파일 생성**

```markdown
현재 브랜치의 변경 코드를 분석하고 리팩토링 제안을 해줘.

## 동작

`qa_refactor_check` MCP 도구를 사용하여 변경 파일을 분석한다.

## 절차

### 1단계: 변경 파일 수집

$ARGUMENTS 가 있으면 옵션으로 파싱:
- `--base <branch>` → `base: "<branch>"` (비교 기준 브랜치 지정)
- 인자 없으면 부모 브랜치 자동 감지

`qa_refactor_check` 도구를 호출해.

### 2단계: 리팩토링 제안

반환된 파일 목록과 diff를 분석해서 아래 기준으로 제안 목록을 만들어:

| 항목 | 설명 |
|------|------|
| 중복 코드 | 동일/유사 로직이 2곳 이상 존재 |
| 책임 분리 | 한 함수/클래스가 너무 많은 일을 함 |
| 네이밍 | 의도가 불명확한 변수/함수명 |
| 불필요한 복잡도 | 단순화 가능한 조건문, 중첩 |
| 패턴 적용 | 기존 코드베이스 패턴과 불일치 |

제안 목록 예시:
```
1. [중복 코드] src/service/foo.ts:42 — getVersion()과 동일 로직이 bar.ts:18에 존재
2. [책임 분리] src/handler/baz.ts — handle() 함수가 검증/변환/저장을 모두 처리
```

### 3단계: 승인 요청

제안 목록을 보여주고 아래 중 하나를 선택하게 해:
- **전체 적용** — 모든 제안 수정
- **선택 적용** — 번호 입력 (예: 1,3)
- **취소** — 수정하지 않음

### 4단계: 코드 수정

승인된 항목을 코드에 직접 반영해. 수정 후 변경 내용을 요약해줘.

## 사용 예시

- `/refactor` — 현재 브랜치 변경 파일 리팩토링 제안
- `/refactor --base main` — main 기준으로 비교
```

- [ ] **Step 2: 커밋**

```bash
git add commands/refactor.md
git commit -m "feat(commands): /refactor slash command 추가"
```

---

## Task 4: `/lint-fix` slash command 작성

**Files:**
- Create: `commands/lint-fix.md`

- [ ] **Step 1: 파일 생성**

```markdown
ESLint 자동 수정을 실행하고 남은 타입 에러를 분석해서 수정해줘.

## 동작

`qa_lint_fix` MCP 도구를 사용하여 자동 수정 후 타입 에러를 분석한다.

## 절차

### 1단계: lint & tsc 실행

`qa_lint_fix` 도구를 호출해.

### 2단계: 결과 해석

| 결과 | 조치 |
|------|------|
| ESLint 수정 완료 + tsc 에러 없음 | "모든 검사 통과" 보고 |
| ESLint 수정 완료 + tsc 에러 있음 | 에러별 수정 제안 후 적용 |
| ESLint 수정 불가 에러 있음 | 수동 수정 필요 항목 안내 |

### 3단계: tsc 에러 수정

에러가 있으면:
1. 에러 목록을 파일별로 그룹핑해서 보여줘
2. 각 에러를 분석하고 원인과 수정 방법을 설명해
3. 코드를 직접 수정해
4. 수정 후 `npx tsc --noEmit`를 다시 실행해서 확인해

## 사용 예시

- `/lint-fix` — ESLint 자동 수정 + tsc 에러 분석 및 수정
```

- [ ] **Step 2: 커밋**

```bash
git add commands/lint-fix.md
git commit -m "feat(commands): /lint-fix slash command 추가"
```

---

## Task 5: setup.mjs에 새 커맨드 등록 확인

**Files:**
- Read: `scripts/setup.mjs`

- [ ] **Step 1: setup.mjs에서 commands 복사 로직 확인**

```bash
grep -n "refactor\|lint-fix\|commands" scripts/setup.mjs
```

commands 디렉토리 전체를 복사하는 방식이면 추가 작업 불필요. 특정 파일명을 하드코딩하는 방식이면 `refactor.md`, `lint-fix.md` 추가 필요.

- [ ] **Step 2: 필요시 setup.mjs 수정 후 커밋**

전체 복사 방식이면 스킵. 하드코딩 방식이면:
```bash
git add scripts/setup.mjs
git commit -m "feat(setup): refactor, lint-fix 커맨드 등록"
```
