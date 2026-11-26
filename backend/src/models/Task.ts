import db from '../config/database';

export interface ITask {
  id: number;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in_progress' | 'done';
  due_date: string | null;
  project_id: number;
  user_id: number;
  assigned_to_user_id: number | null;
  recurrence_rule: 'daily' | 'weekly' | 'monthly' | null;
  recurrence_parent_id: number | null;
  assigned_to_name?: string | null;
  assigned_to_email?: string | null;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

function nextDueDate(dueDate: string | null, rule: ITask['recurrence_rule']): Date | null {
  if (!dueDate || !rule) return null;
  const next = new Date(dueDate);
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (next.getTime() < todayStart.getTime()) next.setTime(todayStart.getTime());
  if (rule === 'daily') next.setDate(next.getDate() + 1);
  if (rule === 'weekly') next.setDate(next.getDate() + 7);
  if (rule === 'monthly') {
    const day = next.getDate();
    next.setDate(1);
    next.setMonth(next.getMonth() + 1);
    const lastDayOfMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(day, lastDayOfMonth));
  }
  return next;
}

export interface TaskFilters {
  priority?: string;
  status?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

function applyFilters(base: string, params: any[], filters: TaskFilters): string {
  let query = base;

  if (filters.priority) {
    query += ' AND priority = ?';
    params.push(filters.priority);
  }
  if (filters.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }

  const allowed = ['priority', 'status', 'due_date', 'created_at', 'title'];
  const col = allowed.includes(filters.sort_by || '') ? filters.sort_by! : 'created_at';
  const dir = filters.sort_order === 'asc' ? 'ASC' : 'DESC';

  if (col === 'priority') {
    query += ` ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END ${dir}`;
  } else {
    query += ` ORDER BY ${col} ${dir}`;
  }

  return query;
}

export const TaskModel = {
  async findByProject(projectId: number, userId: number, filters: TaskFilters = {}): Promise<ITask[]> {
    const params: any[] = [projectId];
    const base = `SELECT t.*, assignee.name AS assigned_to_name, assignee.email AS assigned_to_email,
      creator.name AS created_by_name FROM tasks t
      LEFT JOIN users assignee ON assignee.id = t.assigned_to_user_id
      LEFT JOIN users creator ON creator.id = t.user_id WHERE t.project_id = $1`;
    const { query, values } = (() => {
      // reuse applyFilters logic but adapt placeholders
      let q = base;
      const vals = [...params];

      if (filters.priority) {
        q += ` AND t.priority = $${vals.length + 1}`;
        vals.push(filters.priority);
      }
      if (filters.status) {
        q += ` AND t.status = $${vals.length + 1}`;
        vals.push(filters.status);
      }

      const allowed = ['priority', 'status', 'due_date', 'created_at', 'title'];
      const col = allowed.includes(filters.sort_by || '') ? filters.sort_by! : 'created_at';
      const dir = filters.sort_order === 'asc' ? 'ASC' : 'DESC';

      if (col === 'priority') {
        q += ` ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END ${dir}`;
      } else {
        q += ` ORDER BY t.${col} ${dir}`;
      }

      return { query: q, values: vals };
    })();

    const res = await db.query(query, values);
    return res.rows as ITask[];
  },

  async findAllByUser(userId: number, filters: TaskFilters = {}): Promise<ITask[]> {
    const params: any[] = [userId];
    const base = `SELECT t.*, assignee.name AS assigned_to_name, assignee.email AS assigned_to_email,
      creator.name AS created_by_name FROM tasks t
      LEFT JOIN users assignee ON assignee.id = t.assigned_to_user_id
      LEFT JOIN users creator ON creator.id = t.user_id
      WHERE EXISTS (SELECT 1 FROM projects p WHERE p.id = t.project_id AND (p.user_id = $1 OR EXISTS (
        SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $1)))`;
    const { query, values } = (() => {
      let q = base;
      const vals = [...params];

      if (filters.priority) {
        q += ` AND t.priority = $${vals.length + 1}`;
        vals.push(filters.priority);
      }
      if (filters.status) {
        q += ` AND t.status = $${vals.length + 1}`;
        vals.push(filters.status);
      }

      const allowed = ['priority', 'status', 'due_date', 'created_at', 'title'];
      const col = allowed.includes(filters.sort_by || '') ? filters.sort_by! : 'created_at';
      const dir = filters.sort_order === 'asc' ? 'ASC' : 'DESC';

      if (col === 'priority') {
        q += ` ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END ${dir}`;
      } else {
        q += ` ORDER BY t.${col} ${dir}`;
      }

      return { query: q, values: vals };
    })();

    const res = await db.query(query, values);
    return res.rows as ITask[];
  },

  async findById(id: number, userId: number): Promise<ITask | undefined> {
    const res = await db.query(`SELECT t.*, assignee.name AS assigned_to_name, assignee.email AS assigned_to_email,
      creator.name AS created_by_name FROM tasks t
      LEFT JOIN users assignee ON assignee.id = t.assigned_to_user_id
      LEFT JOIN users creator ON creator.id = t.user_id
      WHERE t.id = $1 AND EXISTS (SELECT 1 FROM projects p WHERE p.id = t.project_id AND (p.user_id = $2 OR EXISTS (
        SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $2)))`, [id, userId]);
    return res.rows[0] as ITask | undefined;
  },

  async create(task: Omit<ITask, 'id' | 'created_at' | 'updated_at'>): Promise<ITask> {
    const res = await db.query(
      `INSERT INTO tasks (title, description, priority, status, due_date, project_id, user_id,
                          assigned_to_user_id, recurrence_rule, recurrence_parent_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [task.title, task.description, task.priority, task.status, task.due_date, task.project_id, task.user_id,
        task.assigned_to_user_id || null, task.recurrence_rule || null, task.recurrence_parent_id || null],
    );
    const id = res.rows[0].id as number;
    return TaskModel.findById(id, task.user_id) as Promise<ITask>;
  },

  async update(id: number, userId: number, updates: Partial<ITask>): Promise<ITask | undefined> {
    const existing = await TaskModel.findById(id, userId);
    if (!existing) return undefined;

    const merged = { ...existing, ...updates } as ITask;
    await db.query(`
      UPDATE tasks
      SET title = $1, description = $2, priority = $3, status = $4,
          reminder_sent_for = CASE WHEN due_date IS DISTINCT FROM $5 THEN NULL ELSE reminder_sent_for END,
          due_date = $5, assigned_to_user_id = $6, recurrence_rule = $7, updated_at = NOW()
      WHERE id = $8 AND EXISTS (SELECT 1 FROM projects p WHERE p.id = tasks.project_id AND (p.user_id = $9 OR EXISTS (
        SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $9)))
    `, [merged.title, merged.description, merged.priority, merged.status, merged.due_date,
      merged.assigned_to_user_id || null, merged.recurrence_rule || null, id, userId]);

    return TaskModel.findById(id, userId);
  },

  async createNextOccurrence(source: ITask, actorId: number): Promise<ITask | undefined> {
    if (!source.recurrence_rule) return undefined;
    const dueDate = nextDueDate(source.due_date, source.recurrence_rule);
    try {
      const res = await db.query(`
        INSERT INTO tasks (title, description, priority, status, due_date, project_id, user_id,
                           assigned_to_user_id, recurrence_rule, recurrence_parent_id)
        VALUES ($1, $2, $3, 'todo', $4, $5, $6, $7, $8, $9)
        RETURNING id
      `, [source.title, source.description, source.priority, dueDate, source.project_id, source.user_id,
        source.assigned_to_user_id, source.recurrence_rule, source.id]);
      return TaskModel.findById(res.rows[0].id, actorId);
    } catch (err) {
      if ((err as { code?: string }).code !== '23505') throw err;
      const existing = await db.query('SELECT id FROM tasks WHERE recurrence_parent_id = $1', [source.id]);
      return existing.rows[0] ? TaskModel.findById(existing.rows[0].id, actorId) : undefined;
    }
  },

  async delete(id: number, userId: number): Promise<boolean> {
    if (!(await TaskModel.findById(id, userId))) return false;
    const res = await db.query(`DELETE FROM tasks WHERE id = $1 AND EXISTS (
      SELECT 1 FROM projects p WHERE p.id = tasks.project_id AND (p.user_id = $2 OR EXISTS (
        SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $2)))`, [id, userId]);
    return (res.rowCount || 0) > 0;
  },

  async getStats(userId: number) {
    const res = await db.query(`
      SELECT
        COUNT(*)::int                                                    as total,
        COALESCE(SUM(CASE WHEN status = 'todo'        THEN 1 ELSE 0 END), 0)::int   as todo,
        COALESCE(SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END), 0)::int   as in_progress,
        COALESCE(SUM(CASE WHEN status = 'done'        THEN 1 ELSE 0 END), 0)::int   as done
      FROM tasks t WHERE EXISTS (SELECT 1 FROM projects p WHERE p.id = t.project_id AND (p.user_id = $1 OR EXISTS (
        SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $1)))
    `, [userId]);
    return res.rows[0] as { total: number; todo: number; in_progress: number; done: number };
  },
};
