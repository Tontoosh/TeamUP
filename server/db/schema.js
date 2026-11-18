// Relational tables are shared by SQLite (local) and Microsoft SQL Server.
export const tables = {
  users: `id VARCHAR(36) PRIMARY KEY, email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL, name VARCHAR(160) NOT NULL,
    school VARCHAR(160) NOT NULL, major VARCHAR(160) NOT NULL,
    skills TEXT NOT NULL, interests TEXT NOT NULL, experience TEXT NOT NULL,
    portfolio TEXT NOT NULL, hours INTEGER NOT NULL, bio TEXT NOT NULL,
    role VARCHAR(20) NOT NULL, status VARCHAR(20) NOT NULL,
    verified INTEGER NOT NULL, created_at VARCHAR(40) NOT NULL`,
  login_attempts: `id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) REFERENCES users(id),
    outcome VARCHAR(30) NOT NULL, created_at VARCHAR(40) NOT NULL`,
  sessions: `id VARCHAR(128) PRIMARY KEY, user_id VARCHAR(36) NOT NULL REFERENCES users(id),
    expires_at VARCHAR(40) NOT NULL`,
  tokens: `id VARCHAR(128) PRIMARY KEY, user_id VARCHAR(36) NOT NULL REFERENCES users(id),
    purpose VARCHAR(20) NOT NULL, expires_at VARCHAR(40) NOT NULL`,
  projects: `id VARCHAR(36) PRIMARY KEY, owner_id VARCHAR(36) NOT NULL REFERENCES users(id),
    name VARCHAR(200) NOT NULL, description TEXT NOT NULL, category VARCHAR(100) NOT NULL,
    project_type VARCHAR(50) NOT NULL, goal TEXT NOT NULL, duration INTEGER NOT NULL,
    capacity INTEGER NOT NULL, skills TEXT NOT NULL, roles TEXT NOT NULL,
    hours INTEGER NOT NULL, status VARCHAR(20) NOT NULL, visibility VARCHAR(20) NOT NULL,
    created_at VARCHAR(40) NOT NULL`,
  memberships: `id VARCHAR(36) PRIMARY KEY, project_id VARCHAR(36) NOT NULL REFERENCES projects(id),
    user_id VARCHAR(36) NOT NULL REFERENCES users(id), role VARCHAR(100) NOT NULL,
    created_at VARCHAR(40) NOT NULL, UNIQUE(project_id, user_id)`,
  applications: `id VARCHAR(36) PRIMARY KEY, project_id VARCHAR(36) NOT NULL REFERENCES projects(id),
    user_id VARCHAR(36) NOT NULL REFERENCES users(id), role VARCHAR(100) NOT NULL,
    introduction TEXT NOT NULL, status VARCHAR(20) NOT NULL, question TEXT NOT NULL,
    answer TEXT NOT NULL, reason TEXT NOT NULL, created_at VARCHAR(40) NOT NULL`,
  messages: `id VARCHAR(36) PRIMARY KEY, project_id VARCHAR(36) NOT NULL REFERENCES projects(id),
    user_id VARCHAR(36) NOT NULL REFERENCES users(id), body TEXT NOT NULL,
    visibility VARCHAR(20) NOT NULL, created_at VARCHAR(40) NOT NULL`,
  attachments: `id VARCHAR(36) PRIMARY KEY, message_id VARCHAR(36) NOT NULL REFERENCES messages(id),
    name VARCHAR(255) NOT NULL, path VARCHAR(255) NOT NULL, mime VARCHAR(120) NOT NULL,
    size INTEGER NOT NULL`,
  notifications: `id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL REFERENCES users(id),
    title TEXT NOT NULL, link VARCHAR(255) NOT NULL, is_read INTEGER NOT NULL,
    created_at VARCHAR(40) NOT NULL`,
  blocks: `id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL REFERENCES users(id),
    target_id VARCHAR(36) NOT NULL REFERENCES users(id), UNIQUE(user_id, target_id)`,
  portfolios: `id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL REFERENCES users(id),
    title VARCHAR(200) NOT NULL, url TEXT NOT NULL, contribution TEXT NOT NULL,
    created_at VARCHAR(40) NOT NULL`,
  user_skill_levels: `id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL REFERENCES users(id),
    skill VARCHAR(80) NOT NULL, skill_key VARCHAR(80) NOT NULL,
    level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5), UNIQUE(user_id, skill_key)`,
  role_settings: `id VARCHAR(36) PRIMARY KEY, project_id VARCHAR(36) NOT NULL REFERENCES projects(id),
    role VARCHAR(80) NOT NULL, hours INTEGER NOT NULL, hours_required INTEGER NOT NULL,
    UNIQUE(project_id, role)`,
  role_requirements: `id VARCHAR(36) PRIMARY KEY, project_id VARCHAR(36) NOT NULL REFERENCES projects(id),
    role VARCHAR(80) NOT NULL, skill VARCHAR(80) NOT NULL, skill_key VARCHAR(80) NOT NULL,
    min_level INTEGER NOT NULL, weight INTEGER NOT NULL, required INTEGER NOT NULL,
    UNIQUE(project_id, role, skill_key)`,
  project_completions: `id VARCHAR(36) PRIMARY KEY REFERENCES projects(id), completed_at VARCHAR(40) NOT NULL`,
  completion_members: `id VARCHAR(36) PRIMARY KEY, project_id VARCHAR(36) NOT NULL REFERENCES project_completions(id),
    user_id VARCHAR(36) NOT NULL REFERENCES users(id), role VARCHAR(100) NOT NULL,
    UNIQUE(project_id, user_id)`,
  peer_reviews: `id VARCHAR(36) PRIMARY KEY, project_id VARCHAR(36) NOT NULL REFERENCES project_completions(id),
    author_id VARCHAR(36) NOT NULL REFERENCES users(id), target_id VARCHAR(36) NOT NULL REFERENCES users(id),
    quality INTEGER NOT NULL CHECK (quality BETWEEN 1 AND 5),
    reliability INTEGER NOT NULL CHECK (reliability BETWEEN 1 AND 5),
    communication INTEGER NOT NULL CHECK (communication BETWEEN 1 AND 5),
    comment TEXT NOT NULL, created_at VARCHAR(40) NOT NULL,
    UNIQUE(project_id, author_id, target_id)`,
  reports: `id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL REFERENCES users(id),
    target_type VARCHAR(20) NOT NULL, target_id VARCHAR(36) NOT NULL,
    reason VARCHAR(200) NOT NULL, description TEXT NOT NULL, status VARCHAR(20) NOT NULL,
    decision TEXT NOT NULL, created_at VARCHAR(40) NOT NULL`,
  audit: `id VARCHAR(36) PRIMARY KEY, admin_id VARCHAR(36) NOT NULL REFERENCES users(id),
    target_type VARCHAR(30) NOT NULL, target_id VARCHAR(36) NOT NULL,
    action VARCHAR(50) NOT NULL, reason TEXT NOT NULL, before_state TEXT NOT NULL,
    after_state TEXT NOT NULL, created_at VARCHAR(40) NOT NULL`,
  reference_data: `id VARCHAR(36) PRIMARY KEY, code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(160) NOT NULL, type VARCHAR(30) NOT NULL`,
};

export async function createSchema(db) {
  for (const [name, columns] of Object.entries(tables)) {
    const sql =
      db.driver === 'mssql'
        ? `IF OBJECT_ID(N'${name}', N'U') IS NULL CREATE TABLE ${name} (${columns
            .replaceAll('TEXT', 'NVARCHAR(MAX)')
            .replaceAll('VARCHAR(', 'NVARCHAR(')
            .replaceAll('NNVARCHAR', 'NVARCHAR')})`
        : `CREATE TABLE IF NOT EXISTS ${name} (${columns})`;
    await db.run(sql);
  }
  const indexes = {
    idx_login_user: 'login_attempts(user_id, created_at)',
    idx_project_owner: 'projects(owner_id)',
    idx_membership_user: 'memberships(user_id)',
    idx_application_project: 'applications(project_id, status)',
    idx_messages_project: 'messages(project_id, created_at)',
    idx_notification_user: 'notifications(user_id, is_read)',
    idx_review_target: 'peer_reviews(target_id, created_at)',
  };
  for (const [name, target] of Object.entries(indexes)) {
    const prefix =
      db.driver === 'mssql'
        ? `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = '${name}') CREATE INDEX`
        : 'CREATE INDEX IF NOT EXISTS';
    await db.run(`${prefix} ${name} ON ${target}`);
  }
}
