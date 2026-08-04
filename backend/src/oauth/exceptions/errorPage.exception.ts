export class ErrorPageException extends Error {
  constructor(
    public readonly key: string = "default",
    public readonly redirect?: string,
    public readonly params?: string[],
  ) {
    super("error");
  }
}
