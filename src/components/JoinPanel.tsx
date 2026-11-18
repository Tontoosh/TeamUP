import { Link, useLocation } from 'react-router-dom';
import { ArrowUpRight, MessageSquare } from 'lucide-react';
import { useApp } from '../context';
import type { Project } from '../types';
import { Avatar } from './ui';

export function JoinPanel({
  project,
  inTeam,
  pending,
  onApply,
}: {
  project: Project;
  inTeam: boolean;
  pending: boolean;
  onApply: () => void;
}) {
  const { user } = useApp();
  const location = useLocation();
  const id = project.id;
  return (
    <aside className="panel join-panel">
      <span className="eyebrow">ДАРААГИЙН АЛХАМ</span>
      <h2>{inTeam ? 'Та энэ багийн нэг хэсэг.' : 'Энэ багт таны орон зай бий.'}</h2>
      <progress value={project.member_count} max={project.capacity} />
      <div className="space-between">
        <span className="muted">Багийн бүрэлдэхүүн</span>
        <b>
          {project.member_count} / {project.capacity}
        </b>
      </div>
      <hr />
      <h3>{project.status === 'open' ? 'Нээлттэй үүргүүд' : 'Төслийн үүргүүд'}</h3>
      {project.roles.map(role => (
        <div className="role-item" key={role}>
          <span className="live-dot" />
          {role}
          <ArrowUpRight size={16} />
        </div>
      ))}
      {!project.roles.length && <p className="muted">Баг бүрдсэн байна.</p>}
      {inTeam ? (
        <Link className="btn primary full" to={`/chat?project=${id}`}>
          <MessageSquare size={18} />
          Багийн чат руу
        </Link>
      ) : user ? (
        <button
          className="btn primary full"
          disabled={
            pending ||
            project.status !== 'open' ||
            project.member_count >= project.capacity ||
            !project.roles.length
          }
          onClick={onApply}
        >
          {pending
            ? 'Хүсэлт илгээгдсэн'
            : project.status !== 'open'
            ? 'Элсэлт хаагдсан'
            : 'Нэгдэх хүсэлт'}
          <ArrowUpRight size={18} />
        </button>
      ) : (
        <Link
          className="btn primary full"
          to={`/login?next=${encodeURIComponent(location.pathname)}`}
        >
          Нэвтэрч хүсэлт илгээх
          <ArrowUpRight size={17} />
        </Link>
      )}
      <small className="helper">Хүсэлтийг төслийн эзэмшигч шалгаж шийдвэрлэнэ.</small>
      <hr />
      <Link className="person" to={`/people/${project.owner_id}`}>
        <Avatar name={project.owner.name} />
        <span>
          <b>{project.owner.name}</b>
          <small>Төсөл санаачлагч</small>
        </span>
      </Link>
    </aside>
  );
}
