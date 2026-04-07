export type ImageId = number;

export interface ImagePrimitives {
  id?: ImageId;
  filename: string;
  url: string;
}

export class Image {
  private constructor(
    private readonly _id: ImageId | undefined,
    private _filename: string,
    private _url: string
  ) {
    Image.assertId(_id);
    Image.assertFilename(_filename);
    Image.assertUrl(_url);
  }

  public static create(props: ImagePrimitives): Image {
    return new Image(props.id, props.filename, props.url);
  }

  public get id(): ImageId | undefined {
    return this._id;
  }

  public get filename(): string {
    return this._filename;
  }

  public get url(): string {
    return this._url;
  }

  public renameFile(newFilename: string): void {
    Image.assertFilename(newFilename);
    this._filename = newFilename.trim();
  }

  public changeUrl(newUrl: string): void {
    Image.assertUrl(newUrl);
    this._url = newUrl.trim();
  }

  public toPrimitives(): ImagePrimitives {
    return {
      id: this._id,
      filename: this._filename,
      url: this._url,
    };
  }

  private static assertId(id: ImageId | undefined): void {
    if (id === undefined) return;
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error("Image.id must be a positive integer when provided.");
    }
  }

  private static assertFilename(filename: string): void {
    if (typeof filename !== "string" || filename.trim().length === 0) {
      throw new Error("Image.filename must be a non-empty string.");
    }
  }

  private static assertUrl(url: string): void {
    if (typeof url !== "string" || url.trim().length === 0) {
      throw new Error("Image.url must be a non-empty string.");
    }
    const trimmed = url.trim();
    if (!(trimmed.startsWith("http://") || trimmed.startsWith("https://"))) {
      throw new Error("Image.url must start with http:// or https://");
    }
  }
}
