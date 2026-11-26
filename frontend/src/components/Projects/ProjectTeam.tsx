import React, { useState } from 'react';
import { ProjectMember } from '../../types';
import { projectAPI } from '../../api/api';

interface Props {
  projectId: number;
  ownerId: number;
  currentUserId: number;
  members: ProjectMember[];
  onMembersChange: (members: ProjectMember[]) => void;
}

const ProjectTeam: React.FC<Props> = ({ projectId, ownerId, currentUserId, members, onMembersChange }) => {
  const [showDialog, setShowDialog] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isOwner = currentUserId === ownerId;

  const addMember = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await projectAPI.addMember(projectId, email);
      onMembersChange(res.data);
      setEmail('');
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
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not remove this member.');
    }
  };

  return (
    <>
      <section className="project-team-bar" aria-label="Project team">
        <div className="project-team-summary">
          <strong>Team</strong>
          <span className="team-count">{members.length}</span>
          <div className="team-avatars" aria-label={`${members.length} project members`}>
            {members.slice(0, 5).map((member) => (
              <span className="member-avatar" title={`${member.name} · ${member.role}`} key={member.id}>
                {member.name.slice(0, 1).toUpperCase()}
              </span>
            ))}
            {members.length > 5 && <span className="team-overflow">+{members.length - 5}</span>}
          </div>
        </div>
        {isOwner && <button className="btn btn-ghost add-member-trigger" onClick={() => { setError(''); setShowDialog(true); }}>+ Add member</button>}
      </section>

      {showDialog && (
        <div className="team-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowDialog(false); }}>
          <section className="team-dialog" role="dialog" aria-modal="true" aria-labelledby="team-dialog-title">
            <header className="team-dialog-header">
              <div><h2 id="team-dialog-title">Project team</h2><p>Manage the people working on this project.</p></div>
              <button className="btn-icon" onClick={() => setShowDialog(false)} aria-label="Close">×</button>
            </header>

            {error && <div className="error-message team-error">{error}</div>}

            <ul className="team-member-list">
              {members.map((member) => (
                <li key={member.id} className="team-member">
                  <span className="member-avatar">{member.name.slice(0, 1).toUpperCase()}</span>
                  <span className="member-details"><strong>{member.name}</strong><small>{member.email}</small></span>
                  <span className="member-role">{member.role === 'owner' ? 'Owner' : 'Member'}</span>
                  {member.role === 'member' && <button className="btn-icon btn-danger-icon" title={`Remove ${member.name}`} onClick={() => removeMember(member)}>×</button>}
                </li>
              ))}
            </ul>

            <form className="invite-form" onSubmit={addMember}>
              <label htmlFor={`invite-member-email-${projectId}`}>Add a Planify user by email</label>
              <div className="invite-controls">
                <input id={`invite-member-email-${projectId}`} type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="member@example.com" required />
                <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add member'}</button>
              </div>
              <small>They need to have a Planify account first.</small>
            </form>
          </section>
        </div>
      )}
    </>
  );
};

export default ProjectTeam;
