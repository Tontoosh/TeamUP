-- Lab06 — Full, Differential, Log backup ба сэргээх туршилт. Бүхэлд нь ажиллуулахад санг сэргээж, холболтуудыг тасална.
USE master;
GO
-- 1. Бэлтгэл — TeamUpDB байгаа эсэхийг шалгаж, FULL recovery model тохируулах.
IF DB_ID(N'TeamUpDB') IS NULL THROW 51600,N'Эхлээд Lab02 TeamUpDB-г бэлтгэнэ.',1;
IF OBJECT_ID(N'TeamUpDB.dbo.Skill',N'U') IS NULL THROW 51601,N'dbo.Skill олдсонгүй.',1;
ALTER DATABASE TeamUpDB SET RECOVERY FULL;
GO
USE TeamUpDB;
GO

-- 2. Backup-ийн сэргэлтийг шалгах тусгай тэмдэглэгээтэй түр мөрүүд нэмэх.
IF EXISTS(SELECT 1 FROM dbo.Skill WHERE name LIKE N'[_][_]Lab06[_]%')
 THROW 51602,N'Lab06 тэмдэглэгээтэй мөр байна. Өмнөх туршилтын төлөвийг эхлээд шалга.',1;
INSERT dbo.Skill(name,category) VALUES(N'__Lab06_BACK001',N'Lab06 Backup'),(N'__Lab06_BACK002',N'Lab06 Backup');
GO

USE master;
GO
-- Энгийн Full backup нь Differential-ийн суурь болно; WITH INIT нь тухайн файл дахь өмнөх backup set-үүдийг дарна.
-- 3. FULL BACKUP — санг бүтнээр нөөцлөх. C:\Backup хавтас ба SQL Server-ийн бичих эрх шаардлагатай.
BACKUP DATABASE TeamUpDB TO DISK=N'C:\Backup\TeamUpDB_Full.bak'
 WITH INIT,CHECKSUM,NAME=N'TeamUp Lab06 Full',STATS=10;
-- 3.1 Full backup-ийн бүтцийг шалгаж, backup header мэдээллийг харах.
RESTORE VERIFYONLY FROM DISK=N'C:\Backup\TeamUpDB_Full.bak' WITH CHECKSUM;
RESTORE HEADERONLY FROM DISK=N'C:\Backup\TeamUpDB_Full.bak';

GO

USE TeamUpDB;
GO
-- 4. DIFFERENTIAL BACKUP — Full-ийн дараах өөрчлөлт үүсгэж, ялгаварт нөөц авах.
INSERT dbo.Skill(name,category) VALUES(N'__Lab06_DIFF001',N'Lab06 Differential'),(N'__Lab06_DIFF002',N'Lab06 Differential');
UPDATE dbo.Skill SET category=N'Lab06 Updated' WHERE name=N'__Lab06_BACK001';
GO
USE master;
GO
BACKUP DATABASE TeamUpDB TO DISK=N'C:\Backup\TeamUpDB_Diff.bak'
 WITH DIFFERENTIAL,INIT,CHECKSUM,NAME=N'TeamUp Lab06 Differential',STATS=10;
RESTORE VERIFYONLY FROM DISK=N'C:\Backup\TeamUpDB_Diff.bak' WITH CHECKSUM;
SELECT type,backup_start_date,CAST(backup_size/1024.0 AS decimal(18,2)) AS SizeKB,
 CAST(compressed_backup_size/1024.0 AS decimal(18,2)) AS CompressedKB
FROM msdb.dbo.backupset WHERE database_name=N'TeamUpDB' ORDER BY backup_finish_date DESC;
GO

USE TeamUpDB;
GO
-- 5. LOG BACKUP — шинэ мөр нэмж, сэргээх @StopAt цагийг тогтоон гүйлгээний лог нөөцлөх. Энэ batch-ийг бүтнээр ажиллуулна.
IF EXISTS(SELECT 1 FROM dbo.Skill WHERE name=N'__Lab06_LOG001')
 THROW 51603,N'LOG001 өмнө байна. Туршилтыг цэвэр лабораторийн хуулбарт эхэл.',1;
INSERT dbo.Skill(name,category) VALUES(N'__Lab06_LOG001',N'Lab06 Log');
WAITFOR DELAY '00:00:01';
DECLARE @StopAt datetime=GETDATE();
WAITFOR DELAY '00:00:01';
USE master;
BACKUP LOG TeamUpDB TO DISK=N'C:\Backup\TeamUpDB_Log1.trn'
 WITH INIT,CHECKSUM,NAME=N'TeamUp Lab06 Log1',STATS=10;
SELECT @StopAt AS RecoveryTarget;

-- 6. RESTORE — туршилтын мөрүүдийг устгаад Full → Differential → Log дарааллаар @StopAt цаг хүртэл сэргээх.
DELETE FROM TeamUpDB.dbo.Skill WHERE name IN
 (N'__Lab06_BACK001',N'__Lab06_BACK002',N'__Lab06_DIFF001',N'__Lab06_DIFF002',N'__Lab06_LOG001');
-- Зөвхөн лабораторийн санд ажиллуул: SINGLE_USER холболтуудыг тасалж, Full → Differential → Log дарааллаар STOPAT цаг хүртэл сэргээнэ; @StopAt-тай batch-ийг бүхэлд нь ажиллуулна.
ALTER DATABASE TeamUpDB SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
BEGIN TRY
 RESTORE DATABASE TeamUpDB FROM DISK=N'C:\Backup\TeamUpDB_Full.bak'
  WITH NORECOVERY,REPLACE,CHECKSUM,STATS=10;
 RESTORE DATABASE TeamUpDB FROM DISK=N'C:\Backup\TeamUpDB_Diff.bak'
  WITH NORECOVERY,CHECKSUM,STATS=10;
 RESTORE LOG TeamUpDB FROM DISK=N'C:\Backup\TeamUpDB_Log1.trn'
  WITH STOPAT=@StopAt,RECOVERY,CHECKSUM,STATS=10;
 ALTER DATABASE TeamUpDB SET MULTI_USER;
END TRY
BEGIN CATCH
 IF DATABASEPROPERTYEX(N'TeamUpDB',N'Status')=N'ONLINE' ALTER DATABASE TeamUpDB SET MULTI_USER;
 THROW;
END CATCH;
SELECT name,category FROM TeamUpDB.dbo.Skill WHERE name LIKE N'[_][_]Lab06[_]%';

GO

USE master;
GO
-- 7. SNAPSHOT — агшин зураг үүсгэж, нэг мөр устгасны дараа snapshot-оос санг буцаах. Энэ нь тусдаа backup биш.
IF DB_ID(N'TeamUpDB_Lab06Snapshot') IS NOT NULL
 THROW 51604,N'Snapshot өмнө байна. Эзэмшил, өмнөх туршилтыг шалга.',1;
DECLARE @files nvarchar(max),@sql nvarchar(max);
SELECT @files=STRING_AGG(CAST(N'(NAME=N'''+REPLACE(name,'''','''''')+
 N''',FILENAME=N''C:\Data\TeamUpDB_Lab06Snapshot_'+CONVERT(nvarchar(10),file_id)+N'.ss'')' AS nvarchar(max)),N',')
FROM sys.master_files WHERE database_id=DB_ID(N'TeamUpDB') AND type=0;
SET @sql=N'CREATE DATABASE TeamUpDB_Lab06Snapshot ON '+@files+N' AS SNAPSHOT OF TeamUpDB;';
EXEC sys.sp_executesql @sql;
DELETE FROM TeamUpDB.dbo.Skill WHERE name=N'__Lab06_LOG001';
ALTER DATABASE TeamUpDB SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
BEGIN TRY
 RESTORE DATABASE TeamUpDB FROM DATABASE_SNAPSHOT=N'TeamUpDB_Lab06Snapshot';
 ALTER DATABASE TeamUpDB SET MULTI_USER;
END TRY
BEGIN CATCH
 IF DATABASEPROPERTYEX(N'TeamUpDB',N'Status')=N'ONLINE' ALTER DATABASE TeamUpDB SET MULTI_USER;
 THROW;
END CATCH;
SELECT name,category FROM TeamUpDB.dbo.Skill WHERE name=N'__Lab06_LOG001';
-- 8. Цэвэрлэгээ — snapshot болон лабораторийн түр мөрүүдийг устгах.
DROP DATABASE TeamUpDB_Lab06Snapshot;

DELETE FROM TeamUpDB.dbo.Skill WHERE name IN
 (N'__Lab06_BACK001',N'__Lab06_BACK002',N'__Lab06_DIFF001',N'__Lab06_DIFF002',N'__Lab06_LOG001');

-- 9. Snapshot-оос буцаасны дараах шинэ Full backup авах.
BACKUP DATABASE TeamUpDB TO DISK=N'C:\Backup\TeamUpDB_AfterSnapshot.bak' WITH INIT,CHECKSUM;
GO

-- 10. SQL SERVER AGENT JOB — долоо хоног бүрийн Full backup-ийн хуваарь үүсгэх; энэ хэсэг backup-ийг шууд эхлүүлэхгүй.
USE msdb;
GO
SELECT servicename,status_desc FROM sys.dm_server_services WHERE servicename LIKE N'SQL Server Agent%';
IF NOT EXISTS(SELECT 1 FROM dbo.sysjobs WHERE name=N'TeamUpDB_WeeklyFullBackup')
BEGIN
 EXEC dbo.sp_add_job @job_name=N'TeamUpDB_WeeklyFullBackup',@enabled=1;
 EXEC dbo.sp_add_jobstep @job_name=N'TeamUpDB_WeeklyFullBackup',@step_name=N'Full Backup',
 @subsystem=N'TSQL',@database_name=N'master',
 @command=N'DECLARE @p nvarchar(260)=N''C:\Backup\TeamUpDB_Auto_''+CONVERT(char(8),GETDATE(),112)+N''_''+REPLACE(CONVERT(char(8),GETDATE(),108),'':'','''')+N''.bak''; BACKUP DATABASE TeamUpDB TO DISK=@p WITH CHECKSUM;';
-- 10.1 Хуваарь — Ням гараг бүр 02:00, SQL Server-ийн орон нутгийн цагаар. Автомат ажиллахад SQL Server Agent шаардлагатай.
 EXEC dbo.sp_add_jobschedule @job_name=N'TeamUpDB_WeeklyFullBackup',@name=N'TeamUp_Lab06_Sunday0200',
 @freq_type=8,@freq_interval=1,@freq_recurrence_factor=1,@active_start_time=020000;
 EXEC dbo.sp_add_jobserver @job_name=N'TeamUpDB_WeeklyFullBackup';
END;
-- 10.2 ШУУД АЖИЛЛУУЛАХ — Agent ажиллаж байхад доорх EXEC мөрийн эхний -- тэмдгийг авч, зөвхөн тэр мөрийг ажиллуулна.
-- EXEC dbo.sp_start_job @job_name=N'TeamUpDB_WeeklyFullBackup';
-- 10.3 Job history — өмнө ажилласан эсэх, амжилт/алдааны түүхийг харах.
EXEC dbo.sp_help_jobhistory @job_name=N'TeamUpDB_WeeklyFullBackup';
GO
