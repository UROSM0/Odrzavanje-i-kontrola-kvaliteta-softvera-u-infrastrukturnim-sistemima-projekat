import React from 'react';
import { Task } from '../../types';
import { taskAPI } from '../../api/api';

interface Props {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (id: number) => void;
  onStatusChange: (task: Task) => void;
  onDiscuss: (task: Task) => void;
}

const priorityConfig = {
  low: { label: 'Low', className: 'priority-low' },
  medium: { label: 'Medium', className: 'priority-medium' },
  high: { label: 'High', className: 'priority-high' },
} as const;

const statusConfig = {
  todo: { label: 'To Do', className: 'status-todo' },
  in_progress: { label: 'In Progress', className: 'status-progress' },
  done: { label: 'Done', className: 'status-done' },
} as const;

const recurrenceLabels = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' } as const;

const TaskCard: React.FC<Props> = ({ task, onEdit, onDelete, onStatusChange, onDiscuss }) => {
  const cycleStatus = async () => {
    const next = task.status === 'todo' ? 'in_progress' : task.status === 'in_progress' ? 'done' : 'todo';
    try {
      const res = await taskAPI.update(task.id, { status: next });
      onStatusChange(res.data);
    } catch {
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    try {
      await taskAPI.delete(task.id);
      onDelete(task.id);
    } catch {
    }
  };

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : null;
  const dueDay = task.due_date ? new Date(task.due_date) : null;
  const today = new Date();
  const dueDayStart = dueDay ? new Date(dueDay.getFullYear(), dueDay.getMonth(), dueDay.getDate()) : null;
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dayDifference = dueDayStart ? Math.round((dueDayStart.getTime() - todayStart.getTime()) / 86400000) : null;
  const isOverdue = dayDifference !== null && dayDifference < 0 && task.status !== 'done';
  const reminderLabel = isOverdue ? 'Overdue' : dayDifference === 0 ? 'Due today' : dayDifference === 1 ? 'Due tomorrow' : null;

  return (
    <div className={`task-card ${task.status === 'done' ? 'task-done' : ''}`}>
      <div className="task-card-left">
        <button
          onClick={cycleStatus}
          className={`status-checkbox ${statusConfig[task.status].className}`}
          title="Change status"
        >
          {task.status === 'done' ? '✓' : task.status === 'in_progress' ? '◐' : '○'}
        </button>

        <div className="task-card-content">
          <h4 className="task-title">{task.title}</h4>
          {task.description && <p className="task-desc">{task.description}</p>}

          <div className="task-meta">
            <span className={`badge ${priorityConfig[task.priority].className}`}>
              {priorityConfig[task.priority].label}
            </span>
            <span className={`badge ${statusConfig[task.status].className}`}>
              {statusConfig[task.status].label}
            </span>
            {task.recurrence_rule && <span className="badge recurrence-badge">↻ {recurrenceLabels[task.recurrence_rule]}</span>}
            {task.due_date && (
              <span className={`task-due ${isOverdue ? 'overdue' : reminderLabel ? 'due-soon' : ''}`}>
                📅 {formatDate(task.due_date)}{reminderLabel && task.status !== 'done' ? ` · ${reminderLabel}` : ''}
              </span>
            )}
            {task.assigned_to_name && <span className="task-person">Assigned to <strong>{task.assigned_to_name}</strong></span>}
            {task.created_by_name && <span className="task-person">Created by {task.created_by_name}</span>}
          </div>
        </div>
      </div>

      <div className="task-card-actions">
        <button onClick={() => onDiscuss(task)} className="btn-icon" title="Comments and recent activity" aria-label={`Comments and recent activity for ${task.title}`}>
          💬
        </button>
        <button onClick={() => onEdit(task)} className="btn-icon" title="Edit">
          ✎
        </button>
        <button onClick={handleDelete} className="btn-icon btn-danger-icon" title="Delete">
          ✕
        </button>
      </div>
    </div>
  );
};

export default TaskCard;
