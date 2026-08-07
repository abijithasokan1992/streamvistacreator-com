import fs from 'node:fs';

function replaceOnce(path, from, to, label) {
  let text = fs.readFileSync(path, 'utf8');
  if (!text.includes(from)) return false;
  const count = text.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one target, found ${count}`);
  text = text.replace(from, to);
  fs.writeFileSync(path, text);
  return true;
}

function replaceExactCount(path, from, to, expected, label) {
  let text = fs.readFileSync(path, 'utf8');
  if (!text.includes(from)) return false;
  const count = text.split(from).length - 1;
  if (count !== expected) throw new Error(`${label}: expected ${expected} targets, found ${count}`);
  text = text.split(from).join(to);
  fs.writeFileSync(path, text);
  return true;
}

let changes = 0;

changes += Number(replaceOnce(
  'src/components/streamvista/Pricing.tsx',
  '<dl className="space-y-3">',
  '<div className="space-y-3">',
  'pricing FAQ opening element',
));
changes += Number(replaceOnce(
  'src/components/streamvista/Pricing.tsx',
  '        </dl>\n      </div>\n    </div>\n  );\n}\n\n\nfunction shortCycle',
  '        </div>\n      </div>\n    </div>\n  );\n}\n\n\nfunction shortCycle',
  'pricing FAQ closing element',
));

changes += Number(replaceOnce(
  'src/pages/Contact.tsx',
  'font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent mb-3',
  'font-mono-tech text-[10px] uppercase tracking-[0.3em] text-foreground mb-3',
  'contact eyebrow contrast',
));
changes += Number(replaceExactCount(
  'src/pages/Contact.tsx',
  'className="text-accent hover:underline"',
  'className="text-foreground underline decoration-accent/70 underline-offset-2 hover:text-accent"',
  2,
  'contact link contrast',
));

changes += Number(replaceOnce(
  'src/components/streamvista/Footer.tsx',
  '<span className="opacity-60"> · Ernakulam, Kerala, India.</span>',
  '<span> · Ernakulam, Kerala, India.</span>',
  'footer location contrast',
));

// Remediate OSV findings instead of suppressing them. @lovable.dev/mcp-js 0.25.0
// is held on the reviewed package version while its vulnerable transitive packages
// are forced onto patched compatible releases. Hono must be a top-level override:
// nesting it under the already-overridden MCP SDK leaves npm resolving 1.19.17.
const packagePath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const desiredOverrides = {
  '@lovable.dev/mcp-js': {
    '@modelcontextprotocol/sdk': '1.30.0',
    esbuild: '0.28.1',
  },
  '@hono/node-server': '2.0.12',
};
if (JSON.stringify(pkg.overrides ?? {}) !== JSON.stringify(desiredOverrides)) {
  pkg.overrides = desiredOverrides;
  fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
  changes += 1;
}

// Do not permit advisory suppression as release evidence.
if (fs.existsSync('osv-scanner.toml')) {
  fs.rmSync('osv-scanner.toml');
  changes += 1;
}
const securityPath = '.github/workflows/security.yml';
let security = fs.readFileSync(securityPath, 'utf8');
const ignoredOsv = 'scan --config=osv-scanner.toml --lockfile=package-lock.json --format=sarif --output=osv.sarif';
const strictOsv = 'scan --lockfile=package-lock.json --format=sarif --output=osv.sarif';
if (security.includes(ignoredOsv)) {
  security = security.replace(ignoredOsv, strictOsv);
  fs.writeFileSync(securityPath, security);
  changes += 1;
}

const temporaryWorkflow = '.github/workflows/release-gate-repair.yml';
if (fs.existsSync(temporaryWorkflow)) {
  fs.rmSync(temporaryWorkflow);
  changes += 1;
}

console.log(`Release gate repair changed ${changes} target(s).`);
