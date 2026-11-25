import db from '../config/database';
import { transporter } from './mailer';

let isSending = false;

async function sendDueReminders(): Promise<void> {
  if (isSending || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;
  isSending = true;

  try {
    const dueTasks = await db.query(`
      SELECT t.id, t.title, t.due_date, recipient.name AS recipient_name, recipient.email,
             p.name AS project_name
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      JOIN users recipient ON recipient.id = COALESCE(t.assigned_to_user_id, t.user_id)
      WHERE t.status <> 'done'
        AND t.due_date::date BETWEEN CURRENT_DATE AND CURRENT_DATE + 1
        AND t.reminder_sent_for IS DISTINCT FROM t.due_date
      ORDER BY t.due_date ASC
    `);

    for (const task of dueTasks.rows) {
      try {
        await transporter.sendMail({
          from: `"Planify" <${process.env.EMAIL_USER}>`,
          to: task.email,
          subject: `Reminder: ${task.title} is due soon`,
          text: `Hi ${task.recipient_name},\n\nThe task "${task.title}" in project "${task.project_name}" is due on ${new Date(task.due_date).toLocaleString()}.\n\nOpen Planify to review the task.`,
        });
        await db.query('UPDATE tasks SET reminder_sent_for = due_date WHERE id = $1 AND due_date = $2', [task.id, task.due_date]);
        console.log(`Due-date reminder sent for task ${task.id} to ${task.email}`);
      } catch (err) {
        console.error(`Failed to send due-date reminder for task ${task.id}:`, err);
      }
    }
  } catch (err) {
    console.error('Due-date reminder check failed:', err);
  } finally {
    isSending = false;
  }
}

export function startDueReminderWorker(): void {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('Due-date email reminders are disabled; set EMAIL_USER and EMAIL_PASS to enable them.');
    return;
  }

  // Give the database schema initializer time to finish before the first query.
  setTimeout(() => { void sendDueReminders(); }, 15_000);
  setInterval(() => { void sendDueReminders(); }, 5 * 60 * 1000);
}
