#!/usr/bin/env node
/**
 * setup: MCP 서버 설정 파일 및 슬래시 커맨드를 프로젝트에 복사/갱신
 *
 * Usage:
 *   npx @stablecointf/mcp-servers setup          # 전체 설정
 *   npx @stablecointf/mcp-servers setup --mcp     # MCP 설정만
 *   npx @stablecointf/mcp-servers setup --commands # 슬래시 커맨드만
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, copyFileSync, statSync } from "fs";
import { resolve, dirname, relative } from "path";
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

  copyCommandsRecursive(commandsDir, targetDir, commandsDir);
}

function copyCommandsRecursive(srcDir, targetDir, rootDir) {
  const entries = readdirSync(srcDir);

  for (const entry of entries) {
    const src = resolve(srcDir, entry);
    const stat = statSync(src);

    if (stat.isDirectory()) {
      const subTarget = resolve(targetDir, entry);
      mkdirSync(subTarget, { recursive: true });
      copyCommandsRecursive(src, subTarget, rootDir);
    } else if (entry.endsWith(".md")) {
      const dest = resolve(targetDir, entry);
      const relPath = relative(rootDir, src);
      const srcContent = readFileSync(src, "utf-8");

      if (existsSync(dest)) {
        const destContent = readFileSync(dest, "utf-8");
        if (srcContent === destContent) {
          console.log(`  . ${relPath} 이미 최신`);
          continue;
        }
        copyFileSync(src, dest);
        console.log(`  ~ ${relPath} 갱신`);
        changes++;
      } else {
        copyFileSync(src, dest);
        console.log(`  + ${relPath} 추가`);
        changes++;
      }
    }
  }
}

// ─── 실행 ──────────────────────────────────────────────────────

console.log("@stablecointf/mcp-servers setup");

if (doMcp) setupMcp();
if (doCommands) setupCommands();

console.log(`\n완료: ${changes}건 변경\n`);
