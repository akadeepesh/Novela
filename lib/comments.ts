export type SerializedComment = {
  id: string;
  chapterId: string;
  authorKind: "owner" | "reader";
  authorName: string;
  body: string;
  quote: string;
  resolved: boolean;
  seen: boolean;
  createdAt: string;
};

export function serializeComment(doc: Record<string, unknown>): SerializedComment {
  return {
    id: String(doc._id),
    chapterId: String(doc.chapterId),
    authorKind: (doc.authorKind as SerializedComment["authorKind"]) ?? "owner",
    authorName: (doc.authorName as string) ?? "",
    body: doc.body as string,
    quote: (doc.quote as string) ?? "",
    resolved: Boolean(doc.resolved),
    seen: doc.seenByOwner !== false,
    createdAt: new Date(doc.createdAt as string).toISOString(),
  };
}

/** Longest passage stored with a comment. */
export const MAX_QUOTE_LENGTH = 500;
