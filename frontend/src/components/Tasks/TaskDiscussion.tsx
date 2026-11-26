import React, { useCallback, useEffect, useState } from 'react';
import { Task, TaskComment, TaskHistoryEntry } from '../../types';
import { taskAPI } from '../../api/api';
import { useAuth } from '../../context/AuthContext';

interface Props {
  task: Task;
  onClose: () => void;
}

const displayDate = (value: unknown): string => {
  if (!value) return 'No date';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
};

const historyDescription = (entry: TaskHistoryEntry): string => {
  const details = entry.details || {};
  switch (entry.event_type) {
    case 'task_created': return 'created the task';
    case 'task_repeated': {
      const due = entry.details?.next_due_date;
      return `completed the recurring task and created its next occurrence${due ? ` due ${displayDate(due)}` : ''}`;
    }
    case 'task_deleted': return 'deleted the task';
    case 'task_comment_added': return 'added a comment';
    case 'task_comment_edited': return 'edited a comment';
    case 'task_comment_deleted': return 'deleted a comment';
    case 'task_updated': {
      const changes: string[] = [];
      if (details.status) {
        const status = details.status as { from: string; to: string };
        changes.push(`changed status from ${status.from.replace(/_/g, ' ')} to ${status.to.replace(/_/g, ' ')}`);
      }
      if (details.priority) {
        const priority = details.priority as { from: string; to: string };
        changes.push(`changed priority from ${priority.from} to ${priority.to}`);
      }
      if (details.due_date) {
        const due = details.due_date as { from: unknown; to: unknown };
        changes.push(`changed due date from ${displayDate(due.from)} to ${displayDate(due.to)}`);
      }
      if (details.assigned_to_user_id !== undefined) {
        changes.push(`assigned the task to ${String(details.assigned_to_name || 'no one')}`);
      }
      if (details.title) {
        const title = details.title as { from: string; to: string };
        changes.push(`renamed the task from “${title.from}” to “${title.to}”`);
      }
      if (details.description_changed) changes.push('updated the description');
      if (details.recurrence_rule) {
        const recurrence = details.recurrence_rule as { from: string | null; to: string | null };
        changes.push(`changed repeat setting from ${recurrence.from || 'off'} to ${recurrence.to || 'off'}`);
      }
      return changes.length ? changes.join('; ') : 'updated the task';
    }
    default: return 'updated the task';
  }
};

const TaskDiscussion: React.FC<Props> = ({ task, onClose }) => {
  const { user } = useAuth();
  const [tab, setTab] = useState<'comments' | 'history'>('comments');
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [history, setHistory] = useState<TaskHistoryEntry[]>([]);
  const [content, setContent] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadDiscussion = useCallback(async () => {
    try {
      const [commentsRes, historyRes] = await Promise.all([
        taskAPI.getComments(task.id),
        taskAPI.getHistory(task.id),
      ]);
      setComments(commentsRes.data);
      setHistory(historyRes.data);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not load comments and history.');
    }
  }, [task.id]);

  useEffect(() => { void loadDiscussion(); }, [loadDiscussion]);

  const addComment = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await taskAPI.addComment(task.id, content);
      setContent('');
      await loadDiscussion();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not post this comment.');
    } finally {
      setBusy(false);
    }
  };

  const saveComment = async (commentId: number) => {
    setBusy(true);
    setError('');
    try {
      await taskAPI.updateComment(task.id, commentId, editingContent);
      setEditingCommentId(null);
      setEditingContent('');
      await loadDiscussion();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not update this comment.');
    } finally {
      setBusy(false);
    }
  };

  const deleteComment = async (commentId: number) => {
    if (!window.confirm('Delete this comment?')) return;
    setBusy(true);
    setError('');
    try {
      await taskAPI.deleteComment(task.id, commentId);
      await loadDiscussion();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not delete this comment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="discussion-backdrop">
      <section className="discussion-dialog" role="dialog" aria-modal="true" aria-labelledby="discussion-title">
        <header className="discussion-header">
          <div><span className="discussion-kicker">Task discussion</span><h2 id="discussion-title">{task.title}</h2></div>
          <button className="btn-icon" onClick={onClose} aria-label="Close discussion">×</button>
        </header>

        <div className="discussion-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'comments'} className={tab === 'comments' ? 'active' : ''} onClick={() => setTab('comments')}>Comments ({comments.length})</button>
          <button role="tab" aria-selected={tab === 'history'} className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>Recent activity ({history.length})</button>
        </div>

        {error && <div className="error-message discussion-error">{error}</div>}

        {tab === 'comments' ? (
          <>
            <div className="discussion-scroll comments-list">
              {comments.length === 0 ? <p className="discussion-empty">No comments yet. Start the discussion.</p> : comments.map((comment) => (
                <article className="comment-item" key={comment.id}>
                  <div className="comment-avatar">{comment.author_name.slice(0, 1).toUpperCase()}</div>
                  <div className="comment-main">
                    <div className="comment-meta"><strong>{comment.author_name}</strong><time>{new Date(comment.created_at).toLocaleString()}{comment.created_at !== comment.updated_at ? ' · edited' : ''}</time></div>
                    {editingCommentId === comment.id ? (
                      <>
                        <textarea value={editingContent} onChange={(event) => setEditingContent(event.target.value)} maxLength={5000} rows={4} autoFocus />
                        <div className="comment-actions"><button className="btn btn-primary" disabled={busy || !editingContent.trim()} onClick={() => saveComment(comment.id)}>Save</button><button className="btn btn-ghost" onClick={() => setEditingCommentId(null)}>Cancel</button></div>
                      </>
                    ) : (
                      <>
                        <p className="comment-content">{comment.content}</p>
                        {comment.user_id === user?.id && <div className="comment-actions"><button className="text-action" onClick={() => { setEditingCommentId(comment.id); setEditingContent(comment.content); }}>Edit</button><button className="text-action danger-action" disabled={busy} onClick={() => deleteComment(comment.id)}>Delete</button></div>}
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
            <form className="comment-composer" onSubmit={addComment}>
              <label htmlFor="new-task-comment">Add a comment</label>
              <textarea id="new-task-comment" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Write a comment for your team…" maxLength={5000} rows={3} required />
              <div className="composer-footer"><small>{content.length}/5000</small><button className="btn btn-primary" type="submit" disabled={busy || !content.trim()}>{busy ? 'Posting…' : 'Post comment'}</button></div>
            </form>
          </>
        ) : (
          <div className="discussion-scroll history-list">
            {history.length === 0 ? <p className="discussion-empty">No changes have been recorded for this task yet.</p> : history.map((entry) => (
              <article className="history-item" key={entry.id}>
                <span className="history-marker" />
                <div><p><strong>{entry.actor_name}</strong> {historyDescription(entry)}</p><time>{new Date(entry.created_at).toLocaleString()}</time></div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default TaskDiscussion;
