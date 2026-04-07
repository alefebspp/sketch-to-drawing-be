export type DrawingId = number;

export interface DrawingPrimitives {
  id?: DrawingId;
  mediaId: string;
  sketchId: string;
  title?: string;
  description?: string;
}

export class Drawing {
  private constructor(
    private readonly _id: DrawingId | undefined,
    private _mediaId: string,
    private _sketchId: string,
    private _title?: string,
    private _description?: string
  ) {
    Drawing.assertId(_id);
    Drawing.assertMediaId(_mediaId);
    Drawing.assertSketchId(_sketchId);
    this._mediaId = _mediaId.trim();
    this._sketchId = _sketchId.trim();
    this._title = Drawing.normalizeOptionalText(_title);
    this._description = Drawing.normalizeOptionalText(_description);
  }

  public static create(props: DrawingPrimitives): Drawing {
    return new Drawing(
      props.id,
      props.mediaId,
      props.sketchId,
      props.title,
      props.description
    );
  }

  public get id(): DrawingId | undefined {
    return this._id;
  }

  public get mediaId(): string {
    return this._mediaId;
  }

  public get sketchId(): string {
    return this._sketchId;
  }

  public get title(): string | undefined {
    return this._title;
  }

  public get description(): string | undefined {
    return this._description;
  }

  public changeTitle(title?: string): void {
    this._title = Drawing.normalizeOptionalText(title);
  }

  public changeDescription(description?: string): void {
    this._description = Drawing.normalizeOptionalText(description);
  }

  public changeMedia(mediaId: string): void {
    Drawing.assertMediaId(mediaId);
    this._mediaId = mediaId.trim();
  }

  public toPrimitives(): DrawingPrimitives {
    return {
      id: this._id,
      mediaId: this._mediaId,
      sketchId: this._sketchId,
      title: this._title,
      description: this._description,
    };
  }

  private static normalizeOptionalText(value?: string): string | undefined {
    if (value === undefined) return undefined;
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  }

  private static assertId(id: DrawingId | undefined): void {
    if (id === undefined) return;
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error("Drawing.id must be a positive integer when provided.");
    }
  }

  private static assertMediaId(mediaId: string): void {
    if (typeof mediaId !== "string" || mediaId.trim().length === 0) {
      throw new Error("Drawing.mediaId must be a non-empty string.");
    }
  }

  private static assertSketchId(sketchId: string): void {
    if (typeof sketchId !== "string" || sketchId.trim().length === 0) {
      throw new Error("Drawing.sketchId must be a non-empty string.");
    }
  }
}
