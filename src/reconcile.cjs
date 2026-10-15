'use strict';
/** Plans an explicit local -> cloud import without mutating either document.
 * A note deleted on another device is never silently resurrected under its old ID.
 */
const { randomUUID } = require('node:crypto');
const { validateDoc, replay } = require('./core.cjs');

function planMerge(remote, local, pending, { recoverMissing = false, includeUnqueued = false, makeId = randomUUID } = {}) {
  if (!validateDoc(remote) || !validateDoc(local) || !Array.isArray(pending)) throw new Error('Invalid merge documents or edit queue');
  const cloudNotes = new Set(remote.notes.map(n => n.id));
  const cloudBoards = new Set(remote.boards.map(b => b.id));
  const localNotes = new Map(local.notes.map(n => [n.id, n]));
  const localBoards = new Map(local.boards.map(b => [b.id, b]));
  const createdLocally = new Set(pending.filter(op => op.type === 'new-note').map(op => op.note?.id));
  const missingIds = new Set();
  for (const op of pending) {
    if (typeof op.noteId === 'string' && !cloudNotes.has(op.noteId) && !createdLocally.has(op.noteId)) missingIds.add(op.noteId);
  }
  if (includeUnqueued) for (const id of localNotes.keys()) if (!cloudNotes.has(id) && !createdLocally.has(id)) missingIds.add(id);
  const missing = [...missingIds].map(id => ({ id, title: localNotes.get(id)?.title ?? '(missing locally)' }));
  if (missing.some(n => !localNotes.has(n.id))) {
    throw new Error('A queued edit refers to a note missing from BOTH local and cloud data. Export a recovery backup for review.');
  }
  if (missing.length && !recoverMissing) return { needsRecovery: true, missing, recovered: 0 };

  const boardOps = [];
  const neededBoards = new Set();
  for (const op of pending) {
    if (op.type === 'new-board' && op.board) neededBoards.add(op.board.id);
    if (op.type === 'new-note' && op.note) neededBoards.add(op.note.boardId);
  }
  for (const id of missingIds) neededBoards.add(localNotes.get(id).boardId);
  // A new board can exist locally without pending operations after a legacy migration.
  if (includeUnqueued) for (const b of local.boards) if (!cloudBoards.has(b.id)) neededBoards.add(b.id);
  for (const id of neededBoards) {
    if (cloudBoards.has(id)) continue;
    const board = localBoards.get(id) || pending.find(op => op.type === 'new-board' && op.board?.id === id)?.board;
    if (!board) throw new Error('A locally edited note belongs to a missing board. Export a recovery backup.');
    boardOps.push({ type: 'new-board', board: structuredClone(board), at: Date.now() });
  }
  const recoveredOps = [];
  for (const id of missingIds) {
    const copy = structuredClone(localNotes.get(id));
    copy.id = makeId();
    if (cloudNotes.has(copy.id) || localNotes.has(copy.id)) throw new Error('Recovery note ID collision');
    copy.title = (copy.title.slice(0, 76) + ' (recovered)').slice(0, 90);
    copy.updatedAt = Date.now();
    recoveredOps.push({ type: 'new-note', note: copy, at: Date.now() });
  }
  const retained = pending.filter(op => {
    if (op.type === 'new-board') return false; // deduplicated above
    if (typeof op.noteId === 'string' && missingIds.has(op.noteId)) return false; // copied snapshot already has those edits
    if (op.type === 'new-note' && cloudNotes.has(op.note?.id)) return false;
    return true;
  });
  const queue = [...boardOps, ...retained, ...recoveredOps];
  return { needsRecovery: false, missing, recovered: recoveredOps.length, queue, data: replay(remote, queue) };
}
module.exports = { planMerge };
