import { ArrowUpRight, Clock3, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Project } from '../types';
import { Avatar, Badge, Tags } from './ui';

export function ProjectCard({ project }: { project: Project }) {
  const free = Math.max(0, project.capacity - project.member_count);
  return (
    <article className="project-card">
      <div className="card-top">
        <span className={`category category-${project.category.toLowerCase()}`}>
          {project.category}
        </span>
        <Badge status={project.status} />
      </div>
      <Link to={`/projects/${project.id}`} className="project-name">
        <h3>{project.name}</h3>
        <ArrowUpRight size={19} />
      </Link>
      <p className="card-description">{project.description}</p>
      <Tags items={project.skills} />
      {project.reasons && (
        <p className="match-reason">✧ Тохирох зүйлс: {project.reasons.join(', ')}</p>
      )}
      <div className="team-progress">
        <div>
          <span>
            <Users size={15} /> Багийн бүрэлдэхүүн
          </span>
          <strong>
            {project.member_count}
            <span> / {project.capacity}</span>
          </strong>
        </div>
        <progress value={project.member_count} max={project.capacity} />
        <div className="open-roles">
          <p>{project.roles.join(', ') || 'Баг бүрдсэн'}</p>
          <b>{free} сул суудал</b>
        </div>
      </div>
      <div className="card-footer">
        <Link className="person" to={`/people/${project.owner_id}`}>
          <Avatar name={project.owner.name} />
          <span>
            <b>{project.owner.name}</b>
            <small>
              {project.owner.school} · {project.project_type}
            </small>
          </span>
        </Link>
        <span className="duration">
          <Clock3 size={13} /> {project.duration} долоо хоног
        </span>
      </div>
    </article>
  );
}
