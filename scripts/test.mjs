import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
await build({ entryPoints: ['src/state.ts','src/settings.ts','src/controller.ts','src/editors.ts'], bundle: true, outdir: '.test-build', platform: 'node', format: 'esm' });
const result = spawnSync(process.execPath, ['--test', 'tests/foundation.test.mjs', 'evaluation/validate.test.mjs'], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
