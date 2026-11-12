import { useState } from 'react';
import { LoginHistory } from '../components/LoginHistory';
import { Link } from 'react-router-dom';
import { ShieldBan } from 'lucide-react';
import { api } from '../api';
import { useApi } from '../hooks';
import { useApp } from '../context';
import type { Report, User } from '../types';
import { Avatar, Badge, Empty, ErrorState, Loading, Modal, PageTitle } from '../components/ui';

export function Settings() {
  const blocks = useApi<{ target_id: string; user: User }[]>('/community/blocks');
  const reports = useApi<Report[]>('/community/reports');
  const { toast } = useApp();
  const [target, setTarget] = useState('');
  return (
    <>
      <PageTitle
        eyebrow="ТАНЫ УДИРДЛАГАД"
        title="Нууцлал ба аюулгүй байдал"
        description="Блоклосон хэрэглэгчид болон илгээсэн зөрчлийн мэдээлэл."
      />
      <section className="panel">
        <h2>
          <ShieldBan size={20} />
          Блоклосон хэрэглэгчид
        </h2>
        {blocks.loading ? (
          <Loading />
        ) : blocks.error ? (
          <ErrorState message={blocks.error} />
        ) : !blocks.data?.length ? (
          <Empty
            title="Блоклосон хэрэглэгч байхгүй"
            text="Хэрэглэгчийн профайл дээрээс блоклох тохиргоог ашиглана."
          />
        ) : (
          blocks.data.map(block => (
            <div className="member-row" key={block.target_id}>
              <Link to={`/people/${block.target_id}`} className="person">
                <Avatar name={block.user.name} />
                <b>{block.user.name}</b>
              </Link>
              <button className="btn secondary small" onClick={() => setTarget(block.target_id)}>
                Блок цуцлах
              </button>
            </div>
          ))
        )}
      </section>
      <section className="panel section-gap">
        <h2>Миний илгээсэн зөрчлүүд</h2>
        {reports.loading ? (
          <Loading />
        ) : reports.error ? (
          <ErrorState message={reports.error} />
        ) : !reports.data?.length ? (
          <Empty title="Зөрчлийн мэдээлэл алга" />
        ) : (
          reports.data.map(report => (
            <div className="report-row" key={report.id}>
              <div className="space-between">
                <h3>{report.reason}</h3>
                <Badge status={report.status} />
              </div>
              <p>{report.description}</p>
              {report.decision && <p className="muted">Шийдвэр: {report.decision}</p>}
            </div>
          ))
        )}
      </section>
      <LoginHistory />
      {target && (
        <Modal title="Блок цуцлах уу?" close={() => setTarget('')}>
          <p>Энэ хэрэглэгчтэй шинэ хүсэлт солилцох боломжтой болно.</p>
          <button
            className="btn primary"
            onClick={async () => {
              try {
                await api(`/community/blocks/${target}`, { method: 'DELETE' });
                setTarget('');
                await blocks.reload();
                toast('Блок цуцлагдлаа.');
              } catch (err) {
                toast((err as Error).message, true);
              }
            }}
          >
            Блок цуцлах
          </button>
        </Modal>
      )}
    </>
  );
}
