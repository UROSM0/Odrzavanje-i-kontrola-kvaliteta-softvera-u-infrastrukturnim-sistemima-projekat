import React, { useCallback, useEffect, useState } from 'react';
import { ProjectActivity, ProjectMember } from '../../types';
import { projectAPI } from '../../api/api';

interface Props {
  projectId: number;
  ownerId: number;
  currentUserId: number;
  members: ProjectMember[];
  onMembersChange: (members: ProjectMember[]) => void;
  activityVersion: number;
}

const activityDescription = (event: ProjectActivity): string => {
  const details = event.details || {};
  switch (event.event_type) {
    case 'member_added': return `added ${String(details.member_name || 'a member')} to the project`;
    case 'member_removed': return `removed ${String(details.member_name || 'a member')} from the project`;
    case 'project_created': return `created project “${String(details.project_name || 'Untitled')}”`;
    case 'task_created': return `created task “${String(details.task_title || 'Untitled')}”`;
    case 'task_deleted': return `deleted task “${String(details.task_title || 'Untitled')}”`;
    case 'task_updated': {
      const changes: string[] = [];
      if (details.status) {
        const status = details.status as { from: string; to: string };
        changes.push(`changed status from ${status.from.replace('_', ' ')} to ${status.to.replace('_', ' ')}`);
      }
      if (Object.prototype.hasOwnProperty.call(details, 'assigned_to_user_id')) {
        changes.push(`assigned “${String(details.task_title || 'a task')}” to ${String(details.assigned_to_name || 'no one')}`);
      }
      if (details.title) changes.push(`renamed a task to “${String(details.task_title || 'Untitled')}”`);
      if (details.priority) {
        const priority = details.priority as { from: string; to: string };
        changes.push(`changed priority from ${priority.from} to ${priority.to}`);
      }
      if (details.due_date) changes.push(`changed the due date for “${String(details.task_title || 'a task')}”`);
      if (details.description_changed) changes.push(`updated the description for “${String(details.task_title || 'a task')}”`);
      return changes.length ? changes.join(' and ') : `updated task “${String(details.task_title || 'Untitled')}”`;
    }
    default: return 'updated the project';
  }
};

const ProjectTeam: React.FC<Props> = ({ projectId, ownerId, currentUserId, members, onMembersChange, activityVersion }) => {
  const [email, setEmail] = useState('');
  const [activity, setActivity] = useState<ProjectActivity[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isOwner = currentUserId === ownerId;

  const refreshActivity = useCallback(() => {
    projectAPI.getActivity(projectId).then((res) => setActivity(res.data)).catch(() => {});
  }, [projectId]);

  useEffect(() => {
    refreshActivity();
  }, [refreshActivity, activityVersion]);

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await projectAPI.addMember(projectId, email);
      onMembersChange(res.data);
      setEmail('');
      refreshActivity();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not add this member.');
    } finally {
      setBusy(false);
    }
  };

  const removeMember = async (member: ProjectMember) => {
    if (!window.confirm(`Remove ${member.name} from this project?`)) return;
    setError('');
    try {
      const res = await projectAPI.removeMember(projectId, member.id);
      onMembersChange(res.data);
      refreshActivity();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not remove this member.');
    }
  };

  return (
    <section className="collaboration-grid">
      <div className="collaboration-card">
        <div className="collaboration-heading">
          <div>
            <h3>Project team</h3>
            <p>People working on this project</p>
          </div>
          <span className="team-count">{members.length} {members.length === 1 ? 'member' : 'members'}</span>
        </div>
        {error && <div className="error-message team-error">{error}</div>}
        <ul className="team-member-list">
          {members.map((member) => (
            <li key={member.id} className="team-member">
              <span className="member-avatar">{member.name.slice(0, 1).toUpperCase()}</span>
              <span className="member-details"><strong>{member.name}</strong><small>{member.email}</small></span>
              <span className="member-role">{member.role === 'owner' ? 'Owner' : 'Member'}</span>
              {isOwner && member.role === 'member' && (
                <button className="btn-icon btn-danger-icon" title={`Remove ${member.name}`} onClick={() => removeMember(member)}>×</button>
              )}
            </li>
          ))}
        </ul>
        {isOwner && (
          <form className="invite-form" onSubmit={addMember}>
            <label htmlFor="invite-member-email">Add a Planify user by email</label>
            <div className="invite-controls">
              <input id="invite-member-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="member@example.com" required />
              <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add member'}</button>
            </div>
            <small>They need to have a Planify account first.</small>
          </form>
        )}
      </div>

      <div className="collaboration-card activity-card">
        <div className="collaboration-heading">
          <div><h3>Recent activity</h3><p>Changes made in this project</p></div>
        </div>
        {activity.length === 0 ? <p className="empty-activity">Activity will appear here as the team works.</p> : (
          <ul className="activity-list">
            {activity.map((event) => (
              <li key={event.id}>
                <span className="activity-dot" />
                <div><p><strong>{event.actor_name}</strong> {activityDescription(event)}</p>
                  <time>{new Date(event.created_at).toLocaleString()}</time></div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default ProjectTeam;
