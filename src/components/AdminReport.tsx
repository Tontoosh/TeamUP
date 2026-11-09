import { useState } from 'react';
import type { FormEvent } from 'react';
import { useApi } from '../hooks';
import { useApp } from '../context';
import { date, post } from '../api';
import type { Audit, Report, User } from '../types';
import { Badge, ErrorState, Loading, Modal } from './ui';

interface ReportContext {
  content: { name?: string; description?: string; body?: string; bio?: string } | null;
  audit: Audit[];
}
export function AdminReport({
  report,
  users,
  close,
  resolved,
}: {
  report: Report;
  users: User[];
  close: () => void;
  resolved: () => Promise<void>;
}) {
  const { data, loading, error } = useApi<ReportContext>(`/admin/reports/${report.id}`);
  const { toast } = useApp();
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setFormError('');
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await post(`/admin/reports/${report.id}/resolve`, values);
      toast('Шийдвэр болон аудит хадгалагдлаа.');
      await resolved();
      close();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const content = data?.content;
  return (
    <Modal title="Зөрчлийг шалгах" close={close}>
      <div className="form-stack">
        <Badge status={report.status} />
        <h3>{report.reason}</h3>
        <p>{report.description}</p>
        <small className="muted">
          Илгээгч: {users.find(item => item.id === report.user_id)?.name} ·{' '}
          {date(report.created_at)}
        </small>
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorState message={error} />
        ) : (
          <>
            <div className="quote">
              <b>Контентын агуулга</b>
              {content?.name && <h3>{content.name}</h3>}
              <p>
                {content?.description ||
                  content?.body ||
                  content?.bio ||
                  'Текстэн агуулга оруулаагүй.'}
              </p>
              <small>
                {report.target_type} · {report.target_id}
              </small>
            </div>
            {report.status === 'pending' ? (
              <form className="form-stack" onSubmit={submit}>
                <label>
                  Шийдвэр
                  <select name="action">
                    {report.target_type === 'user' ? (
                      <option value="suspend">Эрх түр түдгэлзүүлэх</option>
                    ) : (
                      <>
                        <option value="hide">Контент нуух</option>
                        <option value="delete">Контент устгах</option>
                      </>
                    )}
                    <option value="dismiss">Зөрчилгүй гэж хаах</option>
                  </select>
                </label>
                <label>
                  Шийдвэрийн шалтгаан
                  <textarea name="reason" required minLength={3} maxLength={3000} rows={3} />
                </label>
                <small className="helper">
                  Баталгаажуулснаар шийдвэр хэрэгжиж, админ, огноо, шалтгаан, өмнөх/шинэ төлөв
                  аудитад хадгалагдана.
                </small>
                {formError && <ErrorState message={formError} />}
                <button className="btn danger" disabled={busy}>
                  Шийдвэрийг баталгаажуулах
                </button>
              </form>
            ) : (
              <p>Шийдвэр: {report.decision}</p>
            )}
            {data?.audit.map(entry => (
              <div className="audit-entry" key={entry.id}>
                <b>{entry.action}</b>
                <p>{entry.reason}</p>
                <small>
                  {users.find(user => user.id === entry.admin_id)?.name} · {date(entry.created_at)}
                </small>
                <pre>
                  {entry.before_state} → {entry.after_state}
                </pre>
              </div>
            ))}
          </>
        )}
      </div>
    </Modal>
  );
}
