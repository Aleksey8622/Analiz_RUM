const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('analizRum', {
  searchBom: (date, query) => ipcRenderer.invoke('bom:search', date, query),
  saveForecast: (code, value, date) => ipcRenderer.invoke('bom:save-forecast', code, value, date),
  getDataState: () => ipcRenderer.invoke('data:get-state'),
  updateData: (date) => ipcRenderer.invoke('data:update', date),
  getSnapshot: (date) => ipcRenderer.invoke('data:get-snapshot', date),
  getWorkspaceSettings: () => ipcRenderer.invoke('settings:get-workspace'),
  saveWorkspaceSettings: (settings) => ipcRenderer.invoke('settings:save-workspace', settings),
  saveDirectoryPosition: (position) => ipcRenderer.invoke('directory:save-position', position),
  saveDirectoryPositions: (positions) => ipcRenderer.invoke('directory:save-positions', positions),
  deleteDirectoryPositions: (ids) => ipcRenderer.invoke('directory:delete-positions', ids),
});
