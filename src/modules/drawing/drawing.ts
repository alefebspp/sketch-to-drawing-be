export type DrawingStatus = "processing" | "success" | "failed";

export interface Drawing {
  id: number;
  mediaId?: number;
  sketchId: number;
  title?: string;
  description?: string;
  /** `null` = ainda sem ciclo de geração assíncrona concluído (default no banco). */
  status: DrawingStatus | null;
  lastError: string | null;
  failedAt: Date | null;
}

/** Input para criação; `status` omitido grava `null` no banco. */
export type DrawingCreateInput = Omit<
  Drawing,
  "id" | "status" | "lastError" | "failedAt"
> & {
  status?: DrawingStatus | null;
};
