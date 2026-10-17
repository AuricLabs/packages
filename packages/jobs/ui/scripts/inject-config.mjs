import { readFileSync, writeFileSync } from 'node:fs';

const indexPath = '_deploy/index.html';
const html = readFileSync(indexPath, 'utf8');
const apiUrl = process.env.JOBS_API_URL;
const parentOrigin = process.env.JOBS_AUTH_PARENT_ORIGIN;
const signInUrl = process.env.JOBS_AUTH_SIGN_IN_URL;

if (!apiUrl || !parentOrigin || !signInUrl || !html.includes('<head>')) {
  throw new Error('Jobs dashboard build requires its API and authentication configuration');
}

const config = { apiUrl, auth: { parentOrigin, signInUrl } };
const json = JSON.stringify(config)
  .replaceAll('<', '\\u003c')
  .replaceAll('>', '\\u003e')
  .replaceAll('&', '\\u0026')
  .replaceAll('\u2028', '\\u2028')
  .replaceAll('\u2029', '\\u2029');
const script = `<script>globalThis.__JOBS_CONFIG__=${json}</script>`;
writeFileSync(indexPath, html.replace('<head>', `<head>${script}`));
