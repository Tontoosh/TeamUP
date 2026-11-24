USE TeamUpDB;
GO
IF OBJECT_ID(N'dbo.Application',N'U') IS NULL OR OBJECT_ID(N'dbo.Membership',N'U') IS NULL
 THROW 51800,N'Эхлээд Lab02 TeamUpDB-г бэлтгэ.',1;
GO

SELECT OBJECT_SCHEMA_NAME(p.object_id) AS SchemaName,OBJECT_NAME(p.object_id) AS TableName,
 i.name,p.partition_number,p.avg_fragmentation_in_percent,p.page_count
FROM sys.dm_db_index_physical_stats(DB_ID(),NULL,NULL,NULL,'LIMITED') p
JOIN sys.indexes i ON i.object_id=p.object_id AND i.index_id=p.index_id
WHERE i.type IN(1,2) AND p.index_level=0 AND p.alloc_unit_type_desc='IN_ROW_DATA'
ORDER BY p.avg_fragmentation_in_percent DESC;
GO

-- @Execute=0 нь арчилгааны командыг зөвхөн харуулна; @RebuildAll, @ArchiveDemo мөн 0 үед идэвхгүй тул хэмжилт, нөөцөө шалгасны дараа шаардлагатайг идэвхжүүлнэ.
DECLARE @Execute bit=0;
DECLARE @cmd nvarchar(max);
DECLARE maintenance CURSOR LOCAL FAST_FORWARD FOR
SELECT N'ALTER INDEX '+QUOTENAME(i.name)+N' ON '+QUOTENAME(s.name)+N'.'+QUOTENAME(t.name)+
 CASE WHEN p.avg_fragmentation_in_percent>30 THEN N' REBUILD PARTITION = '
 ELSE N' REORGANIZE PARTITION = ' END+CONVERT(nvarchar(10),p.partition_number)+
 CASE WHEN p.avg_fragmentation_in_percent>30 THEN N' WITH (ONLINE=OFF);' ELSE N';' END
FROM sys.dm_db_index_physical_stats(DB_ID(),NULL,NULL,NULL,'LIMITED') p
JOIN sys.indexes i ON i.object_id=p.object_id AND i.index_id=p.index_id
JOIN sys.tables t ON t.object_id=i.object_id JOIN sys.schemas s ON s.schema_id=t.schema_id
WHERE t.is_ms_shipped=0 AND i.type IN(1,2) AND i.is_disabled=0 AND i.is_hypothetical=0
AND p.index_level=0 AND p.alloc_unit_type_desc='IN_ROW_DATA'
AND p.page_count>=1000 AND p.avg_fragmentation_in_percent>=10;
OPEN maintenance;
FETCH NEXT FROM maintenance INTO @cmd;
WHILE @@FETCH_STATUS=0
BEGIN
 PRINT @cmd;
 IF @Execute=1 EXEC sys.sp_executesql @cmd;
 FETCH NEXT FROM maintenance INTO @cmd;
END;
CLOSE maintenance;
DEALLOCATE maintenance;
GO

DECLARE @RebuildAll bit=0,@sql nvarchar(max);
IF @RebuildAll=1
BEGIN
 DECLARE all_tables CURSOR LOCAL FAST_FORWARD FOR
 SELECT N'ALTER INDEX ALL ON '+QUOTENAME(s.name)+N'.'+QUOTENAME(t.name)+N' REBUILD;'
 FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id
 WHERE t.is_ms_shipped=0 AND t.is_memory_optimized=0
 AND EXISTS(SELECT 1 FROM sys.indexes i WHERE i.object_id=t.object_id AND i.type IN(1,2));
 OPEN all_tables; FETCH NEXT FROM all_tables INTO @sql;
 WHILE @@FETCH_STATUS=0
 BEGIN EXEC sys.sp_executesql @sql; FETCH NEXT FROM all_tables INTO @sql; END;
 CLOSE all_tables; DEALLOCATE all_tables;
END;
GO

UPDATE STATISTICS dbo.Application WITH FULLSCAN;
UPDATE STATISTICS dbo.[User] WITH FULLSCAN;
EXEC sys.sp_updatestats;
SELECT OBJECT_SCHEMA_NAME(s.object_id) AS SchemaName,OBJECT_NAME(s.object_id) AS TableName,
 s.name,p.last_updated,p.rows,p.rows_sampled
FROM sys.stats s CROSS APPLY sys.dm_db_stats_properties(s.object_id,s.stats_id) p
WHERE s.object_id IN(OBJECT_ID(N'dbo.Application'),OBJECT_ID(N'dbo.[User]'));

GO

DBCC CHECKDB (N'TeamUpDB') WITH NO_INFOMSGS,ALL_ERRORMSGS;
DBCC CHECKDB (N'TeamUpDB') WITH PHYSICAL_ONLY;
DBCC CHECKTABLE (N'dbo.Application') WITH NO_INFOMSGS;
DBCC CHECKALLOC (N'TeamUpDB') WITH NO_INFOMSGS;
DBCC CHECKCATALOG (N'TeamUpDB') WITH NO_INFOMSGS;

GO

-- Доорх repair блок зөвхөн тусдаа гэмтэлтэй туршилтын хуулбарт зориулагдсан; эхлээд цэвэр backup-аас сэргээхийг сонгож, REPAIR_ALLOW_DATA_LOSS-ийг өгөгдөл алдах эрсдэлтэй сүүлийн арга гэж үзнэ.
/*
USE master;
BACKUP DATABASE TeamUpDB TO DISK=N'C:\Backup\TeamUpDB_BeforeRepair.bak'
WITH COPY_ONLY,CHECKSUM;

ALTER DATABASE TeamUpDB SET EMERGENCY;
ALTER DATABASE TeamUpDB SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
BEGIN TRY
 DBCC CHECKDB (N'TeamUpDB',REPAIR_REBUILD) WITH NO_INFOMSGS;
 ALTER DATABASE TeamUpDB SET ONLINE;
 ALTER DATABASE TeamUpDB SET MULTI_USER;
END TRY
BEGIN CATCH
 ALTER DATABASE TeamUpDB SET MULTI_USER;
 THROW;
END CATCH;
DBCC CHECKDB (N'TeamUpDB') WITH NO_INFOMSGS,ALL_ERRORMSGS;

-- DBCC CHECKDB (N'TeamUpDB',REPAIR_ALLOW_DATA_LOSS);
*/
GO

EXEC sys.sp_spaceused;
SELECT TOP(10) s.name AS SchemaName,t.name AS TableName,
 SUM(CASE WHEN p.index_id IN(0,1) THEN p.row_count ELSE 0 END) AS [RowCount],
 CAST(SUM(p.reserved_page_count)*8.0/1024 AS decimal(18,2)) AS ReservedMB,
 CAST(SUM(p.used_page_count)*8.0/1024 AS decimal(18,2)) AS UsedMB,
 CAST(SUM(p.reserved_page_count-p.used_page_count)*8.0/1024 AS decimal(18,2)) AS FreeMB
FROM sys.dm_db_partition_stats p JOIN sys.tables t ON t.object_id=p.object_id
JOIN sys.schemas s ON s.schema_id=t.schema_id GROUP BY s.name,t.name ORDER BY ReservedMB DESC;
GO

DECLARE @path nvarchar(260)=N'C:\Backup\TeamUpDB_Maintenance_'+CONVERT(char(8),GETDATE(),112)+
 N'_'+REPLACE(CONVERT(char(8),GETDATE(),108),':','')+N'.bak';
BACKUP DATABASE TeamUpDB TO DISK=@path WITH COPY_ONLY,CHECKSUM;
RESTORE VERIFYONLY FROM DISK=@path WITH CHECKSUM;
GO

IF SCHEMA_ID(N'lab') IS NULL EXEC(N'CREATE SCHEMA lab AUTHORIZATION dbo;');
GO
IF OBJECT_ID(N'lab.ArchivedApplications',N'U') IS NULL
 CREATE TABLE lab.ArchivedApplications(
 application_id int NOT NULL PRIMARY KEY,user_id int NOT NULL,project_role_id int NOT NULL,
 cover_note nvarchar(1000) NULL,status varchar(10) NOT NULL,submitted_at datetime2 NOT NULL);
GO
SET XACT_ABORT ON;
DECLARE @ArchiveDemo bit=0;
DECLARE @Cutoff datetime2=DATEADD(year,-5,SYSUTCDATETIME());
IF OBJECT_ID(N'lab.ApplicationPerformance',N'U') IS NOT NULL
BEGIN
 SELECT @Cutoff AS ArchiveCutoff,COUNT_BIG(*) AS CandidateRows
 FROM lab.ApplicationPerformance WHERE submitted_at<@Cutoff AND status IN('rejected','withdrawn');
 IF @ArchiveDemo=1
 BEGIN TRY
  BEGIN TRANSACTION;
  DELETE FROM lab.ApplicationPerformance WITH(TABLOCKX)
  OUTPUT deleted.application_id,deleted.user_id,deleted.project_role_id,
   deleted.cover_note,deleted.status,deleted.submitted_at
  INTO lab.ArchivedApplications(application_id,user_id,project_role_id,cover_note,status,submitted_at)
  WHERE submitted_at<@Cutoff AND status IN('rejected','withdrawn');
  DECLARE @Moved int=@@ROWCOUNT;
  COMMIT;
  SELECT @Moved AS ArchivedDemoRows;
 END TRY
 BEGIN CATCH
  IF XACT_STATE()<>0 ROLLBACK;
  THROW;
 END CATCH;
END
ELSE PRINT N'Архивын туршилтад эхлээд Lab07-ийн туслах хүснэгтийг бэлтгэ.';
SELECT COUNT_BIG(*) AS BusinessApplications FROM dbo.Application;
SELECT COUNT_BIG(*) AS BusinessMemberships FROM dbo.Membership;
SELECT COUNT_BIG(*) AS ArchivedDemoRows FROM lab.ArchivedApplications;

GO

IF OBJECT_ID(N'lab.MaintenanceLog',N'U') IS NULL
BEGIN
 CREATE TABLE lab.MaintenanceLog(LogID bigint IDENTITY PRIMARY KEY,LogDate datetime2 NOT NULL,Message nvarchar(200));
 CREATE INDEX IX_Lab08_MaintenanceLog_Date ON lab.MaintenanceLog(LogDate);
 INSERT lab.MaintenanceLog(LogDate,Message) VALUES
 (DATEADD(month,-4,SYSDATETIME()),N'TeamUp арчилгааны хуучин тест лог'),(SYSDATETIME(),N'TeamUp арчилгааны шинэ тест лог');
END;
GO
DECLARE @LogCutoff datetime2=DATEADD(month,-3,SYSDATETIME()),@Deleted int=1,@Total bigint=0;
SELECT COUNT_BIG(*) AS CandidateLogs FROM lab.MaintenanceLog WHERE LogDate<@LogCutoff;

WHILE @Deleted>0
BEGIN
 DELETE TOP(1000) FROM lab.MaintenanceLog WHERE LogDate<@LogCutoff;
 SET @Deleted=@@ROWCOUNT; SET @Total+=@Deleted;
 IF @Deleted>0 WAITFOR DELAY '00:00:01';
END;
SELECT @Total AS DeletedLogs;

GO

SELECT @@VERSION AS VersionInfo,SERVERPROPERTY('ProductVersion') AS ProductVersion,
 SERVERPROPERTY('ProductLevel') AS ProductLevel,SERVERPROPERTY('Edition') AS Edition;
SELECT name,compatibility_level FROM sys.databases WHERE name=DB_NAME();
GO
