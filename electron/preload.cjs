const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dotaApi', {
  getHeroes: () => ipcRenderer.invoke('dota:getHeroes'),
  getBuild: (heroId) => ipcRenderer.invoke('dota:getBuild', heroId),
  getMatchups: (heroId) => ipcRenderer.invoke('dota:getMatchups', heroId),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
});
