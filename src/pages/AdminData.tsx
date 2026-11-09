import { useState } from 'react';
import { Download, Upload, FileSpreadsheet } from 'lucide-react';
import { post } from '../api';
import { useApp } from '../context';
import { ErrorState } from '../components/ui';

interface Preview {
  count: number;
  rows: { code: string; name: string; type: string }[];
}
export function AdminData() {
  const { toast } = useApp();
  const [csv, setCsv] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="data-layout">
      <section className="panel form-stack">
        <Download size={26} />
        <h2>Тайлан экспортлох</h2>
        <p className="muted">10,000 хүртэл мөрийг UTF-8 CSV хэлбэрээр татна.</p>
        <form action="/api/admin/export" className="form-stack">
          <label>
            Тайлангийн төрөл
            <select name="kind">
              <option value="projects">Төслүүд</option>
              <option value="users">Хэрэглэгчид</option>
              <option value="reports">Зөрчлүүд</option>
              <option value="audit">Аудитын түүх</option>
            </select>
          </label>
          <div className="form-row">
            <label>
              Эхлэх огноо
              <input type="date" name="from" />
            </label>
            <label>
              Дуусах огноо
              <input type="date" name="to" />
            </label>
          </div>
          <label>
            Төлөв
            <select name="status">
              <option value="">Бүгд</option>
              <option value="open">Нээлттэй</option>
              <option value="closed">Хаалттай</option>
              <option value="archived">Архивласан</option>
              <option value="active">Идэвхтэй</option>
              <option value="suspended">Түдгэлзсэн</option>
              <option value="pending">Хүлээгдэж буй</option>
              <option value="resolved">Шийдвэрлэсэн</option>
            </select>
          </label>
          <button className="btn primary">
            <Download size={16} />
            CSV татах
          </button>
        </form>
      </section>
      <section className="panel form-stack">
        <Upload size={26} />
        <h2>Лавлах өгөгдөл импортлох</h2>
        <p className="muted">
          CSV багана: <code>code,name,type</code>. Төрөл нь <code>category</code> эсвэл{' '}
          <code>skill</code>. 5,000 хүртэл мөрийг нэг гүйлгээгээр хадгална.
        </p>
        <label className="file-drop">
          <FileSpreadsheet size={30} />
          <span>CSV файл сонгох</span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={async event => {
              setPreview(null);
              setError('');
              const file = event.target.files?.[0];
              if (!file) {
                setCsv('');
                return;
              }
              if (file.size > 2000000) {
                setError('Файл 2 MB-аас их байна.');
                return;
              }
              setCsv(await file.text());
            }}
          />
        </label>
        <textarea
          aria-label="CSV агуулга"
          rows={5}
          value={csv}
          placeholder={'code,name,type\nnew-skill,Шинэ ур чадвар,skill'}
          onChange={event => {
            setCsv(event.target.value);
            setPreview(null);
          }}
        />
        {error && <ErrorState message={error} />}
        <button
          className="btn secondary"
          disabled={!csv || busy}
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              setPreview(
                await post<Preview>('/admin/import/preview', { csv })
              );
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Шалгаж, урьдчилан харах
        </button>
        {preview && (
          <>
            <p className="match-reason">✓ {preview.count} мөр хүчинтэй. Эхний 20 хүртэл мөр:</p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>code</th>
                    <th>name</th>
                    <th>type</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map(row => (
                    <tr key={row.code}>
                      <td>{row.code}</td>
                      <td>{row.name}</td>
                      <td>{row.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              className="btn primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  await post('/admin/import', { csv });
                  toast(`${preview.count} мөр импортлогдлоо.`);
                  setPreview(null);
                  setCsv('');
                } catch (err) {
                  setError((err as Error).message);
                  setPreview(null);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Баталгаажуулж импортлох
            </button>
          </>
        )}
      </section>
    </div>
  );
}
