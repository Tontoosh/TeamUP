import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, Search, Sparkles } from 'lucide-react';
import { useApi, useDebouncedFilters } from '../hooks';
import type { Page, Project, User } from '../types';
import { Avatar, Empty, ErrorState, Loading, PageTitle, Pagination, Tags } from '../components/ui';
import { ProjectCard } from '../components/ProjectCard';
import { MatchSummary, RatingSummary } from '../components/MatchSummary';
import { SkillLevels } from '../components/SkillLevels';

export function PersonCard({ user }: { user: User }) {
  return (
    <article className="panel person-card">
      <div className="space-between">
        <Avatar name={user.name} size="large" />
        <span className="availability">
          <span className="live-dot" />
          {user.hours ? user.hours + ' цаг / 7 хоног' : user.availability === 'available' ? 'Хамтран ажиллах боломжтой' : user.availability === 'busy' ? 'Завгүй' : 'Цагийн мэдээлэл оруулаагүй'}
        </span>
      </div>
      <h3>{user.name}</h3>
      <p className="muted">
        {[user.school, user.major].filter(Boolean).join(' · ') || 'Сургалтын мэдээлэл оруулаагүй'}
      </p>
      <p className="card-description">{user.bio || 'Танилцуулга оруулаагүй байна.'}</p>
      <SkillLevels skills={user.skills} levels={user.skillLevels} />
      <RatingSummary reputation={user.reputation} />
      <MatchSummary match={user.match} />
      {!user.match && user.reasons && (
        <p className="match-reason">✧ Төслийн шаардлагад нийцэх: {user.reasons.join(', ')}</p>
      )}
      <Link className="text-btn" to={`/people/${user.id}`}>
        Профайл үзэх <ArrowUpRight size={15} />
      </Link>
    </article>
  );
}
export function People() {
  const [params, setParams] = useSearchParams();
  const { data: ownProjects } = useApi<Project[]>('/users/owned-projects');
  const selectedProject = ownProjects?.find(project => project.id === params.get('project'));
  const query = useDebouncedFilters(params, 'q,skill,major,interest,experience,hours');
  const { data, error, loading, reload } = useApi<Page<User>>(`/users/people?${query}`);
  const update = (key: string, value: string) =>
    setParams(previous => {
      const next = new URLSearchParams(previous);
      value ? next.set(key, value) : next.delete(key);
      if (key !== 'page') next.delete('page');
      if (key === 'project') next.delete('role');
      return next;
    }, { replace: key !== 'page' });
  return (
    <>
      <PageTitle
        eyebrow="ХАМТЫН ХҮЧЭЭ ОЛООРОЙ"
        title="Хамтрагч хайх"
        description="Төсөлдөө тохирох ур чадвартай оюутнуудтай танилцаарай."
      />
      <div className="panel matching-context">
        <label>Төсөлдөө тохирох хүн олох
          <select value={params.get('project') || ''} onChange={event => update('project', event.target.value)}>
            <option value="">Бүх хамтрагчийг үзэх</option>
            {(ownProjects || []).map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </label>
        {params.get('project') && <label>Нээлттэй үүрэг
          <select value={params.get('role') || ''} onChange={event => update('role', event.target.value)}>
            <option value="">Хамгийн сайн тохирох үүргээр</option>
            {(selectedProject?.roles || []).map(role => <option key={role}>{role}</option>)}
          </select>
        </label>}
        <p className="helper">Төсөл сонговол ур чадвар 60, цаг 20, сонирхол 10, хамтын ажиллагааны үнэлгээ 10 оноогоор эрэмбэлнэ.</p>
      </div>
      <div className="panel people-filters">
        <label className="search-field">
          <Search size={18} />
          <input
            aria-label="Хамтрагчийн нэр"
            placeholder="Нэр, сургууль, мэргэжил…"
            value={params.get('q') || ''}
            onChange={event => update('q', event.target.value)}
          />
        </label>
        {[
          ['skill', 'Ур чадвар'],
          ['major', 'Мэргэжил'],
          ['interest', 'Сонирхол'],
          ['experience', 'Туршлага'],
        ].map(([key, label]) => (
          <input
            key={key}
            aria-label={label}
            placeholder={label}
            value={params.get(key) || ''}
            onChange={event => update(key, event.target.value)}
          />
        ))}
        <input
          type="number"
          min={0}
          max={80}
          aria-label="Боломжит цаг"
          placeholder="7 хоногийн цаг ≥"
          value={params.get('hours') || ''}
          onChange={event => update('hours', event.target.value)}
        />
        <button className="text-btn" onClick={() => setParams({})}>
          Шүүлтүүр цэвэрлэх
        </button>
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} retry={reload} />
      ) : !data?.items.length ? (
        <Empty title="Тохирох хамтрагч олдсонгүй" text="Шүүлтүүрээ өөрчилж дахин хайгаарай." />
      ) : (
        <div className="people-grid">
          {data.items.map(user => (
            <PersonCard key={user.id} user={user} />
          ))}
        </div>
      )}
      {data && (
        <Pagination
          page={Number(params.get('page') || 1)}
          pages={data.pages}
          change={page => update('page', String(page))}
        />
      )}
    </>
  );
}
export function Recommendations() {
  const [tab, setTab] = useState('projects');
  const { data, loading, error } = useApi<{
    projects: Project[];
    people: User[];
    incomplete: boolean;
  }>('/users/recommendations');
  return (
    <>
      <PageTitle
        eyebrow="ТАНЫ УР ЧАДВАРААС ЭХЭЛНЭ"
        title="Танд санал болгох"
        description="Ур чадвар, сонирхол, боломжит цагт тань нийцэх боломжууд."
      />
      <div className="tabs">
        <button className={tab === 'projects' ? 'active' : ''} onClick={() => setTab('projects')}>
          Төслүүд
        </button>
        <button className={tab === 'people' ? 'active' : ''} onClick={() => setTab('people')}>
          Хамтрагчид
        </button>
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <>
          {data?.incomplete && (
            <div className="info-banner">
              <Sparkles size={20} />
              <span>
                Саналыг сайжруулахын тулд ур чадварын түвшин болон боломжит цагаа профайлдаа нэмээрэй.
              </span>
              <Link to="/profile">Профайл засах ↗</Link>
            </div>
          )}
          {tab === 'projects' ? (
            data?.projects.length ? (
              <div className="project-grid">
                {data.projects.map(project => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            ) : (
              <Empty
                title="Одоогоор тохирох төсөл алга"
                text="Профайлаа шинэчилж эсвэл бүх төслөөс хайж үзээрэй."
              >
                <Link className="btn primary" to="/projects">
                  Төсөл хайх
                </Link>
              </Empty>
            )
          ) : data?.people.length ? (
            <div className="people-grid">
              {data.people.map(user => (
                <PersonCard key={user.id} user={user} />
              ))}
            </div>
          ) : (
            <Empty
              title="Тохирох хамтрагч алга"
              text="Өөрийн нээлттэй төслийн ур чадвар, цагийн шаардлагад нийцэх хүмүүсийг энд санал болгоно."
            />
          )}
        </>
      )}
    </>
  );
}

