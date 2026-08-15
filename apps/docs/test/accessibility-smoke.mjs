import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const DOCS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROUTES = ['/', '/docs', '/docs/components/button'];
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'];

function availablePort() {
  return new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const address = socket.address();
      socket.close(() => resolve(address.port));
    });
  });
}

async function waitForServer(url, server) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Docs server exited with ${server.exitCode}`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch {
      // The production server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Docs server did not become ready within 30 seconds');
}

function formatViolations(route, violations) {
  const details = violations.flatMap((violation) => [
    `${route}: ${violation.id} (${violation.impact ?? 'unknown'}) — ${violation.help}`,
    ...violation.nodes.map((node) => `  ${node.target.join(' ')}: ${node.failureSummary}`),
  ]);
  return details.join('\n');
}

async function stopServer(server) {
  if (server.exitCode !== null) return;
  server.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => server.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (server.exitCode === null) server.kill('SIGKILL');
}

async function run() {
  const port = await availablePort();
  const origin = `http://127.0.0.1:${port}`;
  const logs = [];
  const server = spawn(
    process.execPath,
    [require.resolve('next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)],
    { cwd: DOCS_ROOT, env: { ...process.env, NODE_ENV: 'production' }, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  for (const stream of [server.stdout, server.stderr]) {
    stream.on('data', (chunk) => logs.push(chunk.toString()));
  }

  let browser;
  try {
    await waitForServer(origin, server);
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    const failures = [];

    for (const route of ROUTES) {
      const response = await page.goto(`${origin}${route}`, { waitUntil: 'domcontentloaded' });
      if (!response?.ok()) throw new Error(`${route} returned HTTP ${response?.status() ?? 'unknown'}`);
      await page.locator('h1').first().waitFor({ state: 'visible' });
      await page.evaluate(() => document.fonts.ready);
      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      if (results.violations.length) failures.push(formatViolations(route, results.violations));
      else console.log(`✓ ${route}`);
    }

    if (failures.length) throw new Error(`Accessibility violations:\n${failures.join('\n')}`);
    console.log(`Docs accessibility smoke: ${ROUTES.length} routes, Chromium, WCAG 2 A/AA`);
  } catch (error) {
    const serverLog = logs.join('').trim();
    if (serverLog) console.error(`Docs server output:\n${serverLog}`);
    throw error;
  } finally {
    await browser?.close();
    await stopServer(server);
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
