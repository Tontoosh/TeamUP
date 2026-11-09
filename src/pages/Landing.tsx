import { Link } from 'react-router-dom';
import { ArrowUpRight, MessageSquare, Network, Rocket, Sparkles, Users } from 'lucide-react';
import { useApp } from '../context';
import { useApi } from '../hooks';
import type { Page, Project } from '../types';
import { Brand } from '../components/ui';
import { ProjectCard } from '../components/ProjectCard';

export function Landing() {
  const { user } = useApp();
  const { data } = useApi<Page<Project>>('/projects?size=3');
  return (
    <div className="landing">
      <header className="landing-nav">
        <Brand />
        <nav>
          <a href="#features">Боломжууд</a>
          <a href="#how">Хэрхэн ажиллах вэ</a>
          <Link to="/projects">Төслүүд</Link>
        </nav>
        <div className="inline">
          <Link to={user ? '/my-projects' : '/login'} className="btn ghost">
            {user ? 'Миний төслүүд' : 'Нэвтрэх'}
          </Link>
          <Link to={user ? '/projects' : '/register'} className="btn primary">
            {user ? 'Төсөл хайх' : 'Бүртгүүлэх'}
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </header>
      <main>
        <section className="landing-hero">
          <div>
            <span className="eyebrow">
              <span className="live-dot" /> ОЮУТНЫ СТАРТАП ХАМТЫН АЖИЛЛАГААНЫ ПЛАТФОРМ
            </span>
            <h1>
              Санаагаа
              <br />
              <em>хамтдаа</em>
              <br />
              бодит болгоё.
            </h1>
            <p>
              Ур чадвараараа нэгдэж, төсөлдөө тохирох
              <br />
              хамтрагчаа олж, багаараа бүтээ.
            </p>
            <div className="inline">
              <Link className="btn primary" to="/projects">
                Төсөл хайх
                <ArrowUpRight size={18} />
              </Link>
              <Link className="btn secondary" to="/register">
                Хамтдаа эхлэх
              </Link>
            </div>
            <div className="hero-note">
              <span className="small-avatars">
                <i>А</i>
                <i>Т</i>
                <i>Н</i>
              </span>
              <span>Таны дараагийн баг эндээс эхэлнэ.</span>
            </div>
          </div>
          <div className="landing-sculpture" aria-hidden="true">
            <div className="sculpture-ring" />
            <div className="sculpture-core">
              <Network size={100} strokeWidth={1} />
            </div>
            <span className="floating-label label-idea">
              <Sparkles size={17} />
              Таны санаа
            </span>
            <span className="floating-label label-people">
              <Users size={17} />
              Зөв хүмүүс
            </span>
            <span className="floating-label label-project">
              <Rocket size={17} />
              Бодит бүтээл
            </span>
            <div className="sculpture-grid" />
          </div>
        </section>
        <section className="landing-section" id="features">
          <span className="eyebrow">БОЛОМЖУУДАА НЭЭ</span>
          <h2>
            Гайхалтай бүтээлүүд
            <br />
            холбооноос эхэлдэг.
          </h2>
          <div className="feature-grid">
            {[
              [
                Rocket,
                'Өөрийн төслөө ол',
                'Сонирхол, ур чадвартаа нийцсэн төсөлд нэгдэж, бодит туршлага хуримтлуул.',
              ],
              [
                Users,
                'Зөв хамтрагчаа ол',
                'Санааг тань урагшлуулах ур чадвартай оюутнуудтай нэг баг бол.',
              ],
              [
                MessageSquare,
                'Нэг орон зайд бүтээ',
                'Багийн чатад санаагаа ярилцаж, файл болон холбоосоо хуваалц.',
              ],
              [
                Sparkles,
                'Бүтээлийн түүхээ бич',
                'Хийсэн ажил, оруулсан хувь нэмрээ профайлдаа нэгтгэ.',
              ],
            ].map(([Icon, title, text], index) => {
              const Component = Icon as typeof Rocket;
              return (
                <article key={index}>
                  <span className="feature-icon">
                    <Component size={25} />
                  </span>
                  <h3>{String(title)}</h3>
                  <p>{String(text)}</p>
                </article>
              );
            })}
          </div>
        </section>
        <section className="landing-section how-section" id="how">
          <div>
            <span className="eyebrow">ГУРАВХАН АЛХАМ</span>
            <h2>
              Эхний алхмаас
              <br />
              хамтын бүтээл рүү.
            </h2>
            <p className="muted">
              Өөрийн санаа бий юу? Нэвтрээд төслөө нийтэлж,
              <br />
              хамтдаа бүтээх багаа бүрдүүлээрэй.
            </p>
          </div>
          <div className="steps">
            {[
              [
                '01',
                'Төслүүдтэй танилц',
                'Нээлттэй төслүүд болон багт хэрэгтэй үүргүүдийг хараарай.',
              ],
              ['02', 'Профайлаа бүрдүүл', 'Ур чадвар, сонирхол, боломжит цагаа хуваалцаарай.'],
              ['03', 'Багаараа бүтээ', 'Хүсэлтээ илгээж, багт нэгдээд санаагаа бодит болгоорой.'],
            ].map(([number, title, text]) => (
              <div key={number}>
                <span>{number}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="landing-section">
          <div className="space-between">
            <div>
              <span className="eyebrow">ТАНЫ ДАРААГИЙН БОЛОМЖ</span>
              <h2>Хамтдаа бүтээх төслүүд.</h2>
              <p className="muted">Туршилтын орчны зохиомол жишээ төслүүд.</p>
            </div>
            <Link className="text-btn" to="/projects">
              Бүх төсөл үзэх
              <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className="project-grid landing-projects">
            {data?.items.map(project => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </section>
        <section className="landing-section faq">
          <div>
            <span className="eyebrow">ТҮГЭЭМЭЛ АСУУЛТ</span>
            <h2>Эхлэхээсээ өмнө.</h2>
          </div>
          <div>
            {[
              [
                'Хэн ашиглаж болох вэ?',
                'Хамтран суралцаж, стартап болон төсөл хөгжүүлэх хүсэлтэй их, дээд сургуулийн оюутнуудад зориулсан.',
              ],
              [
                'Төсөл үзэхэд бүртгүүлэх шаардлагатай юу?',
                'Нийтийн төслүүдийг бүртгэлгүй үзэж болно. Багт нэгдэх хүсэлт илгээхдээ нэвтэрнэ.',
              ],
              [
                'Өөрийн төсөл нийтэлж болох уу?',
                'Тийм. Нэвтэрсний дараа зорилго, ур чадвар, нээлттэй үүргээ тодорхойлоод төсөл нийтлээрэй.',
              ],
            ].map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <span>+</span>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="landing-cta">
          <span className="eyebrow">ДАРААГИЙН ТҮҮХ ЧИНЬ ЭНДЭЭС</span>
          <h2>
            Хамтдаа эхний
            <br />
            алхмаа хийе.
          </h2>
          <Link className="btn primary" to="/register">
            Хамтдаа нэгдэх
            <ArrowUpRight size={19} />
          </Link>
        </section>
      </main>
      <footer className="landing-footer">
        <Brand />
        <span>Хамтдаа бүтээх орон зай. © {new Date().getFullYear()}</span>
        <Link to="/projects">Төслүүдтэй танилцах ↗</Link>
      </footer>
    </div>
  );
}
