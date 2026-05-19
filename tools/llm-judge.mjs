#!/usr/bin/env node
import Anthropic from '@anthropic-ai/sdk';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const SYSTEM_INSTRUCTIONS = `You are a strict code-review judge. Review the provided git diff against
the behavioral rules in the <agents_md> document.
Rules of engagement:
1. Check ONLY the rules explicitly stated in <agents_md>. Do not invent
   rules. Do not flag style, formatting, or general code quality.
2. Each finding must reference a specific rule by its heading.
3. Findings must be agent-instructive: include the file, location,
   the violated rule, why it violates, and a concrete fix.
Respond ONLY with a JSON object matching this schema:
{
  "status": "pass" | "fail",
  "findings": [
    {
      "rule": "<rule heading from agents_md>",
      "file": "<path>",
      "location": "<symbol or line range>",
      "issue": "<one-sentence description>",
      "fix": "<one-or-two-sentence concrete action>"
    }
  ]
}
If there are no violations, return {"status": "pass", "findings": []}.
Do not wrap the JSON in markdown fences.`;

const args = process.argv.slice(2);
let base = 'main';
let includeWorktree = false;

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];

  if (arg === '--base') {
    const value = args[i + 1];
    if (!value) {
      console.error('usage: node tools/llm-judge.mjs [--base <ref>] [--worktree]');
      process.exit(2);
    }

    base = value;
    i += 1;
    continue;
  }

  if (arg === '--worktree') {
    includeWorktree = true;
    continue;
  }

  console.error(`unknown argument: ${arg}`);
  console.error('usage: node tools/llm-judge.mjs [--base <ref>] [--worktree]');
  process.exit(2);
}

let diff;
try {
  diff = readDiff(base, includeWorktree);
} catch (error) {
  console.error(`failed to read git diff against ${base}:`);
  printCommandError(error);
  process.exit(2);
}

if (diff.trim().length === 0) {
  console.log('no changes; nothing to review');
  process.exit(0);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is not set. Export it before running the policy judge.');
  process.exit(3);
}

let agentsMdContent;
try {
  agentsMdContent = readFileSync('AGENTS.md', 'utf8');
} catch (error) {
  console.error('failed to read AGENTS.md:');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 15_000,
});

let response;
try {
  response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    temperature: 0,
    system: [
      { type: 'text', text: SYSTEM_INSTRUCTIONS, cache_control: { type: 'ephemeral' } },
      {
        type: 'text',
        text: `<agents_md>\n${agentsMdContent}\n</agents_md>`,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `<diff>\n${diff}\n</diff>`,
          },
        ],
      },
    ],
  });
} catch (error) {
  console.error('Anthropic API call failed:');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(4);
}

if (process.env.JUDGE_SHOW_USAGE === '1') {
  console.error(`judge: usage ${JSON.stringify(response.usage)}`);
}

const rawResponse = response.content
  .filter(block => block.type === 'text')
  .map(block => block.text)
  .join('\n')
  .trim();

let verdict;
try {
  verdict = JSON.parse(rawResponse);
} catch (_) {
  console.error('failed to parse judge response as JSON:');
  console.error(rawResponse);
  process.exit(2);
}

if (!isValidVerdict(verdict)) {
  console.error('judge response JSON did not match the expected schema:');
  console.error(rawResponse);
  process.exit(2);
}

if (verdict.status === 'pass') {
  console.log('judge: pass (0 findings)');
  process.exit(0);
}

console.log(`judge: FAIL (${verdict.findings.length} findings)`);
verdict.findings.forEach((finding, index) => {
  console.log(`[${index + 1}] Rule: ${finding.rule}`);
  console.log(`    File: ${finding.file}`);
  console.log(`    Location: ${finding.location}`);
  console.log(`    Issue: ${finding.issue}`);
  console.log(`    Fix: ${finding.fix}`);
});
process.exit(1);

function isValidVerdict(value) {
  if (!value || typeof value !== 'object') {
    return false;
  }

  if (value.status !== 'pass' && value.status !== 'fail') {
    return false;
  }

  if (!Array.isArray(value.findings)) {
    return false;
  }

  if (value.status === 'pass' && value.findings.length !== 0) {
    return false;
  }

  if (value.status === 'fail' && value.findings.length === 0) {
    return false;
  }

  return value.findings.every(finding => {
    return (
      finding &&
      typeof finding === 'object' &&
      typeof finding.rule === 'string' &&
      typeof finding.file === 'string' &&
      typeof finding.location === 'string' &&
      typeof finding.issue === 'string' &&
      typeof finding.fix === 'string'
    );
  });
}

function readDiff(baseRef, worktree) {
  const committedDiff = execFileSync('git', ['diff', `${baseRef}...HEAD`], {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });

  if (!worktree) {
    return committedDiff;
  }

  const stagedDiff = execFileSync('git', ['diff', '--cached'], {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });
  const unstagedDiff = execFileSync('git', ['diff'], {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });
  const untrackedDiff = readUntrackedDiff();

  return [committedDiff, stagedDiff, unstagedDiff, untrackedDiff].filter(part => part.trim().length > 0).join('\n');
}

function readUntrackedDiff() {
  const untrackedFiles = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  })
    .split('\n')
    .map(file => file.trim())
    .filter(Boolean);

  return untrackedFiles.map(file => readNoIndexDiff(file)).filter(Boolean).join('\n');
}

function readNoIndexDiff(file) {
  try {
    return execFileSync('git', ['diff', '--no-index', '--', '/dev/null', file], {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (error) {
    if (error && typeof error === 'object' && error.status === 1 && error.stdout) {
      return String(error.stdout);
    }

    throw error;
  }
}

function printCommandError(error) {
  if (error && typeof error === 'object') {
    if (error.stderr) {
      console.error(String(error.stderr).trim());
      return;
    }

    if (error.message) {
      console.error(error.message);
      return;
    }
  }

  console.error(String(error));
}
