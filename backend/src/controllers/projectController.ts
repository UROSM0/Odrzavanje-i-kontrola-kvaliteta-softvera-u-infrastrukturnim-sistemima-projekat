import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ProjectModel } from '../models/Project';
import { UserModel } from '../models/User';

export const projectController = {
  async getAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projects = await ProjectModel.findAllByUser(req.userId!);
      res.json(projects);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch projects.' });
    }
  },

  async getOne(req: AuthRequest, res: Response): Promise<void> {
    try {
      const project = await ProjectModel.findById(Number(req.params.id), req.userId!);
      if (!project) { res.status(404).json({ error: 'Project not found.' }); return; }
      res.json(project);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch project.' });
    }
  },

  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { name, description } = req.body;
      if (!name) { res.status(400).json({ error: 'Project name is required.' }); return; }
      const project = await ProjectModel.create(name, description || '', req.userId!);
      await ProjectModel.logActivity(project.id, req.userId!, 'project_created', { project_name: project.name });
      res.status(201).json(project);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to create project.' });
    }
  },

  async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { name, description } = req.body;
      if (!name) { res.status(400).json({ error: 'Project name is required.' }); return; }

      const project = await ProjectModel.update(Number(req.params.id), name, description || '', req.userId!);
      if (!project) { res.status(404).json({ error: 'Project not found.' }); return; }
      res.json(project);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update project.' });
    }
  },

  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const ok = await ProjectModel.delete(Number(req.params.id), req.userId!);
      if (!ok) {
        res.status(404).json({ error: 'Project not found.' });
        return;
      }
      res.json({ message: 'Project deleted successfully.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to delete project.' });
    }
  },

  async getMembers(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projectId = Number(req.params.projectId);
      if (!(await ProjectModel.canAccess(projectId, req.userId!))) {
        res.status(404).json({ error: 'Project not found.' });
        return;
      }
      res.json(await ProjectModel.getMembers(projectId));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch project members.' });
    }
  },

  async addMember(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projectId = Number(req.params.projectId);
      const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      if (!email) { res.status(400).json({ error: 'Member email is required.' }); return; }
      if (!(await ProjectModel.isOwner(projectId, req.userId!))) {
        res.status(403).json({ error: 'Only the project owner can add members.' });
        return;
      }
      const user = await UserModel.findByEmail(email);
      if (!user) {
        res.status(404).json({ error: 'No Planify account uses that email. Ask them to sign up first.' });
        return;
      }
      if (user.id === req.userId || await ProjectModel.canAccess(projectId, user.id)) {
        res.status(409).json({ error: 'That user is already part of this project.' });
        return;
      }
      await ProjectModel.addMember(projectId, user.id);
      await ProjectModel.logActivity(projectId, req.userId!, 'member_added', { member_name: user.name, member_email: user.email });
      res.status(201).json(await ProjectModel.getMembers(projectId));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to add project member.' });
    }
  },

  async removeMember(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projectId = Number(req.params.projectId);
      const memberId = Number(req.params.memberId);
      if (!(await ProjectModel.isOwner(projectId, req.userId!))) {
        res.status(403).json({ error: 'Only the project owner can remove members.' });
        return;
      }
      const member = (await ProjectModel.getMembers(projectId)).find((item) => item.id === memberId);
      if (!member || member.role !== 'member') {
        res.status(404).json({ error: 'Project member not found.' });
        return;
      }
      await ProjectModel.removeMember(projectId, memberId);
      await ProjectModel.logActivity(projectId, req.userId!, 'member_removed', { member_name: member.name, member_email: member.email });
      res.json(await ProjectModel.getMembers(projectId));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to remove project member.' });
    }
  },

  async getActivity(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projectId = Number(req.params.projectId);
      if (!(await ProjectModel.canAccess(projectId, req.userId!))) {
        res.status(404).json({ error: 'Project not found.' });
        return;
      }
      res.json(await ProjectModel.getActivity(projectId));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch project activity.' });
    }
  },
};
