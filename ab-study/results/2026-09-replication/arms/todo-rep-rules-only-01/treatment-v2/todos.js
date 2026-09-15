// Ordering rule (project decision): completed todos always sit below all
// active todos; within each group, todos are sorted by priority (high, med,
// low), and insertion order (oldest first) is kept within the same priority.
// Search rule: a todo matches when its text contains the search term,
// case-insensitive. An empty term matches everything. Search narrows the
// result of the active filter; it never changes the ordering above.
function visibleTodos(todos, filter, search) {
  var matching = todos.filter(function (t) { return matchesSearch(t, search); });
  var active = byPriority(matching.filter(function (t) { return !t.completed; }));
  var completed = byPriority(matching.filter(function (t) { return !!t.completed; }));
  if (filter === 'active') return active;
  if (filter === 'completed') return completed;
  return active.concat(completed);
}

function matchesSearch(todo, search) {
  if (!search) return true;
  return String(todo.text).toLowerCase().indexOf(String(search).toLowerCase()) !== -1;
}

// Bulk actions apply to every stored todo, ignoring filter and search. They
// keep the stored array order, so the ordering rule above still holds.
function clearCompleted(todos) {
  return todos.filter(function (t) { return !t.completed; });
}

function markAllComplete(todos) {
  return todos.map(function (t) { return t.completed ? t : Object.assign({}, t, { completed: true }); });
}

// Shortcut rule: "/" focuses search only when the user is not typing in a
// field, so a "/" typed into a todo, an edit or the search box stays text.
function isTypingTarget(el) {
  if (!el) return false;
  if (el.isContentEditable) return true;
  return ['INPUT', 'TEXTAREA', 'SELECT'].indexOf(String(el.tagName).toUpperCase()) !== -1;
}

// Due date rule (project decision): due dates are stored as plain local
// "YYYY-MM-DD" strings and never converted through UTC. A todo is overdue
// only when its due date is strictly before today's local calendar date.
var DUE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function localDateString(date) {
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
}

function isOverdue(due, today) {
  return typeof due === 'string' && DUE_PATTERN.test(due) && due < today;
}

// Priority rule (project decision): every todo is "low", "med" or "high".
// Anything missing or unknown (e.g. todos saved before priorities) is "med".
// Priority sorts todos only within the active and completed groups above.
var PRIORITIES = ['low', 'med', 'high'];

function normalizePriority(priority) {
  return PRIORITIES.indexOf(priority) === -1 ? 'med' : priority;
}

// Stable: ties fall back to the original index, so insertion order is kept.
function byPriority(list) {
  return list
    .map(function (t, i) { return { todo: t, index: i, rank: PRIORITIES.indexOf(normalizePriority(t.priority)) }; })
    .sort(function (a, b) { return b.rank - a.rank || a.index - b.index; })
    .map(function (entry) { return entry.todo; });
}
