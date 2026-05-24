const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopApi', {
  isDesktopApp: true,
  loadState: () => ipcRenderer.invoke('desktop:load-state'),
  saveState: (state) => ipcRenderer.invoke('desktop:save-state', state),
  clearState: () => ipcRenderer.invoke('desktop:clear-state'),
  getDataDirectory: () => ipcRenderer.invoke('desktop:get-data-directory'),
  openDataDirectory: () => ipcRenderer.invoke('desktop:open-data-directory'),
});
