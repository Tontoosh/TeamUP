-- TeamUP SQL Server application schema. Run in the intended existing database.
-- Generated from server/db/schema.js; does not drop or overwrite existing data.
-- This script was exported, not executed against SQL Server (SSPI authentication unavailable).
-- Normalized legacy source views are installed by server/db/source-schema.js at app startup.
SET XACT_ABORT ON;
GO
IF OBJECT_ID(N'dbo.users', N'U') IS NULL CREATE TABLE dbo.users (id NVARCHAR(36) PRIMARY KEY, email NVARCHAR(255) NOT NULL UNIQUE, password NVARCHAR(255) NOT NULL, name NVARCHAR(160) NOT NULL, school NVARCHAR(160) NOT NULL, major NVARCHAR(160) NOT NULL, skills NVARCHAR(MAX) NOT NULL, interests NVARCHAR(MAX) NOT NULL, experience NVARCHAR(MAX) NOT NULL, portfolio NVARCHAR(MAX) NOT NULL, hours INTEGER NOT NULL, bio NVARCHAR(MAX) NOT NULL, role NVARCHAR(20) NOT NULL, status NVARCHAR(20) NOT NULL, verified INTEGER NOT NULL, created_at NVARCHAR(40) NOT NULL);
GO
IF OBJECT_ID(N'dbo.login_attempts', N'U') IS NULL CREATE TABLE dbo.login_attempts (id NVARCHAR(36) PRIMARY KEY, user_id NVARCHAR(36) REFERENCES users(id), outcome NVARCHAR(30) NOT NULL, created_at NVARCHAR(40) NOT NULL);
GO
IF OBJECT_ID(N'dbo.sessions', N'U') IS NULL CREATE TABLE dbo.sessions (id NVARCHAR(128) PRIMARY KEY, user_id NVARCHAR(36) NOT NULL REFERENCES users(id), expires_at NVARCHAR(40) NOT NULL);
GO
IF OBJECT_ID(N'dbo.tokens', N'U') IS NULL CREATE TABLE dbo.tokens (id NVARCHAR(128) PRIMARY KEY, user_id NVARCHAR(36) NOT NULL REFERENCES users(id), purpose NVARCHAR(20) NOT NULL, expires_at NVARCHAR(40) NOT NULL);
GO
IF OBJECT_ID(N'dbo.projects', N'U') IS NULL CREATE TABLE dbo.projects (id NVARCHAR(36) PRIMARY KEY, owner_id NVARCHAR(36) NOT NULL REFERENCES users(id), name NVARCHAR(200) NOT NULL, description NVARCHAR(MAX) NOT NULL, category NVARCHAR(100) NOT NULL, project_type NVARCHAR(50) NOT NULL, goal NVARCHAR(MAX) NOT NULL, duration INTEGER NOT NULL, capacity INTEGER NOT NULL, skills NVARCHAR(MAX) NOT NULL, roles NVARCHAR(MAX) NOT NULL, hours INTEGER NOT NULL, status NVARCHAR(20) NOT NULL, visibility NVARCHAR(20) NOT NULL, created_at NVARCHAR(40) NOT NULL);
GO
IF OBJECT_ID(N'dbo.memberships', N'U') IS NULL CREATE TABLE dbo.memberships (id NVARCHAR(36) PRIMARY KEY, project_id NVARCHAR(36) NOT NULL REFERENCES projects(id), user_id NVARCHAR(36) NOT NULL REFERENCES users(id), role NVARCHAR(100) NOT NULL, created_at NVARCHAR(40) NOT NULL, UNIQUE(project_id, user_id));
GO
IF OBJECT_ID(N'dbo.applications', N'U') IS NULL CREATE TABLE dbo.applications (id NVARCHAR(36) PRIMARY KEY, project_id NVARCHAR(36) NOT NULL REFERENCES projects(id), user_id NVARCHAR(36) NOT NULL REFERENCES users(id), role NVARCHAR(100) NOT NULL, introduction NVARCHAR(MAX) NOT NULL, status NVARCHAR(20) NOT NULL, question NVARCHAR(MAX) NOT NULL, answer NVARCHAR(MAX) NOT NULL, reason NVARCHAR(MAX) NOT NULL, created_at NVARCHAR(40) NOT NULL);
GO
IF OBJECT_ID(N'dbo.messages', N'U') IS NULL CREATE TABLE dbo.messages (id NVARCHAR(36) PRIMARY KEY, project_id NVARCHAR(36) NOT NULL REFERENCES projects(id), user_id NVARCHAR(36) NOT NULL REFERENCES users(id), body NVARCHAR(MAX) NOT NULL, visibility NVARCHAR(20) NOT NULL, created_at NVARCHAR(40) NOT NULL);
GO
IF OBJECT_ID(N'dbo.attachments', N'U') IS NULL CREATE TABLE dbo.attachments (id NVARCHAR(36) PRIMARY KEY, message_id NVARCHAR(36) NOT NULL REFERENCES messages(id), name NVARCHAR(255) NOT NULL, path NVARCHAR(255) NOT NULL, mime NVARCHAR(120) NOT NULL, size INTEGER NOT NULL);
GO
IF OBJECT_ID(N'dbo.notifications', N'U') IS NULL CREATE TABLE dbo.notifications (id NVARCHAR(36) PRIMARY KEY, user_id NVARCHAR(36) NOT NULL REFERENCES users(id), title NVARCHAR(MAX) NOT NULL, link NVARCHAR(255) NOT NULL, is_read INTEGER NOT NULL, created_at NVARCHAR(40) NOT NULL);
GO
IF OBJECT_ID(N'dbo.blocks', N'U') IS NULL CREATE TABLE dbo.blocks (id NVARCHAR(36) PRIMARY KEY, user_id NVARCHAR(36) NOT NULL REFERENCES users(id), target_id NVARCHAR(36) NOT NULL REFERENCES users(id), UNIQUE(user_id, target_id));
GO
IF OBJECT_ID(N'dbo.portfolios', N'U') IS NULL CREATE TABLE dbo.portfolios (id NVARCHAR(36) PRIMARY KEY, user_id NVARCHAR(36) NOT NULL REFERENCES users(id), title NVARCHAR(200) NOT NULL, url NVARCHAR(MAX) NOT NULL, contribution NVARCHAR(MAX) NOT NULL, created_at NVARCHAR(40) NOT NULL);
GO
IF OBJECT_ID(N'dbo.user_skill_levels', N'U') IS NULL CREATE TABLE dbo.user_skill_levels (id NVARCHAR(36) PRIMARY KEY, user_id NVARCHAR(36) NOT NULL REFERENCES users(id), skill NVARCHAR(80) NOT NULL, skill_key NVARCHAR(80) NOT NULL, level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5), UNIQUE(user_id, skill_key));
GO
IF OBJECT_ID(N'dbo.role_settings', N'U') IS NULL CREATE TABLE dbo.role_settings (id NVARCHAR(36) PRIMARY KEY, project_id NVARCHAR(36) NOT NULL REFERENCES projects(id), role NVARCHAR(80) NOT NULL, hours INTEGER NOT NULL, hours_required INTEGER NOT NULL, UNIQUE(project_id, role));
GO
IF OBJECT_ID(N'dbo.role_requirements', N'U') IS NULL CREATE TABLE dbo.role_requirements (id NVARCHAR(36) PRIMARY KEY, project_id NVARCHAR(36) NOT NULL REFERENCES projects(id), role NVARCHAR(80) NOT NULL, skill NVARCHAR(80) NOT NULL, skill_key NVARCHAR(80) NOT NULL, min_level INTEGER NOT NULL, weight INTEGER NOT NULL, required INTEGER NOT NULL, UNIQUE(project_id, role, skill_key));
GO
IF OBJECT_ID(N'dbo.project_completions', N'U') IS NULL CREATE TABLE dbo.project_completions (id NVARCHAR(36) PRIMARY KEY REFERENCES projects(id), completed_at NVARCHAR(40) NOT NULL);
GO
IF OBJECT_ID(N'dbo.completion_members', N'U') IS NULL CREATE TABLE dbo.completion_members (id NVARCHAR(36) PRIMARY KEY, project_id NVARCHAR(36) NOT NULL REFERENCES project_completions(id), user_id NVARCHAR(36) NOT NULL REFERENCES users(id), role NVARCHAR(100) NOT NULL, UNIQUE(project_id, user_id));
GO
IF OBJECT_ID(N'dbo.peer_reviews', N'U') IS NULL CREATE TABLE dbo.peer_reviews (id NVARCHAR(36) PRIMARY KEY, project_id NVARCHAR(36) NOT NULL REFERENCES project_completions(id), author_id NVARCHAR(36) NOT NULL REFERENCES users(id), target_id NVARCHAR(36) NOT NULL REFERENCES users(id), quality INTEGER NOT NULL CHECK (quality BETWEEN 1 AND 5), reliability INTEGER NOT NULL CHECK (reliability BETWEEN 1 AND 5), communication INTEGER NOT NULL CHECK (communication BETWEEN 1 AND 5), comment NVARCHAR(MAX) NOT NULL, created_at NVARCHAR(40) NOT NULL, UNIQUE(project_id, author_id, target_id));
GO
IF OBJECT_ID(N'dbo.reports', N'U') IS NULL CREATE TABLE dbo.reports (id NVARCHAR(36) PRIMARY KEY, user_id NVARCHAR(36) NOT NULL REFERENCES users(id), target_type NVARCHAR(20) NOT NULL, target_id NVARCHAR(36) NOT NULL, reason NVARCHAR(200) NOT NULL, description NVARCHAR(MAX) NOT NULL, status NVARCHAR(20) NOT NULL, decision NVARCHAR(MAX) NOT NULL, created_at NVARCHAR(40) NOT NULL);
GO
IF OBJECT_ID(N'dbo.audit', N'U') IS NULL CREATE TABLE dbo.audit (id NVARCHAR(36) PRIMARY KEY, admin_id NVARCHAR(36) NOT NULL REFERENCES users(id), target_type NVARCHAR(30) NOT NULL, target_id NVARCHAR(36) NOT NULL, action NVARCHAR(50) NOT NULL, reason NVARCHAR(MAX) NOT NULL, before_state NVARCHAR(MAX) NOT NULL, after_state NVARCHAR(MAX) NOT NULL, created_at NVARCHAR(40) NOT NULL);
GO
IF OBJECT_ID(N'dbo.reference_data', N'U') IS NULL CREATE TABLE dbo.reference_data (id NVARCHAR(36) PRIMARY KEY, code NVARCHAR(100) NOT NULL UNIQUE, name NVARCHAR(160) NOT NULL, type NVARCHAR(30) NOT NULL);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_login_user' AND object_id = OBJECT_ID(N'dbo.login_attempts')) CREATE INDEX idx_login_user ON dbo.login_attempts(user_id, created_at);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_project_owner' AND object_id = OBJECT_ID(N'dbo.projects')) CREATE INDEX idx_project_owner ON dbo.projects(owner_id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_project_search' AND object_id = OBJECT_ID(N'dbo.projects')) CREATE INDEX idx_project_search ON dbo.projects(visibility, created_at, id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_membership_user' AND object_id = OBJECT_ID(N'dbo.memberships')) CREATE INDEX idx_membership_user ON dbo.memberships(user_id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_application_project' AND object_id = OBJECT_ID(N'dbo.applications')) CREATE INDEX idx_application_project ON dbo.applications(project_id, status);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_messages_project' AND object_id = OBJECT_ID(N'dbo.messages')) CREATE INDEX idx_messages_project ON dbo.messages(project_id, created_at);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_notification_user' AND object_id = OBJECT_ID(N'dbo.notifications')) CREATE INDEX idx_notification_user ON dbo.notifications(user_id, is_read);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_review_target' AND object_id = OBJECT_ID(N'dbo.peer_reviews')) CREATE INDEX idx_review_target ON dbo.peer_reviews(target_id, created_at);
GO
-- Read-only connection diagnostics attempted in this session; connection failed before execution.
SELECT DB_NAME() AS database_name, SUSER_SNAME() AS login_name;
SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE';
GO
