import db from '../config/database';

export interface ITaskComment {
  id: number;
  task_id: number;
  user_id: number;
  author_name: string;
  author_email: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface ITaskHistoryEntry {
  id: number;
  actor_name: string;
  event_type: string;
  details: Record<string, unknown>;
  created_at: string;
}

export const TaskDiscussionModel = {
  async getComments(taskId: number): Promise<ITaskComment[]> {
    const res = await db.query(`
      SELECT c.id, c.task_id, c.user_id, u.name AS author_name, u.email AS author_email,
             c.content, c.created_at, c.updated_at
      FROM task_comments c JOIN users u ON u.id = c.user_id
      WHERE c.task_id = $1 ORDER BY c.created_at ASC
    `, [taskId]);
    return res.rows as ITaskComment[];
  },

  async addComment(taskId: number, userId: number, content: string): Promise<ITaskComment> {
    const res = await db.query(`
      INSERT INTO task_comments (task_id, user_id, content) VALUES ($1, $2, $3)
      RETURNING id, task_id, user_id, content, created_at, updated_at
    `, [taskId, userId, content]);
    const comment = res.rows[0];
    const userRes = await db.query('SELECT name AS author_name, email AS author_email FROM users WHERE id = $1', [userId]);
    return { ...comment, ...userRes.rows[0] } as ITaskComment;
  },

  async updateComment(commentId: number, taskId: number, userId: number, content: string): Promise<ITaskComment | undefined> {
    const res = await db.query(`
      UPDATE task_comments SET content = $1, updated_at = NOW()
      WHERE id = $2 AND task_id = $3 AND user_id = $4
      RETURNING id, task_id, user_id, content, created_at, updated_at
    `, [content, commentId, taskId, userId]);
    const comment = res.rows[0];
    if (!comment) return undefined;
    const userRes = await db.query('SELECT name AS author_name, email AS author_email FROM users WHERE id = $1', [userId]);
    return { ...comment, ...userRes.rows[0] } as ITaskComment;
  },

  async deleteComment(commentId: number, taskId: number, userId: number): Promise<boolean> {
    const res = await db.query('DELETE FROM task_comments WHERE id = $1 AND task_id = $2 AND user_id = $3', [commentId, taskId, userId]);
    return (res.rowCount || 0) > 0;
  },

  async getHistory(projectId: number, taskId: number): Promise<ITaskHistoryEntry[]> {
    const res = await db.query(`
      SELECT a.id, COALESCE(u.name, 'Deleted user') AS actor_name,
             a.event_type, a.details, a.created_at
      FROM project_activity a LEFT JOIN users u ON u.id = a.actor_id
      WHERE a.project_id = $1 AND a.details->>'task_id' = $2
      ORDER BY a.created_at DESC LIMIT 100
    `, [projectId, String(taskId)]);
    return res.rows as ITaskHistoryEntry[];
  },
};
