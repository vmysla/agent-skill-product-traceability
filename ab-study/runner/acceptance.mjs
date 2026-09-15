// Back-compat shim: acceptance.mjs was the todo-only module before the harness became
// app-aware. runs/pilot-01 is published data and must stay reproducible, so the old path
// keeps working and resolves to the todo criteria.
export * from './acceptance.todo.mjs';
