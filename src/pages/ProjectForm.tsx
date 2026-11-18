import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowUpRight, Save, Lightbulb } from 'lucide-react';
import { patch, post, splitList } from '../api';
import { useApp } from '../context';
import { useApi } from '../hooks';
import type { Project } from '../types';
import { ErrorState, Loading, PageTitle } from '../components/ui';
import { RoleRequirementsEditor } from '../components/RoleRequirements';
import { uniqueSkills } from '../skill-utils';

function Editor({ project }: { project?: Project }) {
  const { toast } = useApp();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [skillsText, setSkillsText] = useState(project?.skills.join(', ') || '');
  const [rolesText, setRolesText] = useState(project?.roles.join(', ') || '');
  const [hours, setHours] = useState(String(project?.hours || 8));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const data = {
      ...form,
      skills: uniqueSkills(String(form.skills)),
      roleRequirements: JSON.parse(String(form.roleRequirements)),
      roles: splitList(String(form.roles)),
      capacity: Number(form.capacity),
      hours: Number(form.hours),
      duration: Number(form.duration),
    };
    try {
      if (project) {
        await patch(`/projects/${project.id}`, data);
        toast('Төслийн мэдээлэл хадгалагдлаа.');
        navigate(`/projects/${project.id}`);
      } else {
        const created = await post<Project>('/projects', data);
        toast('Төсөл амжилттай нийтлэгдлээ.');
        navigate(`/projects/${created.id}`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="editor-layout">
      <form className="panel form-stack" onSubmit={submit}>
        <div className="section-label">
          01 <span>Төслийн үндсэн мэдээлэл</span>
        </div>
        <label>
          Төслийн нэр
          <input
            name="name"
            defaultValue={project?.name}
            minLength={3}
            maxLength={200}
            placeholder="Санаандаа нэр өгье…"
            required
          />
        </label>
        <label>
          Товч танилцуулга
          <textarea
            name="description"
            defaultValue={project?.description}
            minLength={10}
            maxLength={5000}
            rows={4}
            placeholder="Ямар асуудлыг хэнд зориулж шийдэх вэ?"
            required
          />
        </label>
        <div className="form-row">
          <label>
            Ангилал
            <select name="category" defaultValue={project?.category} required>
              {['EdTech', 'FinTech', 'GreenTech', 'HealthTech', 'Social', 'Бусад'].map(value => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            Төрөл
            <select name="project_type" defaultValue={project?.project_type}>
              <option>Стартап</option>
              <option>Судалгаа</option>
              <option>Хичээлийн төсөл</option>
            </select>
          </label>
        </div>
        <label>
          Зорилго, хүлээгдэж буй үр дүн
          <textarea
            name="goal"
            defaultValue={project?.goal}
            minLength={10}
            maxLength={3000}
            rows={3}
            required
          />
        </label>
        <div className="section-label">
          02 <span>Баг ба хамтын ажиллагаа</span>
        </div>
        <div className="form-row three">
          <label>
            Хугацаа / долоо хоног
            <input
              name="duration"
              type="number"
              min={1}
              max={520}
              defaultValue={project?.duration || 12}
              required
            />
          </label>
          <label>
            Багийн хэмжээ
            <input
              name="capacity"
              type="number"
              min={project?.member_count || 2}
              max={100}
              defaultValue={project?.capacity || 5}
              required
            />
          </label>
          <label>
            7 хоногийн цаг
            <input
              name="hours"
              type="number"
              min={1}
              max={80}
              value={hours}
              onChange={event => setHours(event.target.value)}
              required
            />
          </label>
        </div>
        <label>
          Шаардлагатай ур чадвар
          <input
            name="skills"
            aria-label="Шаардлагатай ур чадвар"
            value={skillsText}
            onChange={event => setSkillsText(event.target.value)}
            placeholder="React, Figma, TypeScript"
            required
          />
          <small>Таслалаар тусгаарлан бичнэ үү.</small>
        </label>
        <label>
          Нээлттэй үүргүүд
          <input
            name="roles"
            aria-label="Нээлттэй үүргүүд"
            value={rolesText}
            onChange={event => setRolesText(event.target.value)}
            placeholder="Frontend хөгжүүлэгч, UI/UX дизайнер"
            required
          />
          <small>Нэг үүрэг бүр нэг сул орон тоог илэрхийлнэ.</small>
        </label>
        <RoleRequirementsEditor roles={splitList(rolesText)} skills={uniqueSkills(skillsText)}
          hours={Number(hours) || 8} initial={project?.roleRequirements} />
        {error && <ErrorState message={error} />}
        <div className="form-actions">
          <Link className="btn secondary" to={project ? `/projects/${project.id}` : '/my-projects'}>
            Цуцлах
          </Link>
          <button className="btn primary" disabled={busy}>
            {project ? <Save size={17} /> : <ArrowUpRight size={17} />}
            {busy ? 'Хадгалж байна…' : project ? 'Өөрчлөлт хадгалах' : 'Төсөл нийтлэх'}
          </button>
        </div>
      </form>
      <aside className="editor-help panel">
        <Lightbulb size={29} />
        <h3>Сайн баг тодорхой санаанаас эхэлдэг.</h3>
        <p>Зорилго, хэрэгтэй ур чадвар, хамтрах хугацаагаа ойлгомжтой бичээрэй.</p>
        <hr />
        <p>
          Та төслийн эзэмшигч болно. Багт нэгдэх хүсэлтүүдийг шалгаж, гишүүдийн үүргийг удирдана.
        </p>
      </aside>
    </div>
  );
}
export function ProjectForm() {
  const { id } = useParams();
  const { user } = useApp();
  const { data, error, loading } = useApi<Project>(id ? `/projects/${id}` : null);
  if (id && loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  if (data && (data.owner_id !== user?.id || ['archived', 'completed'].includes(data.status)))
    return <ErrorState message="Энэ төслийг засах эрхгүй." />;
  return (
    <>
      <PageTitle
        eyebrow="САНААНААС БОДИТ БҮТЭЭЛ РҮҮ"
        title={id ? 'Төсөл засах' : 'Шинэ төсөл эхлүүлэх'}
        description="Санаагаа танилцуулаад, зөв хүмүүсээ олоорой."
      />
      <Editor key={data?.id || 'new'} project={data || undefined} />
    </>
  );
}
