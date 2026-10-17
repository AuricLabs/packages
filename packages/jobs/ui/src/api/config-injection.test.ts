import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const scriptPath = fileURLToPath(new URL('../../scripts/inject-config.mjs', import.meta.url));

describe('deployed Jobs browser configuration', () => {
  it('embeds the exact API and parent origins without executable URL contents', () => {
    const dir = mkdtempSync(join(tmpdir(), 'jobs-config-'));
    try {
      mkdirSync(join(dir, '_deploy'));
      writeFileSync(join(dir, '_deploy/index.html'), '<html><head></head><body></body></html>');
      execFileSync(process.execPath, [scriptPath], {
        cwd: dir,
        env: {
          ...process.env,
          JOBS_API_URL: 'https://api.example.test',
          JOBS_AUTH_PARENT_ORIGIN: 'https://admin.example.test',
          JOBS_AUTH_SIGN_IN_URL: 'https://admin.example.test/jobs?next=</script><script>evil()</script>',
        },
      });
      const html = readFileSync(join(dir, '_deploy/index.html'), 'utf8');
      expect(html).toContain('globalThis.__JOBS_CONFIG__=');
      expect(html).toContain('https://api.example.test');
      expect(html).not.toContain('</script><script>evil()');
      expect(html).toContain('\\u003c/script\\u003e');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
