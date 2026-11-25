import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Task, Project, ProjectMember, TaskFilters as ITaskFilters } from '../../types';
import { taskAPI, projectAPI } from '../../api/api';
import TaskCard from './TaskCard';
import TaskForm from './TaskForm';
import TaskFiltersBar from './TaskFilters';
import ProjectTeam from '../Projects/ProjectTeam';
import { useAuth } from '../../context/AuthContext';

const TaskList: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [filters, setFilters] = useState<ITaskFilters>({});
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [activityVersion, setActivityVersion] = useState(0);

  const fetchProject = useCallback(async () => {
    try {
      const res = await projectAPI.getOne(Number(projectId));
      setProject(res.data);
    } catch {
      navigate('/');
    }
  }, [projectId, navigate]);

  const fetchTasks = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (filters.priority) params.priority = filters.priority;
      if (filters.status) params.status = filters.status;
      if (filters.sort_by) params.sort_by = filters.sort_by;
      if (filters.sort_order) params.sort_order = filters.sort_order;

      const res = await taskAPI.getByProject(Number(projectId), params);
      setTasks(res.data);
    } catch {
    }
  }, [projectId, filters]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);
  useEffect(() => {
    projectAPI.getMembers(Number(projectId)).then((res) => setMembers(res.data)).catch(() => setMembers([]));
  }, [projectId]);
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleTaskCreated = (task: Task) => {
    setTasks((prev) => [task, ...prev]);
    setShowForm(false);
    fetchProject();
    setActivityVersion((version) => version + 1);
  };

  const handleTaskUpdated = (updated: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setEditingTask(null);
    fetchProject();
    setActivityVersion((version) => version + 1);
  };

  const handleTaskDeleted = (id: number) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    fetchProject();
    setActivityVersion((version) => version + 1);
  };

  if (!project) return null;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>{project.name}</h2>
          {project.description && <p className="page-subtitle">{project.description}</p>}
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingTask(null);
          }}
          className="btn btn-primary"
        >
          + Add Task
        </button>
      </div>

      <div className="project-progress-bar">
        <div className="progress-stats">
          <span>
            {project.completed_tasks}/{project.total_tasks} completed
          </span>
          <span>{project.progress}%</span>
        </div>
        <div className="progress-bar large">
          <div className="progress-fill" style={{ width: `${project.progress}%` }} />
        </div>
      </div>

      <ProjectTeam
        projectId={Number(projectId)}
        ownerId={project.user_id}
        currentUserId={user?.id || 0}
        members={members}
        onMembersChange={setMembers}
        activityVersion={activityVersion}
      />

      {(showForm || editingTask) && (
        <div className="form-card">
          <TaskForm
            projectId={Number(projectId)}
            members={members}
            task={editingTask || undefined}
            onSubmit={editingTask ? handleTaskUpdated : handleTaskCreated}
            onCancel={() => {
              setShowForm(false);
              setEditingTask(null);
            }}
          />
        </div>
      )}

      <TaskFiltersBar filters={filters} onChange={setFilters} />

      <div className="task-list">
        {tasks.length === 0 ? (
          <p className="empty-state">No tasks yet. Add one to get started!</p>
        ) : (
          tasks.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              onEdit={setEditingTask}
              onDelete={handleTaskDeleted}
              onStatusChange={handleTaskUpdated}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default TaskList;
