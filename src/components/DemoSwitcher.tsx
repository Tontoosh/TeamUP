import { useState } from 'react';
import { post } from '../api';
import { useApp } from '../context';

export function DemoSwitcher() {
  const { demoRole, toast } = useApp();
  const [busy, setBusy] = useState(false);

  return <select
    className="demo-switcher"
    aria-label="Туршилтын хэрэглэгч"
    title="Нэвтрэлт түр алгассан. Туршилтын хэрэглэгч сонгоно уу."
    value={demoRole}
    disabled={busy}
    onChange={async event => {
      const role = event.target.value;
      setBusy(true);
      try {
        await post('/auth/demo-role', { role });
        // Reload all user-scoped state when changing the preview identity.
        window.location.assign(role === 'admin' ? '/admin' : '/projects');
      } catch (error) {
        toast((error as Error).message, true);
        setBusy(false);
      }
    }}
  >
    <option value="student">Туршилт · Оюутан</option>
    <option value="owner">Туршилт · Эзэмшигч</option>
    <option value="admin">Туршилт · Админ</option>
  </select>;
}
