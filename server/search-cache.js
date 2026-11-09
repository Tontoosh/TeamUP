// Every committed or in-flight mutation advances db.revision. Old search results
// can never cross a profile, project, moderation or blocking change.
export function searchCache(db) {
  const entries = new Map();
  return (req, res, next) => {
    const key = `${db.revision}:${req.user?.id || 'guest'}:${req.originalUrl}`;
    const existing = entries.get(key);
    if (existing && existing.expires > Date.now()) return res.json(existing.value);
    const send = res.json.bind(res);
    res.json = value => {
      if (res.statusCode === 200) {
        if (entries.size >= 100) entries.delete(entries.keys().next().value);
        entries.set(key, { value, expires: Date.now() + 15000 });
      }
      return send(value);
    };
    next();
  };
}
