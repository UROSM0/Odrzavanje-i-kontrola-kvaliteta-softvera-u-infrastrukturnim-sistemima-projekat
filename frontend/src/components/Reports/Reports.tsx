import React, { useEffect, useMemo, useState } from 'react';
import { Project } from '../../types';
import { api } from '../../api/api';

interface CompletedTaskDay { date: string; count: number }
interface MemberWorkload {
  member_id: number | null;
  member_name: string;
  todo: number;
  in_progress: number;
  total: number;
}
interface ReportData {
  completedByDay: CompletedTaskDay[];
  memberWorkload: MemberWorkload[];
  projects: Project[];
}

const Reports: React.FC = () => {
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<ReportData>('/reports')
      .then((response) => setData(response.data))
      .catch(() => setError('Izveštaji trenutno nisu mogli da se učitaju. Osvežite stranicu i pokušajte ponovo.'));
  }, []);

  const completionDays = useMemo(() => {
    const countByDate = new Map((data?.completedByDay || []).map((day) => [day.date.slice(0, 10), day.count]));
    return Array.from({ length: 14 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - 13 + index);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      return { key, label: date.toLocaleDateString('sr-Latn', { day: 'numeric', month: 'short' }), count: countByDate.get(key) || 0 };
    });
  }, [data]);

  const completedTotal = data?.projects.reduce((sum, project) => sum + project.completed_tasks, 0) || 0;
  const taskTotal = data?.projects.reduce((sum, project) => sum + project.total_tasks, 0) || 0;
  const openTotal = data?.memberWorkload.reduce((sum, member) => sum + member.total, 0) || 0;
  const peakCompletion = Math.max(1, ...completionDays.map((day) => day.count));
  const peakWorkload = Math.max(1, ...(data?.memberWorkload || []).map((member) => member.total));

  if (!data && !error) return <div className="page"><p className="empty-state">Učitavam izveštaje…</p></div>;
  if (error) return <div className="page"><h2>Izveštaji</h2><p className="reports-error">{error}</p></div>;

  return (
    <div className="page reports-page">
      <div className="reports-heading">
        <div><h2>Izveštaji</h2><p>Pregled završenih zadataka, opterećenja tima i napretka projekata.</p></div>
      </div>

      <div className="reports-summary">
        <div className="report-summary-card"><span className="report-summary-icon">✓</span><div><strong>{completedTotal}</strong><span>Završeni zadaci</span></div></div>
        <div className="report-summary-card"><span className="report-summary-icon report-icon-open">◷</span><div><strong>{openTotal}</strong><span>Otvoreni zadaci</span></div></div>
        <div className="report-summary-card"><span className="report-summary-icon report-icon-project">▣</span><div><strong>{data?.projects.length || 0}</strong><span>Projekti · {taskTotal} zadataka ukupno</span></div></div>
      </div>

      <section className="report-panel">
        <div className="report-panel-heading"><div><h3>Završeni zadaci</h3><p>Broj zadataka označenih kao završenih u poslednjih 14 dana</p></div><span className="report-period">Poslednjih 14 dana</span></div>
        <div className="completion-chart" role="img" aria-label="Grafikon završenih zadataka za poslednjih 14 dana">
          {completionDays.map((day) => <div className="completion-day" key={day.key} title={`${day.label}: ${day.count}`}>
            <span className="completion-count">{day.count || ''}</span>
            <div className="completion-bar-track"><div className="completion-bar" style={{ height: `${Math.max(day.count ? 8 : 0, day.count / peakCompletion * 100)}%` }} /></div>
            <span className="completion-label">{day.label}</span>
          </div>)}
        </div>
        <p className="report-note">Grafikon prikazuje promene statusa zabeležene u istoriji aktivnosti.</p>
      </section>

      <div className="reports-two-column">
        <section className="report-panel">
          <div className="report-panel-heading"><div><h3>Opterećenje članova</h3><p>Otvoreni zadaci po članu tima</p></div></div>
          {data?.memberWorkload.length ? <div className="workload-list">
            {data.memberWorkload.map((member) => <div className="workload-row" key={member.member_id ?? 'unassigned'}>
              <div className="workload-label"><span>{member.member_name}</span><strong>{member.total}</strong></div>
              <div className="workload-track" aria-label={`${member.member_name}: ${member.todo} za rad, ${member.in_progress} u toku`}>
                <div className="workload-todo" style={{ width: `${member.todo / peakWorkload * 100}%` }} />
                <div className="workload-progress" style={{ width: `${member.in_progress / peakWorkload * 100}%` }} />
              </div>
              <div className="workload-legend"><span><i className="legend-todo" />Za rad: {member.todo}</span><span><i className="legend-progress" />U toku: {member.in_progress}</span></div>
            </div>)}
          </div> : <p className="report-empty">Nema otvorenih zadataka za prikaz.</p>}
        </section>

        <section className="report-panel">
          <div className="report-panel-heading"><div><h3>Napredak projekata</h3><p>Završeni zadaci u svakom projektu</p></div></div>
          {data?.projects.length ? <div className="project-progress-list">
            {data.projects.map((project) => <div className="project-progress-item" key={project.id}>
              <div className="project-progress-label"><strong>{project.name}</strong><span>{project.completed_tasks}/{project.total_tasks} · {project.progress}%</span></div>
              <div className="progress-bar"><div className="progress-fill" style={{ width: `${project.progress}%` }} /></div>
            </div>)}
          </div> : <p className="report-empty">Još nema projekata za prikaz.</p>}
        </section>
      </div>
    </div>
  );
};

export default Reports;
