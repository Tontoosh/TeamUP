import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Clock3, Flag, GraduationCap, Link as LinkIcon, Pencil, ShieldBan } from 'lucide-react';
import { api, patch, post, splitList } from '../api';
import { useApi } from '../hooks';
import { useApp } from '../context';
import type { User } from '../types';
import { Avatar, ErrorState, Loading, Modal, PageTitle, Tags, Empty } from '../components/ui';
import { ProjectCard } from '../components/ProjectCard';
import { PortfolioList } from '../components/PortfolioList';
import { ReportDialog } from '../components/ReportDialog';

export function Profile() {
  const { id } = useParams();
  const { user: me, refresh, toast } = useApp();
  const own = !id || id === me?.id;
  const { data: user, error, loading, reload } = useApi<User>(`/users/${id || me?.id}`);
  const [editing, setEditing] = useState(false);
  const [report, setReport] = useState(false);
  const [block, setBlock] = useState(false);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setFormError('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await patch('/users/me', {
        ...data,
        skills: splitList(String(data.skills)),
        interests: splitList(String(data.interests)),
        hours: Number(data.hours),
      });
      await refresh();
      await reload();
      setEditing(false);
      toast('Профайл хадгалагдлаа.');
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (loading) return <Loading />;
  if (error || !user) return <ErrorState message={error || 'Профайл олдсонгүй.'} />;
  return (
    <>
      <PageTitle
        eyebrow="ХАМТРАН БҮТЭЭГЧ"
        title={own ? 'Миний профайл' : 'Хамтрагчийн профайл'}
        description="Ур чадвар, туршлага болон хамтын бүтээлийн түүх."
      />
      <section className="panel profile-hero">
        <div className="profile-cover" />
        <div className="profile-identity">
          <Avatar name={user.name} size="xl" />
          <div>
            <h1>{user.name}</h1>
            <p className="muted">{user.major}</p>
          </div>
          <div className="inline">
            {own ? (
              <button
                className="btn secondary"
                onClick={() => {
                  setEditing(true);
                  setFormError('');
                }}
              >
                <Pencil size={16} />
                Профайл засах
              </button>
            ) : (
              <>
                <button className="btn secondary" onClick={() => setBlock(true)}>
                  <ShieldBan size={16} />
                  {user.blocked ? 'Блок цуцлах' : 'Блоклох'}
                </button>
                <button
                  className="icon-btn"
                  aria-label="Зөрчил мэдээлэх"
                  onClick={() => setReport(true)}
                >
                  <Flag size={18} />
                </button>
              </>
            )}
          </div>
        </div>
        <div className="profile-meta">
          <span>
            <GraduationCap size={17} />
            {user.school} · {user.major}
          </span>
          <span>
            <Clock3 size={17} />
            {user.hours} цаг / 7 хоног
          </span>
          {user.portfolio && (
            <a href={user.portfolio} target="_blank" rel="noreferrer">
              <LinkIcon size={17} />
              Бүтээлийн холбоос ↗
            </a>
          )}
        </div>
      </section>
      <div className="profile-layout">
        <aside className="panel">
          <h2>Миний тухай</h2>
          <p className="muted preserve-text">{user.bio || 'Танилцуулга оруулаагүй байна.'}</p>
          <h3>Ур чадвар</h3>
          <Tags items={user.skills} />
          <h3>Сонирхол</h3>
          <Tags items={user.interests} />
          <h3>Туршлага</h3>
          <p className="muted preserve-text">{user.experience || 'Туршлага оруулаагүй байна.'}</p>
        </aside>
        <section className="panel">
          <PortfolioList entries={user.portfolioEntries || []} own={own} reload={reload} />
        </section>
      </div>
      <div className="results-heading">
        <h2>
          Хамтын ажиллагааны түүх <span>{user.projects?.length || 0}</span>
        </h2>
        <Link className="text-btn" to="/my-projects">
          Миний төслүүд ↗
        </Link>
      </div>
      {user.projects?.length ? (
        <div className="project-grid">
          {user.projects.map(project => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <Empty title="Төслийн түүх хараахан үүсээгүй" />
      )}
      {editing && (
        <Modal title="Профайл засах" close={() => setEditing(false)}>
          <form onSubmit={submit} className="form-stack">
            <label>
              Нэр
              <input name="name" defaultValue={user.name} required minLength={2} maxLength={160} />
            </label>
            <div className="form-row">
              <label>
                Сургууль
                <input
                  name="school"
                  defaultValue={user.school}
                  required
                  minLength={2}
                  maxLength={160}
                />
              </label>
              <label>
                Мэргэжил
                <input
                  name="major"
                  defaultValue={user.major}
                  required
                  minLength={2}
                  maxLength={160}
                />
              </label>
            </div>
            <label>
              Танилцуулга
              <textarea name="bio" defaultValue={user.bio} rows={3} maxLength={3000} />
            </label>
            <label>
              Ур чадвар
              <input
                name="skills"
                defaultValue={user.skills.join(', ')}
                placeholder="Таслалаар тусгаарлана"
              />
            </label>
            <label>
              Сонирхол
              <input
                name="interests"
                defaultValue={user.interests.join(', ')}
                placeholder="EdTech, GreenTech"
              />
            </label>
            <label>
              Туршлага
              <textarea
                name="experience"
                defaultValue={user.experience}
                rows={2}
                maxLength={3000}
              />
            </label>
            <label>
              Бүтээлийн холбоос
              <input
                name="portfolio"
                type="url"
                defaultValue={user.portfolio}
                placeholder="https://…"
              />
            </label>
            <label>
              7 хоногт зарцуулах боломжит цаг
              <input
                name="hours"
                type="number"
                min={0}
                max={80}
                defaultValue={user.hours}
                required
              />
            </label>
            {formError && <ErrorState message={formError} />}
            <button disabled={busy} className="btn primary">
              Хадгалах
            </button>
          </form>
        </Modal>
      )}
      {report && <ReportDialog type="user" targetId={user.id} close={() => setReport(false)} />}
      {block && (
        <Modal
          title={user.blocked ? 'Блок цуцлах уу?' : 'Хэрэглэгчийг блоклох уу?'}
          close={() => setBlock(false)}
        >
          <p className="muted">
            Шинэ хүсэлт солилцохыг хязгаарлана. Нийтийн мэдээлэл болон өмнөх багийн гишүүнчлэл
            хадгалагдана.
          </p>
          <div className="form-actions">
            <button className="btn secondary" onClick={() => setBlock(false)}>
              Цуцлах
            </button>
            <button
              className="btn danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  if (user.blocked) await api(`/community/blocks/${user.id}`, { method: 'DELETE' });
                  else await post('/community/blocks', { target_id: user.id });
                  setBlock(false);
                  await reload();
                  toast('Блокийн тохиргоо хадгалагдлаа.');
                } catch (err) {
                  toast((err as Error).message, true);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Баталгаажуулах
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
