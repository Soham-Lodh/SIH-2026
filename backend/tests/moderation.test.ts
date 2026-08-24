import assert from 'node:assert/strict';
import test from 'node:test';
import { moderateChatInput } from '../server/lib/moderation.ts';

test('chat moderation permits normal disaster research', () => {
  assert.deepEqual(moderateChatInput('What flood warnings are active in Assam?'), { allowed: true });
});

test('chat moderation blocks normalized abuse and threats', () => {
  assert.equal(moderateChatInput('You are an 1d10t').allowed, false);
  assert.equal(moderateChatInput('kill yourself').allowed, false);
  assert.equal(moderateChatInput('চোদা').allowed, false);
});

test('chat moderation rejects oversized input', () => {
  assert.equal(moderateChatInput('x'.repeat(4001)).allowed, false);
});
