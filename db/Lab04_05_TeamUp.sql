-- GitHub copy: SQL login passwords are supplied with SQLCMD variables.
-- Enable SSMS Query > SQLCMD Mode and define the variables locally,
-- or use sqlcmd -v. Never commit the variable values.
-- Required: TEAMUP_ADMIN_PASSWORD, TEAMUP_READER_PASSWORD, TEAMUP_WRITER_PASSWORD.

use TeamUpDB;
IF SUSER_ID(N'teamup_admin') IS NULL
 CREATE LOGIN teamup_admin WITH PASSWORD='$(TEAMUP_ADMIN_PASSWORD)',CHECK_POLICY=ON,CHECK_EXPIRATION=ON;
IF SUSER_ID(N'teamup_reader') IS NULL
 CREATE LOGIN teamup_reader WITH PASSWORD='$(TEAMUP_READER_PASSWORD)',CHECK_POLICY=ON;
IF SUSER_ID(N'teamup_writer') IS NULL
 CREATE LOGIN teamup_writer WITH PASSWORD='$(TEAMUP_WRITER_PASSWORD)',CHECK_POLICY=ON;
SELECT name,type_desc,is_disabled,create_date FROM sys.server_principals
WHERE name IN ('teamup_admin','teamup_reader','teamup_writer');
GO
USE TeamUpDB;
GO
-- 2. Сангийн user болон admin / reader / editor role-ууд үүсгэх.
IF USER_ID(N'teamup_admin') IS NULL CREATE USER teamup_admin FOR LOGIN teamup_admin;
IF USER_ID(N'teamup_reader') IS NULL CREATE USER teamup_reader FOR LOGIN teamup_reader;
IF USER_ID(N'teamup_writer') IS NULL CREATE USER teamup_writer FOR LOGIN teamup_writer;
IF DATABASE_PRINCIPAL_ID(N'role_teamup_admin') IS NULL CREATE ROLE role_teamup_admin;
IF DATABASE_PRINCIPAL_ID(N'role_teamup_reader') IS NULL CREATE ROLE role_teamup_reader;
IF DATABASE_PRINCIPAL_ID(N'role_teamup_editor') IS NULL CREATE ROLE role_teamup_editor;

-- 3. Эрхийн туршилтад ашиглах нууц тэмдэглэлийн хүснэгт бэлтгэх.
IF OBJECT_ID(N'dbo.LabModerationNote',N'U') IS NULL
BEGIN
 CREATE TABLE dbo.LabModerationNote(
  note_id int IDENTITY PRIMARY KEY,
  note nvarchar(500) NOT NULL,
  created_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
 );
 INSERT dbo.LabModerationNote(note) VALUES(N'Зөвхөн администраторт зориулсан туршилтын тэмдэглэл');
END;

-- 4. GRANT — admin-д dbo өгөгдлийн эрх олгох.
GRANT SELECT,INSERT,UPDATE,DELETE ON SCHEMA::dbo TO role_teamup_admin;

GO
-- 5. Нийтийн харагдац — зөвшөөрсөн төлөвтэй төслүүдийг харуулах.
CREATE OR ALTER VIEW dbo.vw_PublicProjects AS
SELECT project_id,title,description,status,work_mode
FROM dbo.Project WHERE status IN ('recruiting','active','completed');
GO
-- 6. Reader / editor эрх олгох ба хэрэглэгчдийг role-д нэмэх.
GRANT SELECT ON dbo.vw_PublicProjects TO role_teamup_reader;

GRANT SELECT,INSERT,UPDATE ON dbo.Skill TO role_teamup_editor;
IF IS_ROLEMEMBER('role_teamup_admin','teamup_admin')<>1
 ALTER ROLE role_teamup_admin ADD MEMBER teamup_admin;
IF IS_ROLEMEMBER('role_teamup_reader','teamup_reader')<>1
 ALTER ROLE role_teamup_reader ADD MEMBER teamup_reader;
IF IS_ROLEMEMBER('role_teamup_editor','teamup_writer')<>1
 ALTER ROLE role_teamup_editor ADD MEMBER teamup_writer;

-- DENY нь энд олгосон SELECT эрхийг хориглоно; REVOKE нь зөвхөн тухайн UPDATE олголтыг арилгаж, бусад эх үүсвэрийн эрхийг хориглохгүй.
-- 7. DENY / REVOKE — SELECT-ийг хориглож, UPDATE олголтыг буцаах.
GRANT SELECT ON dbo.LabModerationNote TO role_teamup_reader;
DENY SELECT ON dbo.LabModerationNote TO teamup_reader;
REVOKE UPDATE ON dbo.Skill FROM role_teamup_editor;

-- 8. Эрхийн тайлан — олгосон/хориглосон эрх болон role-ийн гишүүд.
SELECT dp.name,OBJECT_NAME(p.major_id) AS ObjectName,p.permission_name,p.state_desc
FROM sys.database_permissions p JOIN sys.database_principals dp
 ON dp.principal_id=p.grantee_principal_id
WHERE dp.name LIKE '%teamup%' ORDER BY dp.name,p.permission_name;
SELECT r.name AS RoleName,u.name AS UserName FROM sys.database_role_members m
JOIN sys.database_principals r ON r.principal_id=m.role_principal_id
JOIN sys.database_principals u ON u.principal_id=m.member_principal_id
WHERE r.name LIKE 'role_teamup%';

-- 9. Reader тест — нийтийн төсөл уншигдах, нууц тэмдэглэлд 229 алдаа гарахыг шалгах.
EXECUTE AS USER='teamup_reader';
BEGIN TRY
 SELECT * FROM dbo.vw_PublicProjects;
 BEGIN TRY
  EXEC(N'SELECT * FROM dbo.LabModerationNote');
  THROW 51100,N'DENY тест амжилтгүй.',1;
 END TRY
 BEGIN CATCH
  IF ERROR_NUMBER()<>229 THROW;
  PRINT N'Хүлээгдсэн DENY: '+ERROR_MESSAGE();
 END CATCH;
 REVERT;
END TRY
BEGIN CATCH
 REVERT;
 THROW;
END CATCH;

-- 10. Writer тест — INSERT зөвшөөрөгдөх, UPDATE хориглогдохыг шалгаад ROLLBACK хийх.
DECLARE @HadXactAbort bit=CASE WHEN (@@OPTIONS & 16384)=16384 THEN 1 ELSE 0 END;
SET XACT_ABORT OFF;
BEGIN TRANSACTION;
EXECUTE AS USER='teamup_writer';
BEGIN TRY
 SELECT * FROM dbo.Skill;
 INSERT dbo.Skill(name,category) VALUES(N'RBAC туршилт',N'Lab04');
 BEGIN TRY
  EXEC(N'UPDATE dbo.Skill SET category=N''Changed'' WHERE name=N''RBAC туршилт''');
  THROW 51101,N'REVOKE тест амжилтгүй.',1;
 END TRY
 BEGIN CATCH
  IF ERROR_NUMBER()<>229 THROW;
  PRINT N'Хүлээгдсэн REVOKE: '+ERROR_MESSAGE();
 END CATCH;
 REVERT;
 IF XACT_STATE()<>0 ROLLBACK;
END TRY
BEGIN CATCH
 REVERT;
 IF XACT_STATE()<>0 ROLLBACK;
 THROW;
END CATCH;
IF @HadXactAbort=1 SET XACT_ABORT ON;

GO

-- Unsafe процедур нь SQL injection харуулах сургалтын жишээ бөгөөд тестийн дараа устна; Safe процедур оролтыг sp_executesql-ийн параметрээр дамжуулна.
-- 11. SQL injection — оролтыг SQL текстэд залгадаг эмзэг процедурын жишээ.
CREATE OR ALTER PROCEDURE dbo.usp_LabFindUserUnsafe @email nvarchar(254)
AS
BEGIN
 DECLARE @sql nvarchar(max)=N'SELECT user_id,display_name,email FROM dbo.[User] WHERE email=N'''+@email+N'''';
 EXEC sys.sp_executesql @sql;
END;
GO
-- 12. Параметртэй хайлт — sp_executesql ашиглан оролтыг SQL командаас салгах.
CREATE OR ALTER PROCEDURE dbo.usp_FindUserSafe @email nvarchar(254)
AS
BEGIN
 SET NOCOUNT ON;
 DECLARE @sql nvarchar(max)=N'SELECT user_id,display_name,email FROM dbo.[User] WHERE email=@p';
 EXEC sys.sp_executesql @sql,N'@p nvarchar(254)',@p=@email;
END;
GO

-- 13. Ижил халдлагын оролтоор хоёр процедурыг харьцуулж, эмзэг процедурыг устгах.
EXEC dbo.usp_LabFindUserUnsafe @email=N'x'' OR 1=1--';
EXEC dbo.usp_FindUserSafe @email=N'x'' OR 1=1--';
EXEC dbo.usp_FindUserSafe @email=N'bat@example.com';
DROP PROCEDURE dbo.usp_LabFindUserUnsafe;

USE master;
GO

-- Lab05 — Аудит. 1. Серверийн log хавтаст TeamUpAudit үүсгэж идэвхжүүлэх.
DECLARE @AuditDirectory nvarchar(4000)=CONVERT(nvarchar(4000),SERVERPROPERTY('InstanceDefaultLogPath'));
IF @AuditDirectory IS NULL THROW 51200,N'Аудитын хавтсыг тодорхойлж чадсангүй.',1;
IF NOT EXISTS(SELECT 1 FROM sys.server_audits WHERE name=N'TeamUpAudit')
BEGIN
 DECLARE @CreateAudit nvarchar(max)=N'CREATE SERVER AUDIT TeamUpAudit TO FILE (FILEPATH=N'''
 +REPLACE(@AuditDirectory,N'''',N'''''')+N''', MAXSIZE=10 MB, MAX_ROLLOVER_FILES=5,
 RESERVE_DISK_SPACE=OFF) WITH(QUEUE_DELAY=1000, ON_FAILURE=CONTINUE)';
 EXEC sys.sp_executesql @CreateAudit;
END;
ALTER SERVER AUDIT TeamUpAudit WITH(STATE=ON);
GO
USE TeamUpDB;
GO
-- 2. Database audit specification — хүснэгтүүдийн сонгосон үйлдлүүдийг бүртгэх.
IF NOT EXISTS(SELECT 1 FROM sys.database_audit_specifications WHERE name=N'TeamUpDataAudit')
 EXEC(N'CREATE DATABASE AUDIT SPECIFICATION TeamUpDataAudit
 FOR SERVER AUDIT TeamUpAudit
 ADD(INSERT ON dbo.Skill BY [public]),
 ADD(UPDATE ON dbo.Skill BY [public]),
 ADD(DELETE ON dbo.Skill BY [public]),
 ADD(UPDATE ON dbo.Application BY [public]),
 ADD(INSERT ON dbo.Membership BY [public]),
 ADD(SELECT ON dbo.LabModerationNote BY [public])
 WITH(STATE=ON)');
ALTER DATABASE AUDIT SPECIFICATION TeamUpDataAudit WITH(STATE=ON);
GO

-- 3. Аудитын төлөв ба бүртгэлийн файлын замыг шалгах.
SELECT a.name,s.status_desc,s.audit_file_path
FROM sys.server_audits a LEFT JOIN sys.dm_server_audit_status s ON s.audit_id=a.audit_id
WHERE a.name=N'TeamUpAudit';
SELECT name,is_state_enabled FROM sys.database_audit_specifications
WHERE name=N'TeamUpDataAudit';

-- 4. Аудитын тест — түр ур чадварт INSERT / UPDATE / DELETE хийж, нууц тэмдэглэл унших.
DECLARE @name nvarchar(100)=N'Audit_'+CONVERT(nvarchar(36),NEWID());
INSERT dbo.Skill(name,category) VALUES(@name,N'Lab05 Audit');
UPDATE dbo.Skill SET category=N'Lab05 Updated' WHERE name=@name;
DELETE dbo.Skill WHERE name=@name;
SELECT * FROM dbo.LabModerationNote;

-- 5. Аудитын бичилт файлд очихыг хүлээж, fn_get_audit_file-ээр унших.
WAITFOR DELAY '00:00:02';

DECLARE @AuditPattern nvarchar(4000);
SELECT @AuditPattern=log_file_path+N'TeamUpAudit_*.sqlaudit'
FROM sys.server_file_audits WHERE name=N'TeamUpAudit';
SELECT event_time,server_principal_name,database_name,object_name,
 action_id,succeeded,statement
FROM sys.fn_get_audit_file(@AuditPattern,DEFAULT,DEFAULT)
WHERE database_name=N'TeamUpDB'
ORDER BY event_time DESC;
SELECT event_time,server_principal_name,action_id,succeeded,statement
FROM sys.fn_get_audit_file(@AuditPattern,DEFAULT,DEFAULT)
WHERE database_name=N'TeamUpDB' AND object_name=N'Skill'
ORDER BY event_time DESC;
GO

-- 6. Сонголтот цэвэрлэгээ — @Cleanup=1 бол аудит, лабораторийн user/role/login болон тэмдэглэлийн хүснэгтийг устгана.
DECLARE @Cleanup bit=0;
IF @Cleanup=1
BEGIN
 ALTER DATABASE AUDIT SPECIFICATION TeamUpDataAudit WITH(STATE=OFF);
 DROP DATABASE AUDIT SPECIFICATION TeamUpDataAudit;
 ALTER ROLE role_teamup_admin DROP MEMBER teamup_admin;
 ALTER ROLE role_teamup_reader DROP MEMBER teamup_reader;
 ALTER ROLE role_teamup_editor DROP MEMBER teamup_writer;
 DROP USER teamup_admin;
 DROP USER teamup_reader;
 DROP USER teamup_writer;
 DROP ROLE role_teamup_admin;
 DROP ROLE role_teamup_reader;
 DROP ROLE role_teamup_editor;
 DROP TABLE dbo.LabModerationNote;
 EXEC(N'USE master; ALTER SERVER AUDIT TeamUpAudit WITH(STATE=OFF);
 DROP SERVER AUDIT TeamUpAudit;
 DROP LOGIN teamup_admin; DROP LOGIN teamup_reader; DROP LOGIN teamup_writer;');
END;
