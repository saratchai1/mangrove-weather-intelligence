import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const distRoot = path.join(projectRoot, 'dist');
const indexPath = path.join(distRoot, 'index.html');
const publicBaseUrl = 'https://saratchai1.github.io/mangrove-weather-intelligence';

const indexHtml = (await fs.readFile(indexPath, 'utf8'))
  .replaceAll('__SITE_ORIGIN__', publicBaseUrl)
  .replace(
    `property="og:url" content="${publicBaseUrl}/environmental-intelligence"`,
    `property="og:url" content="${publicBaseUrl}/"`,
  );

await Promise.all([
  fs.writeFile(indexPath, indexHtml, 'utf8'),
  fs.writeFile(path.join(distRoot, '404.html'), indexHtml, 'utf8'),
  fs.writeFile(path.join(distRoot, '.nojekyll'), '', 'utf8'),
]);
