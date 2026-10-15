/** Operations shared by rendering, optimistic editing, and cloud-conflict rebasing.
 * One operation changes only the targeted field, preserving unrelated remote changes.
 */
const COLORS = ["butter", "mint", "lilac", "rose", "sky", "paper"];
const STATUSES = ["planned", "active", "review", "done"];
const clip = (v, limit) => String(v ?? "").trim().slice(0, limit);
const validId = id => typeof id === "string" && id.length >= 1 && id.length <= 90;
function blankBoard() {
  const boardId = "board-default";
  return { version: 1, boards: [{ id: boardId, name: "My board", createdAt: Date.now() }], notes: [], activeBoardId: boardId };
}
function validateDoc(value) {
  if (!value || typeof value !== "object" || value.version !== 1 || !Array.isArray(value.boards) || !Array.isArray(value.notes)) return false;
  if (!value.boards.length || value.boards.length > 100 || value.notes.length > 3000) return false;
  const ids = new Set(value.boards.map(b => b.id));
  if (!value.boards.every(b => validId(b.id) && typeof b.name === "string")) return false;
  return value.notes.every(n => validId(n.id) && ids.has(n.boardId) && Array.isArray(n.tasks) && n.tasks.length <= 35 && typeof n.title === "string" && COLORS.includes(n.color) && STATUSES.includes(n.status));
}
function applyOperation(document, op, strict = false) {
  if (!validateDoc(document)) throw new Error("Invalid local document");
  const next = structuredClone(document);
  const note = () => {
    const found = next.notes.find(n => n.id === op.noteId);
    if (!found && strict) throw new Error(`Note was removed on another device: ${op.noteId}`);
    return found;
  };
  let target, task;
  switch (op.type) {
    case "new-note":
      if (!next.boards.some(b => b.id === op.note?.boardId)) throw new Error("Target board was removed");
      if (!next.notes.some(n => n.id === op.note.id)) next.notes.push(op.note);
      break;
    case "update-note":
      target = note();
      if (target) {
        if (op.field === "title") target.title = clip(op.value,90) || "Untitled";
        else if (op.field === "body") target.body = clip(op.value,1200);
        else if (op.field === "status" && STATUSES.includes(op.value)) target.status = op.value;
        else if (op.field === "color" && COLORS.includes(op.value)) target.color = op.value;
        else throw new Error("Invalid note field");
        target.updatedAt = op.at;
      }
      break;
    case "new-task":
      target = note();
      if (target) {
        if (target.tasks.length >= 35) throw new Error("A note supports up to 35 tasks");
        if (!target.tasks.some(t => t.id === op.task.id)) target.tasks.push({ id:op.task.id, text:clip(op.task.text,180), done:false });
        target.updatedAt=op.at;
      }
      break;
    case "update-task":
      target = note();
      task = target?.tasks.find(t => t.id === op.taskId);
      if (!task && strict) throw new Error("Task was removed on another device");
      if (task) {
        if (op.field === "done") task.done=!!op.value;
        else if (op.field === "text") task.text=clip(op.value,180);
        else throw new Error("Invalid task field");
        target.updatedAt=op.at;
      }
      break;
    case "remove-task":
      target = note();
      if (target) { target.tasks = target.tasks.filter(t => t.id !== op.taskId);target.updatedAt=op.at; }
      break;
    case "archive-note":
      target = note();
      if (target) { target.archivedAt=op.at;target.status="done";target.updatedAt=op.at; }
      break;
    case "restore-note":
      target = note();
      if (target) { target.archivedAt=null;target.status="active";target.updatedAt=op.at; }
      break;
    case "new-board":
      if (!op.board || !validId(op.board.id) || typeof op.board.name !== 'string' || !clip(op.board.name, 80)) throw new Error('Invalid board');
      if (next.boards.length >= 100) throw new Error('Board limit reached');
      if (!next.boards.some(b => b.id === op.board.id)) next.boards.push({...op.board,name:clip(op.board.name,80)});
      next.activeBoardId=op.board.id;
      break;
    case "rename-board":
      target = next.boards.find(b => b.id === op.boardId);
      if (!target) { if (strict) throw new Error('Board was removed on another device'); break; }
      if (!clip(op.name,80)) throw new Error('Enter a board name');
      target.name=clip(op.name,80);
      break;
    default: throw new Error("Unsupported change");
  }
  if (!validateDoc(next)) throw new Error("Change creates invalid board");
  return next;
}
function replay(remote, pending) {
  let data = remote ? structuredClone(remote) : blankBoard();
  if (!validateDoc(data)) throw new Error("Cloud returned invalid TackBoard data");
  for (const op of pending) data=applyOperation(data,op,true);
  return data;
}
module.exports = { COLORS, STATUSES, blankBoard, validateDoc, applyOperation, replay };
