import db from '../config/database';

export interface IProject {
  id: number;
  name: string;
  description: string;
  user_id: number;
  created_at: string;
  updated_at: string;
}

export interface IProjectWithProgress extends IProject {
  total_tasks: number;
  completed_tasks: number;
  progress: number;
}

export interface IProjectMember {
  id: number;
  name: string;
  email: string;
  role: 'owner' | 'member';
  joined_at: string;
}

export interface IProjectActivity {
  id: number;
  actor_name: string;
  event_type: string;
  details: Record<string, unknown>;
  created_at: string;
}

const withProgress = (row: any): IProjectWithProgress => ({
  ...row,
  total_tasks: Number(row.total_tasks) || 0,
  completed_tasks: Number(row.completed_tasks) || 0,
  progress: Number(row.total_tasks) > 0
    ? Math.round(((Number(row.completed_tasks) || 0) / Number(row.total_tasks)) * 100)
    : 0,
});

export const ProjectModel = {
  async findAllByUser(userId: number): Promise<IProjectWithProgress[]> {
    const res = await db.query(`
      SELECT p.*,
             COUNT(t.id) as total_tasks,
             SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as completed_tasks
      FROM projects p
      LEFT JOIN tasks t ON t.project_id = p.id
      WHERE p.user_id = $1 OR EXISTS (
        SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $1
      )
      GROUP BY p.id
      ORDER BY p.updated_at DESC
    `, [userId]);
    return res.rows.map(withProgress);
  },

  async findById(id: number, userId: number): Promise<IProjectWithProgress | undefined> {
    const res = await db.query(`
      SELECT p.*,
             COUNT(t.id) as total_tasks,
             SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as completed_tasks
      FROM projects p
      LEFT JOIN tasks t ON t.project_id = p.id
      WHERE p.id = $1 AND (p.user_id = $2 OR EXISTS (
        SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $2
      ))
      GROUP BY p.id
    `, [id, userId]);
    const row = res.rows[0];
    return row ? withProgress(row) : undefined;
  },

  async canAccess(id: number, userId: number): Promise<boolean> {
    const res = await db.query(`SELECT 1 FROM projects p
      WHERE p.id = $1 AND (p.user_id = $2 OR EXISTS (
        SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $2
      ))`, [id, userId]);
    return (res.rowCount || 0) > 0;
  },

  async isOwner(id: number, userId: number): Promise<boolean> {
    const res = await db.query('SELECT 1 FROM projects WHERE id = $1 AND user_id = $2', [id, userId]);
    return (res.rowCount || 0) > 0;
  },

  async isMember(id: number, userId: number): Promise<boolean> {
    const res = await db.query('SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2', [id, userId]);
    return (res.rowCount || 0) > 0;
  },

  async getMembers(projectId: number): Promise<IProjectMember[]> {
    const res = await db.query(`
      SELECT u.id, u.name, u.email, 'owner'::text AS role, p.created_at AS joined_at
      FROM projects p JOIN users u ON u.id = p.user_id WHERE p.id = $1
      UNION ALL
      SELECT u.id, u.name, u.email, 'member'::text AS role, pm.joined_at
      FROM project_members pm JOIN users u ON u.id = pm.user_id WHERE pm.project_id = $1
      ORDER BY role, name
    `, [projectId]);
    return res.rows as IProjectMember[];
  },

  async addMember(projectId: number, userId: number): Promise<void> {
    await db.query('INSERT INTO project_members (project_id, user_id) VALUES ($1, $2)', [projectId, userId]);
  },

  async removeMember(projectId: number, userId: number): Promise<boolean> {
    await db.query('UPDATE tasks SET assigned_to_user_id = NULL, updated_at = NOW() WHERE project_id = $1 AND assigned_to_user_id = $2', [projectId, userId]);
    const res = await db.query('DELETE FROM project_members WHERE project_id = $1 AND user_id = $2', [projectId, userId]);
    return (res.rowCount || 0) > 0;
  },

  async logActivity(projectId: number, actorId: number, eventType: string, details: Record<string, unknown> = {}): Promise<void> {
    await db.query('INSERT INTO project_activity (project_id, actor_id, event_type, details) VALUES ($1, $2, $3, $4)',
      [projectId, actorId, eventType, JSON.stringify(details)]);
  },

  async getActivity(projectId: number): Promise<IProjectActivity[]> {
    const res = await db.query(`
      SELECT a.id, COALESCE(u.name, 'Deleted user') AS actor_name, a.event_type, a.details, a.created_at
      FROM project_activity a LEFT JOIN users u ON u.id = a.actor_id
      WHERE a.project_id = $1 ORDER BY a.created_at DESC LIMIT 100
    `, [projectId]);
    return res.rows as IProjectActivity[];
  },

  async create(name: string, description: string, userId: number): Promise<IProjectWithProgress> {
    const insert = await db.query(
      'INSERT INTO projects (name, description, user_id) VALUES ($1, $2, $3) RETURNING id',
      [name, description, userId],
    );
    const id = insert.rows[0].id as number;
    return ProjectModel.findById(id, userId) as Promise<IProjectWithProgress>;
  },

  async update(id: number, name: string, description: string, userId: number): Promise<IProjectWithProgress | undefined> {
    const res = await db.query(`
      UPDATE projects SET name = $1, description = $2, updated_at = NOW()
      WHERE id = $3 AND user_id = $4
    `, [name, description, id, userId]);
    return (res.rowCount || 0) > 0 ? ProjectModel.findById(id, userId) : undefined;
  },

  async delete(id: number, userId: number): Promise<boolean> {
    const res = await db.query('DELETE FROM projects WHERE id = $1 AND user_id = $2', [id, userId]);
    return (res.rowCount || 0) > 0;
  },
};
