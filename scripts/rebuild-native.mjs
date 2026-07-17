// Rebuild native modules (node-pty) against Electron's ABI.
//
// Two Windows gotchas are handled here so `pnpm rebuild:native` just works:
//  1. node-pty's winpty build runs `GetCommitHash.bat` from its own directory.
//     If `NoDefaultCurrentDirectoryInExePath` is set, cmd refuses to run a batch
//     file from the cwd, so we drop that var for the child build process.
//  2. node-pty's Spectre-mitigation flag is removed via a committed pnpm patch
//     (patches/node-pty@1.1.0.patch) so the Spectre-mitigated VS libraries are
//     not required.
import { spawnSync } from 'node:child_process'

delete process.env.NoDefaultCurrentDirectoryInExePath

const result = spawnSync('electron-rebuild', ['-f', '-w', 'node-pty'], {
  stdio: 'inherit',
  shell: true,
  env: process.env
})

process.exit(result.status ?? 1)
