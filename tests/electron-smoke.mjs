import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { _electron as electron } from 'playwright';

const userDataDir = await mkdtemp(join(tmpdir(), 'bunbietbay-electron-smoke-'));
let app;

try {
  const executablePath = process.env.ELECTRON_EXECUTABLE_PATH;
  app = await electron.launch({
    ...(executablePath ? { executablePath } : {}),
    args: [...(executablePath ? [] : ['.']), `--user-data-dir=${userDataDir}`],
    env: { ...process.env, VITE_DEV_SERVER_URL: '' },
  });
  const window = await app.firstWindow();
  const runtimeErrors = [];
  window.on('pageerror', (error) => runtimeErrors.push(error.message));
  await window.getByText('Chuyến đi của tôi', { exact: true }).waitFor();
  const dataDirectory = await window.evaluate(() => window.desktopApi?.getDataDirectory());
  if (typeof dataDirectory !== 'string' || !dataDirectory.includes('bunbietbay-electron-smoke-')) {
    throw new Error('Electron không sử dụng userData tạm trong smoke test.');
  }
  if (runtimeErrors.length > 0) throw new Error(`Electron renderer lỗi: ${runtimeErrors.join('\n')}`);
  console.log('Electron smoke test passed.');
} finally {
  await app?.close();
  await rm(userDataDir, { recursive: true, force: true });
}
