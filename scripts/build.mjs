import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await build({ entryPoints: ['src/content.ts','src/options.ts','src/fixture.ts'], bundle: true, outdir: 'dist', target: 'chrome120', format: 'iife', sourcemap: true });
for (const file of ['manifest.json','options.html','fixture.html','styles.css']) await copyFile(`extension/${file}`, `dist/${file}`);
