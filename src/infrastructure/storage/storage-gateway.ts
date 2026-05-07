export interface StorageSaveResult {
  url: string;
  filename: string;
  mime: string;
  size: number;
}

export interface StorageGateway {
  save(file: Buffer, mime: string, originalName?: string): Promise<StorageSaveResult>;
}

