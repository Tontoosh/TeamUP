-- Lab03 — JOIN, нэгтгэл, харагдац, индекс ба гүйлгээ. Эхлээд Lab02-ийг бэлтгэнэ.
USE TeamUpDB;
GO
SET NOCOUNT ON;

-- 1. INNER JOIN — хэрэглэгчийг бүртгэлтэй ур чадвартай нь холбох.
SELECT u.display_name,s.name,us.level,us.experience_months
FROM dbo.[User] u JOIN dbo.UserSkill us ON us.user_id=u.user_id
JOIN dbo.Skill s ON s.skill_id=us.skill_id;
SELECT COUNT(*) AS UsersWithoutSkills FROM dbo.[User] u
WHERE NOT EXISTS(SELECT 1 FROM dbo.UserSkill us WHERE us.user_id=u.user_id);

-- 2. LEFT JOIN — ур чадваргүй хэрэглэгчийг мөн үр дүнд хадгалах.
SELECT u.display_name,ISNULL(s.name,N'Ур чадвар оруулаагүй') AS Skill
FROM dbo.[User] u LEFT JOIN dbo.UserSkill us ON us.user_id=u.user_id
LEFT JOIN dbo.Skill s ON s.skill_id=us.skill_id;
SELECT u.user_id,u.display_name FROM dbo.[User] u
LEFT JOIN dbo.UserSkill us ON us.user_id=u.user_id WHERE us.user_skill_id IS NULL;

-- 3. GROUP BY — төсөл бүрийн орон тооны тоо, дундаж ба хамгийн их багтаамж.
SELECT p.title,COUNT(r.project_role_id) AS RoleCount,
 AVG(CONVERT(decimal(10,2),r.required_count)) AS AverageCapacity,
 MAX(r.required_count) AS MaxCapacity
FROM dbo.Project p LEFT JOIN dbo.ProjectRole r ON r.project_id=p.project_id
GROUP BY p.project_id,p.title ORDER BY RoleCount DESC;

-- 4. Дэд асуулга — идэвхтэй хэрэглэгчдийн дунджаас өндөр туршлагатай хүмүүс.
SELECT u.display_name,s.name,us.experience_months
FROM dbo.UserSkill us JOIN dbo.[User] u ON u.user_id=us.user_id
JOIN dbo.Skill s ON s.skill_id=us.skill_id
WHERE u.account_status='active' AND us.experience_months>(
 SELECT AVG(CONVERT(decimal(10,2),x.experience_months)) FROM dbo.UserSkill x
 JOIN dbo.[User] y ON y.user_id=x.user_id WHERE y.account_status='active');
GO

-- Сул орон тоог идэвхтэй гишүүдийн тооноос тооцож, зөвхөн элсэлт нээлттэй төслийн дүүрээгүй орон тоог харуулна.
-- 5. VIEW — элсэлт нээлттэй, сул орон тоотой төслүүдийн харагдац.
CREATE OR ALTER VIEW dbo.vw_OpenRoles AS
SELECT p.project_id,p.title,p.work_mode,r.project_role_id,r.role_name,
 r.required_count,COUNT(m.membership_id) AS ActiveMembers,
 r.required_count-COUNT(m.membership_id) AS AvailableSeats
FROM dbo.Project p JOIN dbo.ProjectRole r ON r.project_id=p.project_id
LEFT JOIN dbo.Membership m ON m.project_role_id=r.project_role_id AND m.member_status='active'
WHERE p.status='recruiting' AND r.status='open'
GROUP BY p.project_id,p.title,p.work_mode,r.project_role_id,r.role_name,r.required_count
HAVING COUNT(m.membership_id)<r.required_count;
GO
SELECT * FROM dbo.vw_OpenRoles;
SELECT v.*,s.name AS RequiredSkill FROM dbo.vw_OpenRoles v
JOIN dbo.RoleSkill rs ON rs.project_role_id=v.project_role_id
JOIN dbo.Skill s ON s.skill_id=rs.skill_id
WHERE v.work_mode='remote' AND rs.is_required=1;

-- 6. Индексүүд — туршлага, төслийн төлөв, идэвхтэй гишүүдийн хайлт.
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_UserSkill_Experience' AND object_id=OBJECT_ID('dbo.UserSkill'))
 CREATE INDEX IX_UserSkill_Experience ON dbo.UserSkill(experience_months);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_Project_Status' AND object_id=OBJECT_ID('dbo.Project'))
 CREATE INDEX IX_Project_Status ON dbo.Project(status);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_Membership_Role_Status' AND object_id=OBJECT_ID('dbo.Membership'))
 CREATE INDEX IX_Membership_Role_Status ON dbo.Membership(project_role_id,member_status);
SELECT OBJECT_NAME(object_id) AS TableName,name,type_desc,is_unique
FROM sys.indexes WHERE object_id IN (OBJECT_ID('dbo.Project'),OBJECT_ID('dbo.UserSkill'),OBJECT_ID('dbo.Membership'));
GO

-- Зөвшөөрөл ба гишүүнчлэлийг нэг гүйлгээнд хийж, UPDLOCK/HOLDLOCK-оор зэрэгцээ элсэлтийн багтаамжийг хамгаална; эзэмшигчийн ID-г баталгаажсан хэрэглэгчээс авна.
-- 7. Процедур — эзэмшигчийн эрх ба сул орон тоог шалгаж хүсэлт зөвшөөрөх.
CREATE OR ALTER PROCEDURE dbo.usp_AcceptApplication
 @application_id int,@owner_user_id int
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF @@TRANCOUNT<>0 THROW 51010,N'Гаднах transaction-гүй ажиллуулна.',1;
 BEGIN TRY
  BEGIN TRANSACTION;
  DECLARE @role int,@user int,@project int,@capacity int,@owner int,
          @role_status varchar(10),@project_status varchar(15),@state varchar(10);
  SELECT @role=project_role_id FROM dbo.Application WHERE application_id=@application_id;
  IF @role IS NULL THROW 51011,N'Хүсэлт олдсонгүй.',1;

  SELECT @project=project_id FROM dbo.ProjectRole WHERE project_role_id=@role;
  SELECT @owner=owner_user_id,@project_status=status
  FROM dbo.Project WITH(UPDLOCK,HOLDLOCK) WHERE project_id=@project;
  SELECT @capacity=required_count,@role_status=status
  FROM dbo.ProjectRole WITH(UPDLOCK,HOLDLOCK) WHERE project_role_id=@role;
  SELECT @user=user_id,@state=status FROM dbo.Application WITH(UPDLOCK,HOLDLOCK)
  WHERE application_id=@application_id;

  IF @owner_user_id IS NULL OR @owner IS NULL OR @owner<>@owner_user_id THROW 51012,N'Зөвхөн төслийн эзэмшигч зөвшөөрнө.',1;
  IF @user=@owner THROW 51013,N'Эзэмшигч өөрийн төсөлд хүсэлт гаргахгүй.',1;
  IF @state<>'pending' THROW 51014,N'Зөвхөн pending хүсэлтийг зөвшөөрнө.',1;
  IF @project_status<>'recruiting' OR @role_status<>'open'
   THROW 51015,N'Элсэлт хаалттай.',1;
  IF NOT EXISTS(SELECT 1 FROM dbo.[User] WHERE user_id=@user AND account_status='active')
   THROW 51016,N'Хэрэглэгч идэвхгүй.',1;
  IF EXISTS(SELECT 1 FROM dbo.Membership WHERE user_id=@user AND project_id=@project)
   THROW 51017,N'Энэ хэрэглэгч төслийн гишүүнчлэлтэй.',1;
  IF (SELECT COUNT(*) FROM dbo.Membership WHERE project_role_id=@role AND member_status='active')>=@capacity
   THROW 51018,N'Орон тоо дүүрсэн.',1;
  UPDATE dbo.Application SET status='accepted' WHERE application_id=@application_id;
  INSERT dbo.Membership(application_id,user_id,project_role_id,project_id)
  VALUES(@application_id,@user,@role,@project);
  COMMIT;
 END TRY
 BEGIN CATCH
  IF XACT_STATE()<>0 ROLLBACK;
  THROW;
 END CATCH
END;
GO

-- 8. Эерэг тест — түр хүсэлт зөвшөөрөөд, туршилтын хүсэлт/гишүүнчлэлийг цэвэрлэх.
DECLARE @TestApplication int;
INSERT dbo.Application(user_id,project_role_id,cover_note)
VALUES(3,1,N'Lab03 түр эерэг тест');
SET @TestApplication=CONVERT(int,SCOPE_IDENTITY());
BEGIN TRY
 EXEC dbo.usp_AcceptApplication @TestApplication,1;
 SELECT a.application_id,a.status,m.membership_id
 FROM dbo.Application a JOIN dbo.Membership m ON m.application_id=a.application_id
 WHERE a.application_id=@TestApplication;
 DELETE dbo.Membership WHERE application_id=@TestApplication;
 DELETE dbo.Application WHERE application_id=@TestApplication;
END TRY
BEGIN CATCH
 DELETE dbo.Membership WHERE application_id=@TestApplication;
 DELETE dbo.Application WHERE application_id=@TestApplication;
 THROW;
END CATCH;

-- 9. Сөрөг тест — эзэмшигч биш хэрэглэгч хүсэлт зөвшөөрөхөд алдаа өгөх.
BEGIN TRY
 EXEC dbo.usp_AcceptApplication 2,3;
 THROW 51019,N'Эрхийн шалгалт амжилтгүй.',1;
END TRY
BEGIN CATCH
 IF ERROR_NUMBER()<>51012 THROW;
 PRINT N'Хүлээгдсэн ROLLBACK: '+ERROR_MESSAGE();
END CATCH;
SELECT a.application_id,a.status,m.membership_id FROM dbo.Application a
LEFT JOIN dbo.Membership m ON m.application_id=a.application_id;

-- 10. SAVEPOINT — эхний засварыг хадгалж, availability-ийн дараагийн засварыг буцаах.
BEGIN TRANSACTION;
 UPDATE dbo.Profile SET bio=N'Frontend төсөлд ажиллах боломжтой' WHERE user_id=2;
 SAVE TRANSACTION ProfileSaved;
 UPDATE dbo.Profile SET availability='busy' WHERE user_id=2;
 ROLLBACK TRANSACTION ProfileSaved;
COMMIT;
SELECT * FROM dbo.Profile WHERE user_id=2;

-- 11. SERIALIZABLE — орон тооны багтаамжийг идэвхтэй гишүүдийн тоотой тулгах.
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @capacity int;
 SELECT @capacity=required_count FROM dbo.ProjectRole WITH(UPDLOCK) WHERE project_role_id=1;
 IF @capacity<(SELECT COUNT(*) FROM dbo.Membership WHERE project_role_id=1 AND member_status='active')
  THROW 51020,N'Идэвхтэй гишүүдээс цөөн багтаамж зөвшөөрөхгүй.',1;
 UPDATE dbo.ProjectRole SET required_count=@capacity WHERE project_role_id=1;
 COMMIT;
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK;
 SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
 THROW;
END CATCH;
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
SELECT COUNT(*) AS ApplicationCount FROM dbo.Application;
SELECT COUNT(*) AS MembershipCount FROM dbo.Membership;
