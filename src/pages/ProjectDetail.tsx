import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarDays, Clock3, Flag, Folder, Pencil, Users, Target } from 'lucide-react';
import { patch, post } from '../api';
import { useApi } from '../hooks';
import { useApp } from '../context';
import type { Member, Project } from '../types';
import { Avatar, Badge, ErrorState, Loading, Modal, Tags } from '../components/ui';
import { JoinPanel } from '../components/JoinPanel';
import { ReportDialog } from '../components/ReportDialog';
import { RoleRequirements } from '../components/RoleRequirements';

export function ProjectDetail() {
  const { id } = useParams();
  const { data: project, loading, error, reload } = useApi<Project>(`/projects/${id}`);
  const { user, toast } = useApp();
  const [apply, setApply] = useState(false);
  const [report, setReport] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [member, setMember] = useState<Member | null>(null);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  if (loading) return <Loading />;
  if (error || !project) return <ErrorState message={error || 'Төсөл олдсонгүй.'} retry={reload} />;
  const owner = user?.id === project.owner_id;
  const inTeam = project.members?.some(item => item.user_id === user?.id);
  const pending = project.application?.some(item => ['pending', 'info'].includes(item.status));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setFormError('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await post('/applications', { ...data, project_id: project.id });
      setApply(false);
      toast('Нэгдэх хүсэлт амжилттай илгээгдлээ.');
      await reload();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const changeStatus = async () => {
    setBusy(true);
    try {
      await post(`/projects/${id}/status`, { status: confirm });
      setConfirm('');
      toast('Төслийн төлөв шинэчлэгдлээ.');
      await reload();
    } catch (err) {
      toast((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Link to="/projects" className="back-link">
        ← Төслүүд рүү буцах
      </Link>
      <div className="detail-heading">
        <div>
          <div className="inline">
            <span className="category">{project.category}</span>
            <Badge status={project.status} />
          </div>
          <h1>{project.name}</h1>
          <div className="inline muted">
            <span>{project.owner.school}</span>
            <span>·</span>
            <span>{project.project_type}</span>
          </div>
        </div>
        {user && (
          <button className="icon-btn" aria-label="Зөрчил мэдээлэх" onClick={() => setReport(true)}>
            <Flag size={19} />
          </button>
        )}
      </div>
      <div className="detail-layout">
        <div className="detail-main">
          <section className="panel">
            <h2>
              <Folder size={20} />
              Төслийн тухай
            </h2>
            <p className="preserve-text">{project.description}</p>
            <h3>
              <Target size={18} />
              Бидний зорилго
            </h3>
            <p className="preserve-text muted">{project.goal || 'Мэдээлэл оруулаагүй'}</p>
            <div className="detail-facts">
              <div>
                <CalendarDays size={19} />
                <span>
                  Үргэлжлэх хугацаа<b>{project.duration ? project.duration + ' долоо хоног' : 'Тодорхойгүй'}</b>
                </span>
              </div>
              <div>
                <Clock3 size={19} />
                <span>
                  Оролцох боломж<b>{project.hours ? project.hours + ' цаг / 7 хоног' : 'Тодорхойгүй'}</b>
                </span>
              </div>
            </div>
            <h3>Шаардлагатай ур чадвар</h3>
            <Tags items={project.skills} />
            <h3>Нээлттэй үүргүүдийн шаардлага</h3>
            <RoleRequirements roles={project.roleRequirements} />
            {owner && project.status === 'open' && <Link className="btn secondary" to={`/people?project=${id}`}>
              Тохирох хамтрагч хайх
            </Link>}
          </section>
          <section className="panel">
            <h2>
              <Users size={20} />
              Хамтдаа бүтээх баг{' '}
              <span className="muted">
                {project.member_count} / {project.capacity}
              </span>
            </h2>
            <div className="member-list">
              {project.members?.map(item => (
                <div key={item.id} className="member-row">
                  <Link className="person" to={`/people/${item.user_id}`}>
                    <Avatar name={item.user.name} />
                    <span>
                      <b>{item.user.name}</b>
                      <small>{item.role}</small>
                    </span>
                  </Link>
                  {inTeam && project.completed_at && item.user_id !== user?.id && (
                    <Link className="text-btn" to={`/people/${item.user_id}?reviewProject=${id}`}>Үнэлгээ өгөх</Link>
                  )}
                  {owner && item.user_id !== user?.id && !['archived', 'completed'].includes(project.status) && (
                    <button
                      className="text-btn"
                      onClick={() => {
                        setMember(item);
                        setFormError('');
                      }}
                    >
                      Үүрэг өөрчлөх
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
          {owner && (
            <section className="panel owner-tools">
              <h2>Төслийн удирдлага</h2>
              <div className="inline wrap">
                {project.status === 'open' && project.member_count < project.capacity && project.roles.length > 0 && (
                  <Link className="btn primary" to={`/people?project=${project.id}`}>Тохирох хамтрагч олох</Link>
                )}
                {project.status !== 'archived' && (
                  <>
                    {project.status !== 'completed' && <Link className="btn secondary" to={`/projects/${id}/edit`}>
                      <Pencil size={16} />
                      Мэдээлэл засах
                    </Link>}
                    <Link to="/requests?tab=incoming" className="btn secondary">
                      Ирсэн хүсэлтүүд
                    </Link>
                    {project.status === 'open' && (
                      <button className="btn secondary" onClick={() => setConfirm('closed')}>
                        Элсэлт хаах
                      </button>
                    )}
                    {['open', 'closed'].includes(project.status) && (
                      <button className="btn secondary" onClick={() => setConfirm('completed')}>Төсөл дуусгах</button>
                    )}
                    <button className="btn danger" onClick={() => setConfirm('archived')}>
                      Архивлах
                    </button>
                  </>
                )}
              </div>
            </section>
          )}
        </div>
        <JoinPanel
          project={project}
          inTeam={!!inTeam}
          pending={!!pending}
          onApply={() => {
            setApply(true);
            setFormError('');
          }}
        />
      </div>
      {apply && (
        <Modal title="Багт нэгдэх хүсэлт" close={() => setApply(false)}>
          <form onSubmit={submit} className="form-stack">
            <p className="muted">{project.name}</p>
            <label>
              Хүсэж буй үүрэг
              <select name="role" required>
                {project.roles.map(role => (
                  <option key={role}>{role}</option>
                ))}
              </select>
            </label>
            <label>
              Өөрийгөө товч танилцуулаарай
              <textarea
                name="introduction"
                minLength={10}
                maxLength={3000}
                required
                rows={5}
                placeholder="Ур чадвар, туршлага, яагаад энэ төсөлд нэгдэхийг хүсэж байна вэ?"
              />
            </label>
            {formError && <ErrorState message={formError} />}
            <button disabled={busy} className="btn primary">
              Хүсэлт илгээх
            </button>
          </form>
        </Modal>
      )}
      {confirm && (
        <Modal
          title={confirm === 'closed' ? 'Элсэлт хаах уу?' : confirm === 'completed' ? 'Төслийн ажил дууссан уу?' : 'Төсөл архивлах уу?'}
          close={() => setConfirm('')}
        >
          <p className="muted">
            Шийдвэрлэгдээгүй хүсэлтүүд хүчингүй болж, түүх хадгалагдана.{' '}
            {confirm === 'archived' && 'Төсөл болон багийн чат зөвхөн унших горимд шилжинэ.'} Энэ
            үйлдлийг буцаахгүй.
            {confirm === 'completed' && ' Одоогийн багийн бүрэлдэхүүн хадгалагдаж, гишүүд бие биедээ үнэлгээ өгөх боломжтой болно. Төсөл болон чат зөвхөн унших горимд шилжинэ.'}
          </p>
          <div className="form-actions">
            <button className="btn secondary" onClick={() => setConfirm('')}>
              Цуцлах
            </button>
            <button className="btn danger" disabled={busy} onClick={changeStatus}>
              Баталгаажуулах
            </button>
          </div>
        </Modal>
      )}
      {member && (
        <Modal title="Гишүүний үүрэг" close={() => setMember(null)}>
          <form
            className="form-stack"
            onSubmit={async event => {
              event.preventDefault();
              setBusy(true);
              try {
                const role = new FormData(event.currentTarget).get('role');
                await patch(`/projects/${id}/members/${member.user_id}`, { role });
                setMember(null);
                toast('Үүрэг шинэчлэгдлээ.');
                await reload();
              } catch (err) {
                setFormError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              {member.user.name}
              <input name="role" defaultValue={member.role} maxLength={100} required />
            </label>
            {formError && <ErrorState message={formError} />}
            <button disabled={busy} className="btn primary">
              Хадгалах
            </button>
          </form>
        </Modal>
      )}
      {report && (
        <ReportDialog type="project" targetId={project.id} close={() => setReport(false)} />
      )}
    </>
  );
}

