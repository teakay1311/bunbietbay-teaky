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
  await page.waitForURL('**/trips/t3');
  await page.waitForSelector('text=Đà Lạt');

  await page.goto(`${baseUrl}/trips/t3/plan?tab=itinerary`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Hạ cánh tại Liên Khương');

  await page.goto(`${baseUrl}/trips/t3`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Mùa Thu Tại Đà Lạt');

  await page.goto(`${baseUrl}/trips/t3/plan?tab=itinerary`, { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: 'Thêm chi tiêu' }).first().click();
  await page.waitForURL('**/trips/t3/money?action=add**');
  if (!await page.locator('select[name="activityId"]').inputValue()) throw new Error('Chi tiêu mở từ hoạt động chưa giữ ngữ cảnh activityId.');
  await page.goto(`${baseUrl}/trips/t3/plan?tab=itinerary`, { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: 'Viết nhật ký' }).first().click();
  await page.waitForURL('**/trips/t3/memories?action=journal**');
  if (!await page.locator('select[name="activityId"]').inputValue()) throw new Error('Nhật ký mở từ hoạt động chưa giữ ngữ cảnh activityId.');
  await page.getByRole('button', { name: 'Đóng hộp thoại' }).click();

  await page.getByRole('link', { name: 'Tài khoản', exact: true }).click();
  await page.waitForURL('**/account/profile');
  await page.waitForSelector('text=Tài khoản');

  await page.goto(`${baseUrl}/trips/t3/members`, { waitUntil: 'networkidle' });
  const archivedMemberRow = page.getByText('tu@example.com', { exact: true })
    .locator('xpath=ancestor::div[contains(@class, "rounded-[1.25rem]")]');
  const revokeButton = archivedMemberRow.getByRole('button', { name: 'Thu hồi' });
  await revokeButton.click();
  const revokeDialog = page.getByRole('dialog', { name: 'Thu hồi quyền của Tú' });
  await revokeDialog.waitFor();
  await page.keyboard.press('Escape');
  await revokeDialog.waitFor({ state: 'hidden' });
  if (!await revokeButton.evaluate((button) => document.activeElement === button)) throw new Error('Hộp thoại xác nhận không khôi phục focus sau khi đóng bằng Escape.');
  await revokeButton.click();
  await revokeDialog.waitFor();
  await page.getByRole('button', { name: 'Thu hồi quyền', exact: true }).click();
  await page.getByText('tu@example.com', { exact: true }).waitFor({ state: 'detached' });

  await page.goto(`${baseUrl}/trips/t3/expenses`, { waitUntil: 'networkidle' });
  await page.getByText('Tú', { exact: true }).first().waitFor();
  await page.getByRole('button', { name: 'Sửa khoản chi Vé tham quan Thác Datanla' }).click();
  if (await page.locator('select[name="paidBy"]').inputValue() !== 'm4') throw new Error('Sửa khoản chi lịch sử đã làm mất người trả tiền bị thu hồi.');
  if (!await page.locator('input[name="participants"][value="m4"]').isChecked()) throw new Error('Sửa khoản chi lịch sử đã làm mất người tham gia bị thu hồi.');
  await page.getByRole('button', { name: 'Đóng hộp thoại' }).click();
  await page.getByRole('button', { name: 'Tra soát Công nợ' }).click();
  await page.getByText('Đã thu hồi quyền', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Biểu đồ Chi tiêu' }).click();
  await page.getByText('Phân bổ Danh mục', { exact: true }).waitFor();

  await page.goto(`${baseUrl}/trips/t3/settings`, { waitUntil: 'networkidle' });
  await page.locator('input[name="startDate"]').fill('2024-10-20');
  await page.locator('input[name="endDate"]').fill('2024-10-19');
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await page.getByText('Ngày về phải bằng hoặc sau ngày đi.', { exact: true }).waitFor();
  await page.reload({ waitUntil: 'networkidle' });
  if (await page.locator('input[name="startDate"]').inputValue() === '2024-10-20') throw new Error('Thiết lập chuyến đi đã lưu khoảng ngày không hợp lệ.');

  for (const route of [
    '/trips', '/trips/t3', '/trips/t3/plan?tab=itinerary', '/trips/t3/plan?tab=places', '/trips/t3/money',
    '/trips/t3/prepare?tab=packing', '/trips/t3/prepare?tab=team', '/trips/t3/memories', '/trips/t3/settings',
    '/library', '/inbox', '/account/profile', '/account/preferences', '/account/notifications', '/account/data', '/account/shortcuts',
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

  await page.goto(`${baseUrl}/trips/t3/schedule?source=legacy#today`, { waitUntil: 'networkidle' });
  const redirectedSchedule = new URL(page.url());
  if (redirectedSchedule.pathname !== '/trips/t3/plan' || redirectedSchedule.searchParams.get('tab') !== 'itinerary' || redirectedSchedule.searchParams.get('source') !== 'legacy' || redirectedSchedule.hash !== '#today') {
    throw new Error('Route lịch trình cũ không giữ query/hash khi redirect.');
  }
  await page.goto(`${baseUrl}/notebook?view=grid#saved`, { waitUntil: 'networkidle' });
  if (!page.url().includes('/library?view=grid#saved')) throw new Error('Route Sổ tay cũ không redirect đúng sang Thư viện.');
  await page.goto(`${baseUrl}/settings?ref=legacy`, { waitUntil: 'networkidle' });
  if (!page.url().includes('/account/profile?ref=legacy')) throw new Error('Route Cài đặt cũ không redirect đúng sang Tài khoản.');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/trips/t3`, { waitUntil: 'networkidle' });
  if (await page.getByRole('navigation', { name: 'Điều hướng chuyến đi' }).getByRole('link').count() !== 5) throw new Error('Mobile không có đúng 5 mục điều hướng chuyến đi.');
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto(`${baseUrl}/trips/t3`, { waitUntil: 'networkidle' });
  const tabletNavigation = page.getByRole('navigation', { name: 'Điều hướng tablet' });
  await tabletNavigation.waitFor();
  if (await tabletNavigation.locator('[aria-current="page"]').count() !== 1) throw new Error('Tablet đánh dấu nhiều hơn một mục điều hướng hiện tại.');
  await page.setViewportSize({ width: 1180, height: 900 });
  await page.goto(`${baseUrl}/trips/t3`, { waitUntil: 'networkidle' });
  await page.getByRole('navigation', { name: 'Điều hướng chính' }).first().waitFor();
  const visibleCurrentLinks = page.locator('nav:visible [aria-current="page"]');
  if (await visibleCurrentLinks.count() !== 1) throw new Error('Desktop đánh dấu nhiều hơn một mục điều hướng hiện tại.');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reducedTransitionDuration = await page.getByRole('link', { name: 'Trang chủ', exact: true }).evaluate((element) => getComputedStyle(element).transitionDuration);
  if (reducedTransitionDuration.split(',').some((duration) => Number.parseFloat(duration) > 0.001)) throw new Error('Giao diện chưa tắt transition theo prefers-reduced-motion.');
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  await page.goto(`${baseUrl}/trips/does-not-exist/photos`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Trip not found');

  const legacyContext = await browser.newContext();
  const legacyPage = await legacyContext.newPage();
  await legacyPage.addInitScript((state) => {
    localStorage.setItem('bunbietbay-app-state', JSON.stringify(state));
  }, {
    version: 4,
    trips: [{
      id: 'legacy-trip', title: 'Chuyến đi cũ cần khôi phục', location: 'Huế', startDate: '2026-08-01', endDate: '2026-08-03',
      budget: 3000000, status: 'upcoming', image: '', createdBy: 'legacy-user',
    }],
    profiles: [{ id: 'legacy-user', email: 'legacy@example.com', displayName: 'Legacy', avatar: 'https://example.com/avatar.png' }],
    memberships: [{ id: 'legacy-membership', tripId: 'legacy-trip', userId: 'legacy-user', role: 'owner' }],
    invitations: [], activities: [], expenses: [], savedPlaces: [], packingItems: [], photos: [], activityLogs: [],
    currentTripId: 'legacy-trip', viewerProfileId: 'legacy-user', pinnedTripIds: [],
  });
  await legacyPage.goto(`${baseUrl}/trips`, { waitUntil: 'networkidle' });
  await legacyPage.getByText('Chuyến đi cũ cần khôi phục', { exact: true }).waitFor();
  const migratedTripId = await legacyPage.evaluate(async () => await new Promise((resolve, reject) => {
    const request = indexedDB.open('bunbietbay-trips-db', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const transaction = request.result.transaction('app-state', 'readonly');
      const readRequest = transaction.objectStore('app-state').get('bunbietbay-app-state');
      readRequest.onerror = () => reject(readRequest.error);
      readRequest.onsuccess = () => resolve(readRequest.result?.trips?.[0]?.id ?? null);
    };
  }));
  if (migratedTripId !== 'legacy-trip') {
    throw new Error('Dữ liệu localStorage cũ chưa được migrate sang IndexedDB.');
  }
  await legacyContext.close();

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
