-- 100000 мөрийн туршилтыг lab.ApplicationPerformance туслах хүснэгтэд хийж, үндсэн Application/Membership түүхийг хадгална.
USE TeamUpDB;
GO
IF OBJECT_ID(N'dbo.Application',N'U') IS NULL THROW 51700,N'Lab02 шаардлагатай.',1;
IF NOT EXISTS(SELECT 1 FROM dbo.[User]) OR NOT EXISTS(SELECT 1 FROM dbo.ProjectRole)
 THROW 51701,N'Хэрэглэгч, орон тооны суурь өгөгдөл шаардлагатай.',1;
IF SCHEMA_ID(N'lab') IS NULL EXEC(N'CREATE SCHEMA lab AUTHORIZATION dbo;');
GO

SET STATISTICS TIME ON;
SET STATISTICS IO ON;
SELECT a.application_id,u.display_name,r.role_name,a.status,a.submitted_at
FROM dbo.Application a JOIN dbo.[User] u ON u.user_id=a.user_id
JOIN dbo.ProjectRole r ON r.project_role_id=a.project_role_id;
GO

IF OBJECT_ID(N'lab.ApplicationPerformance',N'U') IS NULL
 CREATE TABLE lab.ApplicationPerformance(
  application_id int NOT NULL PRIMARY KEY,
  user_id int NOT NULL REFERENCES dbo.[User](user_id),
  project_role_id int NOT NULL REFERENCES dbo.ProjectRole(project_role_id),
  cover_note nvarchar(1000) NULL,status varchar(10) NOT NULL,
  submitted_at datetime2 NOT NULL,
  CHECK(status IN('pending','accepted','rejected','withdrawn')));
GO
IF NOT EXISTS(SELECT 1 FROM lab.ApplicationPerformance)
BEGIN
 ;WITH n AS(SELECT TOP(100000) CONVERT(int,ROW_NUMBER() OVER(ORDER BY a.object_id,b.object_id)) AS n
 FROM sys.all_objects a CROSS JOIN sys.all_objects b),
 u AS(SELECT user_id,ROW_NUMBER() OVER(ORDER BY user_id) AS rn FROM dbo.[User]),
 r AS(SELECT project_role_id,ROW_NUMBER() OVER(ORDER BY project_role_id) AS rn FROM dbo.ProjectRole)
 INSERT lab.ApplicationPerformance(application_id,user_id,project_role_id,cover_note,status,submitted_at)
 SELECT n.n,u.user_id,r.project_role_id,REPLICATE(N'TeamUp ',30),
 CASE n.n%4 WHEN 0 THEN 'pending' WHEN 1 THEN 'accepted' WHEN 2 THEN 'rejected' ELSE 'withdrawn' END,
 DATEADD(day,n.n%2557,CONVERT(datetime2,'20190101'))
 FROM n JOIN u ON u.rn=1+(n.n-1)%(SELECT COUNT(*) FROM dbo.[User])
 JOIN r ON r.rn=1+(n.n-1)%(SELECT COUNT(*) FROM dbo.ProjectRole);
END;
GO

SELECT TOP(10) qs.total_elapsed_time/NULLIF(qs.execution_count,0) AS AvgElapsedUs,
 qs.total_logical_reads/NULLIF(qs.execution_count,0) AS AvgReads,qs.execution_count,
 SUBSTRING(st.text,qs.statement_start_offset/2+1,
 ((CASE qs.statement_end_offset WHEN -1 THEN DATALENGTH(st.text) ELSE qs.statement_end_offset END
 -qs.statement_start_offset)/2)+1) AS StatementText
FROM sys.dm_exec_query_stats qs CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
WHERE st.dbid=DB_ID() ORDER BY AvgElapsedUs DESC;
GO

-- Ижил өгөгдөлтэй query-г индексийн өмнө ба дараа Actual Execution Plan, STATISTICS IO/TIME-аар харьцуулна; давтан ажиллуулахад өмнөх индекс үлдсэн эсэхийг шалгана.
DECLARE @UserID int=(SELECT MIN(user_id) FROM dbo.[User]);
SELECT * FROM lab.ApplicationPerformance WHERE user_id=@UserID;
SELECT application_id,submitted_at,status FROM lab.ApplicationPerformance WHERE user_id=@UserID;
SELECT user_id,COUNT(*) AS Total FROM lab.ApplicationPerformance
 GROUP BY user_id,status HAVING status='pending' AND COUNT(*)>5;
SELECT user_id,COUNT(*) AS Total FROM lab.ApplicationPerformance
 WHERE status='pending' GROUP BY user_id HAVING COUNT(*)>5;
SELECT application_id,submitted_at FROM lab.ApplicationPerformance WHERE YEAR(submitted_at)=2023;
SELECT application_id,submitted_at FROM lab.ApplicationPerformance
 WHERE submitted_at>='20230101' AND submitted_at<'20240101';

SELECT a.application_id,u.display_name FROM lab.ApplicationPerformance a
 JOIN dbo.[User] u ON u.user_id=a.user_id
 JOIN dbo.ProjectRole r ON r.project_role_id=a.project_role_id WHERE a.status='pending';
SELECT a.application_id,u.display_name FROM lab.ApplicationPerformance a
 JOIN dbo.[User] u ON u.user_id=a.user_id WHERE a.status='pending';
GO

DECLARE @UserID int=(SELECT MIN(user_id) FROM dbo.[User]);
SELECT application_id,user_id FROM lab.ApplicationPerformance WHERE user_id=@UserID;
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'lab.ApplicationPerformance') AND name=N'IX_Lab07_Application_User')
 CREATE INDEX IX_Lab07_Application_User ON lab.ApplicationPerformance(user_id);
SELECT application_id,user_id FROM lab.ApplicationPerformance WHERE user_id=@UserID;
GO

DECLARE @UserID int=(SELECT MIN(user_id) FROM dbo.[User]);
SELECT application_id,submitted_at,status FROM lab.ApplicationPerformance
 WHERE user_id=@UserID AND submitted_at>='20230101' ORDER BY submitted_at DESC;
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'lab.ApplicationPerformance') AND name=N'IX_Lab07_Application_User_Date')
 CREATE INDEX IX_Lab07_Application_User_Date ON lab.ApplicationPerformance(user_id,submitted_at DESC) INCLUDE(status);
SELECT application_id,submitted_at,status FROM lab.ApplicationPerformance
 WHERE user_id=@UserID AND submitted_at>='20230101' ORDER BY submitted_at DESC;

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.Application') AND name=N'IX_TeamUp_Application_User_Date')
 CREATE INDEX IX_TeamUp_Application_User_Date ON dbo.Application(user_id,submitted_at DESC) INCLUDE(status,project_role_id);
SELECT i.name,us.user_seeks,us.user_scans,us.user_updates
FROM sys.indexes i LEFT JOIN sys.dm_db_index_usage_stats us
 ON us.database_id=DB_ID() AND us.object_id=i.object_id AND us.index_id=i.index_id
WHERE i.object_id IN(OBJECT_ID(N'dbo.Application'),OBJECT_ID(N'lab.ApplicationPerformance'));

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'lab.ApplicationPerformance') AND name=N'IX_Lab07_UnusedDemo')
 CREATE INDEX IX_Lab07_UnusedDemo ON lab.ApplicationPerformance(status);
DROP INDEX IX_Lab07_UnusedDemo ON lab.ApplicationPerformance;
GO

IF NOT EXISTS(SELECT 1 FROM sys.partition_functions WHERE name=N'PF_TeamUp_SubmittedAt')
 EXEC(N'CREATE PARTITION FUNCTION PF_TeamUp_SubmittedAt(datetime2) AS RANGE RIGHT
 FOR VALUES(''20220101'',''20230101'',''20240101'',''20250101'');');
IF NOT EXISTS(SELECT 1 FROM sys.partition_schemes WHERE name=N'PS_TeamUp_SubmittedAt')
 EXEC(N'CREATE PARTITION SCHEME PS_TeamUp_SubmittedAt AS PARTITION PF_TeamUp_SubmittedAt ALL TO([PRIMARY]);');
GO
IF OBJECT_ID(N'lab.ApplicationPartitioned',N'U') IS NULL
BEGIN
 CREATE TABLE lab.ApplicationPartitioned(application_id int NOT NULL,submitted_at datetime2 NOT NULL,
 user_id int NOT NULL,status varchar(10) NOT NULL,
 CONSTRAINT PK_TeamUp_AppPart PRIMARY KEY CLUSTERED(submitted_at,application_id))
 ON PS_TeamUp_SubmittedAt(submitted_at);
 INSERT lab.ApplicationPartitioned SELECT application_id,submitted_at,user_id,status FROM lab.ApplicationPerformance;
END;
IF OBJECT_ID(N'lab.ApplicationUnpartitioned',N'U') IS NULL
BEGIN
 CREATE TABLE lab.ApplicationUnpartitioned(application_id int NOT NULL,submitted_at datetime2 NOT NULL,
 user_id int NOT NULL,status varchar(10) NOT NULL,
 CONSTRAINT PK_TeamUp_AppUnpart PRIMARY KEY CLUSTERED(submitted_at,application_id));
 INSERT lab.ApplicationUnpartitioned SELECT application_id,submitted_at,user_id,status FROM lab.ApplicationPerformance;
END;
GO
SELECT application_id,submitted_at,status FROM lab.ApplicationUnpartitioned
 WHERE submitted_at>='20230101' AND submitted_at<'20240101';
SELECT application_id,submitted_at,status FROM lab.ApplicationPartitioned
 WHERE submitted_at>='20230101' AND submitted_at<'20240101';
SELECT partition_number,rows FROM sys.partitions WHERE object_id=OBJECT_ID(N'lab.ApplicationPartitioned') AND index_id=1;

DECLARE @Measurements TABLE(TestName nvarchar(100),CPU_ms bigint,LogicalReads bigint,PlanOperator nvarchar(100));
INSERT @Measurements(TestName) VALUES(N'SELECT *'),(N'Багана сонголт'),(N'Индексийн өмнө'),
 (N'Индексийн дараа'),(N'Нийлмэл индекс'),(N'Unpartitioned'),(N'Partitioned');
SELECT * FROM @Measurements;

SET STATISTICS TIME OFF;
SET STATISTICS IO OFF;
GO
