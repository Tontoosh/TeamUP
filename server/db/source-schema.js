import { installSourceWrites } from './source-writes.js';
// SQL Server's normalized TeamUpDB schema is the source for existing records.
// Plural tables hold authentication and UI fields absent from the original schema.
const jsonList = (table, value, where) =>
  `COALESCE((SELECT N'[' + STRING_AGG(CAST(N'"' + STRING_ESCAPE(${value}, 'json') + N'"' AS NVARCHAR(MAX)), N',') + N']' FROM ${table} WHERE ${where}), N'[]')`;
const userId = value => `N'sql-user-' + CONVERT(NVARCHAR(20), ${value})`;
const projectId = value => `N'sql-project-' + CONVERT(NVARCHAR(20), ${value})`;

export const sourceViews = {
  users: `SELECT a.id, a.email, a.password,
    COALESCE(u.display_name,a.name) AS name, a.school, a.major,
    CASE WHEN u.user_id IS NULL THEN a.skills ELSE ${jsonList('dbo.UserSkill us JOIN dbo.Skill s ON s.skill_id=us.skill_id', 's.name', 'us.user_id=u.user_id')} END AS skills,
    a.interests, CASE WHEN u.user_id IS NULL THEN a.experience ELSE COALESCE((SELECT STRING_AGG(CAST(CONCAT(s.name,N': ',us.level,N' · ',us.experience_months,N' сар') AS NVARCHAR(MAX)),N', ') FROM dbo.UserSkill us JOIN dbo.Skill s ON s.skill_id=us.skill_id WHERE us.user_id=u.user_id),a.experience) END AS experience, COALESCE(pr.portfolio_url,a.portfolio) AS portfolio,
    a.hours, COALESCE(pr.bio,a.bio) AS bio, a.role,
    CASE WHEN a.status<>'active' THEN a.status WHEN u.user_id IS NULL THEN a.status WHEN u.account_status='active' THEN 'active' ELSE 'suspended' END AS status,
    a.verified, a.created_at, COALESCE(pr.availability,N'') AS availability
    FROM dbo.users a LEFT JOIN dbo.[User] u ON a.email=u.email
    OUTER APPLY (SELECT TOP (1) bio,portfolio_url,availability FROM dbo.Profile WHERE user_id=u.user_id ORDER BY profile_id) pr
    WHERE a.id NOT LIKE 'sql-user-%' OR u.user_id IS NOT NULL`,
  projects: `SELECT a.id, COALESCE(au.id,${userId('p.owner_user_id')},a.owner_id) AS owner_id,
    COALESCE(p.title,a.name) AS name, COALESCE(p.description,a.description) AS description,
    a.category, COALESCE(p.work_mode,a.project_type) AS project_type, a.goal, a.duration,
    CASE WHEN p.project_id IS NULL THEN a.capacity ELSE COALESCE((SELECT SUM(required_count) FROM dbo.ProjectRole WHERE project_id=p.project_id),0)+CASE WHEN EXISTS (SELECT 1 FROM dbo.Membership om WHERE om.project_id=p.project_id AND om.user_id=p.owner_user_id AND om.member_status='active') THEN 0 ELSE 1 END END AS capacity,
    CASE WHEN p.project_id IS NULL THEN a.skills ELSE ${jsonList('dbo.RoleSkill rs JOIN dbo.ProjectRole r ON r.project_role_id=rs.project_role_id JOIN dbo.Skill s ON s.skill_id=rs.skill_id', 's.name', 'r.project_id=p.project_id')} END AS skills,
    CASE WHEN p.project_id IS NULL THEN a.roles ELSE ${jsonList('dbo.ProjectRole r', 'r.role_name', "r.project_id=p.project_id AND r.status='open'")} END AS roles,
    a.hours, CASE WHEN a.status IN ('closed','completed','archived') THEN a.status WHEN p.project_id IS NULL THEN a.status WHEN p.status='recruiting' THEN 'open' WHEN p.status IN ('archived','cancelled') THEN 'archived' ELSE 'closed' END AS status,
    a.visibility,a.created_at
    FROM dbo.projects a LEFT JOIN dbo.Project p ON a.id=${projectId('p.project_id')}
    LEFT JOIN dbo.[User] ou ON ou.user_id=p.owner_user_id
    LEFT JOIN dbo.users au ON au.email=ou.email
    WHERE a.id NOT LIKE 'sql-project-%' OR p.project_id IS NOT NULL`,
  applications: `SELECT N'sql-application-'+CONVERT(NVARCHAR(20),ap.application_id) AS id,
    ${projectId('r.project_id')} AS project_id, au.id AS user_id, r.role_name AS role,
    COALESCE(ap.cover_note,N'') AS introduction,
    CASE WHEN extra.status IN ('accepted','rejected','info','cancelled','invalidated') THEN extra.status WHEN ap.status='approved' THEN 'accepted' WHEN ap.status='submitted' THEN 'pending' ELSE ap.status END AS status,
    COALESCE(extra.question,N'') AS question,COALESCE(extra.answer,N'') AS answer,COALESCE(extra.reason,N'') AS reason,
    CONVERT(NVARCHAR(40),ap.submitted_at,127) AS created_at
    FROM dbo.Application ap JOIN dbo.ProjectRole r ON r.project_role_id=ap.project_role_id
    JOIN dbo.[User] u ON u.user_id=ap.user_id JOIN dbo.users au ON au.email=u.email
    LEFT JOIN dbo.applications extra ON extra.id=N'sql-application-'+CONVERT(NVARCHAR(20),ap.application_id)
    UNION ALL SELECT * FROM dbo.applications WHERE id NOT LIKE 'sql-application-%'`,
  memberships: `SELECT N'sql-member-'+CONVERT(NVARCHAR(20),m.membership_id) AS id,
    ${projectId('m.project_id')} AS project_id, au.id AS user_id,r.role_name AS role,
    CONVERT(NVARCHAR(40),m.joined_at,127) AS created_at
    FROM dbo.Membership m JOIN dbo.ProjectRole r ON r.project_role_id=m.project_role_id
    JOIN dbo.[User] u ON u.user_id=m.user_id JOIN dbo.users au ON au.email=u.email
    WHERE m.member_status='active'
    UNION ALL SELECT a.* FROM dbo.memberships a WHERE a.id NOT LIKE 'sql-member-%'
    AND NOT EXISTS (SELECT 1 FROM dbo.Membership m JOIN dbo.[User] u ON u.user_id=m.user_id JOIN dbo.users au ON au.email=u.email
      WHERE a.project_id=${projectId('m.project_id')} AND a.user_id=au.id AND m.member_status='active')`,
  reference_data: `SELECT N'sql-skill-'+CONVERT(NVARCHAR(20),skill_id) AS id,
    N'skill-'+CONVERT(NVARCHAR(20),skill_id) AS code,name,N'skill' AS type FROM dbo.Skill
    UNION ALL SELECT * FROM dbo.reference_data`,
};

export async function installSourceMapping(db) {
  if (db.driver !== 'mssql' || process.env.SQL_SOURCE_SCHEMA === 'app') return;
  const source = await db.get("SELECT OBJECT_ID(N'dbo.Project',N'U') AS project_table, OBJECT_ID(N'dbo.User',N'U') AS user_table");
  if (!source.project_table || !source.user_table) return;
  // Keep stable FK targets for sessions, uploads and other application-only features.
  // Source accounts have no password: do not grant them a shared test password.
  const refresh = async () => {
    await db.run(`INSERT INTO dbo.users (id,email,password,name,school,major,skills,interests,experience,portfolio,hours,bio,role,status,verified,created_at)
      SELECT ${userId('u.user_id')},u.email,N'',u.display_name,N'',N'',N'[]',N'[]',N'',N'',0,N'','student','active',0,N''
      FROM dbo.[User] u WHERE NOT EXISTS (SELECT 1 FROM dbo.users a WHERE a.email=u.email)`);
    await db.run(`INSERT INTO dbo.projects (id,owner_id,name,description,category,project_type,goal,duration,capacity,skills,roles,hours,status,visibility,created_at)
      SELECT ${projectId('p.project_id')},a.id,p.title,COALESCE(p.description,N''),N'',p.work_mode,N'',0,0,N'[]',N'[]',0,'open','visible',N''
      FROM dbo.Project p JOIN dbo.[User] u ON u.user_id=p.owner_user_id JOIN dbo.users a ON a.email=u.email
      WHERE NOT EXISTS (SELECT 1 FROM dbo.projects x WHERE x.id=${projectId('p.project_id')})`);
    await db.run(`INSERT INTO dbo.applications (id,project_id,user_id,role,introduction,status,question,answer,reason,created_at)
      SELECT N'sql-application-'+CONVERT(NVARCHAR(20),ap.application_id),${projectId('r.project_id')},a.id,r.role_name,COALESCE(ap.cover_note,N''),'source',N'',N'',N'',CONVERT(NVARCHAR(40),ap.submitted_at,127)
      FROM dbo.Application ap JOIN dbo.ProjectRole r ON r.project_role_id=ap.project_role_id JOIN dbo.[User] u ON u.user_id=ap.user_id JOIN dbo.users a ON a.email=u.email
      WHERE NOT EXISTS (SELECT 1 FROM dbo.applications x WHERE x.id=N'sql-application-'+CONVERT(NVARCHAR(20),ap.application_id))`);
    await db.run(`INSERT INTO dbo.memberships (id,project_id,user_id,role,created_at)
      SELECT N'sql-owner-'+CONVERT(NVARCHAR(20),p.project_id),${projectId('p.project_id')},a.id,N'Төсөл эзэмшигч',N''
      FROM dbo.Project p JOIN dbo.[User] u ON u.user_id=p.owner_user_id JOIN dbo.users a ON a.email=u.email
      WHERE NOT EXISTS (SELECT 1 FROM dbo.memberships m WHERE m.project_id=${projectId('p.project_id')} AND m.user_id=a.id)
      AND NOT EXISTS (SELECT 1 FROM dbo.Membership m WHERE m.project_id=p.project_id AND m.user_id=p.owner_user_id AND m.member_status='active')`);
  };
  let inFlight;
  db.refreshSource = () => {
    if (!inFlight) inFlight = db.transaction(refresh).finally(() => { inFlight = null; });
    return inFlight;
  };
  await db.refreshSource();
  for (const [name, projection] of Object.entries(sourceViews)) {
    await db.run(`CREATE OR ALTER VIEW dbo.teamup_api_${name} AS ${projection}`);
  }
  installSourceWrites(db);
  db.sourceSchema = 'normalized';
  db.mapRead = sql => sql.replace(/\b(FROM|JOIN)\s+(users|projects|applications|memberships|reference_data)\b/gi,
    (_match, clause, table) => `${clause} dbo.teamup_api_${table.toLowerCase()}`);
}





