import { useState } from 'react';
import type { FormEvent } from 'react';
import { post } from '../api';
import { useApp } from '../context';
import { Modal, ErrorState } from './ui';

export function ReportDialog({
  type,
  targetId,
  close,
}: {
  type: string;
  targetId: string;
  close: () => void;
}) {
  const { toast } = useApp();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await post('/community/reports', { ...data, target_type: type, target_id: targetId });
      toast('Зөрчлийн мэдээллийг хүлээн авлаа.');
      close();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Зөрчил мэдээлэх" close={close}>
      <form className="form-stack" onSubmit={submit}>
        <p className="muted">Мэдээллийг администратор шалгаж, шийдвэрлэнэ.</p>
        <label>
          Шалтгаан
          <select name="reason">
            <option>Зохисгүй контент</option>
            <option>Худал мэдээлэл</option>
            <option>Спам, зар сурталчилгаа</option>
            <option>Бусад зөрчил</option>
          </select>
        </label>
        <label>
          Дэлгэрэнгүй тайлбар
          <textarea name="description" minLength={10} maxLength={3000} rows={4} required />
        </label>
        {error && <ErrorState message={error} />}
        <button className="btn primary" disabled={busy}>
          Мэдээлэл илгээх
        </button>
      </form>
    </Modal>
  );
}
