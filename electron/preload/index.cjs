const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('analizRum', {
  getDataState: () => ipcRenderer.invoke('data:get-state'),
  updateData: (date) => ipcRenderer.invoke('data:update', date),
  getSnapshot: (date) => ipcRenderer.invoke('data:get-snapshot', date),
});
