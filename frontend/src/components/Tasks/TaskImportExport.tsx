import React, { ChangeEvent, useMemo, useState } from 'react';
import { ProjectMember, Task, Priority, Status } from '../../types';
import { taskAPI } from '../../api/api';

interface Props {
  projectId: number;
  tasks: Task[];
  members: ProjectMember[];
  onImported: () => void;
}

interface ImportRow {
  line: number;
  title: string;
  description: string;
  priority: Priority;
  status: Status;
  due_date: string | null;
  assigned_to_user_id: number | null;
  recurrence_rule: 'daily' | 'weekly' | 'monthly' | null;
  error: string;
}

const allowedHeaders = new Set(['title', 'description', 'priority', 'status', 'due_date', 'assigned_to_email', 'recurrence_rule']);
const statuses = new Set<Status>(['todo', 'in_progress', 'done']);
const priorities = new Set<Priority>(['low', 'medium', 'high']);
const recurrenceRules = new Set(['', 'daily', 'weekly', 'monthly']);

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell.length === 0) quoted = true;
    else if (char === ',') { row.push(cell); cell = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += char;
  }
  if (quoted) throw new Error('CSV contains a quoted field that was not closed.');
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((values) => values.some((value) => value.trim() !== ''));
}

const escapeHTML = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));
const csvCell = (value: string) => {
  const safe = /^[=+@-]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
};
const localDate = (value: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const TaskImportExport: React.FC<Props> = ({ projectId, tasks, members, onImported }) => {
  const [showImport, setShowImport] = useState(false);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [importFinished, setImportFinished] = useState(false);
  const validRows = useMemo(() => rows.filter((row) => !row.error), [rows]);
  const invalidCount = rows.length - validRows.length;

  const exportCSV = () => {
    const header = ['title', 'description', 'priority', 'status', 'due_date', 'assigned_to_email', 'recurrence_rule'];
    const data = tasks.map((task) => [task.title, task.description || '', task.priority, task.status, localDate(task.due_date), task.assigned_to_email || '', task.recurrence_rule || '']);
    const content = `\uFEFF${[header, ...data].map((record) => record.map((value) => csvCell(String(value))).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `planify-project-${projectId}-tasks.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.alert('The browser blocked the print window. Allow pop-ups for this page and try again.');
      return;
    }
    const body = tasks.map((task) => `<tr><td>${escapeHTML(task.title)}</td><td>${escapeHTML(task.description || '')}</td><td>${escapeHTML(task.priority)}</td><td>${escapeHTML(task.status.replace('_', ' '))}</td><td>${escapeHTML(localDate(task.due_date) || '—')}</td><td>${escapeHTML(task.assigned_to_name || 'Unassigned')}</td></tr>`).join('');
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Planify tasks</title><style>body{font:14px Arial,sans-serif;color:#111827;padding:28px}h1{font-size:22px}p{color:#4b5563}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #d1d5db;padding:8px;text-align:left;vertical-align:top;word-break:break-word}th{background:#f3f4f6}@media print{body{padding:0}tr{break-inside:avoid}}</style></head><body><h1>Planify tasks</h1><p>${tasks.length} task${tasks.length === 1 ? '' : 's'} · ${new Date().toLocaleDateString()}</p><table><thead><tr><th>Title</th><th>Description</th><th>Priority</th><th>Status</th><th>Due date</th><th>Assigned to</th></tr></thead><tbody>${body || '<tr><td colspan="6">No tasks to export</td></tr>'}</tbody></table><script>window.onload=()=>window.print();</script></body></html>`);
    printWindow.document.close();
  };

  const openImporter = () => {
    setRows([]);
    setFileName('');
    setParseError('');
    setImportMessage('');
    setImportFinished(false);
    setShowImport(true);
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setRows([]); setFileName(file.name); setParseError(''); setImportMessage('');
    setImportFinished(false);
    if (file.size > 2 * 1024 * 1024) { setParseError('CSV must be smaller than 2 MB.'); return; }
    try {
      const parsed = parseCSV((await file.text()).replace(/^\uFEFF/, ''));
      if (parsed.length < 2) throw new Error('CSV needs a header row and at least one task row.');
      if (parsed.length > 501) throw new Error('A file can contain up to 500 tasks at a time.');
      const headers = parsed[0].map((header) => header.trim().toLowerCase().replace(/[\s-]+/g, '_'));
      if (new Set(headers).size !== headers.length) throw new Error('CSV contains duplicate column names.');
      if (!headers.includes('title')) throw new Error('CSV must contain a “title” column.');
      const unknown = headers.filter((header) => !allowedHeaders.has(header));
      if (unknown.length) throw new Error(`Unknown column${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}.`);

      const memberByEmail = new Map(members.map((member) => [member.email.toLowerCase(), member.id]));
      const parsedTasks = parsed.slice(1).map((values, index): ImportRow => {
        const cells = Object.fromEntries(headers.map((header, column) => [header, (values[column] || '').trim()]));
        const title = cells.title || '';
        const priorityValue = (cells.priority || 'medium').toLowerCase() as Priority;
        const statusValue = (cells.status || 'todo').toLowerCase() as Status;
        const recurrenceValue = (cells.recurrence_rule || '').toLowerCase();
        const dueValue = cells.due_date || '';
        const email = (cells.assigned_to_email || '').toLowerCase();
        const errors: string[] = [];
        if (values.length > headers.length) errors.push('Row has more values than the header.');
        if (!title) errors.push('Title is required.');
        if (!priorities.has(priorityValue)) errors.push('Priority must be low, medium, or high.');
        if (!statuses.has(statusValue)) errors.push('Status must be todo, in_progress, or done.');
        if (dueValue && (!/^\d{4}-\d{2}-\d{2}$/.test(dueValue) || Number.isNaN(Date.parse(`${dueValue}T00:00:00Z`)) || new Date(`${dueValue}T00:00:00Z`).toISOString().slice(0, 10) !== dueValue)) errors.push('Due date must use YYYY-MM-DD.');
        if (!recurrenceRules.has(recurrenceValue)) errors.push('Repeat must be daily, weekly, monthly, or empty.');
        if (email && !memberByEmail.has(email)) errors.push('Assigned email is not a member of this project.');
        return {
          line: index + 2, title, description: cells.description || '', priority: priorityValue,
          status: statusValue, due_date: dueValue || null,
          assigned_to_user_id: email ? memberByEmail.get(email)! : null,
          recurrence_rule: recurrenceValue ? recurrenceValue as ImportRow['recurrence_rule'] : null,
          error: errors.join(' '),
        };
      });
      setRows(parsedTasks);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Could not read this CSV file.');
    }
  };

  const importTasks = async () => {
    if (!validRows.length) return;
    setBusy(true); setImportMessage('');
    let imported = 0;
    const failures: string[] = [];
    for (const row of validRows) {
      try {
        await taskAPI.create(projectId, {
          title: row.title, description: row.description, priority: row.priority, status: row.status,
          due_date: row.due_date, assigned_to_user_id: row.assigned_to_user_id, recurrence_rule: row.recurrence_rule,
        });
        imported += 1;
      } catch {
        failures.push(`Row ${row.line}`);
      }
    }
    if (imported) onImported();
    setImportMessage(`${imported} task${imported === 1 ? '' : 's'} imported.${failures.length ? ` Could not import: ${failures.join(', ')}.` : ''}${invalidCount ? ` ${invalidCount} invalid row${invalidCount === 1 ? '' : 's'} skipped.` : ''}`);
    setImportFinished(true);
    setBusy(false);
  };

  return (
    <>
      <div className="task-data-tools" aria-label="Import and export tasks">
        <button className="btn btn-ghost" onClick={openImporter}>Import CSV</button>
        <button className="btn btn-ghost" onClick={exportCSV} disabled={!tasks.length}>Export CSV</button>
        <button className="btn btn-ghost" onClick={exportPDF}>Export PDF</button>
        <span className="task-data-note">Exports use the tasks matching the current filters. PDF opens the print view; choose “Save as PDF”.</span>
      </div>
      {showImport && <div className="team-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setShowImport(false); }}>
        <section className="import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-dialog-title">
          <header className="team-dialog-header"><div><h2 id="import-dialog-title">Import tasks from CSV</h2><p>Required column: title. Optional: description, priority, status, due_date, assigned_to_email, recurrence_rule.</p></div><button className="btn-icon" onClick={() => setShowImport(false)} disabled={busy} aria-label="Close">×</button></header>
          <p className="import-hint">Priority: low / medium / high · Status: todo / in_progress / done · Date: YYYY-MM-DD</p>
          <label className="import-file-label">Choose a CSV file<input type="file" accept=".csv,text/csv" onChange={(event) => { void handleFile(event); }} disabled={busy} /></label>
          {fileName && <p className="import-file-name">Selected: {fileName}</p>}
          {parseError && <p className="import-error" role="alert">{parseError}</p>}
          {rows.length > 0 && <>
            <p className="import-summary">{validRows.length} valid · {invalidCount} invalid · {rows.length} rows found</p>
            <div className="import-preview-wrap"><table className="import-preview"><thead><tr><th>Line</th><th>Title</th><th>Status</th><th>Priority</th><th>Validation</th></tr></thead><tbody>
              {rows.slice(0, 8).map((row) => <tr key={row.line} className={row.error ? 'import-row-invalid' : ''}><td>{row.line}</td><td>{row.title || '—'}</td><td>{row.status}</td><td>{row.priority}</td><td>{row.error || (importFinished ? 'Import attempted' : 'Ready')}</td></tr>)}
            </tbody></table>{rows.length > 8 && <p className="import-hint">Showing first 8 rows of {rows.length}.</p>}</div>
          </>}
          {importMessage && <p className="import-result" role="status">{importMessage}</p>}
          <footer className="import-footer"><button className="btn btn-ghost" onClick={() => setShowImport(false)} disabled={busy}>Close</button><button className="btn btn-primary" onClick={() => { void importTasks(); }} disabled={busy || importFinished || validRows.length === 0}>{busy ? 'Importing…' : importFinished ? 'Import finished' : `Import ${validRows.length} valid task${validRows.length === 1 ? '' : 's'}`}</button></footer>
        </section>
      </div>}
    </>
  );
};

export default TaskImportExport;
