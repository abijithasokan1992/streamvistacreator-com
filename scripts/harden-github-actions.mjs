import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workflowsDir = path.join(root, '.github', 'workflows');

// Immutable SHAs are intentionally tied to the versions already used by this repo.
// Sources: resolved GitHub Actions runner logs for active workflows and signed upstream
// GitHub release commits for actions that only run on deploy/scheduled workflows.
const pins = new Map([
  ['actions/checkout@v4', 'actions/checkout@11d5960a326750d5838078e36cf38b85af677262'],
  ['actions/setup-node@v4', 'actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020'],
  ['actions/upload-artifact@v4', 'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02'],
  ['actions/download-artifact@v4', 'actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093'],
  ['actions/github-script@v7', 'actions/github-script@60a0d83039c74a4aee543508d2ffcb1c3799cdea'],
  ['gitleaks/gitleaks-action@v2', 'gitleaks/gitleaks-action@ff98106e4c7b2bc287b24eaf42907196329070c7'],
  ['aquasecurity/trivy-action@v0.36.0', 'aquasecurity/trivy-action@ed142fd0673e97e23eac54620cfb913e5ce36c25'],
  ['github/codeql-action/upload-sarif@v4', 'github/codeql-action/upload-sarif@5595ccaf912efad79be6eef63a5619ff05969be3'],
  ['github/codeql-action/init@v3', 'github/codeql-action/init@a905abd23f045faf57fc7c660951e15358da8ed0'],
  ['github/codeql-action/autobuild@v3', 'github/codeql-action/autobuild@a905abd23f045faf57fc7c660951e15358da8ed0'],
  ['github/codeql-action/analyze@v3', 'github/codeql-action/analyze@a905abd23f045faf57fc7c660951e15358da8ed0'],
  ['actions/configure-pages@v5', 'actions/configure-pages@983d7736d9b0ae728b81ab479565c72886d7745b'],
  ['actions/upload-pages-artifact@v3', 'actions/upload-pages-artifact@56afc609e74202658d3ffba0e8f6dda462b719fa'],
  ['actions/deploy-pages@v4', 'actions/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e'],
  ['zaproxy/action-baseline@v0.12.0', 'zaproxy/action-baseline@66042c8e7e24680119199a017e5b0e8603bf4dae'],
  ['oven-sh/setup-bun@v2', 'oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6'],
]);

let replacements = 0;
for (const entry of fs.readdirSync(workflowsDir, { withFileTypes: true })) {
  if (!entry.isFile() || !/\.ya?ml$/i.test(entry.name)) continue;
  const file = path.join(workflowsDir, entry.name);
  let text = fs.readFileSync(file, 'utf8');
  const before = text;
  for (const [tag, sha] of pins) {
    const occurrences = text.split(tag).length - 1;
    if (occurrences > 0) {
      text = text.split(tag).join(sha);
      replacements += occurrences;
    }
  }
  if (text !== before) fs.writeFileSync(file, text);
}

const unresolved = [];
const usesPattern = /^\s*-?\s*uses:\s*([^\s#]+)\s*/gm;
for (const entry of fs.readdirSync(workflowsDir, { withFileTypes: true })) {
  if (!entry.isFile() || !/\.ya?ml$/i.test(entry.name)) continue;
  const file = path.join(workflowsDir, entry.name);
  const text = fs.readFileSync(file, 'utf8');
  for (const match of text.matchAll(usesPattern)) {
    const ref = match[1];
    if (ref.startsWith('./') || ref.startsWith('docker://')) continue;
    const at = ref.lastIndexOf('@');
    const version = at >= 0 ? ref.slice(at + 1) : '';
    if (!/^[0-9a-f]{40}$/i.test(version)) unresolved.push(`${entry.name}: ${ref}`);
  }
}

console.log(`Pinned ${replacements} mutable GitHub Action reference(s).`);
if (unresolved.length) {
  console.error('Unresolved non-immutable Action references remain:');
  for (const item of unresolved) console.error(`- ${item}`);
  process.exit(1);
}
console.log('All workflow Action references are immutable SHAs.');
