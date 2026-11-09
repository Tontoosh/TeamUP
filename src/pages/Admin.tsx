import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, FolderKanban, Flag, ShieldCheck, Search } from 'lucide-react';
import { date } from '../api';
import { useApi } from '../hooks';
import { AdminReport } from '../components/AdminReport';
import { useApp } from '../context';
import type { Audit, Project, Report, User } from '../types';
import { Badge, Empty, ErrorState, Loading, PageTitle, Pagination } from '../components/ui';
import { AdminData } from './AdminData';

export function Admin() {
  const { user } = useApp();
  const { data, error, loading, reload } = useApi<{
    users: User[];
    projects: Project[];
    reports: Report[];
    audit: Audit[];
  }>(user?.role === 'admin' ? '/admin/overview' : null);
  const [tab, setTab] = useState('reports');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [report, setReport] = useState<Report | null>(null);
  if (user?.role !== 'admin') return <ErrorState message="Администраторын эрх шаардлагатай." />;
  const filter = (value: { status: string }) =>
    (!status || value.status === status) &&
    JSON.stringify(value)
      .toLowerCase()
      .includes(q.toLowerCase());
  const list =
    tab === 'users'
      ? data?.users.filter(filter)
      : tab === 'projects'
      ? data?.projects.filter(filter)
      : data?.reports.filter(filter);
  const items = list?.slice((page - 1) * 10, page * 10);
  return (
    <>
      <PageTitle
        eyebrow="АДМИНИСТРАТОРЫН ТАНХИМ"
        title="Платформын хяналт"
        description="Хэрэглэгч, төслүүд, зөрчил болон өгөгдлийг удирдах."
      />
      <div className="stats-grid">
        {[
          [Users, 'Хэрэглэгчид', data?.users.length],
          [FolderKanban, 'Төслүүд', data?.projects.length],
          [Flag, 'Хүлээгдэж буй зөрчил', data?.reports.filter(r => r.status === 'pending').length],
          [ShieldCheck, 'Аудитын бүртгэл', data?.audit.length],
        ].map(([Icon, label, count], index) => {
          const Component = Icon as typeof Users;
          return (
            <div className="panel stat-card" key={index}>
              <Component size={22} />
              <span>{String(label)}</span>
              <b>{count === undefined ? '…' : String(count)}</b>
            </div>
          );
        })}
      </div>
      <div className="tabs">
        {[
          ['reports', 'Зөрчлийн мэдээлэл'],
          ['users', 'Хэрэглэгчид'],
          ['projects', 'Төслүүд'],
          ['audit', 'Аудитын түүх'],
          ['data', 'Өгөгдөл'],
        ].map(([value, label]) => (
          <button
            key={value}
            className={tab === value ? 'active' : ''}
            onClick={() => {
              setTab(value);
              setPage(1);
              setStatus('');
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} retry={reload} />
      ) : tab === 'data' ? (
        <AdminData />
      ) : tab === 'audit' ? (
        <div className="panel">
          {!data?.audit.length ? (
            <Empty title="Аудитын бүртгэл алга" />
          ) : (
            data.audit.map(entry => (
              <div className="audit-entry" key={entry.id}>
                <div className="space-between">
                  <b>
                    {entry.action} · {entry.target_type}
                  </b>
                  <small>{date(entry.created_at)}</small>
                </div>
                <p>{entry.reason}</p>
                <small className="muted">
                  Админ: {data.users.find(item => item.id === entry.admin_id)?.name} ·{' '}
                  {entry.target_id}
                </small>
                <pre>
                  {entry.before_state} → {entry.after_state}
                </pre>
              </div>
            ))
          )}
        </div>
      ) : (
        <>
          <div className="list-toolbar">
            <label className="search-field">
              <Search size={18} />
              <input
                aria-label="Админ хайлт"
                placeholder="Нэр, түлхүүр үгээр хайх…"
                value={q}
                onChange={event => {
                  setQ(event.target.value);
                  setPage(1);
                }}
              />
            </label>
            <select
              aria-label="Төлөвөөр шүүх"
              value={status}
              onChange={event => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Бүх төлөв</option>
              {(tab === 'users'
                ? ['active', 'suspended']
                : tab === 'projects'
                ? ['open', 'closed', 'archived']
                : ['pending', 'resolved']
              ).map(value => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </div>
          <div className="panel table-scroll">
            {!items?.length ? (
              <Empty title="Үр дүн олдсонгүй" />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>{tab === 'reports' ? 'Шалтгаан' : 'Нэр'}</th>
                    <th>Төрөл / мэдээлэл</th>
                    <th>Төлөв</th>
                    <th>Үйлдэл</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id}>
                      <td>{'name' in item ? item.name : item.reason}</td>
                      <td>
                        {'school' in item
                          ? item.school
                          : 'category' in item
                          ? item.category
                          : item.target_type}
                      </td>
                      <td>
                        <Badge status={item.status} />
                      </td>
                      <td>
                        {tab === 'reports' ? (
                          <button
                            className="text-btn"
                            onClick={() => {
                              setReport(item as Report);
                            }}
                          >
                            Шалгах ↗
                          </button>
                        ) : (
                          <Link
                            className="text-btn"
                            to={`/${tab === 'users' ? 'people' : 'projects'}/${item.id}`}
                          >
                            Дэлгэрэнгүй ↗
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <Pagination page={page} pages={Math.ceil((list?.length || 0) / 10)} change={setPage} />
        </>
      )}
      {report && (
        <AdminReport
          report={report}
          users={data?.users || []}
          close={() => setReport(null)}
          resolved={reload}
        />
      )}
    </>
  );
}
