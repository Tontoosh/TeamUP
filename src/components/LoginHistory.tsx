import '../styles/login-history.css';
import { useApi } from '../hooks';
import { date } from '../api';
import { Empty, ErrorState, Loading } from './ui';

type LoginAttempt = { id: string; outcome: string; created_at: string };
const labels: Record<string, string> = {
  success: 'Амжилттай', invalid_credentials: 'Имэйл эсвэл нууц үг буруу',
  unverified: 'Имэйл баталгаажаагүй', suspended: 'Эрх түдгэлзсэн',
};
export function LoginHistory() {
  const history = useApi<LoginAttempt[]>('/auth/login-history');
  return (
    <section className="panel section-gap login-history">
      <div className="space-between">
        <h2>Нэвтрэх түүх</h2>
        <button className="btn secondary small" onClick={() => void history.reload()}>Шинэчлэх</button>
      </div>
      <p className="muted">Таны сүүлийн 50 нэвтрэх оролдлого.</p>
      {history.loading ? <Loading /> : history.error ? <ErrorState message={history.error} />
        : !history.data?.length ? <Empty title="Нэвтрэх түүх алга" />
        : history.data.map(attempt => (
          <div className="member-row" key={attempt.id}>
            <span>{labels[attempt.outcome] || 'Тодорхойгүй оролдлого'}</span>
            <time dateTime={attempt.created_at}>{date(attempt.created_at)}</time>
          </div>
        ))}
    </section>
  );
}
