/** Why `updatePostText` did not write. Shared so the editor can branch on it. */
export type UpdatePostTextError =
  | { ok: false; code: 'TEXT_TOO_LONG' }
  | { ok: false; code: 'POST_NOT_FOUND' }
  | { ok: false; code: 'POST_LOCKED' }
  | { ok: false; code: 'READ_ONLY' }
  | {
      ok: false
      code: 'EDIT_CONFLICT'
      /** The stored text and its `last_edited_at` (ISO), for "Load latest". */
      text: string
      lastEditedAt: string
    }
