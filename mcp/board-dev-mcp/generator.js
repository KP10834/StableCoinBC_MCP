export function toPascalCase(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function toKebabCase(str) {
  return str.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`);
}

export function toZodType(type) {
  if (type === 'number') return 'z.number()';
  if (type === 'boolean') return 'z.boolean()';
  return 'z.string()';
}

export function generatePortContent(pascal, kebab, reqFields, resFields) {
  const reqLines = Object.entries(reqFields).map(([k, t]) => `  ${k}: ${t};`).join('\n');
  const resLines = Object.entries(resFields).map(([k, t]) => `  ${k}: ${t};`).join('\n');
  return [
    `export interface ${pascal}Request {`,
    reqLines,
    `}`,
    ``,
    `export interface ${pascal}Result {`,
    resLines,
    `}`,
    ``,
    `export interface ${pascal}UseCase {`,
    `  handle(req: ${pascal}Request): Promise<${pascal}Result>;`,
    `}`,
    ``,
  ].join('\n');
}

export function generateServiceContent(pascal, kebab, topicKey) {
  return [
    `import { ${pascal}Request, ${pascal}Result, ${pascal}UseCase } from "@domain/port/in/${kebab}.port";`,
    `import { createLogger } from "@infra/logger/logger";`,
    ``,
    `const logger = createLogger("${pascal}Service");`,
    ``,
    `export class ${pascal}Service implements ${pascal}UseCase {`,
    `  async handle(req: ${pascal}Request): Promise<${pascal}Result> {`,
    `    logger.info({ requestId: req.requestId }, "${pascal} handle called");`,
    `    throw new Error("Not implemented");`,
    `  }`,
    `}`,
    ``,
  ].join('\n');
}

export function generateHandlerContent(pascal, kebab, topicKey, reqFields) {
  const zodLines = Object.entries(reqFields).map(([k, t]) => `  ${k}: ${toZodType(t)},`).join('\n');
  return [
    `import { z } from "zod";`,
    ``,
    `import { ${pascal}Request, ${pascal}Result, ${pascal}UseCase } from "@domain/port/in/${kebab}.port";`,
    ``,
    `import { createHandlerConfig, HandlerConfig } from "./register";`,
    ``,
    `const schema = z.object({`,
    zodLines,
    `}) satisfies z.ZodType<${pascal}Request>;`,
    ``,
    `export function ${topicKey}Handler(`,
    `  service: ${pascal}UseCase,`,
    `  requestTopic: string,`,
    `  responseTopic: string,`,
    `): HandlerConfig<${pascal}Request, ${pascal}Result> {`,
    `  return createHandlerConfig({`,
    `    schema,`,
    `    service,`,
    `    requestTopic,`,
    `    responseTopic,`,
    `    label: "${pascal}Request",`,
    `  });`,
    `}`,
    ``,
  ].join('\n');
}

export function updateIndexTs(content, pascal, kebab, topicKey) {
  let result = content;

  result = result.replace(
    `import { ContractUseCase } from "@domain/port/in/contract.port";`,
    `import { ContractUseCase } from "@domain/port/in/contract.port";\nimport { ${pascal}UseCase } from "@domain/port/in/${kebab}.port";`,
  );

  result = result.replace(
    `import { contractHandler } from "./contract.handler";`,
    `import { contractHandler } from "./contract.handler";\nimport { ${topicKey}Handler } from "./${kebab}.handler";`,
  );

  result = result.replace(
    `contractService: ContractUseCase;`,
    `contractService: ContractUseCase;\n  ${topicKey}Service: ${pascal}UseCase;`,
  );

  result = result.replace(
    `contractHandler(services.contractService, RequestTopics.contractInquiry, ResponseTopics.contractResult)];`,
    `contractHandler(services.contractService, RequestTopics.contractInquiry, ResponseTopics.contractResult),\n    ${topicKey}Handler(services.${topicKey}Service, RequestTopics.${topicKey}, ResponseTopics.${topicKey}Result)];`,
  );

  return result;
}

export function updateEnvTs(content, topicKey, kebab) {
  let result = content;

  result = result.replace(
    `infraInquiry: "adapter.board.infra.request",`,
    `infraInquiry: "adapter.board.infra.request",\n        ${topicKey}: "adapter.board.${kebab}.request",`,
  );

  result = result.replace(
    `infraResult: "adapter.board.infra.result",`,
    `infraResult: "adapter.board.infra.result",\n        ${topicKey}Result: "adapter.board.${kebab}.result",`,
  );

  return result;
}
