import React from 'react';
import { ProjectMember, TaskFilters as ITaskFilters } from '../../types';

interface Props {
  filters: ITaskFilters;
  onChange: (filters: ITaskFilters) => void;
  members: ProjectMember[];
}

const TaskFiltersBar: React.FC<Props> = ({ filters, onChange, members }) => {
  const update = (key: keyof ITaskFilters, value: string) => {
    onChange({ ...filters, [key]: value || undefined } as ITaskFilters);
  };

  return (
    <div className="filters-bar">
      <input className="filter-search" type="search" aria-label="Search tasks" placeholder="Search tasks…" value={filters.search || ''} onChange={(e) => update('search', e.target.value)} />

      <select aria-label="Filter by priority" value={filters.priority || ''} onChange={(e) => update('priority', e.target.value)}>
        <option value="">All Priorities</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>

      <select aria-label="Filter by status" value={filters.status || ''} onChange={(e) => update('status', e.target.value)}>
        <option value="">All Statuses</option>
        <option value="todo">To Do</option>
        <option value="in_progress">In Progress</option>
        <option value="done">Done</option>
      </select>

      <select aria-label="Filter by assigned member" value={filters.assignee_id || ''} onChange={(e) => update('assignee_id', e.target.value)}>
        <option value="">All Members</option>
        <option value="unassigned">Unassigned</option>
        {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
      </select>

      <select aria-label="Filter by due date" value={filters.due_state || ''} onChange={(e) => update('due_state', e.target.value)}>
        <option value="">Any Due Date</option>
        <option value="overdue">Overdue</option>
        <option value="today">Due Today</option>
        <option value="next7">Next 7 Days</option>
        <option value="no_date">No Due Date</option>
      </select>

      <label className="date-filter"><span>From</span><input aria-label="Due date from" type="date" value={filters.due_from || ''} onChange={(e) => update('due_from', e.target.value)} /></label>
      <label className="date-filter"><span>To</span><input aria-label="Due date to" type="date" value={filters.due_to || ''} onChange={(e) => update('due_to', e.target.value)} /></label>

      <select aria-label="Sort tasks by" value={filters.sort_by || ''} onChange={(e) => update('sort_by', e.target.value)}>
        <option value="">Sort By</option>
        <option value="created_at">Created Date</option>
        <option value="due_date">Due Date</option>
        <option value="priority">Priority</option>
        <option value="title">Title</option>
      </select>

      <select aria-label="Sort order" value={filters.sort_order || 'desc'} onChange={(e) => update('sort_order', e.target.value)}>
        <option value="desc">Descending</option>
        <option value="asc">Ascending</option>
      </select>

      {(filters.search || filters.priority || filters.status || filters.assignee_id || filters.due_state || filters.due_from || filters.due_to) &&
        <button className="clear-filters" onClick={() => onChange({})}>Clear filters</button>}
    </div>
  );
};

export default TaskFiltersBar;
