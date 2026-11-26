import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ProjectModel } from '../models/Project';
import { ReportModel } from '../models/Report';

export const reportController = {
  async getOverview(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const [completedByDay, memberWorkload, projects] = await Promise.all([
        ReportModel.getCompletedByDay(userId),
        ReportModel.getMemberWorkload(userId),
        ProjectModel.findAllByUser(userId),
      ]);
      res.json({ completedByDay, memberWorkload, projects });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch reports.' });
    }
  },
};
