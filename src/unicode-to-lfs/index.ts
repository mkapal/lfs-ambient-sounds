export default function unicodeToLfs(
  value: string,
  _options: {
    isNullTerminated?: boolean;
    length?: number;
    shouldEscapeSpecialCharacters?: boolean;
  } = {},
): string {
  return value;
}
