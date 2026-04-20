import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  toPascalCase,
  toKebabCase,
  toZodType,
  generatePortContent,
  generateServiceContent,
  generateHandlerContent,
} from '../mcp/board-dev-mcp/generator.js';

test('toPascalCase', () => {
  assert.equal(toPascalCase('networkInquiry'), 'NetworkInquiry');
  assert.equal(toPascalCase('contract'), 'Contract');
});

test('toKebabCase', () => {
  assert.equal(toKebabCase('networkInquiry'), 'network-inquiry');
  assert.equal(toKebabCase('contract'), 'contract');
});

test('toZodType', () => {
  assert.equal(toZodType('string'), 'z.string()');
  assert.equal(toZodType('number'), 'z.number()');
  assert.equal(toZodType('boolean'), 'z.boolean()');
});

test('generatePortContent - 필드 포함 확인', () => {
  const content = generatePortContent(
    'NetworkInquiry',
    'network-inquiry',
    { requestId: 'string', chainId: 'string' },
    { networkId: 'string', blockNumber: 'number' },
  );
  assert.ok(content.includes('export interface NetworkInquiryRequest'));
  assert.ok(content.includes('requestId: string;'));
  assert.ok(content.includes('chainId: string;'));
  assert.ok(content.includes('export interface NetworkInquiryResult'));
  assert.ok(content.includes('blockNumber: number;'));
  assert.ok(content.includes('export interface NetworkInquiryUseCase'));
});

test('generateServiceContent - 기본 구조 확인', () => {
  const content = generateServiceContent('NetworkInquiry', 'network-inquiry', 'networkInquiry');
  assert.ok(content.includes('import { NetworkInquiryRequest, NetworkInquiryResult, NetworkInquiryUseCase }'));
  assert.ok(content.includes('export class NetworkInquiryService implements NetworkInquiryUseCase'));
  assert.ok(content.includes('throw new Error("Not implemented")'));
});

test('generateHandlerContent - zod schema 확인', () => {
  const content = generateHandlerContent(
    'NetworkInquiry',
    'network-inquiry',
    'networkInquiry',
    { requestId: 'string', chainId: 'string' },
  );
  assert.ok(content.includes('requestId: z.string()'));
  assert.ok(content.includes('chainId: z.string()'));
  assert.ok(content.includes('export function networkInquiryHandler('));
});
