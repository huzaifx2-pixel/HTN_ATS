import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("headsbaseDesktop", {
  createBackup: () => ipcRenderer.invoke("headsbase:create-backup") as Promise<string>,
  restoreBackup: (backupDir: string) =>
    ipcRenderer.invoke("headsbase:restore-backup", backupDir) as Promise<boolean>,
  isDesktop: true as const,
});

export type HeadsbaseDesktopApi = {
  createBackup: () => Promise<string>;
  restoreBackup: (backupDir: string) => Promise<boolean>;
  isDesktop: true;
};

declare global {
  interface Window {
    headsbaseDesktop?: HeadsbaseDesktopApi;
  }
}
