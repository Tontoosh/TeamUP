import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, Search, Sparkles } from 'lucide-react';
import { useApi } from '../hooks';
import type { Page, Project, User } from '../types';
import { Avatar, Empty, ErrorState, Loading, PageTitle, Pagination, Tags } from '../components/ui';
import { ProjectCard } from '../components/ProjectCard';

export function PersonCard({ user }: { user: User }) {
  return (
    <article className="panel person-card">
      <div className="space-between">
        <Avatar name={user.name} size="large" />
        <span className="availability">
          <span className="live-dot" />
          {user.hours} цаг / 7 хоног
        </span>
      </div>
      <h3>{user.name}</h3>
      <p className="muted">
        {user.school} · {user.major}
      </p>
      <p className="card-description">{user.bio || 'Танилцуулга оруулаагүй байна.'}</p>
      <Tags items={user.skills} />
      {user.reasons && (
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
  const { data, error, loading, reload } = useApi<Page<User>>(`/users/people?${params}`);
  const update = (key: string, value: string) =>
    setParams(previous => {
      const next = new URLSearchParams(previous);
      value ? next.set(key, value) : next.delete(key);
      if (key !== 'page') next.delete('page');
      return next;
    });
  return (
    <>
      <PageTitle
        eyebrow="ХАМТЫН ХҮЧЭЭ ОЛООРОЙ"
        title="Хамтрагч хайх"
        description="Төсөлдөө тохирох ур чадвартай оюутнуудтай танилцаарай."
      />
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
                Саналыг сайжруулахын тулд ур чадвар болон боломжит цагаа профайлдаа нэмээрэй.
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
