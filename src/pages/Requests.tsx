import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, Check, MessageCircle, X } from 'lucide-react';
import { post, date } from '../api';
import { useApi } from '../hooks';
import { useApp } from '../context';
import type { Application } from '../types';
import { Avatar, Badge, Empty, ErrorState, Loading, Modal, PageTitle } from '../components/ui';

export function Requests() {
  const [params, setParams] = useSearchParams();
  const incoming = params.get('tab') === 'incoming';
  const [status, setStatus] = useState('');
  const { data, loading, error, reload } = useApi<Application[]>(
    `/applications?incoming=${incoming}&status=${status}`
  );
  const { toast } = useApp();
  const [dialog, setDialog] = useState<{ request: Application; action: string } | null>(null);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const titles: Record<string, string> = {
    accepted: 'Хүсэлт зөвшөөрөх',
    rejected: 'Хүсэлтэд татгалзах',
    info: 'Нэмэлт мэдээлэл хүсэх',
    reply: 'Нэмэлт мэдээлэл өгөх',
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!dialog) return;
    setBusy(true);
    setFormError('');
    const value = new FormData(event.currentTarget).get('reason');
    try {
      await post(
        `/applications/${dialog.request.id}/${dialog.action === 'reply' ? 'reply' : 'decision'}`,
        dialog.action === 'reply'
          ? { answer: value }
          : { action: dialog.action, reason: value || '' }
      );
      setDialog(null);
      toast('Хүсэлтийн төлөв шинэчлэгдлээ.');
      await reload();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const open = (request: Application, action: string) => {
    setDialog({ request, action });
    setFormError('');
  };
  return (
    <>
      <PageTitle
        eyebrow="ЗӨВ ХҮМҮҮС. ШИНЭ БОЛОМЖ."
        title="Хүсэлтүүд"
        description="Хамтран ажиллах дараагийн алхмаа эндээс удирдаарай."
      />
      <div className="list-toolbar">
        <div className="tabs">
          <button className={!incoming ? 'active' : ''} onClick={() => setParams({})}>
            <ArrowUpRight size={17} />
            Миний хүсэлтүүд
          </button>
          <button
            className={incoming ? 'active' : ''}
            onClick={() => setParams({ tab: 'incoming' })}
          >
            <ArrowDownLeft size={17} />
            Ирсэн хүсэлтүүд
          </button>
        </div>
        <select
          aria-label="Хүсэлтийн төлөв"
          value={status}
          onChange={event => setStatus(event.target.value)}
        >
          <option value="">Бүх төлөв</option>
          <option value="pending">Хүлээгдэж буй</option>
          <option value="info">Нэмэлт мэдээлэл</option>
          <option value="accepted">Зөвшөөрсөн</option>
          <option value="rejected">Татгалзсан</option>
          <option value="invalidated">Хүчингүй</option>
        </select>
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} retry={reload} />
      ) : !data?.length ? (
        <Empty
          title="Хүсэлт алга байна"
          text={
            incoming
              ? 'Таны төслүүдэд ирсэн хүсэлтүүд энд харагдана.'
              : 'Сонирхсон төслөө олж, багт нэгдэх хүсэлт илгээгээрэй.'
          }
        >
          <Link className="btn primary" to="/projects">
            Төсөл хайх
          </Link>
        </Empty>
      ) : (
        <div className="request-list">
          {data.map(request => (
            <article className="panel request-card" key={request.id}>
              <div className="space-between">
                <Link className="person" to={`/people/${request.user_id}`}>
                  <Avatar name={request.user.name} />
                  <span>
                    <b>{incoming ? request.user.name : request.project.name}</b>
                    <small>{request.role}</small>
                  </span>
                </Link>
                <Badge status={request.status} />
              </div>
              <Link className="text-btn" to={`/projects/${request.project_id}`}>
                {request.project.name} ↗
              </Link>
              <p className="preserve-text">{request.introduction}</p>
              {request.question && (
                <div className="quote">
                  <b>Эзэмшигчийн асуулт</b>
                  <p>{request.question}</p>
                  {request.answer && (
                    <>
                      <b>Хариулт</b>
                      <p>{request.answer}</p>
                    </>
                  )}
                </div>
              )}
              {request.reason && <p className="muted">Шалтгаан: {request.reason}</p>}
              <div className="request-footer">
                <small className="muted">{date(request.created_at)}</small>
                <div className="inline wrap">
                  {incoming && ['pending', 'info'].includes(request.status) && (
                    <>
                      <button
                        className="btn primary small"
                        disabled={request.status === 'info'}
                        onClick={() => open(request, 'accepted')}
                      >
                        <Check size={15} />
                        Зөвшөөрөх
                      </button>
                      <button
                        className="btn secondary small"
                        disabled={request.status === 'info'}
                        onClick={() => open(request, 'info')}
                      >
                        <MessageCircle size={15} />
                        Нэмэлт мэдээлэл
                      </button>
                      <button
                        className="btn danger small"
                        onClick={() => open(request, 'rejected')}
                      >
                        <X size={15} />
                        Татгалзах
                      </button>
                    </>
                  )}
                  {!incoming && request.status === 'info' && (
                    <button className="btn primary small" onClick={() => open(request, 'reply')}>
                      Хариу өгөх
                    </button>
                  )}
                  {!incoming && request.status === 'accepted' && (
                    <Link to={`/chat?project=${request.project_id}`} className="btn primary small">
                      Багийн чат руу
                    </Link>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {dialog && (
        <Modal title={titles[dialog.action]} close={() => setDialog(null)}>
          <form className="form-stack" onSubmit={submit}>
            <p>
              {dialog.request.user.name} · {dialog.request.role}
            </p>
            {dialog.action === 'accepted' ? (
              <p className="muted">
                Зөвшөөрөхөд хэрэглэгч багийн гишүүн болж, чатад хандах эрхтэй болно.
              </p>
            ) : (
              <label>
                {dialog.action === 'info'
                  ? 'Асуух зүйл'
                  : dialog.action === 'reply'
                  ? 'Таны хариулт'
                  : 'Татгалзах шалтгаан'}
                <textarea name="reason" minLength={3} maxLength={3000} rows={4} required />
              </label>
            )}
            {formError && <ErrorState message={formError} />}
            <button disabled={busy} className="btn primary">
              {titles[dialog.action]}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
