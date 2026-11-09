import { useSearchParams, Link } from 'react-router-dom';
import { ArrowUpRight, Plus, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { useApi } from '../hooks';
import { useApp } from '../context';
import type { Page, Project } from '../types';
import { ProjectCard } from '../components/ProjectCard';
import { Empty, ErrorState, Loading, Pagination, PageTitle } from '../components/ui';

export function Projects({ mine = false }: { mine?: boolean }) {
  const [params, setParams] = useSearchParams();
  const { user } = useApp();
  const query = new URLSearchParams(params);
  if (mine) query.set('mine', 'true');
  const { data, loading, error, reload } = useApi<Page<Project>>(`/projects?${query}`);
  const update = (key: string, value: string) => {
    setParams(previous => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== 'page') next.delete('page');
      return next;
    });
  };
  return (
    <>
      <div className="breadcrumb">
        Таны дараагийн боломж <span>/</span> {mine ? 'Миний төслүүд' : 'Төсөл хайх'}
      </div>
      {mine ? (
        <PageTitle
          eyebrow="МИНИЙ ОРОН ЗАЙ"
          title="Бүтээж буй зүйлс"
          description="Өөрийн болон гишүүнээр оролцож буй төслүүдээ удирдаарай."
        >
          <Link className="btn primary" to="/projects/new">
            <Plus size={17} />
            Төсөл үүсгэх
          </Link>
        </PageTitle>
      ) : (
        <section className="discovery-hero">
          <div className="hero-content">
            <span className="eyebrow">
              <span className="live-dot" /> ОЮУТНЫ ИННОВАЦИЙН СҮЛЖЭЭ
            </span>
            <h1>
              Том санаа.
              <br />
              <span>Зөв хамтрагч.</span>
            </h1>
            <p>
              Ур чадвараараа нэгдэж, дараагийн бүтээлээ эхлүүл.
              <br />
              Хамтдаа бүтээх төслөө эндээс олоорой.
            </p>
            <Link to={user ? '/projects/new' : '/register'} className="btn primary">
              {user ? 'Санаагаа төсөл болгох' : 'Хамтдаа эхлэх'}
              <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className="orbit-art" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="orbit-center">
              <Sparkles size={42} />
            </div>
            <div className="orbit-node node-code">&lt;/&gt;</div>
            <div className="orbit-node node-design">✳</div>
            <div className="orbit-node node-idea">↗</div>
            <span className="art-caption">САНАА + УР ЧАДВАР + ХАМТЫН ХҮЧ</span>
          </div>
        </section>
      )}
      <section className="filters-panel" aria-label="Төсөл шүүх">
        <div className="filters-heading">
          <span>
            <SlidersHorizontal size={16} />
            Өөрт тохирох төслөө олох
          </span>
          <span className="muted">Боломж эндээс эхэлнэ</span>
        </div>
        <div className="filter-grid">
          <label className="search-field">
            <Search size={18} />
            <input
              aria-label="Төслийн нэр"
              placeholder="Төслийн нэр, түлхүүр үг…"
              value={params.get('q') || ''}
              onChange={event => update('q', event.target.value)}
            />
          </label>
          <select
            aria-label="Ангилал"
            value={params.get('category') || ''}
            onChange={event => update('category', event.target.value)}
          >
            <option value="">Бүх ангилал</option>
            {['EdTech', 'FinTech', 'GreenTech', 'HealthTech', 'Social'].map(item => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <input
            aria-label="Ур чадвар"
            placeholder="Ур чадвар · React, Figma…"
            value={params.get('skill') || ''}
            onChange={event => update('skill', event.target.value)}
          />
          <select
            aria-label="Төслийн төрөл"
            value={params.get('type') || ''}
            onChange={event => update('type', event.target.value)}
          >
            <option value="">Төслийн төрөл</option>
            <option>Стартап</option>
            <option>Судалгаа</option>
            <option>Хичээлийн төсөл</option>
          </select>
          <select
            aria-label="Хугацаа"
            value={params.get('duration') || ''}
            onChange={event => update('duration', event.target.value)}
          >
            <option value="">Хугацаа</option>
            <option value="4">4 долоо хоног хүртэл</option>
            <option value="12">12 долоо хоног хүртэл</option>
            <option value="24">24 долоо хоног хүртэл</option>
          </select>
        </div>
        <div className="filter-bottom">
          <span className="muted">Эрэлттэй ур чадвар</span>
          {['React', 'Figma', 'Python', 'Marketing'].map(skill => (
            <button
              key={skill}
              className={`filter-chip ${params.get('skill') === skill ? 'selected' : ''}`}
              onClick={() => update('skill', params.get('skill') === skill ? '' : skill)}
            >
              {skill}
              {params.get('skill') === skill && <X size={12} />}
            </button>
          ))}
          {params.size > 0 && (
            <button className="text-btn clear" onClick={() => setParams({})}>
              Бүгдийг цэвэрлэх
            </button>
          )}
        </div>
      </section>
      <div className="results-heading">
        <h2>
          {mine ? 'Миний төслүүд' : 'Төслүүдийг нээх'} <span>{data?.total ?? '…'}</span>
        </h2>
        <select
          aria-label="Эрэмбэлэх"
          value={params.get('sort') || ''}
          onChange={event => update('sort', event.target.value)}
        >
          <option value="">Шинээр нийтлэгдсэн</option>
          <option value="spaces">Сул суудлын тоогоор</option>
        </select>
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} retry={reload} />
      ) : !data?.items.length ? (
        <Empty
          title="Тохирох төсөл олдсонгүй"
          text="Хайлтын үг, шүүлтүүрээ өөрчилж дахин хайгаарай."
        >
          <button className="btn secondary" onClick={() => setParams({})}>
            Шүүлтүүр цэвэрлэх
          </button>
        </Empty>
      ) : (
        <div className="project-grid">
          {data.items.map(project => (
            <ProjectCard key={project.id} project={project} />
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
      {!mine && (
        <div className="discovery-banner">
          <div>
            <Sparkles size={22} />
            <span>
              <b>Танд өөрийн гэсэн санаа бий юу?</b>
              <small>Төслөө нийтлээд, хамт бүтээх багаа бүрдүүлээрэй.</small>
            </span>
          </div>
          <Link to={user ? '/projects/new' : '/register'}>
            Төсөл эхлүүлэх <ArrowUpRight size={17} />
          </Link>
        </div>
      )}
    </>
  );
}
