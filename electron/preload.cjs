const { contextBridge, ipcRenderer, webFrame } = require('electron');

contextBridge.exposeInMainWorld('appDisplay', {
  setZoomFactor: (factor) => {
    const safeFactor = Math.min(1.45, Math.max(1, Number(factor) || 1.3));
    webFrame.setZoomFactor(safeFactor);
  },
});

contextBridge.exposeInMainWorld('dotaApi', {
  getHeroes: () => ipcRenderer.invoke('dota:getHeroes'),
  getBuild: (heroId) => ipcRenderer.invoke('dota:getBuild', heroId),
  getMatchups: (heroId) => ipcRenderer.invoke('dota:getMatchups', heroId),
  getProMatches: () => ipcRenderer.invoke('dota:getProMatches'),
  getProMatchDetail: (matchId) => ipcRenderer.invoke('dota:getProMatchDetail', matchId),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
});

contextBridge.exposeInMainWorld('stratzApi', {
  getState: () => ipcRenderer.invoke('sources:getStratzState'),
  connect: (token) => ipcRenderer.invoke('sources:connectStratz', token),
  disconnect: () => ipcRenderer.invoke('sources:disconnectStratz'),
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
