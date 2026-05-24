const { app, BrowserWindow, ipcMain, shell } = require('electron');
const fs = require('fs/promises');
const path = require('path');

const APP_STATE_FILE = 'app-state.json';
const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

function canOpenExternalUrl(url) {
  try {
    const parsedUrl = new URL(url);
    return ALLOWED_EXTERNAL_PROTOCOLS.has(parsedUrl.protocol);
  } catch {
    return false;
  }
}

function openExternalSafely(url) {
  if (!canOpenExternalUrl(url)) {
    return;
  }
  void shell.openExternal(url);
}

function getAppStatePath() {
  return path.join(app.getPath('userData'), APP_STATE_FILE);
}

async function loadAppState() {
  try {
    const raw = await fs.readFile(getAppStatePath(), 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

async function saveAppState(state) {
  const statePath = getAppStatePath();
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(statePath, JSON.stringify(state, null, 2), 'utf8');
}

async function clearAppState() {
  try {
    await fs.unlink(getAppStatePath());
  } catch (error) {
    if (!error || error.code !== 'ENOENT') {
      throw error;
    }
  }
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1180,
    minHeight: 760,
    show: false,
    title: 'Bunbietbay Trips',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafely(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowedOrigins = new Set(['file://', process.env.VITE_DEV_SERVER_URL ?? '']);
    const isAllowed = Array.from(allowedOrigins).some((origin) => origin && url.startsWith(origin));
    if (!isAllowed) {
      event.preventDefault();
      openExternalSafely(url);
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

ipcMain.handle('desktop:load-state', async () => loadAppState());
ipcMain.handle('desktop:save-state', async (_event, state) => {
  await saveAppState(state);
});
ipcMain.handle('desktop:clear-state', async () => {
  await clearAppState();
});
ipcMain.handle('desktop:get-data-directory', async () => app.getPath('userData'));
ipcMain.handle('desktop:open-data-directory', async () => {
  const dataDirectory = app.getPath('userData');
  await shell.openPath(dataDirectory);
  return dataDirectory;
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
