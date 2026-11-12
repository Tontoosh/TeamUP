// Write canonical scalar fields back to the original normalized records.
// Passwords and UI-only fields remain in the plural application tables.
export function installSourceWrites(db) {
  db.sourceUpdate = async (table, id, values) => {
    const project = /^sql-project-(\d+)$/.exec(id);
    const application = /^sql-application-(\d+)$/.exec(id);
    const set = async (target, key, keyValue, fields) => {
      if (!Object.keys(fields).length) return;
      await db.run(`UPDATE ${target} SET ${Object.keys(fields).map(k => `[${k}] = ?`).join(',')} WHERE [${key}] = ?`, [...Object.values(fields), keyValue]);
    };
    if (table === 'projects' && project) {
      const fields = {};
      if ('name' in values) fields.title = values.name;
      if ('description' in values) fields.description = values.description;
      if ('project_type' in values) fields.work_mode = values.project_type;
      if ('status' in values) {
        const checks = await db.all("SELECT definition FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID(N'dbo.Project') AND definition LIKE '%status%'");
        const allowed = checks.flatMap(c => [...c.definition.matchAll(/'([^']+)'/g)].map(m => m[1]));
        const candidates = values.status === 'open' ? ['recruiting','open'] : values.status === 'archived' ? ['archived','cancelled','completed','closed'] : ['closed','completed','paused'];
        const status = candidates.find(s => allowed.includes(s));
        if (status) fields.status = status;
        // If the source has no matching lifecycle state, the app status is an overlay.
      }
      await set('dbo.Project','project_id',Number(project[1]),fields);
    }
    if (table === 'users') {
      const source = await db.get('SELECT u.user_id FROM dbo.[User] u JOIN dbo.users a ON a.email=u.email WHERE a.id = ?', [id]);
      if (!source) return;
      if ('name' in values) await set('dbo.[User]','user_id',source.user_id,{ display_name: values.name });
      const fields = {};
      if ('bio' in values) fields.bio = values.bio;
      if ('portfolio' in values) fields.portfolio_url = values.portfolio;
      if (Object.keys(fields).length) {
        const profile = await db.get('SELECT profile_id FROM dbo.Profile WHERE user_id = ?', [source.user_id]);
        if (profile) await set('dbo.Profile','profile_id',profile.profile_id,fields);
      }
    }
    if (table === 'applications' && application && 'introduction' in values) {
      await set('dbo.Application','application_id',Number(application[1]),{ cover_note: values.introduction });
    }
  };
}
