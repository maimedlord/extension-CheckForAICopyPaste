import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
await build({ entryPoints: ['src/state.ts','src/settings.ts','src/controller.ts','src/editors.ts','src/provider.ts','src/background.ts','src/popover.ts'], bundle: true, loader:{'.txt':'text'}, outdir: '.test-build', platform: 'node', format: 'esm' });
const result = spawnSync(process.execPath, ['--test', 'tests/foundation.test.mjs', 'tests/provider.test.mjs', 'tests/popover.test.mjs', 'evaluation/validate.test.mjs', 'evaluation/score.test.mjs', 'evaluation/openai-client.test.mjs'], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
