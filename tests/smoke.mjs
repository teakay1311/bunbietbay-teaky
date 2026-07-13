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
  if (await page.locator('html').getAttribute('lang') !== 'vi') throw new Error('Trang chưa khai báo đúng ngôn ngữ tiếng Việt.');
  const viewportContent = await page.locator('meta[name="viewport"]').getAttribute('content') ?? '';
  if (/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?:\.0)?/i.test(viewportContent)) throw new Error('Viewport vẫn đang khóa thao tác phóng to.');
  if (await page.locator('a button, button a').count() > 0) throw new Error('Thẻ chuyến đi còn lồng control tương tác bên trong liên kết.');
  await page.getByRole('combobox', { name: 'Lọc chuyến đi theo trạng thái' }).waitFor();

  await page.getByRole('link', { name: 'Mở chuyến đi Mùa Thu Tại Đà Lạt' }).click();
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
  for (const fieldName of ['Tên hiển thị', 'Đường dẫn ảnh đại diện', 'Số điện thoại', 'Ngày sinh', 'Giới thiệu ngắn']) {
    await page.getByLabel(fieldName, { exact: true }).waitFor();
  }

  await page.goto(`${baseUrl}/trips/t3/members`, { waitUntil: 'networkidle' });
  if (await page.getByRole('combobox', { name: /^Vai trò của / }).count() === 0) throw new Error('Control đổi vai trò thành viên chưa có accessible name.');
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
  for (const filterName of ['Lọc chi tiêu theo danh mục', 'Lọc chi tiêu theo người chi', 'Lọc chi tiêu theo người nợ']) {
    await page.getByRole('combobox', { name: filterName }).waitFor();
  }
  await page.getByText('Tú', { exact: true }).first().waitFor();
  await page.getByRole('button', { name: 'Sửa khoản chi Vé tham quan Thác Datanla' }).click();
  if (await page.locator('select[name="paidBy"]').inputValue() !== 'm4') throw new Error('Sửa khoản chi lịch sử đã làm mất người trả tiền bị thu hồi.');
  if (!await page.locator('input[name="participants"][value="m4"]').isChecked()) throw new Error('Sửa khoản chi lịch sử đã làm mất người tham gia bị thu hồi.');
  await page.getByRole('button', { name: 'Đóng hộp thoại' }).click();
  await page.getByRole('button', { name: 'Tra soát Công nợ' }).click();
  await page.getByText('Đã thu hồi quyền', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Biểu đồ Chi tiêu' }).click();
  await page.getByText('Phân bổ Danh mục', { exact: true }).waitFor();

  await page.goto(`${baseUrl}/library`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Tạo bộ sưu tập' }).click();
  await page.getByPlaceholder('Ví dụ: Hội yêu trà sữa...').fill('   ');
  await page.getByRole('dialog').getByRole('button', { name: 'Tạo bộ sưu tập' }).click();
  await page.getByText('Tên bộ sưu tập không được chỉ gồm khoảng trắng.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Đóng hộp thoại' }).click();

  await page.route('https://api.cloudinary.com/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ secure_url: 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IC4AAADQAwCdASoBAAEADsD+JaQAA3AA/vuUAAA=', public_id: 'smoke-photo' }),
  }));
  await page.goto(`${baseUrl}/photos`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Tải ảnh lên' }).first().click();
  const uploadDialog = page.getByRole('dialog', { name: 'Tải ảnh lên' });
  await uploadDialog.getByLabel('Chuyến đi', { exact: true }).selectOption('t3');
  await uploadDialog.getByLabel('Album', { exact: true }).fill('Smoke album');
  await uploadDialog.getByLabel('Chọn ảnh', { exact: true }).setInputFiles({
    name: 'smoke.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=', 'base64'),
  });
  await uploadDialog.getByRole('button', { name: 'Tải ảnh lên' }).click();
  await page.getByText('Đã tải ảnh', { exact: true }).waitFor();
  await page.goto(`${baseUrl}/trips/t3/memories`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Smoke album', exact: true }).waitFor();
  await page.goto(`${baseUrl}/photos`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Tất cả ảnh' }).click();
  await page.getByRole('button', { name: /Mùa Thu Tại Đà Lạt · Smoke album/ }).click();
  await page.getByRole('button', { name: 'Sửa thông tin' }).click();
  const editPhotoDialog = page.getByRole('dialog', { name: 'Sửa thông tin ảnh' });
  await editPhotoDialog.getByLabel('Album', { exact: true }).fill('Smoke album đã sửa');
  await editPhotoDialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await page.getByText('Đã cập nhật thông tin ảnh', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Xóa ảnh', exact: true }).click();
  const deletePhotoDialog = page.getByRole('dialog', { name: 'Xóa ảnh khỏi chuyến đi' });
  await deletePhotoDialog.getByRole('button', { name: 'Xóa ảnh', exact: true }).click();
  await page.getByText('Đã xóa ảnh', { exact: true }).waitFor();

  await page.goto(`${baseUrl}/trips/t3/settings`, { waitUntil: 'networkidle' });
  await page.locator('input[name="startDate"]').fill('2024-10-20');
  await page.locator('input[name="endDate"]').fill('2024-10-19');
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await page.getByText('Ngày về phải bằng hoặc sau ngày đi.', { exact: true }).waitFor();
  await page.reload({ waitUntil: 'networkidle' });
  if (await page.locator('input[name="startDate"]').inputValue() === '2024-10-20') throw new Error('Thiết lập chuyến đi đã lưu khoảng ngày không hợp lệ.');

  await page.goto(`${baseUrl}/trips/t3/collaborate`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Thêm nhiệm vụ' }).click();
  const taskDialog = page.getByRole('dialog', { name: 'Thêm nhiệm vụ' });
  await taskDialog.getByLabel('Tên nhiệm vụ').fill('Smoke task');
  await taskDialog.getByRole('button', { name: 'Tạo nhiệm vụ' }).click();
  const taskCard = page.locator('article').filter({ hasText: 'Smoke task' });
  await taskCard.waitFor();
  await taskCard.getByRole('combobox', { name: 'Trạng thái Smoke task' }).selectOption('done');
  await taskCard.getByRole('button', { name: 'Bình luận' }).click();
  await taskCard.getByLabel('Nội dung bình luận').fill('Bình luận smoke');
  await taskCard.getByRole('button', { name: 'Gửi bình luận' }).click();
  await taskCard.getByText('Bình luận smoke', { exact: true }).waitFor();
  await page.getByRole('tab', { name: 'Bình chọn' }).click();
  await page.getByRole('button', { name: 'Tạo bình chọn' }).click();
  const pollDialog = page.getByRole('dialog', { name: 'Tạo bình chọn' });
  await pollDialog.getByLabel('Câu hỏi').fill('   ');
  await pollDialog.getByLabel('Các lựa chọn, mỗi dòng một mục').fill('Phương án A\nPhương án B');
  await pollDialog.getByRole('button', { name: 'Tạo bình chọn' }).click();
  await page.getByText('Câu hỏi bình chọn không được để trống.', { exact: true }).waitFor();
  if (!await pollDialog.isVisible()) throw new Error('Hộp thoại bình chọn bị đóng sau khi dữ liệu không hợp lệ.');
  await pollDialog.getByLabel('Câu hỏi').fill('Chọn phương án smoke?');
  await pollDialog.getByRole('button', { name: 'Tạo bình chọn' }).click();
  const pollCard = page.locator('article').filter({ hasText: 'Chọn phương án smoke?' });
  await pollCard.getByRole('button', { name: /Phương án A/ }).click();
  await pollCard.getByText('1', { exact: true }).waitFor();

  for (const route of [
    '/trips', '/trips/t3', '/trips/t3/plan?tab=itinerary', '/trips/t3/plan?tab=places', '/trips/t3/money',
    '/trips/t3/prepare?tab=packing', '/trips/t3/prepare?tab=team', '/trips/t3/memories', '/trips/t3/settings', '/trips/t3/collaborate',
    '/library', '/photos', '/inbox', '/account/profile', '/account/preferences', '/account/notifications', '/account/data', '/account/shortcuts', '/account/sync',
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
  await page.goto(`${baseUrl}/photos`, { waitUntil: 'networkidle' });
  const globalMobileNavigation = page.getByRole('navigation', { name: 'Điều hướng chính' });
  if (await globalMobileNavigation.getByRole('link').count() !== 5) throw new Error('Mobile không có đúng 5 mục điều hướng toàn cục.');
  if (await globalMobileNavigation.locator('[aria-current="page"]').count() !== 1) throw new Error('Mobile đánh dấu sai mục Thư viện ảnh hiện tại.');
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

  await page.getByRole('button', { name: 'Thu gọn thanh bên' }).click();
  await page.getByRole('button', { name: 'Mở rộng thanh bên' }).waitFor();
  await page.goto(`${baseUrl}/library`, { waitUntil: 'networkidle' });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Mở rộng thanh bên' }).waitFor();
  await page.getByRole('button', { name: 'Mở rộng thanh bên' }).click();

  const listViewButton = page.getByRole('button', { name: 'Xem dạng danh sách' });
  await listViewButton.click();
  if (await listViewButton.getAttribute('aria-pressed') !== 'true') throw new Error('Thư viện địa điểm không chuyển sang chế độ danh sách.');
  await page.goto(`${baseUrl}/trips`, { waitUntil: 'networkidle' });
  await page.goto(`${baseUrl}/library`, { waitUntil: 'networkidle' });
  if (await page.getByRole('button', { name: 'Xem dạng danh sách' }).getAttribute('aria-pressed') !== 'true') throw new Error('Chế độ xem Thư viện địa điểm không được bảo lưu khi đổi tab.');
  await page.reload({ waitUntil: 'networkidle' });
  if (await page.getByRole('button', { name: 'Xem dạng danh sách' }).getAttribute('aria-pressed') !== 'true') throw new Error('Chế độ xem Thư viện địa điểm không được bảo lưu sau khi tải lại.');
  await page.getByRole('button', { name: 'Xem dạng lưới' }).click();

  await page.goto(`${baseUrl}/trips/t3/plan`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Địa điểm', exact: true }).click();
  await page.goto(`${baseUrl}/trips/t3/money`, { waitUntil: 'networkidle' });
  await page.goto(`${baseUrl}/trips/t3/plan`, { waitUntil: 'networkidle' });
  if (await page.getByRole('button', { name: 'Địa điểm', exact: true }).getAttribute('aria-current') !== 'page') throw new Error('Tab con của chuyến đi không được bảo lưu.');

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
    const request = indexedDB.open('bunbietbay-trips-db');
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

  const viewerContext = await browser.newContext();
  const viewerPage = await viewerContext.newPage();
  await viewerPage.addInitScript((state) => localStorage.setItem('bunbietbay-app-state', JSON.stringify(state)), {
    version: 4,
    trips: [{ id: 'viewer-trip', title: 'Viewer trip', location: 'Huế', startDate: '2026-08-01', endDate: '2026-08-03', budget: 3000000, status: 'upcoming', image: '', createdBy: 'owner-user' }],
    profiles: [{ id: 'viewer-user', email: 'viewer@example.com', displayName: 'Viewer', avatar: '' }, { id: 'owner-user', email: 'owner@example.com', displayName: 'Owner', avatar: '' }],
    memberships: [{ id: 'viewer-membership', tripId: 'viewer-trip', userId: 'viewer-user', role: 'viewer' }, { id: 'owner-membership', tripId: 'viewer-trip', userId: 'owner-user', role: 'owner' }],
    invitations: [], activities: [], expenses: [], savedPlaces: [], packingItems: [],
    photos: [{ id: 'viewer-photo', tripId: 'viewer-trip', url: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', album: 'Chung', storage: 'embedded', createdAt: '2026-08-01T00:00:00.000Z' }],
    activityLogs: [], currentTripId: 'viewer-trip', viewerProfileId: 'viewer-user', pinnedTripIds: [],
  });
  await viewerPage.goto(`${baseUrl}/photos`, { waitUntil: 'networkidle' });
  if (await viewerPage.getByRole('button', { name: 'Tải ảnh lên' }).count() !== 0) throw new Error('Viewer vẫn thấy thao tác tải ảnh trong Thư viện ảnh.');
  await viewerPage.getByRole('button', { name: 'Tất cả ảnh' }).click();
  await viewerPage.locator('main img[alt="Chung"]').click();
  const viewerPhotoDialog = viewerPage.getByRole('dialog', { name: 'Viewer trip · Chung' });
  if (await viewerPhotoDialog.getByRole('button', { name: 'Sửa thông tin' }).count() !== 0 || await viewerPhotoDialog.getByRole('button', { name: 'Xóa ảnh' }).count() !== 0) throw new Error('Viewer vẫn thấy thao tác sửa hoặc xóa ảnh.');
  await viewerContext.close();

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
