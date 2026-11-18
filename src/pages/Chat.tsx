import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { File, Flag, Hash, Paperclip, Send, X, Users } from 'lucide-react';
import { api, date } from '../api';
import { useApi } from '../hooks';
import { useApp } from '../context';
import type { Message, Page, Project } from '../types';
import { Avatar, Empty, ErrorState, Loading, PageTitle } from '../components/ui';
import { ReportDialog } from '../components/ReportDialog';

function MessageBody({ body }: { body: string }) {
  return (
    <>
      {body.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noreferrer">
            {part}
          </a>
        ) : (
          part
        )
      )}
    </>
  );
}
export function Chat() {
  const { user, toast } = useApp();
  const [params, setParams] = useSearchParams();
  const teams = useApi<Page<Project>>('/projects?mine=true&size=24');
  const projectId = params.get('project') || teams.data?.items[0]?.id;
  const { data, error, loading, reload } = useApi<{ project: Project; messages: Message[] }>(
    projectId ? `/chat/${projectId}` : null,
    4000
  );
  const { data: config } = useApi<{ maxMb: number; types: string }>('/chat/config');
  const [body, setBody] = useState('');
  const [file, setFile] = useState<globalThis.File | null>(null);
  const [busy, setBusy] = useState(false);
  const [reportId, setReportId] = useState('');
  const bottom = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'instant', block: 'nearest' });
  }, [data?.messages.length, projectId]);
  useEffect(() => {
    setBody('');
    setFile(null);
  }, [projectId]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!body.trim() && !file) return;
    setBusy(true);
    const form = new FormData();
    form.set('body', body);
    if (file) form.set('file', file);
    try {
      await api(`/chat/${projectId}`, { method: 'POST', body: form });
      setBody('');
      setFile(null);
      if (fileInput.current) fileInput.current.value = '';
      await reload();
    } catch (err) {
      toast((err as Error).message + ' Мессеж, файл хадгалагдсан тул дахин илгээж болно.', true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageTitle
        eyebrow="ХАМТЫН АЖЛЫН ОРОН ЗАЙ"
        title="Багийн чат"
        description="Санаагаа ярилцаж, материалаа хуваалцаж, хамтдаа урагшлаарай."
      />
      {teams.loading ? (
        <Loading />
      ) : teams.error ? (
        <ErrorState message={teams.error} />
      ) : !teams.data?.items.length ? (
        <Empty
          title="Одоогоор багт нэгдээгүй байна"
          text="Төсөлд нэгдсэний дараа багийн чат нээгдэнэ."
        >
          <Link to="/projects" className="btn primary">
            Төсөл хайх
          </Link>
        </Empty>
      ) : (
        <div className="chat-layout panel">
          <aside className="chat-channels">
            <span className="nav-label">МИНИЙ БАГУУД</span>
            {teams.data.items.map(project => (
              <button
                key={project.id}
                className={projectId === project.id ? 'selected' : ''}
                onClick={() => setParams({ project: project.id })}
              >
                <Hash size={18} />
                <span>{project.name}</span>
              </button>
            ))}
          </aside>
          <div className="chat-main">
            <header className="chat-heading">
              <div>
                <Hash size={21} />
                <b>{data?.project.name || 'Багийн хэлэлцүүлэг'}</b>
              </div>
              <Link to={`/projects/${projectId}`} aria-label="Багийн гишүүд">
                <Users size={20} />
              </Link>
            </header>
            {loading ? (
              <Loading />
            ) : error ? (
              <ErrorState message={error} retry={reload} />
            ) : (
              <>
                <div className="chat-messages">
                  {data?.messages.length ? (
                    data.messages.map(message => (
                      <div
                        className={`message ${message.user_id === user?.id ? 'mine' : ''}`}
                        key={message.id}
                      >
                        <Avatar name={message.user.name} />
                        <div className="message-content">
                          <div className="message-meta">
                            <b>{message.user.name}</b>
                            <small>{date(message.created_at)}</small>
                            <button
                              className="icon-btn"
                              aria-label="Мессеж мэдээлэх"
                              onClick={() => setReportId(message.id)}
                            >
                              <Flag size={13} />
                            </button>
                          </div>
                          <div className="message-bubble">
                            <p className="preserve-text">
                              <MessageBody body={message.body} />
                            </p>
                            {message.attachments.map(attachment => (
                              <a
                                className="attachment"
                                href={`/api/chat/files/${attachment.id}`}
                                key={attachment.id}
                              >
                                <File size={22} />
                                <span>
                                  {attachment.name}
                                  <small>
                                    {(attachment.size / 1024).toFixed(1)} KB · Татаж авах
                                  </small>
                                </span>
                                ↓
                              </a>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <Empty title="Эхний яриаг эхлүүлээрэй" />
                  )}
                  <div ref={bottom} />
                </div>
                {['archived', 'completed'].includes(data?.project.status || '') ? (
                  <div className="info-banner">
                    Энэ төсөл дууссан эсвэл архивлагдсан. Чат зөвхөн унших горимтой.
                  </div>
                ) : (
                  <form className="chat-composer" onSubmit={submit}>
                    {file && (
                      <div className="selected-file">
                        <Paperclip size={15} />
                        {file.name}
                        <button
                          type="button"
                          aria-label="Файл хасах"
                          onClick={() => {
                            setFile(null);
                            if (fileInput.current) fileInput.current.value = '';
                          }}
                        >
                          <X size={15} />
                        </button>
                      </div>
                    )}
                    <div className="composer-row">
                      <input
                        ref={fileInput}
                        id="chat-file"
                        type="file"
                        accept={config?.types}
                        hidden
                        onChange={event => {
                          const selected = event.target.files?.[0];
                          if (selected && selected.size > (config?.maxMb || 10) * 1024 * 1024) {
                            toast('Файлын хэмжээ хэтэрсэн.', true);
                            event.target.value = '';
                            return;
                          }
                          setFile(selected || null);
                        }}
                      />
                      <label className="icon-btn" htmlFor="chat-file" title="Файл хавсаргах">
                        <Paperclip size={20} />
                        <span className="sr-only">Файл хавсаргах</span>
                      </label>
                      <textarea
                        aria-label="Мессеж"
                        placeholder="Багийнхантайгаа санаагаа хуваалцаарай…"
                        rows={2}
                        value={body}
                        maxLength={5000}
                        onChange={event => setBody(event.target.value)}
                      />
                      <button
                        className="btn primary"
                        type="submit"
                        disabled={busy || (!body.trim() && !file)}
                        aria-label="Мессеж илгээх"
                      >
                        <Send size={18} />
                      </button>
                    </div>
                    <small className="helper">
                      {busy
                        ? 'Илгээж байна…'
                        : `Текст, холбоос эсвэл файл · ${config?.maxMb || 10} MB хүртэл`}
                    </small>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      )}
      {reportId && (
        <ReportDialog type="message" targetId={reportId} close={() => setReportId('')} />
      )}
    </>
  );
}
