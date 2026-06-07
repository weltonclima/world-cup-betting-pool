#!/usr/bin/env node
// PreToolUse hook for Skill tool.
// Reads target skill's SKILL.md frontmatter (model + effort), compares against
// current session model. Blocks invocation if mismatch and tells user to run
// /model <required>. Closest-to-automatic model switch Claude Code allows.

const fs = require('fs');
const path = require('path');
const os = require('os');

function readStdin() {
  try { return fs.readFileSync(0, 'utf-8'); } catch { return ''; }
}

function parseFrontmatter(content) {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([a-zA-Z_-]+)\s*:\s*(.+?)\s*$/);
    if (kv) out[kv[1].toLowerCase()] = kv[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

function normalizeModel(raw) {
  if (!raw) return null;
  const s = String(raw).toLowerCase();
  if (s.includes('opus')) return 'opus';
  if (s.includes('sonnet')) return 'sonnet';
  if (s.includes('haiku')) return 'haiku';
  return s;
}

function findSkillFile(skillName, cwd) {
  const localName = skillName.includes(':') ? skillName.split(':').pop() : skillName;
  const candidates = [
    path.join(cwd, '.claude', 'skills', skillName, 'SKILL.md'),
    path.join(cwd, '.claude', 'skills', localName, 'SKILL.md'),
    path.join(os.homedir(), '.claude', 'skills', skillName, 'SKILL.md'),
    path.join(os.homedir(), '.claude', 'skills', localName, 'SKILL.md'),
  ];
  for (const p of candidates) {
    try { if (fs.statSync(p).isFile()) return p; } catch {}
  }
  return null;
}

function readCurrentModelFromTranscript(transcriptPath) {
  if (!transcriptPath) return null;
  try {
    const raw = fs.readFileSync(transcriptPath, 'utf-8');
    const lines = raw.trim().split(/\r?\n/);
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (!line) continue;
      try {
        const obj = JSON.parse(line);
        const model = obj?.message?.model || obj?.model;
        if (model) return model;
      } catch {}
    }
  } catch {}
  return null;
}

function exitAllow() { process.exit(0); }

function exitBlock(reason) {
  const payload = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  };
  process.stdout.write(JSON.stringify(payload));
  process.exit(0);
}

function main() {
  const raw = readStdin();
  let input;
  try { input = JSON.parse(raw); } catch { exitAllow(); }

  if (input.tool_name !== 'Skill') exitAllow();

  const skillName = input?.tool_input?.skill;
  if (!skillName) exitAllow();

  const cwd = input.cwd || process.cwd();
  const skillFile = findSkillFile(skillName, cwd);
  if (!skillFile) exitAllow();

  const fm = parseFrontmatter(fs.readFileSync(skillFile, 'utf-8'));
  if (!fm || !fm.model) exitAllow();

  const targetModel = normalizeModel(fm.model);
  if (!targetModel) exitAllow();

  const currentRaw = readCurrentModelFromTranscript(input.transcript_path)
    || process.env.CLAUDE_MODEL
    || process.env.ANTHROPIC_MODEL;
  const currentModel = normalizeModel(currentRaw);

  if (!currentModel) exitAllow();
  if (currentModel === targetModel) exitAllow();

  const effort = fm.effort || 'medium';
  const reason =
    `MODEL MISMATCH. Skill "${skillName}" requires model: ${targetModel} (effort: ${effort}). ` +
    `Current session model: ${currentModel}. ` +
    `Do NOT call the Skill tool directly. Instead, dispatch the skill as a subagent so the right model runs:\n\n` +
    `Agent({\n` +
    `  subagent_type: "general-purpose",\n` +
    `  model: "${targetModel}",\n` +
    `  description: "Run ${skillName} skill",\n` +
    `  prompt: "Invoke the '${skillName}' skill via the Skill tool and execute it fully on the user's request. User request: <quote the original user request here verbatim>"\n` +
    `})\n\n` +
    `The subagent will run in ${targetModel}, invoke the Skill tool internally (hook allows it since model matches), and return the result.`;

  exitBlock(reason);
}

try { main(); } catch (e) {
  process.stderr.write(`skill-model-guard error: ${e?.message || e}\n`);
  exitAllow();
}
