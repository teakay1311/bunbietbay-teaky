import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import process from 'node:process';
import { chromium } from 'playwright';

const host = '127.0.0.1';
let baseUrl = process.env.SMOKE_BASE_URL ?? '';

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, host, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Không thể tìm cổng trống cho smoke test.')));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}

async function isServerReady(url) {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer(url) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await isServerReady(url)) {
      return true;
    }

    await delay(1000);
  }

  return false;
}

async function startServerIfNeeded() {
  if (baseUrl && await isServerReady(baseUrl)) {
    return null;
  }

  const port = await getFreePort();
  baseUrl = `http://${host}:${port}`;

  const serverProcess = spawn('npm', ['run', 'dev', '--', '--host', host, '--port', String(port), '--strictPort'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  const isReady = await waitForServer(baseUrl);
  if (!isReady) {
    serverProcess.kill('SIGTERM');
    throw new Error('Không thể khởi động Vite dev server cho smoke test.');
  }

  return serverProcess;
}

async function runSmoke() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const runtimeErrors = [];

  page.on('pageerror', (error) => runtimeErrors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      runtimeErrors.push(`console: ${message.text()}`);
    }
  });

  await page.goto(`${baseUrl}/trips`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Chuyến đi của tôi');

  await page.click('text=Mùa Thu Tại Đà Lạt');
  await page.waitForURL('**/trips/t3/schedule');
  await page.waitForSelector('text=Hạ cánh tại Liên Khương');

  await page.click('a[href="/trips/t3/overview"]');
  await page.waitForURL('**/trips/t3/overview');
  await page.waitForSelector('text=Tổng quan');

  await page.click('a[href="/settings"]');
  await page.waitForURL('**/settings');
  await page.waitForSelector('text=Cài đặt hệ thống');

  await page.goto(`${baseUrl}/trips/t3/members`, { waitUntil: 'networkidle' });
  const archivedMemberRow = page.getByText('tu@example.com', { exact: true })
    .locator('xpath=ancestor::div[contains(@class, "rounded-[1.25rem]")]');
  await archivedMemberRow.getByRole('button', { name: 'Thu hồi' }).click();
  await page.getByRole('button', { name: 'Thu hồi quyền', exact: true }).click();
  await page.getByText('tu@example.com', { exact: true }).waitFor({ state: 'detached' });

  await page.goto(`${baseUrl}/trips/t3/expenses`, { waitUntil: 'networkidle' });
  await page.getByText('Tú', { exact: true }).first().waitFor();
  await page.getByRole('button', { name: 'Tra soát Công nợ' }).click();
  await page.getByText('Đã thu hồi quyền', { exact: true }).waitFor();

  for (const route of [
    '/trips', '/trips/t3/schedule', '/trips/t3/overview', '/trips/t3/expenses', '/trips/t3/members',
    '/trips/t3/places', '/trips/t3/packing', '/trips/t3/photos', '/notebook', '/settings',
  ]) {
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
    const unnamedButtons = await page.evaluate(() => [...document.querySelectorAll('button')]
      .filter((button) => button.getClientRects().length > 0
        && !((button.textContent || '').trim() || button.getAttribute('aria-label') || button.getAttribute('title')))
      .length);
    if (unnamedButtons > 0) {
      throw new Error(`${route} còn ${unnamedButtons} nút đang hiển thị nhưng không có accessible name.`);
    }
  }

  await page.goto(`${baseUrl}/trips/does-not-exist/photos`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Trip not found');

  await browser.close();

  if (runtimeErrors.length > 0) {
    throw new Error(`Smoke test phát hiện lỗi runtime:\n${runtimeErrors.join('\n')}`);
  }
}

const serverProcess = await startServerIfNeeded();

try {
  await runSmoke();
  console.log('Smoke test passed.');
} finally {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
  }
}
