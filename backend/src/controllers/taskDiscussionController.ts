import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { TaskModel } from '../models/Task';
import { TaskDiscussionModel } from '../models/TaskDiscussion';
import { ProjectModel } from '../models/Project';

const MAX_COMMENT_LENGTH = 5000;

async function getAccessibleTask(taskId: number, userId: number, res: Response) {
  const task = await TaskModel.findById(taskId, userId);
  if (!task) res.status(404).json({ error: 'Task not found.' });
  return task;
}

function readContent(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const content = value.trim();
  return content.length > 0 && content.length <= MAX_COMMENT_LENGTH ? content : null;
}

export const taskDiscussionController = {
  async getComments(req: AuthRequest, res: Response): Promise<void> {
    try {
      const task = await getAccessibleTask(Number(req.params.id), req.userId!, res);
      if (!task) return;
      res.json(await TaskDiscussionModel.getComments(task.id));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch task comments.' });
    }
  },

  async addComment(req: AuthRequest, res: Response): Promise<void> {
    try {
      const task = await getAccessibleTask(Number(req.params.id), req.userId!, res);
      if (!task) return;
      const content = readContent(req.body.content);
      if (!content) {
        res.status(400).json({ error: `Comment must contain 1 to ${MAX_COMMENT_LENGTH} characters.` });
        return;
      }
      const comment = await TaskDiscussionModel.addComment(task.id, req.userId!, content);
      await ProjectModel.logActivity(task.project_id, req.userId!, 'task_comment_added', { task_id: task.id, comment_id: comment.id });
      res.status(201).json(comment);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to add comment.' });
    }
  },

  async updateComment(req: AuthRequest, res: Response): Promise<void> {
    try {
      const task = await getAccessibleTask(Number(req.params.id), req.userId!, res);
      if (!task) return;
      const content = readContent(req.body.content);
      if (!content) {
        res.status(400).json({ error: `Comment must contain 1 to ${MAX_COMMENT_LENGTH} characters.` });
        return;
      }
      const comment = await TaskDiscussionModel.updateComment(Number(req.params.commentId), task.id, req.userId!, content);
      if (!comment) { res.status(404).json({ error: 'Comment not found or you cannot edit it.' }); return; }
      await ProjectModel.logActivity(task.project_id, req.userId!, 'task_comment_edited', { task_id: task.id, comment_id: comment.id });
      res.json(comment);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update comment.' });
    }
  },

  async deleteComment(req: AuthRequest, res: Response): Promise<void> {
    try {
      const task = await getAccessibleTask(Number(req.params.id), req.userId!, res);
      if (!task) return;
      const commentId = Number(req.params.commentId);
      const deleted = await TaskDiscussionModel.deleteComment(commentId, task.id, req.userId!);
      if (!deleted) { res.status(404).json({ error: 'Comment not found or you cannot delete it.' }); return; }
      await ProjectModel.logActivity(task.project_id, req.userId!, 'task_comment_deleted', { task_id: task.id, comment_id: commentId });
      res.json({ message: 'Comment deleted.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to delete comment.' });
    }
  },

  async getHistory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const task = await getAccessibleTask(Number(req.params.id), req.userId!, res);
      if (!task) return;
      res.json(await TaskDiscussionModel.getHistory(task.project_id, task.id));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch task history.' });
    }
  },
};
