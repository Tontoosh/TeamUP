import { useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowUpRight, Plus, Pencil, Trash2 } from 'lucide-react';
import { api, post, patch } from '../api';
import { useApp } from '../context';
import type { Portfolio } from '../types';
import { Empty, ErrorState, Modal } from './ui';

export function PortfolioList({
  entries,
  own,
  reload,
}: {
  entries: Portfolio[];
  own: boolean;
  reload: () => Promise<void>;
}) {
  const { toast } = useApp();
  const [editing, setEditing] = useState<Portfolio | 'new' | null>(null);
  const [removing, setRemoving] = useState<Portfolio | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (editing && editing !== 'new') await patch(`/users/me/portfolio/${editing.id}`, data);
      else await post('/users/me/portfolio', data);
      setEditing(null);
      toast('Bүтээл хадгалагдлаа.');
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const entry = editing && editing !== 'new' ? editing : undefined;
  return (
    <>
      <div className="space-between">
        <h2>Бүтээлийн сан</h2>
        {own && (
          <button
            className="btn secondary small"
            onClick={() => {
              setEditing('new');
              setError('');
            }}
          >
            <Plus size={15} />
            Бүтээл нэмэх
          </button>
        )}
      </div>
      {!entries.length ? (
        <Empty
          title="Бүтээлийн эхний хуудсаа нээгээрэй"
          text="Төслийн холбоос, оруулсан хувь нэмрээ энд хадгалаарай."
        />
      ) : (
        <div className="portfolio-list">
          {entries.map(item => (
            <div key={item.id} className="portfolio-row">
              <div>
                <a href={item.url} target="_blank" rel="noreferrer">
                  <b>{item.title}</b>
                  <ArrowUpRight size={16} />
                </a>
                <p className="muted preserve-text">{item.contribution}</p>
              </div>
              {own && (
                <div className="inline">
                  <button
                    aria-label="Бүтээл засах"
                    className="icon-btn"
                    onClick={() => {
                      setEditing(item);
                      setError('');
                    }}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    aria-label="Бүтээл устгах"
                    className="icon-btn"
                    onClick={() => setRemoving(item)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {editing && (
        <Modal title={entry ? 'Бүтээл засах' : 'Бүтээл нэмэх'} close={() => setEditing(null)}>
          <form className="form-stack" onSubmit={submit}>
            <label>
              Бүтээлийн нэр
              <input
                name="title"
                defaultValue={entry?.title}
                minLength={2}
                maxLength={200}
                required
              />
            </label>
            <label>
              Холбоос
              <input
                name="url"
                type="url"
                defaultValue={entry?.url}
                placeholder="https://…"
                required
              />
            </label>
            <label>
              Таны оруулсан хувь нэмэр
              <textarea
                name="contribution"
                defaultValue={entry?.contribution}
                rows={3}
                minLength={2}
                maxLength={3000}
                required
              />
            </label>
            {error && <ErrorState message={error} />}
            <button className="btn primary" disabled={busy}>
              Хадгалах
            </button>
          </form>
        </Modal>
      )}
      {removing && (
        <Modal title="Бүтээлийг устгах уу?" close={() => setRemoving(null)}>
          <p>«{removing.title}» бүтээлийг таны сангаас хасна.</p>
          <div className="form-actions">
            <button className="btn secondary" onClick={() => setRemoving(null)}>
              Цуцлах
            </button>
            <button
              className="btn danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api(`/users/me/portfolio/${removing.id}`, { method: 'DELETE' });
                  setRemoving(null);
                  await reload();
                } catch (err) {
                  toast((err as Error).message, true);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Устгах
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
