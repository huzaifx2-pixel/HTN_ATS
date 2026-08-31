export interface StorageAdapter {
  upload(file: Buffer, fileName: string, mimeType: string): Promise<string>;
  getUrl(storageKey: string): Promise<string>;
  delete(storageKey: string): Promise<void>;
  read(storageKey: string): Promise<Buffer>;
}
