import db from '../config/database';

export interface CompletedTaskDay {
  date: string;
  count: number;
}

export interface MemberWorkload {
  member_id: number | null;
  member_name: string;
  todo: number;
  in_progress: number;
  total: number;
}

export const ReportModel = {
  async getCompletedByDay(userId: number): Promise<CompletedTaskDay[]> {
    const result = await db.query(`
      WITH days AS (
        SELECT generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, INTERVAL '1 day')::date AS day
      )
      SELECT days.day::text AS date, COUNT(a.id)::int AS count
      FROM days
      LEFT JOIN project_activity a
        ON a.created_at >= days.day
        AND a.created_at < days.day + INTERVAL '1 day'
        AND a.event_type = 'task_updated'
        AND a.details->'status'->>'to' = 'done'
        AND EXISTS (
          SELECT 1 FROM projects p
          WHERE p.id = a.project_id
            AND (p.user_id = $1 OR EXISTS (
              SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $1
            ))
        )
      GROUP BY days.day
      ORDER BY days.day
    `, [userId]);
    return result.rows.map((row) => ({ date: row.date, count: Number(row.count) }));
  },

  async getMemberWorkload(userId: number): Promise<MemberWorkload[]> {
    const result = await db.query(`
      SELECT t.assigned_to_user_id AS member_id,
             COALESCE(u.name, 'Unassigned') AS member_name,
             COUNT(*) FILTER (WHERE t.status = 'todo')::int AS todo,
             COUNT(*) FILTER (WHERE t.status = 'in_progress')::int AS in_progress,
             COUNT(*)::int AS total
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      LEFT JOIN users u ON u.id = t.assigned_to_user_id
      WHERE t.status <> 'done'
        AND (p.user_id = $1 OR EXISTS (
          SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $1
        ))
      GROUP BY t.assigned_to_user_id, u.name
      ORDER BY total DESC, member_name ASC
    `, [userId]);
    return result.rows.map((row) => ({
      member_id: row.member_id === null ? null : Number(row.member_id),
      member_name: row.member_name,
      todo: Number(row.todo),
      in_progress: Number(row.in_progress),
      total: Number(row.total),
    }));
  },
};
