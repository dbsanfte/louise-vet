import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let source = process.env.VET_GAME_CODEX_HOME ?? path.join(homedir(), '.codex');
let previousWorkspace = process.platform === 'win32' ? undefined : root;
let previousCodexHome = process.platform === 'win32' ? undefined : source;
let uid = process.getuid?.() ?? 1000;
let gid = process.getgid?.() ?? 1000;

// VS Code on Windows can run Codex in WSL. Prefer its existing transcripts
// when the Windows Codex home has no sessions, as on this project's host.
if (
  process.platform === 'win32' &&
  !process.env.VET_GAME_CODEX_HOME &&
  !existsSync(path.join(source, 'sessions'))
) {
  try {
    const [distro, codexHome, workspace, wslUid, wslGid] = execFileSync(
      'wsl.exe',
      [
        '--exec',
        'sh',
        '-lc',
        'printf "%s\\n" "$WSL_DISTRO_NAME" "$HOME/.codex"; wslpath -u "$1"; id -u; id -g',
        'sh',
        root,
      ],
      { encoding: 'utf8', timeout: 15000 },
    )
      .trim()
      .split(/\r?\n/);
    const candidate = `//wsl.localhost/${distro}${codexHome}`.replaceAll(
      '/',
      '\\',
    );
    if (existsSync(path.join(candidate, 'sessions'))) {
      source = candidate;
      // Docker Desktop can make wslpath select a temporary bind-mount alias.
      // Use the normal drive path for the alias, keeping chat paths stable.
      const drivePath = root
        .replace(
          /^([a-z]):[\\/]/i,
          (_, drive) => `/mnt/${drive.toLowerCase()}/`,
        )
        .replaceAll('\\', '/');
      previousWorkspace = /^[a-z]:[\\/]/i.test(root) ? drivePath : workspace;
      previousCodexHome = codexHome;
      uid = Number(wslUid);
      gid = Number(wslGid);
    }
  } catch {
    // A host without WSL uses its native Codex home.
  }
}

mkdirSync(source, { recursive: true });
const volumes = [
  { type: 'bind', source, target: '/home/node/.codex' },
  { type: 'bind', source: root, target: '/workspaces/vet-game' },
];
if (previousCodexHome && previousCodexHome !== '/home/node/.codex') {
  volumes.push({ type: 'bind', source, target: previousCodexHome });
}
if (previousWorkspace && previousWorkspace !== '/workspaces/vet-game') {
  volumes.push(
    { type: 'bind', source: root, target: previousWorkspace },
    {
      type: 'volume',
      source: 'node_modules',
      target: `${previousWorkspace}/node_modules`,
    },
  );
}

const override = {
  services: {
    dev: {
      build: {
        args: { DEV_UID: String(uid || 1000), DEV_GID: String(gid || 1000) },
      },
      volumes,
    },
  },
};
writeFileSync(
  path.join(root, '.devcontainer/compose.local.yaml'),
  JSON.stringify(override, null, 2) + '\n',
);
console.log(`Codex state will persist in: ${source}`);
if (previousWorkspace)
  console.log(`Previous workspace remains available at: ${previousWorkspace}`);
