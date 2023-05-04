import { parser, Node } from '@conventional-commits/parser';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import * as readlineModule from 'node:readline';

interface Settings {
  allowedBranch?: string;
  message?: string;
}

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

    const hasBreakingChange = summary.children.find((m) => (m as Node).type === 'breaking-change');
    if (hasBreakingChange) {
      types.set('breaking', (types.get('breaking') ?? 0) + 1);
    }

    const value = type.value.toLocaleLowerCase();
    types.set(value, (types.get(value) ?? 0) + 1);
  }

  return types;
}

function main(): void {
  const { version: currentVersion, microrelease: packageSettings } = JSON.parse(
    readFileSync('package.json').toString('utf8'),
  ) as {
    version: string;
    microrelease?: Settings;
  };

  const [currentMajorVersion] = currentVersion.split('.').map((p) => Number.parseInt(p, 10));

  const settings: Settings = Object.assign(
    {
      message: 'chore(package): bump version to %s',
    },
    packageSettings ?? {},
  );

  console.log(`🎫 package.json loaded, config:`);

  for (const [key, value] of Object.entries(settings)) {
    console.log(`   ${key}: ${value}`);
  }

  const branch = execSync(`git branch --show-current`).toString().trim();
  if (settings.allowedBranch && branch !== settings.allowedBranch) {
    console.log(`❌ Branch must be ${settings.allowedBranch}, current branch is ${branch}`);
    process.exit(1);
  }
  console.log(`🌳 Branch is ${branch}`);

  console.log(`👉 Current version: ${currentVersion}`);
  const tag = execSync(`git tag -l v${currentVersion}`).toString();
  if (!tag) {
    console.log(`❌ Tag "v${currentVersion}" for version not found`);
    process.exit(2);
  } else {
    console.log('✅ Tag found');
  }

  console.log(`🔍 Check commits v${currentVersion}..HEAD`);
  const types = getCommitTypes(`v${currentVersion}`, 'HEAD');

  if (!types.size) {
    console.log(`❌ No commits found`);
    process.exit(3);
  }

  const bumpMajorVersion = types.has('breaking') && currentMajorVersion > 0;
  const bumpMinorVersion = types.has('feat') || types.has('refactor');
  const versionCommandParam = bumpMajorVersion ? 'major' : bumpMinorVersion ? 'minor' : 'patch';
  const versionCommand = `npm version ${versionCommandParam} -m "${settings.message}"`;

  readline.question(`❔ Will run "${versionCommand}"`, () => {
    console.log(`🍀 Running npm version. Good luck!`);
    const result = execSync(versionCommand).toString().trim().split('\n').at(-1);
    console.log(`🚀 New version: ${result}`);

    readline.close();
  });
}

main();
