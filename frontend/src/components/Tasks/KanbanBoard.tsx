import React, { DragEvent, useMemo, useState } from 'react';
import { Status, Task } from '../../types';
import TaskCard from './TaskCard';

interface Props {
  tasks: Task[];
  onMoveTask: (task: Task, status: Status) => Promise<void>;
  onEdit: (task: Task) => void;
  onDelete: (id: number) => void;
  onStatusChange: (task: Task) => void;
  onDiscuss: (task: Task) => void;
}

const columns: { status: Status; title: string; className: string }[] = [
  { status: 'todo', title: 'To Do', className: 'kanban-todo' },
  { status: 'in_progress', title: 'In Progress', className: 'kanban-progress' },
  { status: 'done', title: 'Done', className: 'kanban-done' },
];

const KanbanBoard: React.FC<Props> = ({ tasks, onMoveTask, onEdit, onDelete, onStatusChange, onDiscuss }) => {
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [dropStatus, setDropStatus] = useState<Status | null>(null);
  const [savingTaskId, setSavingTaskId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const tasksByStatus = useMemo(() => columns.map((column) => ({
    ...column,
    tasks: tasks.filter((task) => task.status === column.status),
  })), [tasks]);

  const handleDrop = async (event: DragEvent<HTMLElement>, targetStatus: Status) => {
    event.preventDefault();
    setDropStatus(null);
    const taskId = draggedTaskId ?? Number(event.dataTransfer.getData('text/plain'));
    const task = tasks.find((item) => item.id === taskId);
    setDraggedTaskId(null);
    if (!task || task.status === targetStatus) return;

    setSavingTaskId(task.id);
    setError('');
    try {
      await onMoveTask(task, targetStatus);
    } catch {
      setError(`Couldn't move “${task.title}”. Please try again.`);
    } finally {
      setSavingTaskId(null);
    }
  };

  return (
    <div className="kanban-board" aria-label="Kanban board">
      {error && <div className="kanban-error" role="alert">{error}</div>}
      {tasksByStatus.map((column) => (
        <section
          key={column.status}
          className={`kanban-column ${column.className} ${dropStatus === column.status ? 'kanban-column-over' : ''}`}
          onDragOver={(event) => { event.preventDefault(); setDropStatus(column.status); }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropStatus(null);
          }}
          onDrop={(event) => { void handleDrop(event, column.status); }}
          aria-label={`${column.title}, ${column.tasks.length} tasks`}
        >
          <header className="kanban-column-header">
            <div><span className="kanban-status-dot" /><h3>{column.title}</h3></div>
            <span className="kanban-count">{column.tasks.length}</span>
          </header>
          <div className="kanban-column-body">
            {column.tasks.length === 0 ? (
              <p className="kanban-empty">Drop a task here</p>
            ) : column.tasks.map((task) => (
              <div
                key={task.id}
                className={`kanban-task ${draggedTaskId === task.id ? 'kanban-task-dragging' : ''}`}
                draggable={savingTaskId !== task.id}
                onDragStart={(event) => {
                  setDraggedTaskId(task.id);
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', String(task.id));
                }}
                onDragEnd={() => { setDraggedTaskId(null); setDropStatus(null); }}
              >
                <TaskCard task={task} onEdit={onEdit} onDelete={onDelete} onStatusChange={onStatusChange} onDiscuss={onDiscuss} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

export default KanbanBoard;
