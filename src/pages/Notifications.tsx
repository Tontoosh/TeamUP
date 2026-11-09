import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, ArrowUpRight } from 'lucide-react';
import { date, patch } from '../api';
import { useApi } from '../hooks';
import { useApp } from '../context';
import type { Notification } from '../types';
import { Empty, ErrorState, Loading, PageTitle } from '../components/ui';

export function Notifications() {
  const [unread, setUnread] = useState(false);
  const { data, loading, error, reload } = useApi<{ items: Notification[]; unread: number }>(
    `/community/notifications?unread=${unread}`,
    10000
  );
  const { toast } = useApp();
  const navigate = useNavigate();
  const mark = async (id?: string) => {
    try {
      await patch('/community/notifications/read', { id });
      await reload();
    } catch (err) {
      toast((err as Error).message, true);
    }
  };
  return (
    <>
      <PageTitle
        eyebrow="ХОЛБООТОЙ БАЙГААРАЙ"
        title="Мэдэгдэл"
        description={`${data?.unread || 0} уншаагүй мэдэгдэл байна.`}
      >
        <button className="btn secondary" onClick={() => mark()}>
          <CheckCheck size={17} />
          Бүгдийг уншсанаар тэмдэглэх
        </button>
      </PageTitle>
      <div className="tabs">
        <button className={!unread ? 'active' : ''} onClick={() => setUnread(false)}>
          Бүгд
        </button>
        <button className={unread ? 'active' : ''} onClick={() => setUnread(true)}>
          Уншаагүй
        </button>
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} retry={reload} />
      ) : !data?.items.length ? (
        <Empty
          title="Шинэ мэдэгдэл алга"
          text="Хүсэлт, төслийн өөрчлөлт, багийн мессежийн мэдэгдэл энд харагдана."
        />
      ) : (
        <div className="panel notification-list">
          {data.items.map(item => (
            <button
              className={`notification-row ${!item.is_read ? 'unread' : ''}`}
              key={item.id}
              onClick={async () => {
                await mark(item.id);
                navigate(item.link);
              }}
            >
              <span className="notification-icon">
                <Bell size={19} />
              </span>
              <span>
                <b>{item.title}</b>
                <small>{date(item.created_at)}</small>
              </span>
              {!item.is_read && <i className="live-dot" />}
              <ArrowUpRight size={16} />
            </button>
          ))}
        </div>
      )}
    </>
  );
}
