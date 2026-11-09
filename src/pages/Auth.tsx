import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Eye, EyeOff, Network, ShieldCheck } from 'lucide-react';
import { post } from '../api';
import { useApp } from '../context';
import { Brand, ErrorState, Loading } from '../components/ui';

export function Auth({ mode }: { mode: 'login' | 'register' | 'forgot' | 'reset' | 'verify' }) {
  const { refresh, googleEnabled, localMail, toast, loading, demoMode } = useApp();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const register = mode === 'register';
  const login = mode === 'login';
  const passwordNeeded = login || register || mode === 'reset';
  const titles = {
    login: 'Тавтай морил! 👋',
    register: 'Хамтдаа эхэлцгээе.',
    forgot: 'Нууц үг сэргээх',
    reset: 'Шинэ нууц үг',
    verify: 'Имэйл баталгаажуулах',
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if ((register || mode === 'reset') && data.password !== data.confirm) {
      setError('Нууц үг давтах талбар таарахгүй байна.');
      setBusy(false);
      return;
    }
    try {
      const result = await post<{ message?: string }>(`/auth/${mode}`, {
        ...data,
        token: params.get('token'),
      });
      if (login) {
        await refresh();
        toast('Амжилттай нэвтэрлээ.');
        const next = params.get('next') || '/projects';
        navigate(next.startsWith('/') && !next.startsWith('//') ? next : '/projects');
      } else setSuccess(result.message || 'Амжилттай.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (loading) return <Loading />;
  if (demoMode) {
    const next = params.get('next') || '/projects';
    const safeNext = next.startsWith('/') && !next.startsWith('//') &&
      !/^\/(login|register|forgot|reset|verify)([/?#]|$)/.test(next);
    return <Navigate to={safeNext ? next : '/projects'} replace />;
  }
  return (
    <div className="auth-page">
      <aside className="auth-story">
        <Brand />
        <div>
          <span className="eyebrow">САНАА БҮРТ БАГ ХЭРЭГТЭЙ</span>
          <h1>
            Ганцаараа санаачил.
            <br />
            <em>Хамтдаа бүтээ.</em>
          </h1>
          <p>Ур чадвараа нэгтгэж, өөрийн түүхийг эхлүүлээрэй.</p>
          <div className="auth-network">
            <Network size={140} strokeWidth={1} />
          </div>
        </div>
        <span className="auth-footnote">Нэг санаа. Олон боломж. Хамтдаа.</span>
      </aside>
      <main className="auth-form-wrap">
        <Link className="back-link" to="/projects">
          ← Төслүүдтэй танилцах
        </Link>
        <div className="auth-form">
          <h2>{titles[mode]}</h2>
          <p>
            {login
              ? 'Хамтын бүтээлийн орон зайдаа эргэн нэгдээрэй.'
              : register
              ? 'Таны дараагийн бүтээлийн эхний алхам.'
              : 'Бүртгэлийнхээ хандалтыг аюулгүй удирдаарай.'}
          </p>
          {success ? (
            <div className="success-panel">
              <CheckCircle2 size={36} />
              <h3>{success}</h3>
              {localMail && (register || mode === 'forgot') && (
                <p>
                  Имэйл үйлчилгээ тохируулаагүй дотоод орчинд холбоос серверийн терминалд гарна.
                </p>
              )}
              <Link to="/login" className="btn primary">
                Нэвтрэх хуудас руу
              </Link>
            </div>
          ) : (
            <>
              {(login || register) && (
                <>
                  <a
                    className={`btn google-button ${!googleEnabled ? 'disabled' : ''}`}
                    href={googleEnabled ? '/api/auth/google' : undefined}
                    aria-disabled={!googleEnabled}
                  >
                    <b>G</b> Google бүртгэлээр {login ? 'нэвтрэх' : 'бүртгүүлэх'}
                  </a>
                  {!googleEnabled && (
                    <small className="helper">
                      Google нэвтрэлтийг серверийн тохиргоогоор идэвхжүүлнэ.
                    </small>
                  )}
                  <div className="or-divider">
                    <span>эсвэл имэйлээр</span>
                  </div>
                </>
              )}
              <form onSubmit={submit} className="form-stack">
                {register && (
                  <>
                    <label>
                      Таны нэр
                      <input
                        name="name"
                        required
                        minLength={2}
                        maxLength={160}
                        autoComplete="name"
                        placeholder="Овог, нэр"
                      />
                    </label>
                    <div className="form-row">
                      <label>
                        Сургууль
                        <input name="school" required minLength={2} placeholder="МУИС" />
                      </label>
                      <label>
                        Мэргэжил
                        <input name="major" required minLength={2} placeholder="Программ хангамж" />
                      </label>
                    </div>
                  </>
                )}
                {mode !== 'reset' && mode !== 'verify' && (
                  <label>
                    Имэйл хаяг
                    <input
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="name@university.edu.mn"
                    />
                  </label>
                )}
                {passwordNeeded && (
                  <label>
                    Нууц үг
                    <div className="password-field">
                      <input
                        name="password"
                        type={visible ? 'text' : 'password'}
                        required
                        minLength={8}
                        maxLength={128}
                        autoComplete={login ? 'current-password' : 'new-password'}
                        placeholder="Хамгийн багадаа 8 тэмдэгт"
                      />
                      <button
                        type="button"
                        aria-label="Нууц үг харах"
                        onClick={() => setVisible(!visible)}
                      >
                        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </label>
                )}
                {(register || mode === 'reset') && (
                  <label>
                    Нууц үг давтах
                    <input
                      name="confirm"
                      type="password"
                      required
                      minLength={8}
                      autoComplete="new-password"
                    />
                  </label>
                )}
                {login && (
                  <Link className="forgot-link" to="/forgot">
                    Нууц үгээ мартсан уу?
                  </Link>
                )}
                {error && <ErrorState message={error} />}
                <button disabled={busy} className="btn primary full" type="submit">
                  {busy
                    ? 'Түр хүлээнэ үү…'
                    : mode === 'verify'
                    ? 'Баталгаажуулах'
                    : mode === 'forgot'
                    ? 'Холбоос илгээх'
                    : login
                    ? 'Нэвтрэх'
                    : register
                    ? 'Бүртгэл үүсгэх'
                    : 'Нууц үг шинэчлэх'}
                  <ArrowRight size={17} />
                </button>
              </form>
              {(login || register) && (
                <p className="auth-switch">
                  {login ? 'Бүртгэлгүй юу?' : 'Бүртгэлтэй юу?'}{' '}
                  <Link to={login ? `/register?${params}` : `/login?${params}`}>
                    {login ? 'Бүртгүүлэх' : 'Нэвтрэх'}
                  </Link>
                </p>
              )}
              {login && (
                <div className="demo-note">
                  <ShieldCheck size={18} />
                  <div>
                    <b>Туршилтын бүртгэл</b>
                    <p>student@teamup.mn · Teamup123!</p>
                    <small>
                      Эзэмшигч: owner@teamup.mn · Админ: admin@teamup.mn
                      <br />
                      Ижил нууц үгтэй, зохиомол жишээ бүртгэлүүд.
                    </small>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
