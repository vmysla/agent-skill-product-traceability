// Pure todo logic, shared by index.html and check/.
// Ordering rule (project decision): completed todos always sit below all
// active todos; within each group, todos are sorted by priority (high, med,
// low) and insertion order (oldest first) is kept within the same priority.
// Due date rule (project decision): stored as a plain 'YYYY-MM-DD' string and
// treated as a LOCAL calendar date, never converted through UTC. A todo is
// overdue only when its due date is strictly before today's local date.
(function (root) {
  var FILTERS = ['all', 'active', 'completed'];

  // Stable sort by priority, highest first; ties keep insertion order.
  function byPriority(list) {
    var rank = { high: 0, med: 1, low: 2 };
    return list
      .map(function (t, i) { return { t: t, i: i, r: rank[normalizePriority(t.priority)] }; })
      .sort(function (a, b) { return a.r - b.r || a.i - b.i; })
      .map(function (x) { return x.t; });
  }

  // Search rule: case-insensitive substring match on the todo text; an empty
  // term matches everything. Search narrows the active filter, never replaces it.
  function matchesSearch(todo, term) {
    if (!term) return true;
    return String(todo.text || '').toLowerCase().indexOf(String(term).toLowerCase()) !== -1;
  }

  function visibleTodos(todos, filter, search) {
    todos = todos.filter(function (t) { return matchesSearch(t, search); });
    var active = byPriority(todos.filter(function (t) { return !t.completed; }));
    var done = byPriority(todos.filter(function (t) { return !!t.completed; }));
    if (filter === 'active') return active;
    if (filter === 'completed') return done;
    return active.concat(done);
  }

  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // Local calendar date of `now` as 'YYYY-MM-DD' (no UTC conversion).
  function localToday(now) {
    var d = now || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  // 'YYYY-MM-DD' strings compare correctly as plain strings.
  function isOverdue(todo, today) {
    return !!todo && typeof todo.due === 'string' && DATE_RE.test(todo.due) && todo.due < today;
  }

  // Priority rule: one of 'low', 'med', 'high'; anything else (including
  // todos saved before priorities existed) counts as 'med'.
  var PRIORITIES = ['low', 'med', 'high'];

  function normalizePriority(p) {
    return PRIORITIES.indexOf(p) !== -1 ? p : 'med';
  }

  // Bulk rules: act on every stored todo (not only the visible ones) and keep
  // the stored insertion order, so display order still comes from visibleTodos.
  function clearCompleted(todos) {
    return todos.filter(function (t) { return !t.completed; });
  }

  function markAllComplete(todos) {
    return todos.map(function (t) {
      var copy = {};
      for (var k in t) if (Object.prototype.hasOwnProperty.call(t, k)) copy[k] = t[k];
      copy.completed = true;
      return copy;
    });
  }

  var api = {
    FILTERS: FILTERS, PRIORITIES: PRIORITIES, visibleTodos: visibleTodos, matchesSearch: matchesSearch,
    localToday: localToday, isOverdue: isOverdue, normalizePriority: normalizePriority,
    clearCompleted: clearCompleted, markAllComplete: markAllComplete
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TodoLogic = api;
})(this);
