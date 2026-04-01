export type SketchId = number;

export interface SketchPrimitives {
  id?: SketchId;
  mediaId: string;
  title?: string;
  description?: string;
  summary?: string;
}

export class Sketch {
  private constructor(
    private readonly _id: SketchId | undefined,
    private _mediaId: string,
    private _title?: string,
    private _description?: string,
    private _summary?: string
  ) {
    Sketch.assertId(_id);
    Sketch.assertMediaId(_mediaId);
    this._mediaId = _mediaId.trim();
    this._title = Sketch.normalizeOptionalText(_title);
    this._description = Sketch.normalizeOptionalText(_description);
    this._summary = Sketch.normalizeOptionalText(_summary);
  }

  public static create(props: SketchPrimitives): Sketch {
    return new Sketch(
      props.id,
      props.mediaId,
      props.title,
      props.description,
      props.summary
    );
  }

  public get id(): SketchId | undefined {
    return this._id;
  }

  public get mediaId(): string {
    return this._mediaId;
  }

  public get title(): string | undefined {
    return this._title;
  }

  public get description(): string | undefined {
    return this._description;
  }

  public get summary(): string | undefined {
    return this._summary;
  }

  public attachMedia(mediaId: string): void {
    Sketch.assertMediaId(mediaId);
    this._mediaId = mediaId.trim();
  }

  public changeTitle(title?: string): void {
    this._title = Sketch.normalizeOptionalText(title);
  }

  public changeDescription(description?: string): void {
    this._description = Sketch.normalizeOptionalText(description);
  }

  public changeSummary(summary?: string): void {
    this._summary = Sketch.normalizeOptionalText(summary);
  }

  public clearTextDetails(): void {
    this._title = undefined;
    this._description = undefined;
    this._summary = undefined;
  }

  public toPrimitives(): SketchPrimitives {
    return {
      id: this._id,
      mediaId: this._mediaId,
      title: this._title,
      description: this._description,
      summary: this._summary,
    };
  }

  private static normalizeOptionalText(value?: string): string | undefined {
    if (value === undefined) return undefined;
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  }

  private static assertId(id: SketchId | undefined): void {
    if (id === undefined) return;
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error("Sketch.id must be a positive integer when provided.");
    }
  }

  private static assertMediaId(mediaId: string): void {
    if (typeof mediaId !== "string" || mediaId.trim().length === 0) {
      throw new Error("Sketch.mediaId must be a non-empty string.");
    }
  }
}
