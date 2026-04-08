#!/usr/bin/env node
/**
 * sync-docs: 코드 Zod 스키마와 asyncapi.yaml 비교 및 자동 수정
 *
 * Usage:
 *   npm run sync-docs                                          # 비교만 (dry-run)
 *   npm run sync-docs -- --fix                                 # 자동 수정
 *   npm run sync-docs -- --project /path/to/project            # 프로젝트 경로 지정
 *   npm run sync-docs -- --asyncapi /path/to/asyncapi.yaml     # asyncapi 경로 지정
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { resolve, basename } from "path";
import { parse, stringify } from "yaml";

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : null;
}

// 설정 우선순위: CLI 인자 > package.json의 syncDocs > 기본값
function loadConfig() {
  const projectRoot = resolve(getArg("--project") || process.cwd());

  let pkgConfig = {};
  const pkgPath = resolve(projectRoot, "package.json");
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    pkgConfig = pkg.syncDocs || {};
  }

  return {
    projectRoot,
    handlersDir: resolve(projectRoot, pkgConfig.handlersDir || "src/adapter/in/kafka/handlers"),
    envPath: resolve(projectRoot, pkgConfig.envPath || "src/infra/config/env.ts"),
    asyncapiPath: resolve(projectRoot, getArg("--asyncapi") || pkgConfig.asyncapiPath || "../StableCoinBC_Adapter_Docs/asyncapi.yaml"),
  };
}

const config_ = loadConfig();
const PROJECT_ROOT = config_.projectRoot;
const HANDLERS_DIR = config_.handlersDir;
const ENV_PATH = config_.envPath;
const ASYNCAPI_PATH = config_.asyncapiPath;

const FIX_MODE = process.argv.includes("--fix");

if (!existsSync(HANDLERS_DIR)) {
  console.error(`ERROR: 핸들러 디렉토리 없음: ${HANDLERS_DIR}`);
  process.exit(1);
}
if (!existsSync(ASYNCAPI_PATH)) {
  console.error(`ERROR: asyncapi.yaml 없음: ${ASYNCAPI_PATH}\n\npackage.json에 syncDocs.asyncapiPath를 설정하세요:\n${JSON.stringify({ syncDocs: { asyncapiPath: "../YourDocsRepo/asyncapi.yaml" } }, null, 2)}`);
  process.exit(1);
}

// ─── 1. 코드에서 토픽명 추출 ────────────────────────────────
function extractTopics() {
  const envContent = readFileSync(ENV_PATH, "utf-8");
  const topics = {};
  const re = /(\w+):\s*"(adapter\.[^"]+)"/g;
  let m;
  while ((m = re.exec(envContent))) {
    topics[m[1]] = m[2];
  }
  return topics;
}

// ─── 2. 핸들러에서 Zod 스키마 필드 추출 ──────────────────────
function extractSchemaFields(filePath) {
  const content = readFileSync(filePath, "utf-8");

  // z.object({ ... }) 블록 추출
  const objMatch = content.match(/z\.object\(\{([\s\S]*?)\}\)\s*satisfies/);
  if (!objMatch) return null;

  const body = objMatch[1];
  const fields = {};

  // 각 필드 파싱: fieldName: z.xxx() 또는 fieldName: customValidator
  const lines = body.split("\n");
  for (const line of lines) {
    const trimmed = line.trim().replace(/,$/, "");
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("*"))
      continue;

    const fieldMatch = trimmed.match(/^(\w+):\s*(.+)$/);
    if (!fieldMatch) continue;

    const [, name, typeExpr] = fieldMatch;
    fields[name] = parseZodType(typeExpr);
  }

  return fields;
}

function parseZodType(expr) {
  const info = { type: "string", required: true, nullable: false };

  if (expr.includes(".optional()")) info.required = false;
  if (expr.includes(".nullable()") || expr.includes("z.null()"))
    info.nullable = true;
  if (expr.includes("optional().nullable()") || expr.includes("nullable().optional()")) {
    info.required = false;
    info.nullable = true;
  }

  if (expr.includes("z.number()") || expr.includes("z.coerce.number()"))
    info.type = "number";
  else if (expr.includes("z.boolean()")) info.type = "boolean";
  else if (expr.includes("z.array(")) info.type = "array";
  else if (expr.includes("z.object(")) info.type = "object";
  else info.type = "string";

  return info;
}

// ─── 3. 핸들러에서 errorDefaults 추출 (응답 필드) ────────────
function extractErrorDefaults(filePath) {
  const content = readFileSync(filePath, "utf-8");
  const match = content.match(/errorDefaults:\s*\{([\s\S]*?)\}/);
  if (!match) return {};

  const defaults = {};
  const re = /(\w+):\s*(null|"[^"]*"|TransactionStatus\.\w+)/g;
  let m;
  while ((m = re.exec(match[1]))) {
    defaults[m[1]] = { type: "string", required: false, nullable: true };
  }
  return defaults;
}

// ─── 4. asyncapi.yaml 파싱 ───────────────────────────────────
function loadAsyncApi() {
  const content = readFileSync(ASYNCAPI_PATH, "utf-8");
  return { doc: parse(content), raw: content };
}

// ─── 5. 비교 ─────────────────────────────────────────────────
function compareFields(codeFields, docProps, docRequired) {
  const diffs = [];
  const docFieldNames = docProps ? Object.keys(docProps) : [];
  const codeFieldNames = Object.keys(codeFields);

  // 코드에 있고 문서에 없는 필드
  for (const name of codeFieldNames) {
    if (!docProps || !docProps[name]) {
      diffs.push({
        field: name,
        action: "add",
        detail: `추가 (type: ${codeFields[name].type}${codeFields[name].nullable ? ", nullable" : ""}${!codeFields[name].required ? ", optional" : ""})`,
      });
    } else {
      // 타입 비교
      const docType = docProps[name].type || "string";
      const codeType = codeFields[name].type;
      if (docType !== codeType && !(docType === "integer" && codeType === "number")) {
        diffs.push({
          field: name,
          action: "type",
          detail: `타입 변경 (${docType} → ${codeType})`,
        });
      }

      // nullable 비교
      const docNullable = docProps[name].nullable === true;
      const codeNullable = codeFields[name].nullable;
      if (docNullable !== codeNullable) {
        diffs.push({
          field: name,
          action: "nullable",
          detail: `nullable 변경 (${docNullable} → ${codeNullable})`,
        });
      }
    }
  }

  // 문서에 있고 코드에 없는 필드 (message 제외 - 에러 응답 공통)
  for (const name of docFieldNames) {
    if (!codeFields[name] && name !== "message") {
      diffs.push({
        field: name,
        action: "remove",
        detail: "삭제 (코드에 없음)",
      });
    }
  }

  // required 비교
  const codeRequired = codeFieldNames.filter((f) => codeFields[f].required);
  const docRequiredSet = new Set(docRequired || []);
  for (const f of codeRequired) {
    if (!docRequiredSet.has(f) && docProps && docProps[f]) {
      diffs.push({
        field: f,
        action: "required",
        detail: "required에 추가 필요",
      });
    }
  }

  return diffs;
}

// ─── 6. 수정 적용 ────────────────────────────────────────────
function applyFixes(doc, channelKey, diffs, codeFields) {
  const channel = doc.channels[channelKey];
  if (!channel) return;

  const msgKey = Object.keys(channel.messages)[0];
  const payload = channel.messages[msgKey].payload;
  if (!payload.properties) payload.properties = {};
  if (!payload.required) payload.required = [];

  for (const diff of diffs) {
    if (diff.action === "add") {
      const field = codeFields[diff.field];
      const prop = { type: field.type, description: diff.field };
      if (field.nullable) prop.nullable = true;
      payload.properties[diff.field] = prop;
      if (field.required && !payload.required.includes(diff.field)) {
        payload.required.push(diff.field);
      }
    } else if (diff.action === "remove") {
      delete payload.properties[diff.field];
      payload.required = payload.required.filter((r) => r !== diff.field);
    } else if (diff.action === "type") {
      payload.properties[diff.field].type = codeFields[diff.field].type;
    } else if (diff.action === "nullable") {
      if (codeFields[diff.field].nullable) {
        payload.properties[diff.field].nullable = true;
      } else {
        delete payload.properties[diff.field].nullable;
      }
    } else if (diff.action === "required") {
      if (!payload.required.includes(diff.field)) {
        payload.required.push(diff.field);
      }
    }
  }
}

// ─── 7. 토픽-채널 매핑 ──────────────────────────────────────
function findChannelByAddress(doc, address) {
  for (const [key, ch] of Object.entries(doc.channels)) {
    if (ch.address === address) return key;
  }
  return null;
}

// ─── Main ────────────────────────────────────────────────────
function main() {
  const topics = extractTopics();
  const { doc } = loadAsyncApi();
  const handlerFiles = readdirSync(HANDLERS_DIR).filter((f) =>
    f.endsWith(".handler.ts"),
  );

  let totalDiffs = 0;
  const results = [];

  for (const file of handlerFiles) {
    const filePath = resolve(HANDLERS_DIR, file);
    const fields = extractSchemaFields(filePath);
    if (!fields) continue;

    // 핸들러 파일에서 토픽명 추출
    const content = readFileSync(filePath, "utf-8");

    // 요청 토픽 찾기: 핸들러 이름으로 매칭
    const handlerName = basename(file, ".handler.ts");
    const topicMapping = {
      "account-create": { req: topics.accountCreate, res: topics.accountCreated },
      "account-delete": { req: topics.accountDelete, res: null },
      "account-deploy": { req: topics.accountDeploy, res: topics.accountDeployed },
      withdraw: { req: topics.withdrawRequest, res: topics.withdrawResult },
      payment: { req: topics.paymentRequest, res: topics.paymentResult },
      settlement: { req: topics.settlementRequest, res: topics.settlementResult },
      confirm: { req: topics.commonConfirm, res: topics.commonConfirmed },
      balance: { req: topics.balanceInquiry, res: topics.balanceResult },
      "config-register": { req: topics.configCreate, res: null },
      reconciliation: { req: topics.reconciliationInquiry, res: topics.reconciliationResult },
    };

    const mapping = topicMapping[handlerName];
    if (!mapping) continue;

    // 요청 토픽 비교
    const reqChannel = findChannelByAddress(doc, mapping.req);
    if (!reqChannel) {
      results.push({ topic: mapping.req, type: "missing_channel", diffs: [{ field: "-", action: "add_channel", detail: "채널 전체 누락" }] });
      totalDiffs++;
      continue;
    }

    const channel = doc.channels[reqChannel];
    const msgKey = Object.keys(channel.messages)[0];
    const payload = channel.messages[msgKey].payload;

    const diffs = compareFields(fields, payload.properties, payload.required);
    if (diffs.length > 0) {
      results.push({ topic: mapping.req, channelKey: reqChannel, diffs, codeFields: fields });
      totalDiffs += diffs.length;

      if (FIX_MODE) {
        applyFixes(doc, reqChannel, diffs, fields);
      }
    }

    // 응답 토픽 비교 (errorDefaults 기반)
    if (mapping.res) {
      const errorDefaults = extractErrorDefaults(filePath);
      const resChannel = findChannelByAddress(doc, mapping.res);
      if (resChannel) {
        // 응답 필드 = 성공 필드 + errorDefaults 키들
        // 응답은 구조가 복잡하므로 기본 체크만
        const resPayload = doc.channels[resChannel].messages[Object.keys(doc.channels[resChannel].messages)[0]].payload;
        const errorKeys = Object.keys(errorDefaults);
        for (const key of errorKeys) {
          if (resPayload.properties && !resPayload.properties[key]) {
            results.push({
              topic: mapping.res,
              channelKey: resChannel,
              diffs: [{ field: key, action: "add", detail: `추가 (type: string, nullable)` }],
              codeFields: { [key]: { type: "string", required: false, nullable: true } },
            });
            totalDiffs++;
            if (FIX_MODE) {
              if (!resPayload.properties) resPayload.properties = {};
              resPayload.properties[key] = { type: "string", nullable: true };
            }
          }
        }
      }
    }
  }

  // 결과 출력
  console.log("\n# AsyncAPI 동기화 점검 결과\n");
  console.log(`- 점검 핸들러 수: ${handlerFiles.length}`);
  console.log(`- 불일치 항목: ${totalDiffs}건`);
  console.log(`- 모드: ${FIX_MODE ? "자동 수정 (--fix)" : "비교만 (dry-run)"}\n`);

  if (totalDiffs === 0) {
    console.log("코드와 asyncapi.yaml이 동기화 상태입니다.\n");
    return;
  }

  console.log("## 불일치 상세\n");
  console.log("| 토픽 | 필드 | 변경 내용 |");
  console.log("| --- | --- | --- |");
  for (const r of results) {
    for (const d of r.diffs) {
      console.log(`| ${r.topic} | ${d.field} | ${d.detail} |`);
    }
  }

  if (FIX_MODE) {
    const yamlStr = stringify(doc, { lineWidth: 0 });
    writeFileSync(ASYNCAPI_PATH, yamlStr, "utf-8");
    console.log(`\nasyncapi.yaml 수정 완료: ${ASYNCAPI_PATH}`);
  } else {
    console.log("\n수정하려면: npm run sync-docs -- --fix");
  }
}

main();
