import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { ArrowRight, Inbox, LoaderCircle, X, Network } from 'lucide-react';
import { Link } from 'react-router-dom';

export const statusLabels: Record<string, string> = {
  open: 'Нээлттэй',
  closed: 'Хаалттай',
  archived: 'Архивласан',
  pending: 'Хүлээгдэж буй',
  info: 'Нэмэлт мэдээлэл',
  accepted: 'Зөвшөөрсөн',
  rejected: 'Татгалзсан',
  invalidated: 'Хүчингүй',
  active: 'Идэвхтэй',
  suspended: 'Түдгэлзсэн',
  resolved: 'Шийдвэрлэсэн',
};
export function Badge({ status }: { status: string }) {
  return (
    <span className={`badge ${status}`}>
      <i />
      {statusLabels[status] || status}
    </span>
  );
}
export function Avatar({ name, size = '' }: { name: string; size?: string }) {
  return (
    <span
      className={`avatar ${size}`}
      style={
        {
          '--avatar-hue': `${[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 300}`,
        } as React.CSSProperties
      }
    >
      {name.replace(/^[А-ЯA-Z]\.\s*/, '').slice(0, 2)}
    </span>
  );
}
export function Brand() {
  return (
    <Link className="brand" to="/">
      <span className="brand-mark">
        <Network size={25} />
      </span>
      <span>
        Хамтдаа<small>ОЮУТНЫ СТАРТАП НЭГДЭЛ</small>
      </span>
    </Link>
  );
}
export function Tags({ items }: { items: string[] }) {
  return (
    <div className="tags">
      {items.map(item => (
        <span key={item}>{item}</span>
      ))}
    </div>
  );
}
export function Empty({
  title = 'Одоогоор мэдээлэл алга',
  text,
  children,
}: {
  title?: string;
  text?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Inbox size={30} />
      </span>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {children}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" /> Ачаалж байна…
    </div>
  );
}
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="error-box" role="alert">
      {message}
      {retry && (
        <button className="btn ghost" onClick={retry}>
          Дахин оролдох
        </button>
      )}
    </div>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}
export function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={close}
      onClick={event => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button className="icon-btn" onClick={close} aria-label="Хаах">
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Pagination({
  page,
  pages,
  change,
}: {
  page: number;
  pages: number;
  change: (page: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <div className="pagination">
      <button disabled={page <= 1} onClick={() => change(page - 1)}>
        ← Өмнөх
      </button>
      <span>
        {page} / {pages}
      </span>
      <button disabled={page >= pages} onClick={() => change(page + 1)}>
        Дараах <ArrowRight size={14} />
      </button>
    </div>
  );
}
