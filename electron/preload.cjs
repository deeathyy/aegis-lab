const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dotaApi', {
  getHeroes: () => ipcRenderer.invoke('dota:getHeroes'),
  getBuild: (heroId) => ipcRenderer.invoke('dota:getBuild', heroId),
  getMatchups: (heroId) => ipcRenderer.invoke('dota:getMatchups', heroId),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
});

contextBridge.exposeInMainWorld('appUpdater', {
  getState: () => ipcRenderer.invoke('app:getUpdateState'),
  check: () => ipcRenderer.invoke('app:checkForUpdates'),
  install: () => ipcRenderer.invoke('app:installUpdate'),
  onState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('app:update-state', listener);
    return () => ipcRenderer.removeListener('app:update-state', listener);
  },
});
