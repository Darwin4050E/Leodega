export const NOTICE_TONE = {
  SUCCESS: "success",
  ERROR: "error",
} as const;

export type NoticeTone = (typeof NOTICE_TONE)[keyof typeof NOTICE_TONE];

export interface InviteNotice {
  tone: NoticeTone;
  title: string;
  body?: string;
}
