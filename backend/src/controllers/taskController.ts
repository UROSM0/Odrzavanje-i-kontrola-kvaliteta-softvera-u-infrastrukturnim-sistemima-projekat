import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { TaskModel } from '../models/Task';
import { ProjectModel } from '../models/Project';

export const taskController = {
  async getAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const filters = {
        priority: req.query.priority as string,
        status: req.query.status as string,
        sort_by: req.query.sort_by as string,
        sort_order: req.query.sort_order as 'asc' | 'desc',
      };
      const tasks = await TaskModel.findAllByUser(req.userId!, filters);
      res.json(tasks);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch tasks.' });
    }
  },

  async getStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const stats = await TaskModel.getStats(req.userId!);
      res.json(stats);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch stats.' });
    }
  },

  async getByProject(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projectId = Number(req.params.projectId);
      if (!(await ProjectModel.findById(projectId, req.userId!))) {
        res.status(404).json({ error: 'Project not found.' });
        return;
      }

      const filters = {
        priority: req.query.priority as string,
        status: req.query.status as string,
        sort_by: req.query.sort_by as string,
        sort_order: req.query.sort_order as 'asc' | 'desc',
      };
      const tasks = await TaskModel.findByProject(projectId, req.userId!, filters);
      res.json(tasks);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch tasks.' });
    }
  },

  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projectId = Number(req.params.projectId);
      if (!(await ProjectModel.findById(projectId, req.userId!))) {
        res.status(404).json({ error: 'Project not found.' });
        return;
      }

      const { title, description, priority, status, due_date } = req.body;
      if (!title) { res.status(400).json({ error: 'Task title is required.' }); return; }
      const assigneeId = req.body.assigned_to_user_id ? Number(req.body.assigned_to_user_id) : null;
      if (assigneeId !== null && !Number.isInteger(assigneeId)) {
        res.status(400).json({ error: 'Invalid assignee.' });
        return;
      }
      if (assigneeId && !(await ProjectModel.canAccess(projectId, assigneeId))) {
        res.status(400).json({ error: 'Assignee must be a member of this project.' });
        return;
      }

      const task = await TaskModel.create({
        title,
        description: description || '',
        priority: priority || 'medium',
        status: status || 'todo',
        due_date: due_date || null,
        project_id: projectId,
        user_id: req.userId!,
        assigned_to_user_id: assigneeId,
      });
      await ProjectModel.logActivity(projectId, req.userId!, 'task_created', { task_id: task.id, task_title: task.title });
      res.status(201).json(task);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to create task.' });
    }
  },

  async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const taskId = Number(req.params.id);
      const previous = await TaskModel.findById(taskId, req.userId!);
      if (!previous) { res.status(404).json({ error: 'Task not found.' }); return; }
      if (Object.prototype.hasOwnProperty.call(req.body, 'assigned_to_user_id')) {
        const assigneeId = req.body.assigned_to_user_id ? Number(req.body.assigned_to_user_id) : null;
        if (assigneeId !== null && !Number.isInteger(assigneeId)) {
          res.status(400).json({ error: 'Invalid assignee.' });
          return;
        }
        if (assigneeId && !(await ProjectModel.canAccess(previous.project_id, assigneeId))) {
          res.status(400).json({ error: 'Assignee must be a member of this project.' });
          return;
        }
        req.body.assigned_to_user_id = assigneeId;
      }
      const task = await TaskModel.update(taskId, req.userId!, req.body);
      if (!task) { res.status(404).json({ error: 'Task not found.' }); return; }
      const changes: Record<string, unknown> = { task_id: task.id, task_title: task.title };
      if (previous.status !== task.status) changes.status = { from: previous.status, to: task.status };
      if (previous.assigned_to_user_id !== task.assigned_to_user_id) {
        changes.assigned_to_user_id = task.assigned_to_user_id;
        changes.assigned_to_name = task.assigned_to_name || null;
      }
      if (previous.title !== task.title) changes.title = { from: previous.title, to: task.title };
      if (previous.priority !== task.priority) changes.priority = { from: previous.priority, to: task.priority };
      const previousDue = previous.due_date ? new Date(previous.due_date).getTime() : null;
      const nextDue = task.due_date ? new Date(task.due_date).getTime() : null;
      if (previousDue !== nextDue) changes.due_date = { from: previous.due_date, to: task.due_date };
      if (previous.description !== task.description) changes.description_changed = true;
      if (Object.keys(changes).length > 2) {
        await ProjectModel.logActivity(task.project_id, req.userId!, 'task_updated', changes);
      }
      res.json(task);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update task.' });
    }
  },

  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const taskId = Number(req.params.id);
      const task = await TaskModel.findById(taskId, req.userId!);
      const ok = task ? await TaskModel.delete(taskId, req.userId!) : false;
      if (!ok) {
        res.status(404).json({ error: 'Task not found.' });
        return;
      }
      await ProjectModel.logActivity(task!.project_id, req.userId!, 'task_deleted', { task_id: task!.id, task_title: task!.title });
      res.json({ message: 'Task deleted successfully.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to delete task.' });
    }
  },
};
