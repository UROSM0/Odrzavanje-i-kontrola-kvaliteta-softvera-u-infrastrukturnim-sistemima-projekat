import React, { useMemo, useState } from 'react';
import { Task } from '../../types';

interface Props {
  tasks: Task[];
  onSelectTask: (task: Task) => void;
}

const dateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const TaskCalendar: React.FC<Props> = ({ tasks, onSelectTask }) => {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const todayKey = dateKey(new Date());
  const tasksByDate = useMemo(() => tasks.reduce<Record<string, Task[]>>((groups, task) => {
    if (!task.due_date) return groups;
    const due = new Date(task.due_date);
    const key = dateKey(due);
    groups[key] = [...(groups[key] || []), task];
    return groups;
  }, {}), [tasks]);

  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(month.getFullYear(), month.getMonth(), 1 - mondayOffset);
  const days = Array.from({ length: 42 }, (_, index) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index));

  return (
    <section className="calendar-card" aria-label="Task calendar">
      <div className="calendar-toolbar">
        <button className="btn btn-ghost" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month">‹</button>
        <h3>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3>
        <button className="btn btn-ghost" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month">›</button>
        <button className="btn btn-ghost calendar-today" onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Today</button>
      </div>
      <div className="calendar-grid calendar-weekdays">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <div key={day}>{day}</div>)}
      </div>
      <div className="calendar-grid calendar-days">
        {days.map((day) => {
          const key = dateKey(day);
          const dayTasks = tasksByDate[key] || [];
          const inMonth = day.getMonth() === month.getMonth();
          return (
            <div key={key} className={`calendar-day ${inMonth ? '' : 'outside-month'} ${key === todayKey ? 'calendar-current-day' : ''}`}>
              <span className="calendar-day-number">{day.getDate()}</span>
              <div className="calendar-day-tasks">
                {dayTasks.slice(0, 3).map((task) => {
                  const overdue = key < todayKey && task.status !== 'done';
                  return <button key={task.id} className={`calendar-task ${overdue ? 'calendar-task-overdue' : ''} ${task.status === 'done' ? 'calendar-task-done' : ''}`} onClick={() => onSelectTask(task)} title={`${task.title}${task.assigned_to_name ? ` — ${task.assigned_to_name}` : ''}`}>
                    <span>{task.title}</span>
                  </button>;
                })}
                {dayTasks.length > 3 && <span className="calendar-more">+{dayTasks.length - 3} more</span>}
              </div>
            </div>
          );
        })}
      </div>
      <p className="calendar-note">Select a task to edit its details or due date.</p>
    </section>
  );
};

export default TaskCalendar;
