#!/usr/bin/env node
/**
 * setup: MCP 서버 설정 파일 및 슬래시 커맨드를 프로젝트에 복사/갱신
 *
 * Usage:
 *   npx @stablecointf/mcp-servers setup          # 전체 설정
 *   npx @stablecointf/mcp-servers setup --mcp     # MCP 설정만
 *   npx @stablecointf/mcp-servers setup --commands # 슬래시 커맨드만
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, copyFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, "..");
const PROJECT_DIR = process.cwd();

const flags = new Set(process.argv.slice(2));
const all = flags.size === 0 || flags.has("--all");
const doMcp = all || flags.has("--mcp");
const doCommands = all || flags.has("--commands");

let changes = 0;

// ─── MCP 설정 ──────────────────────────────────────────────────

function setupMcp() {
  console.log("\n[ MCP 서버 설정 ]\n");

  // Claude Code: .mcp.json
  const mcpExample = resolve(PKG_ROOT, ".mcp.json.example");
  const mcpTarget = resolve(PROJECT_DIR, ".mcp.json");

  if (!existsSync(mcpTarget)) {
    copyFileSync(mcpExample, mcpTarget);
    console.log("  + .mcp.json 생성 (환경변수를 프로젝트에 맞게 수정하세요)");
    changes++;
  } else {
    const migrated = migrateMcpPaths(mcpTarget);
    if (migrated) {
      console.log("  ~ .mcp.json 경로 갱신 (packages/ → mcp/)");
      changes++;
    } else {
      console.log("  . .mcp.json 이미 최신");
    }
  }

  // VS Code: .vscode/mcp.json
  const vscodeExample = resolve(PKG_ROOT, ".vscode/mcp.json.example");
  const vscodeDir = resolve(PROJECT_DIR, ".vscode");
  const vscodeTarget = resolve(vscodeDir, "mcp.json");

  if (existsSync(vscodeDir)) {
    if (!existsSync(vscodeTarget)) {
      copyFileSync(vscodeExample, vscodeTarget);
      console.log("  + .vscode/mcp.json 생성");
      changes++;
    } else {
      const migrated = migrateMcpPaths(vscodeTarget);
      if (migrated) {
        console.log("  ~ .vscode/mcp.json 경로 갱신 (packages/ → mcp/)");
        changes++;
      } else {
        console.log("  . .vscode/mcp.json 이미 최신");
      }
    }
  }
}

function migrateMcpPaths(filePath) {
  const content = readFileSync(filePath, "utf-8");
  if (!content.includes("/packages/")) return false;

  const updated = content.replace(
    /(@stablecointf\/mcp-servers\/)packages\//g,
    "$1mcp/",
  );
  writeFileSync(filePath, updated, "utf-8");
  return true;
}

// ─── Slash Commands ────────────────────────────────────────────

function setupCommands() {
  console.log("\n[ Slash Commands 설정 ]\n");

  const commandsDir = resolve(PKG_ROOT, "commands");
  if (!existsSync(commandsDir)) {
    console.log("  ! commands/ 디렉토리 없음");
    return;
  }

  const targetDir = resolve(PROJECT_DIR, ".claude", "commands");
  mkdirSync(targetDir, { recursive: true });

  const files = readdirSync(commandsDir).filter((f) => f.endsWith(".md"));

  for (const file of files) {
    const src = resolve(commandsDir, file);
    const dest = resolve(targetDir, file);
    const srcContent = readFileSync(src, "utf-8");

    if (existsSync(dest)) {
      const destContent = readFileSync(dest, "utf-8");
      if (srcContent === destContent) {
        console.log(`  . ${file} 이미 최신`);
        continue;
      }
      copyFileSync(src, dest);
      console.log(`  ~ ${file} 갱신`);
      changes++;
    } else {
      copyFileSync(src, dest);
      console.log(`  + ${file} 추가`);
      changes++;
    }
  }
}

// ─── 실행 ──────────────────────────────────────────────────────

console.log("@stablecointf/mcp-servers setup");

if (doMcp) setupMcp();
if (doCommands) setupCommands();

console.log(`\n완료: ${changes}건 변경\n`);
