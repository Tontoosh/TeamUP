-- Lab09 — HA тохиргооны сонголтууд: A. Mirroring, B. Log Shipping, C. Always On AG. Энэ лабораторийн ажиллуулалтыг дараа хийнэ.
-- Файлыг бүхэлд нь ажиллуулахгүй: Mirroring, Log Shipping, AG-ээс нэгийг сонгож, PRIMARY/SECONDARY блокийг тохирох холболт дээр ажиллуулна; өмнөх HA тохиргоог эхлээд салгана.
-- Жишээ instance/DNS/IP/замыг бодит утгаар сольж, endpoint эрх, firewall, backup share, SQL Agent-ийг бэлтгэнэ; AG-д WSFC ба Always On шаардлагатай, failover-ийг SYNCHRONIZED төлөвт хийнэ.

-- A1. PRIMARY: шинэ жишээ сан үүсгэхгүй; Lab02-ийн TeamUpDB-г нөөцөлнө.
/*
USE master;
GO
IF DB_ID(N'TeamUpDB') IS NULL THROW 51900,N'PRIMARY дээр Lab02 TeamUpDB шаардлагатай.',1;
IF OBJECT_ID(N'TeamUpDB.dbo.Project',N'U') IS NULL THROW 51901,N'TeamUp хүснэгт олдсонгүй.',1;
ALTER DATABASE TeamUpDB SET RECOVERY FULL;
BACKUP DATABASE TeamUpDB TO DISK=N'C:\Backups\TeamUpDB_Full.bak' WITH INIT,CHECKSUM;
BACKUP LOG TeamUpDB TO DISK=N'C:\Backups\TeamUpDB_Log.trn' WITH INIT,CHECKSUM;
GO
*/
-- A2. Хоёр backup-ийг SECONDARY-ийн C:\Backups руу хуулсны дараа SECONDARY:
/*
USE master;
RESTORE FILELISTONLY FROM DISK=N'C:\Backups\TeamUpDB_Full.bak';

RESTORE DATABASE TeamUpDB FROM DISK=N'C:\Backups\TeamUpDB_Full.bak' WITH NORECOVERY,CHECKSUM;
RESTORE LOG TeamUpDB FROM DISK=N'C:\Backups\TeamUpDB_Log.trn' WITH NORECOVERY,CHECKSUM;
GO
*/
-- A3. PRIMARY endpoint. Нэг instance-д ганц database mirroring endpoint байна.

/*
USE master;
GO
IF NOT EXISTS(SELECT 1 FROM sys.database_mirroring_endpoints)
 EXEC(N'CREATE ENDPOINT TeamUp_Endpoint STATE=STARTED
 AS TCP(LISTENER_PORT=5022) FOR DATABASE_MIRRORING
 (ROLE=ALL,AUTHENTICATION=WINDOWS NEGOTIATE,ENCRYPTION=REQUIRED ALGORITHM AES);');
SELECT e.name,e.state_desc,t.port FROM sys.endpoints e JOIN sys.tcp_endpoints t ON t.endpoint_id=e.endpoint_id
WHERE e.type_desc='DATABASE_MIRRORING';
GO
*/
-- A4. SECONDARY endpoint (өөр connection-д сонгож ажиллуул):
/*
USE master;
IF NOT EXISTS(SELECT 1 FROM sys.database_mirroring_endpoints)
 EXEC(N'CREATE ENDPOINT TeamUp_Endpoint STATE=STARTED
 AS TCP(LISTENER_PORT=5023) FOR DATABASE_MIRRORING
 (ROLE=ALL,AUTHENTICATION=WINDOWS NEGOTIATE,ENCRYPTION=REQUIRED ALGORITHM AES);');
GO
*/
-- Endpoint account жишээ (хоёр талд эсрэг талын бодит service account-аар солино):
-- CREATE LOGIN [DOMAIN\SqlSecondarySvc] FROM WINDOWS; -- PRIMARY дээр
-- GRANT CONNECT ON ENDPOINT::TeamUp_Endpoint TO [DOMAIN\SqlSecondarySvc];
-- CREATE LOGIN [DOMAIN\SqlPrimarySvc] FROM WINDOWS; -- SECONDARY дээр
-- GRANT CONNECT ON ENDPOINT::TeamUp_Endpoint TO [DOMAIN\SqlPrimarySvc];

-- A5. ЭХЛЭЭД SECONDARY:

-- ДАРАА НЬ PRIMARY (DNS-г солиод сонгож ажиллуул):

-- Optional witness: 3 дахь instance дээр ROLE=WITNESS endpoint ба authentication
-- тохируулсны дараа principal дээр SET WITNESS. Witness-гүй бол manual failover.
-- ALTER DATABASE TeamUpDB SET WITNESS=N'TCP://WITNESSSQL:5024';
-- A6. Хоёр талд шалгах
SELECT d.name,m.mirroring_state_desc,m.mirroring_role_desc,m.mirroring_safety_level_desc,
 m.mirroring_witness_state_desc FROM sys.database_mirroring m
JOIN sys.databases d ON d.database_id=m.database_id WHERE d.name=N'TeamUpDB';
-- A7. Зөвхөн SYNCHRONIZED / SAFETY FULL үед одоогийн PRINCIPAL дээр:
-- ALTER DATABASE TeamUpDB SET PARTNER FAILOVER;
-- Шинэ PRINCIPAL дээр SELECT project_id,title,status FROM TeamUpDB.dbo.Project;
GO
-- B. LOG SHIPPING: мөн TeamUpDB. A/C-ийн тохиргоо, job-гүй цэвэр төлөвөөс эхэл.

/*
USE master;
GO
IF DB_ID(N'TeamUpDB') IS NULL THROW 51902,N'PRIMARY дээр TeamUpDB шаардлагатай.',1;
ALTER DATABASE TeamUpDB SET RECOVERY FULL;
BACKUP DATABASE TeamUpDB TO DISK=N'C:\Backups\TeamUpDB_LS_Init.bak' WITH INIT,CHECKSUM;
GO
*/
-- B1. SECONDARY: init backup-ийг хуулж, primary job-уудыг эхлүүлэхээс ӨМНӨ сэргээ.
/*
USE master;
RESTORE DATABASE TeamUpDB FROM DISK=N'C:\Backups\TeamUpDB_LS_Init.bak' WITH NORECOVERY,CHECKSUM;
GO
*/
-- B2. PRIMARY: \PrimaryServer\LogShipping share нь local Backup folder-ийг заана.

/*
USE msdb;
DECLARE @BackupJob uniqueidentifier,@PrimaryID uniqueidentifier,@Schedule int;
EXEC dbo.sp_add_log_shipping_primary_database
 @database=N'TeamUpDB',@backup_directory=N'C:\LogShipping\Backup',
 @backup_share=N'\\PrimaryServer\LogShipping\Backup',
 @backup_job_name=N'LSBackup_TeamUpDB',@backup_retention_period=4320,
 @backup_threshold=60,@threshold_alert_enabled=1,@history_retention_period=5760,
 @backup_job_id=@BackupJob OUTPUT,@primary_id=@PrimaryID OUTPUT;
EXEC dbo.sp_add_jobschedule @job_id=@BackupJob,@name=N'LSBackup_15min',
 @freq_type=4,@freq_interval=1,@freq_subday_type=4,@freq_subday_interval=15,
 @active_start_time=000000,@schedule_id=@Schedule OUTPUT;
EXEC dbo.sp_update_job @job_id=@BackupJob,@enabled=1;

EXEC dbo.sp_add_log_shipping_primary_secondary
 @primary_database=N'TeamUpDB',@secondary_server=N'SecondaryServerName',
 @secondary_database=N'TeamUpDB';
GO
*/
-- B3. SECONDARY: output хувьсагч болон secondary database бүртгэлийг гүйцээнэ.
/*
USE msdb;
DECLARE @SecondaryID uniqueidentifier,@CopyJob uniqueidentifier,@RestoreJob uniqueidentifier;
EXEC dbo.sp_add_log_shipping_secondary_primary
 @primary_server=N'PrimaryServerName',@primary_database=N'TeamUpDB',
 @backup_source_directory=N'\\PrimaryServer\LogShipping\Backup',
 @backup_destination_directory=N'C:\LogShipping\Secondary',
 @copy_job_name=N'LSCopy_TeamUpDB',@restore_job_name=N'LSRestore_TeamUpDB',
 @file_retention_period=4320,@secondary_id=@SecondaryID OUTPUT,
 @copy_job_id=@CopyJob OUTPUT,@restore_job_id=@RestoreJob OUTPUT;
EXEC dbo.sp_add_log_shipping_secondary_database
 @secondary_database=N'TeamUpDB',@primary_server=N'PrimaryServerName',
 @primary_database=N'TeamUpDB',@restore_delay=0,@restore_mode=0,
 @disconnect_users=1,@restore_threshold=45,@threshold_alert_enabled=1,@history_retention_period=5760;
EXEC dbo.sp_add_jobschedule @job_id=@CopyJob,@name=N'LSCopy_15min',
 @freq_type=4,@freq_interval=1,@freq_subday_type=4,@freq_subday_interval=15,@active_start_time=000100;
EXEC dbo.sp_add_jobschedule @job_id=@RestoreJob,@name=N'LSRestore_15min',
 @freq_type=4,@freq_interval=1,@freq_subday_type=4,@freq_subday_interval=15,@active_start_time=000200;
EXEC dbo.sp_update_job @job_id=@CopyJob,@enabled=1;
EXEC dbo.sp_update_job @job_id=@RestoreJob,@enabled=1;
GO
*/
-- B4. Primary/Secondary-д тохирох monitor query (хоосон байвал тохиргоо шалга).
SELECT primary_server,primary_database,last_backup_date,last_backup_file,backup_threshold
FROM msdb.dbo.log_shipping_monitor_primary WHERE primary_database=N'TeamUpDB';
SELECT secondary_server,secondary_database,last_copied_file,last_copied_date,
 last_restored_file,last_restored_date FROM msdb.dbo.log_shipping_monitor_secondary WHERE secondary_database=N'TeamUpDB';

GO
-- C. ALWAYS ON AG: мөн TeamUpDB. A/B-ийн тохиргоо, job-уудыг өмнө нь салгасан байна.

SELECT SERVERPROPERTY('IsHadrEnabled') AS AlwaysOnEnabled;
-- C1. PRIMARY: байгаа TeamUpDB-г нөөцөлнө. Automatic seeding-д SECONDARY дээр

/*
USE master;
GO
IF DB_ID(N'TeamUpDB') IS NULL THROW 51903,N'PRIMARY дээр Lab02 TeamUpDB шаардлагатай.',1;
ALTER DATABASE TeamUpDB SET RECOVERY FULL;
BACKUP DATABASE TeamUpDB TO DISK=N'C:\Backups\TeamUpDB_AG_Init.bak' WITH INIT,CHECKSUM;
BACKUP LOG TeamUpDB TO DISK=N'C:\Backups\TeamUpDB_AG_Init.trn' WITH INIT,CHECKSUM;
GO
*/
-- C2. A3/A4-ийн ROLE=ALL endpoint-уудыг ашиглана; шинэ 5022 endpoint давхар үүсгэхгүй.

-- C3. PRIMARY: нэр, DNS, port-оо бодитоор солиод ажиллуул.
/*
USE master;
CREATE AVAILABILITY GROUP TeamUp_AG
WITH(AUTOMATED_BACKUP_PREFERENCE=PRIMARY)
FOR DATABASE TeamUpDB
REPLICA ON
 N'PrimaryServerName' WITH(ENDPOINT_URL=N'TCP://PRIMARYSQL:5022',
 AVAILABILITY_MODE=SYNCHRONOUS_COMMIT,FAILOVER_MODE=AUTOMATIC,
 SEEDING_MODE=AUTOMATIC,SECONDARY_ROLE(ALLOW_CONNECTIONS=READ_ONLY)),
 N'SecondaryServerName' WITH(ENDPOINT_URL=N'TCP://SECONDARYSQL:5023',
 AVAILABILITY_MODE=SYNCHRONOUS_COMMIT,FAILOVER_MODE=AUTOMATIC,
 SEEDING_MODE=AUTOMATIC,SECONDARY_ROLE(ALLOW_CONNECTIONS=READ_ONLY));
GO
*/
-- C4. SECONDARY: automatic seeding data/log folder зай, service эрхийг шалга.
/*
USE master;
ALTER AVAILABILITY GROUP TeamUp_AG JOIN;
ALTER AVAILABILITY GROUP TeamUp_AG GRANT CREATE ANY DATABASE;
GO
*/
-- C5. PRIMARY: сүлжээний админтай тохирсон сул IP/DNS/cluster эрхээр солино.

-- C6. Хоёр replica дээр төлөв; SYNCHRONIZED болсны дараа failover.
SELECT ag.name,ar.replica_server_name,rs.role_desc,rs.operational_state_desc,
 rs.synchronization_health_desc
FROM sys.availability_groups ag JOIN sys.availability_replicas ar ON ar.group_id=ag.group_id
LEFT JOIN sys.dm_hadr_availability_replica_states rs ON rs.replica_id=ar.replica_id WHERE ag.name=N'TeamUp_AG';
SELECT DB_NAME(database_id) AS DBName,is_local,synchronization_state_desc,
 synchronization_health_desc,is_suspended FROM sys.dm_hadr_database_replica_states WHERE database_id=DB_ID(N'TeamUpDB');
-- C7. Manual failover нь PRIMARY биш зорилтот SYNCHRONIZED SECONDARY дээр:
-- ALTER AVAILABILITY GROUP TeamUp_AG FAILOVER;
-- Listener-ээр дахин холбогдож шинэ PRIMARY дээр:
-- SELECT @@SERVERNAME AS NewPrimary; SELECT project_id,title,status FROM TeamUpDB.dbo.Project;
GO

-- D. Нэмэлт хяналт — primary replica, mirroring төлөв, SQL Agent үйлчилгээ ба availability тооцооны жишээ.
SELECT ag.name,gs.primary_replica,gs.primary_recovery_health_desc
FROM sys.availability_groups ag JOIN sys.dm_hadr_availability_group_states gs ON gs.group_id=ag.group_id WHERE ag.name=N'TeamUp_AG';
SELECT d.name,m.mirroring_state_desc,m.mirroring_role_desc
FROM sys.databases d JOIN sys.database_mirroring m ON m.database_id=d.database_id
WHERE d.name=N'TeamUpDB' AND m.mirroring_state IS NOT NULL;
SELECT servicename,status_desc FROM sys.dm_server_services WHERE servicename LIKE N'SQL Server Agent%';
SELECT CAST(500.0/(500+1)*100 AS decimal(8,3)) AS ExampleAvailabilityPercent;

GO
