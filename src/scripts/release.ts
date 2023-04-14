import { parser } from '@conventional-commits/parser';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import * as readlineModule from 'node:readline';

const readline = readlineModule.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function getCommitTypes(from: string, to: string): Map<string, number> {
  const commits = execSync(`git log --oneline ${from}..${to}`)
    .toString()
    .split('\n')
    .filter(Boolean)
    .map((l) => l.split(' ').slice(1).join(' '));

  const types = new Map<string, number>();

  for (const commit of commits) {
    if (commit.startsWith('Merge')) {
      console.log('  ', commit, 'skipped');
      continue;
    } else {
      console.log('  ', commit);
    }
    const message = parser(commit);
    const summary = message.children[0];
    if (summary.type !== 'summary') {
      throw new Error('Commit parse error (summary not found)');
    }

    const type = summary.children.find((m) => m.type === 'type');

    if (type?.type !== 'type') {
      throw new Error('Commit parse error (type not found)');
    }

    const value = type.value.toLocaleLowerCase();
    types.set(value, (types.get(value) ?? 0) + 1);
  }

  return types;
}

function main(): void {
  const { version: currentVersion } = JSON.parse(readFileSync('package.json').toString('utf8')) as { version: string };

  console.log(`👉 Current version: ${currentVersion}`);
  const tag = execSync(`git tag -l v${currentVersion}`).toString();
  if (!tag) {
    console.log(`❌ Tag "v${currentVersion}" for version not found`);
    process.exit(1);
  } else {
    console.log('✅ Tag found');
  }

  console.log(`🔍 Check commits v${currentVersion}..HEAD`);
  const types = getCommitTypes(`v${currentVersion}`, 'HEAD');

  if (!types.size) {
    console.log(`❌ No commits found`);
    process.exit(1);
  }

  const bumpMinorVersion = types.has('feat') || types.has('refactor');
  const versionCommandParam = bumpMinorVersion ? 'minor' : 'patch';
  const versionCommand = `npm version ${versionCommandParam} -m "chore(package): bump version to %s"`;

  readline.question(`❔ Will run "${versionCommand}"`, () => {
    console.log(`🚀 Running npm version. Good luck!`);
    execSync(versionCommand);

    readline.close();
  });
}

main();
