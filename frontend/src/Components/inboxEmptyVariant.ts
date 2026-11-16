export const EMPTY_VARIANT = {
  /** Nothing was ever pending, or everything was answered some other way. */
  PLAIN: "plain",
  /** The last pending invitation was just rejected in this visit. */
  REJECTED: "rejected",
} as const;

export type EmptyVariant = (typeof EMPTY_VARIANT)[keyof typeof EMPTY_VARIANT];
