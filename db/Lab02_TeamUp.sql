-- Lab02 — Өгөгдлийн сан, хүснэгт, суурь өгөгдөл ба CRUD туршилт.
USE master;
GO
-- 1. TeamUpDB сан үүсгэх — шинэ санд нэг удаа ажиллуулах хэсэг.
CREATE DATABASE TeamUpDB;
GO
USE TeamUpDB;
GO

-- Гадаад түлхүүрүүд NO ACTION тул холбоотой хүсэлт, гишүүнчлэлийн түүхийг санамсаргүй устгахаас хамгаална.
-- 2. User хүснэгт — хэрэглэгчийн нэр, давхцахгүй имэйл, төлөв.
CREATE TABLE dbo.[User](
 user_id int IDENTITY PRIMARY KEY,
 display_name nvarchar(100) NOT NULL,
 email nvarchar(254) NOT NULL UNIQUE
 CHECK (email like N'%@%'),
 account_status varchar(10) NOT NULL DEFAULT 'active'
 CHECK(account_status IN ('active','suspended'))
);
-- 2.1 Profile хүснэгт — хэрэглэгч бүрийн нэг профайл.
CREATE TABLE dbo.Profile(
 profile_id int IDENTITY PRIMARY KEY,
 user_id int NOT NULL UNIQUE REFERENCES dbo.[User](user_id),
 bio nvarchar(1000) NULL,
 availability varchar(10) NOT NULL DEFAULT 'available'
 CHECK(availability IN ('available','busy')),
 portfolio_url nvarchar(500) NULL
);
-- 2.2 Skill хүснэгт — ур чадварын лавлах.
CREATE TABLE dbo.Skill(
 skill_id int IDENTITY PRIMARY KEY,
 name nvarchar(100) NOT NULL UNIQUE,
 category nvarchar(100) NOT NULL
);
-- 2.3 UserSkill хүснэгт — хэрэглэгчийн ур чадвар, түвшин ба туршлага.
CREATE TABLE dbo.UserSkill(
 user_skill_id int IDENTITY PRIMARY KEY,
 user_id int NOT NULL REFERENCES dbo.[User](user_id),
 skill_id int NOT NULL REFERENCES dbo.Skill(skill_id),
 level varchar(20) NOT NULL CHECK(level IN ('beginner','intermediate','advanced')),
 experience_months int NOT NULL DEFAULT 0 CHECK(experience_months>=0),
 experience_years AS (CONVERT(decimal(8,2),experience_months/12.0)),
 UNIQUE(user_id,skill_id)
);
-- 2.4 Project хүснэгт — төслийн эзэмшигч, тайлбар, төлөв ба ажлын хэлбэр.
CREATE TABLE dbo.Project(
 project_id int IDENTITY PRIMARY KEY,
 owner_user_id int NOT NULL REFERENCES dbo.[User](user_id),
 title nvarchar(200) NOT NULL,
 description nvarchar(2000) NULL,
 status varchar(15) NOT NULL DEFAULT 'draft'
 CHECK(status IN ('draft','recruiting','active','completed','archived')),
 work_mode varchar(10) NOT NULL CHECK(work_mode IN ('remote','onsite','hybrid'))
);
-- 2.5 ProjectRole хүснэгт — төслийн шаардлагатай үүрэг ба орон тоо.
CREATE TABLE dbo.ProjectRole(
 project_role_id int IDENTITY PRIMARY KEY,
 project_id int NOT NULL REFERENCES dbo.Project(project_id),
 role_name nvarchar(100) NOT NULL,
 required_count int NOT NULL CHECK(required_count>0),
 status varchar(10) NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
 UNIQUE(project_role_id,project_id)
);
-- 2.6 RoleSkill хүснэгт — орон тоонд шаардагдах ур чадвар.
CREATE TABLE dbo.RoleSkill(
 role_skill_id int IDENTITY PRIMARY KEY,
 project_role_id int NOT NULL REFERENCES dbo.ProjectRole(project_role_id),
 skill_id int NOT NULL REFERENCES dbo.Skill(skill_id),
 minimum_level varchar(20) NOT NULL CHECK(minimum_level IN ('beginner','intermediate','advanced')),
 is_required bit NOT NULL DEFAULT 1,
 UNIQUE(project_role_id,skill_id)
);
-- 2.7 Application хүснэгт — хэрэглэгчийн элсэх хүсэлт ба төлөв.
CREATE TABLE dbo.Application(
 application_id int IDENTITY PRIMARY KEY,
 user_id int NOT NULL REFERENCES dbo.[User](user_id),
 project_role_id int NOT NULL REFERENCES dbo.ProjectRole(project_role_id),
 cover_note nvarchar(1000) NULL,
 status varchar(10) NOT NULL DEFAULT 'pending'
 CHECK(status IN ('pending','accepted','rejected','withdrawn')),
 submitted_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
 UNIQUE(user_id,project_role_id),
 UNIQUE(application_id,user_id,project_role_id)
);
-- 2.8 Membership хүснэгт — зөвшөөрсөн хүсэлттэй холбоотой гишүүнчлэлийн түүх.
CREATE TABLE dbo.Membership(
 membership_id int IDENTITY PRIMARY KEY,
 application_id int NOT NULL UNIQUE,
 user_id int NOT NULL,
 project_role_id int NOT NULL,
 project_id int NOT NULL,
 joined_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
 member_status varchar(10) NOT NULL DEFAULT 'active' CHECK(member_status IN ('active','left')),
 UNIQUE(user_id,project_id),
 FOREIGN KEY(application_id,user_id,project_role_id)
 REFERENCES dbo.Application(application_id,user_id,project_role_id),
 FOREIGN KEY(project_role_id,project_id)
 REFERENCES dbo.ProjectRole(project_role_id,project_id)
);

-- 3. ALTER TABLE — түр багана нэмэх, хэмжээг өөрчлөх, устгах жишээ.
ALTER TABLE dbo.Profile ADD lab_note nvarchar(50) NULL;
ALTER TABLE dbo.Profile ALTER COLUMN lab_note nvarchar(200) NULL;
ALTER TABLE dbo.Profile DROP COLUMN lab_note;
GO

-- User ба Profile-ийг нэг гүйлгээгээр бүртгэнэ; алдаа гарвал хоёуланг буцааж, дутуу бүртгэл үүсгэхгүй.
-- 4. Бүртгэлийн процедур — User болон Profile-ийг хамт үүсгэх.
CREATE OR ALTER PROCEDURE dbo.usp_RegisterUser
 @display_name nvarchar(100), @email nvarchar(254), @bio nvarchar(1000)=NULL
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;

 IF @@TRANCOUNT<>0 THROW 51002,N'Гаднах transaction-гүй ажиллуулна.',1;
 BEGIN TRY
  BEGIN TRANSACTION;
  INSERT dbo.[User](display_name,email) VALUES(@display_name,@email);
  DECLARE @id int=CONVERT(int,SCOPE_IDENTITY());
  INSERT dbo.Profile(user_id,bio) VALUES(@id,@bio);
  COMMIT;
 END TRY
 BEGIN CATCH
  IF XACT_STATE()<>0 ROLLBACK;
  THROW;
 END CATCH
END;
GO

-- 5. Суурь өгөгдөл — 20 хэрэглэгч ба профайл бүртгэх.
EXEC dbo.usp_RegisterUser N'Бат',N'bat@example.com',N'TeamUp оролцогч 1';
EXEC dbo.usp_RegisterUser N'Номин',N'nomin@example.com',N'TeamUp оролцогч 2';
EXEC dbo.usp_RegisterUser N'Саруул',N'saruul@example.com',N'TeamUp оролцогч 3';
EXEC dbo.usp_RegisterUser N'Тэмүүлэн',N'temuulen@example.com',N'TeamUp оролцогч 4';
EXEC dbo.usp_RegisterUser N'Энх',N'enkh@example.com',N'TeamUp оролцогч 5';
EXEC dbo.usp_RegisterUser N'Батболд',N'batbold@example.com',N'TeamUp оролцогч 6';
EXEC dbo.usp_RegisterUser N'Анужин',N'user7@example.com',N'TeamUp оролцогч 7';
EXEC dbo.usp_RegisterUser N'Мөнх',N'user8@example.com',N'TeamUp оролцогч 8';
EXEC dbo.usp_RegisterUser N'Хулан',N'user9@example.com',N'TeamUp оролцогч 9';
EXEC dbo.usp_RegisterUser N'Төгөлдөр',N'user10@example.com',N'TeamUp оролцогч 10';
EXEC dbo.usp_RegisterUser N'Солонго',N'user11@example.com',N'TeamUp оролцогч 11';
EXEC dbo.usp_RegisterUser N'Билгүүн',N'user12@example.com',N'TeamUp оролцогч 12';
EXEC dbo.usp_RegisterUser N'Энэрэл',N'user13@example.com',N'TeamUp оролцогч 13';
EXEC dbo.usp_RegisterUser N'Тэнгис',N'user14@example.com',N'TeamUp оролцогч 14';
EXEC dbo.usp_RegisterUser N'Марал',N'user15@example.com',N'TeamUp оролцогч 15';
EXEC dbo.usp_RegisterUser N'Ирмүүн',N'user16@example.com',N'TeamUp оролцогч 16';
EXEC dbo.usp_RegisterUser N'Сэлэнгэ',N'user17@example.com',N'TeamUp оролцогч 17';
EXEC dbo.usp_RegisterUser N'Түшиг',N'user18@example.com',N'TeamUp оролцогч 18';
EXEC dbo.usp_RegisterUser N'Уянга',N'user19@example.com',N'TeamUp оролцогч 19';
EXEC dbo.usp_RegisterUser N'Оргил',N'user20@example.com',N'TeamUp оролцогч 20';
-- 5.1 Ур чадварын лавлахад 20 мөр нэмэх.
INSERT dbo.Skill(name,category) VALUES(N'React',N'Технологи');
INSERT dbo.Skill(name,category) VALUES(N'Python',N'Технологи');
INSERT dbo.Skill(name,category) VALUES(N'Figma',N'Технологи');
INSERT dbo.Skill(name,category) VALUES(N'SQL Server',N'Технологи');
INSERT dbo.Skill(name,category) VALUES(N'Git',N'Технологи');
INSERT dbo.Skill(name,category) VALUES(N'JavaScript',N'Технологи');
INSERT dbo.Skill(name,category) VALUES(N'TypeScript',N'Технологи');
INSERT dbo.Skill(name,category) VALUES(N'HTML',N'Технологи');
INSERT dbo.Skill(name,category) VALUES(N'CSS',N'Технологи');
INSERT dbo.Skill(name,category) VALUES(N'Node.js',N'Технологи');
INSERT dbo.Skill(name,category) VALUES(N'Java',N'Технологи');
INSERT dbo.Skill(name,category) VALUES(N'C#',N'Технологи');
INSERT dbo.Skill(name,category) VALUES(N'Docker',N'Технологи');
INSERT dbo.Skill(name,category) VALUES(N'PostgreSQL',N'Технологи');
INSERT dbo.Skill(name,category) VALUES(N'MongoDB',N'Технологи');
INSERT dbo.Skill(name,category) VALUES(N'Flutter',N'Технологи');
INSERT dbo.Skill(name,category) VALUES(N'Kotlin',N'Технологи');
INSERT dbo.Skill(name,category) VALUES(N'Swift',N'Технологи');
INSERT dbo.Skill(name,category) VALUES(N'Linux',N'Технологи');
INSERT dbo.Skill(name,category) VALUES(N'Testing',N'Технологи');
-- 5.2 Хэрэглэгчдийн ур чадвар ба туршлагыг бүртгэх.
INSERT dbo.UserSkill(user_id,skill_id,level,experience_months) VALUES(1,2,'beginner',3);
INSERT dbo.UserSkill(user_id,skill_id,level,experience_months) VALUES(2,1,'intermediate',6);
INSERT dbo.UserSkill(user_id,skill_id,level,experience_months) VALUES(3,3,'advanced',9);
INSERT dbo.UserSkill(user_id,skill_id,level,experience_months) VALUES(4,4,'beginner',12);
INSERT dbo.UserSkill(user_id,skill_id,level,experience_months) VALUES(5,5,'intermediate',15);
INSERT dbo.UserSkill(user_id,skill_id,level,experience_months) VALUES(6,6,'advanced',18);
INSERT dbo.UserSkill(user_id,skill_id,level,experience_months) VALUES(7,7,'beginner',21);
INSERT dbo.UserSkill(user_id,skill_id,level,experience_months) VALUES(8,8,'intermediate',24);
INSERT dbo.UserSkill(user_id,skill_id,level,experience_months) VALUES(9,9,'advanced',27);
INSERT dbo.UserSkill(user_id,skill_id,level,experience_months) VALUES(10,10,'beginner',30);
INSERT dbo.UserSkill(user_id,skill_id,level,experience_months) VALUES(11,11,'intermediate',33);
INSERT dbo.UserSkill(user_id,skill_id,level,experience_months) VALUES(12,12,'advanced',36);
INSERT dbo.UserSkill(user_id,skill_id,level,experience_months) VALUES(13,13,'beginner',39);
INSERT dbo.UserSkill(user_id,skill_id,level,experience_months) VALUES(14,14,'intermediate',42);
INSERT dbo.UserSkill(user_id,skill_id,level,experience_months) VALUES(15,15,'advanced',45);
INSERT dbo.UserSkill(user_id,skill_id,level,experience_months) VALUES(16,16,'beginner',48);
INSERT dbo.UserSkill(user_id,skill_id,level,experience_months) VALUES(17,17,'intermediate',51);
INSERT dbo.UserSkill(user_id,skill_id,level,experience_months) VALUES(18,18,'advanced',54);
INSERT dbo.UserSkill(user_id,skill_id,level,experience_months) VALUES(19,19,'beginner',57);
INSERT dbo.UserSkill(user_id,skill_id,level,experience_months) VALUES(20,20,'intermediate',60);
-- 5.3 Төсөл, орон тоо, шаардлагатай ур чадварын суурь өгөгдөл.
INSERT dbo.Project(owner_user_id,title,description,status,work_mode) VALUES(1,N'TeamUp веб платформ',N'Хамтран хэрэгжүүлэх төсөл 1','draft','remote');
INSERT dbo.Project(owner_user_id,title,description,status,work_mode) VALUES(2,N'Сургалтын апп',N'Хамтран хэрэгжүүлэх төсөл 2','draft','hybrid');
INSERT dbo.Project(owner_user_id,title,description,status,work_mode) VALUES(3,N'Нээлттэй эхийн сан',N'Хамтран хэрэгжүүлэх төсөл 3','draft','onsite');
INSERT dbo.Project(owner_user_id,title,description,status,work_mode) VALUES(4,N'Ном солилцоо',N'Хамтран хэрэгжүүлэх төсөл 4','draft','remote');
INSERT dbo.Project(owner_user_id,title,description,status,work_mode) VALUES(5,N'Аяллын төлөвлөгч',N'Хамтран хэрэгжүүлэх төсөл 5','draft','hybrid');
INSERT dbo.Project(owner_user_id,title,description,status,work_mode) VALUES(6,N'Оюутны клуб',N'Хамтран хэрэгжүүлэх төсөл 6','draft','onsite');
INSERT dbo.Project(owner_user_id,title,description,status,work_mode) VALUES(7,N'Сайн дурын ажил',N'Хамтран хэрэгжүүлэх төсөл 7','draft','remote');
INSERT dbo.Project(owner_user_id,title,description,status,work_mode) VALUES(8,N'Хоолны жор',N'Хамтран хэрэгжүүлэх төсөл 8','draft','hybrid');
INSERT dbo.Project(owner_user_id,title,description,status,work_mode) VALUES(9,N'Спортын хамтрагч',N'Хамтран хэрэгжүүлэх төсөл 9','draft','onsite');
INSERT dbo.Project(owner_user_id,title,description,status,work_mode) VALUES(10,N'Хэл сурах апп',N'Хамтран хэрэгжүүлэх төсөл 10','draft','remote');
INSERT dbo.Project(owner_user_id,title,description,status,work_mode) VALUES(11,N'Арга хэмжээ',N'Хамтран хэрэгжүүлэх төсөл 11','draft','hybrid');
INSERT dbo.Project(owner_user_id,title,description,status,work_mode) VALUES(12,N'Цахим номын сан',N'Хамтран хэрэгжүүлэх төсөл 12','draft','onsite');
INSERT dbo.Project(owner_user_id,title,description,status,work_mode) VALUES(13,N'Төсөв хөтлөгч',N'Хамтран хэрэгжүүлэх төсөл 13','draft','remote');
INSERT dbo.Project(owner_user_id,title,description,status,work_mode) VALUES(14,N'Хог ангилалт',N'Хамтран хэрэгжүүлэх төсөл 14','draft','hybrid');
INSERT dbo.Project(owner_user_id,title,description,status,work_mode) VALUES(15,N'Амьтан үрчлэлт',N'Хамтран хэрэгжүүлэх төсөл 15','draft','onsite');
INSERT dbo.Project(owner_user_id,title,description,status,work_mode) VALUES(16,N'Санал асуулга',N'Хамтран хэрэгжүүлэх төсөл 16','draft','remote');
INSERT dbo.Project(owner_user_id,title,description,status,work_mode) VALUES(17,N'Дадлагын бүртгэл',N'Хамтран хэрэгжүүлэх төсөл 17','draft','hybrid');
INSERT dbo.Project(owner_user_id,title,description,status,work_mode) VALUES(18,N'Хичээлийн хуваарь',N'Хамтран хэрэгжүүлэх төсөл 18','draft','onsite');
INSERT dbo.Project(owner_user_id,title,description,status,work_mode) VALUES(19,N'Бүтээлийн сан',N'Хамтран хэрэгжүүлэх төсөл 19','draft','remote');
INSERT dbo.Project(owner_user_id,title,description,status,work_mode) VALUES(20,N'Зорилго хөтлөгч',N'Хамтран хэрэгжүүлэх төсөл 20','draft','hybrid');
INSERT dbo.ProjectRole(project_id,role_name,required_count) VALUES(1,N'React мэргэжилтэн',3);
INSERT dbo.RoleSkill(project_role_id,skill_id,minimum_level,is_required) VALUES(1,1,'beginner',1);
INSERT dbo.ProjectRole(project_id,role_name,required_count) VALUES(2,N'Python мэргэжилтэн',4);
INSERT dbo.RoleSkill(project_role_id,skill_id,minimum_level,is_required) VALUES(2,2,'beginner',1);
INSERT dbo.ProjectRole(project_id,role_name,required_count) VALUES(3,N'Figma мэргэжилтэн',2);
INSERT dbo.RoleSkill(project_role_id,skill_id,minimum_level,is_required) VALUES(3,3,'beginner',1);
INSERT dbo.ProjectRole(project_id,role_name,required_count) VALUES(4,N'SQL Server мэргэжилтэн',3);
INSERT dbo.RoleSkill(project_role_id,skill_id,minimum_level,is_required) VALUES(4,4,'beginner',1);
INSERT dbo.ProjectRole(project_id,role_name,required_count) VALUES(5,N'Git мэргэжилтэн',4);
INSERT dbo.RoleSkill(project_role_id,skill_id,minimum_level,is_required) VALUES(5,5,'beginner',1);
INSERT dbo.ProjectRole(project_id,role_name,required_count) VALUES(6,N'JavaScript мэргэжилтэн',2);
INSERT dbo.RoleSkill(project_role_id,skill_id,minimum_level,is_required) VALUES(6,6,'beginner',1);
INSERT dbo.ProjectRole(project_id,role_name,required_count) VALUES(7,N'TypeScript мэргэжилтэн',3);
INSERT dbo.RoleSkill(project_role_id,skill_id,minimum_level,is_required) VALUES(7,7,'beginner',1);
INSERT dbo.ProjectRole(project_id,role_name,required_count) VALUES(8,N'HTML мэргэжилтэн',4);
INSERT dbo.RoleSkill(project_role_id,skill_id,minimum_level,is_required) VALUES(8,8,'beginner',1);
INSERT dbo.ProjectRole(project_id,role_name,required_count) VALUES(9,N'CSS мэргэжилтэн',2);
INSERT dbo.RoleSkill(project_role_id,skill_id,minimum_level,is_required) VALUES(9,9,'beginner',1);
INSERT dbo.ProjectRole(project_id,role_name,required_count) VALUES(10,N'Node.js мэргэжилтэн',3);
INSERT dbo.RoleSkill(project_role_id,skill_id,minimum_level,is_required) VALUES(10,10,'beginner',1);
INSERT dbo.ProjectRole(project_id,role_name,required_count) VALUES(11,N'Java мэргэжилтэн',4);
INSERT dbo.RoleSkill(project_role_id,skill_id,minimum_level,is_required) VALUES(11,11,'beginner',1);
INSERT dbo.ProjectRole(project_id,role_name,required_count) VALUES(12,N'C# мэргэжилтэн',2);
INSERT dbo.RoleSkill(project_role_id,skill_id,minimum_level,is_required) VALUES(12,12,'beginner',1);
INSERT dbo.ProjectRole(project_id,role_name,required_count) VALUES(13,N'Docker мэргэжилтэн',3);
INSERT dbo.RoleSkill(project_role_id,skill_id,minimum_level,is_required) VALUES(13,13,'beginner',1);
INSERT dbo.ProjectRole(project_id,role_name,required_count) VALUES(14,N'PostgreSQL мэргэжилтэн',4);
INSERT dbo.RoleSkill(project_role_id,skill_id,minimum_level,is_required) VALUES(14,14,'beginner',1);
INSERT dbo.ProjectRole(project_id,role_name,required_count) VALUES(15,N'MongoDB мэргэжилтэн',2);
INSERT dbo.RoleSkill(project_role_id,skill_id,minimum_level,is_required) VALUES(15,15,'beginner',1);
INSERT dbo.ProjectRole(project_id,role_name,required_count) VALUES(16,N'Flutter мэргэжилтэн',3);
INSERT dbo.RoleSkill(project_role_id,skill_id,minimum_level,is_required) VALUES(16,16,'beginner',1);
INSERT dbo.ProjectRole(project_id,role_name,required_count) VALUES(17,N'Kotlin мэргэжилтэн',4);
INSERT dbo.RoleSkill(project_role_id,skill_id,minimum_level,is_required) VALUES(17,17,'beginner',1);
INSERT dbo.ProjectRole(project_id,role_name,required_count) VALUES(18,N'Swift мэргэжилтэн',2);
INSERT dbo.RoleSkill(project_role_id,skill_id,minimum_level,is_required) VALUES(18,18,'beginner',1);
INSERT dbo.ProjectRole(project_id,role_name,required_count) VALUES(19,N'Linux мэргэжилтэн',3);
INSERT dbo.RoleSkill(project_role_id,skill_id,minimum_level,is_required) VALUES(19,19,'beginner',1);
INSERT dbo.ProjectRole(project_id,role_name,required_count) VALUES(20,N'Testing мэргэжилтэн',4);
INSERT dbo.RoleSkill(project_role_id,skill_id,minimum_level,is_required) VALUES(20,20,'beginner',1);
-- 5.4 Төслүүдийн элсэлтийг нээж, зөвшөөрсөн хүсэлт ба гишүүнчлэлийг нэг гүйлгээнд нэмэх.
UPDATE dbo.Project SET status='recruiting' WHERE project_id BETWEEN 1 AND 20;

BEGIN TRY
 BEGIN TRANSACTION;
 INSERT dbo.Application(user_id,project_role_id,cover_note,status) VALUES(2,1,N'Төсөл 1-д хамтарч ажиллана','accepted');
 INSERT dbo.Membership(application_id,user_id,project_role_id,project_id) VALUES(1,2,1,1);
 INSERT dbo.Application(user_id,project_role_id,cover_note,status) VALUES(3,2,N'Төсөл 2-д хамтарч ажиллана','accepted');
 INSERT dbo.Membership(application_id,user_id,project_role_id,project_id) VALUES(2,3,2,2);
 INSERT dbo.Application(user_id,project_role_id,cover_note,status) VALUES(4,3,N'Төсөл 3-д хамтарч ажиллана','accepted');
 INSERT dbo.Membership(application_id,user_id,project_role_id,project_id) VALUES(3,4,3,3);
 INSERT dbo.Application(user_id,project_role_id,cover_note,status) VALUES(5,4,N'Төсөл 4-д хамтарч ажиллана','accepted');
 INSERT dbo.Membership(application_id,user_id,project_role_id,project_id) VALUES(4,5,4,4);
 INSERT dbo.Application(user_id,project_role_id,cover_note,status) VALUES(6,5,N'Төсөл 5-д хамтарч ажиллана','accepted');
 INSERT dbo.Membership(application_id,user_id,project_role_id,project_id) VALUES(5,6,5,5);
 INSERT dbo.Application(user_id,project_role_id,cover_note,status) VALUES(7,6,N'Төсөл 6-д хамтарч ажиллана','accepted');
 INSERT dbo.Membership(application_id,user_id,project_role_id,project_id) VALUES(6,7,6,6);
 INSERT dbo.Application(user_id,project_role_id,cover_note,status) VALUES(8,7,N'Төсөл 7-д хамтарч ажиллана','accepted');
 INSERT dbo.Membership(application_id,user_id,project_role_id,project_id) VALUES(7,8,7,7);
 INSERT dbo.Application(user_id,project_role_id,cover_note,status) VALUES(9,8,N'Төсөл 8-д хамтарч ажиллана','accepted');
 INSERT dbo.Membership(application_id,user_id,project_role_id,project_id) VALUES(8,9,8,8);
 INSERT dbo.Application(user_id,project_role_id,cover_note,status) VALUES(10,9,N'Төсөл 9-д хамтарч ажиллана','accepted');
 INSERT dbo.Membership(application_id,user_id,project_role_id,project_id) VALUES(9,10,9,9);
 INSERT dbo.Application(user_id,project_role_id,cover_note,status) VALUES(11,10,N'Төсөл 10-д хамтарч ажиллана','accepted');
 INSERT dbo.Membership(application_id,user_id,project_role_id,project_id) VALUES(10,11,10,10);
 INSERT dbo.Application(user_id,project_role_id,cover_note,status) VALUES(12,11,N'Төсөл 11-д хамтарч ажиллана','accepted');
 INSERT dbo.Membership(application_id,user_id,project_role_id,project_id) VALUES(11,12,11,11);
 INSERT dbo.Application(user_id,project_role_id,cover_note,status) VALUES(13,12,N'Төсөл 12-д хамтарч ажиллана','accepted');
 INSERT dbo.Membership(application_id,user_id,project_role_id,project_id) VALUES(12,13,12,12);
 INSERT dbo.Application(user_id,project_role_id,cover_note,status) VALUES(14,13,N'Төсөл 13-д хамтарч ажиллана','accepted');
 INSERT dbo.Membership(application_id,user_id,project_role_id,project_id) VALUES(13,14,13,13);
 INSERT dbo.Application(user_id,project_role_id,cover_note,status) VALUES(15,14,N'Төсөл 14-д хамтарч ажиллана','accepted');
 INSERT dbo.Membership(application_id,user_id,project_role_id,project_id) VALUES(14,15,14,14);
 INSERT dbo.Application(user_id,project_role_id,cover_note,status) VALUES(16,15,N'Төсөл 15-д хамтарч ажиллана','accepted');
 INSERT dbo.Membership(application_id,user_id,project_role_id,project_id) VALUES(15,16,15,15);
 INSERT dbo.Application(user_id,project_role_id,cover_note,status) VALUES(17,16,N'Төсөл 16-д хамтарч ажиллана','accepted');
 INSERT dbo.Membership(application_id,user_id,project_role_id,project_id) VALUES(16,17,16,16);
 INSERT dbo.Application(user_id,project_role_id,cover_note,status) VALUES(18,17,N'Төсөл 17-д хамтарч ажиллана','accepted');
 INSERT dbo.Membership(application_id,user_id,project_role_id,project_id) VALUES(17,18,17,17);
 INSERT dbo.Application(user_id,project_role_id,cover_note,status) VALUES(19,18,N'Төсөл 18-д хамтарч ажиллана','accepted');
 INSERT dbo.Membership(application_id,user_id,project_role_id,project_id) VALUES(18,19,18,18);
 INSERT dbo.Application(user_id,project_role_id,cover_note,status) VALUES(20,19,N'Төсөл 19-д хамтарч ажиллана','accepted');
 INSERT dbo.Membership(application_id,user_id,project_role_id,project_id) VALUES(19,20,19,19);
 INSERT dbo.Application(user_id,project_role_id,cover_note,status) VALUES(1,20,N'Төсөл 20-д хамтарч ажиллана','accepted');
 INSERT dbo.Membership(application_id,user_id,project_role_id,project_id) VALUES(20,1,20,20);
 COMMIT;
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK;
 THROW;
END CATCH;

-- 6. SELECT — өгөгдөл унших, шүүх, эрэмбэлэх ба нэгтгэх.
SELECT * FROM dbo.[User];
SELECT display_name,email FROM dbo.[User];
SELECT * FROM dbo.UserSkill WHERE experience_months>24;
SELECT * FROM dbo.ProjectRole WHERE project_id=1;
SELECT * FROM dbo.Project WHERE status='recruiting' AND work_mode='remote';
SELECT * FROM dbo.UserSkill ORDER BY experience_months DESC;
SELECT * FROM dbo.[User] ORDER BY display_name,email;
SELECT * FROM dbo.[User] WHERE display_name LIKE N'Бат%';
SELECT * FROM dbo.[User] WHERE email LIKE N'%@example.com';
SELECT COUNT(*) AS UserCount FROM dbo.[User];
SELECT AVG(CONVERT(decimal(10,2),experience_months)) AS AverageMonths,
 MIN(experience_months) AS MinMonths,MAX(experience_months) AS MaxMonths FROM dbo.UserSkill;
SELECT project_id,COUNT(*) AS RoleCount FROM dbo.ProjectRole GROUP BY project_id;

-- 7. UPDATE / DELETE — профайл, ур чадварыг засаж, түр өгөгдлийг устгах.
UPDATE dbo.Profile SET availability='busy' WHERE user_id=1;
UPDATE dbo.UserSkill SET experience_months=19,level='intermediate' WHERE user_id=2 AND skill_id=1;
INSERT dbo.Skill(name,category) VALUES(N'Түр туршилт',N'Test');
DELETE dbo.Skill WHERE name=N'Түр туршилт';

-- 8. Түр хүснэгт — CREATE, TRUNCATE, DROP командуудын туршилт.
CREATE TABLE #DDLPractice(id int PRIMARY KEY);
INSERT #DDLPractice VALUES(1);
TRUNCATE TABLE #DDLPractice;
DROP TABLE #DDLPractice;

-- 9. Индекс — төслийн эзэмшигч, хүсэлтийн орон тоо, нэр/имэйлийн хайлтыг дэмжих.
CREATE INDEX IX_Project_Owner ON dbo.Project(owner_user_id);
CREATE INDEX IX_Application_Role ON dbo.Application(project_role_id);
CREATE INDEX IX_User_Name_Email ON dbo.[User](display_name,email);

BEGIN TRY
-- 10. Сөрөг тест — туршлагын сар сөрөг үед CHECK хязгаарлалт алдаа өгөхийг шалгах.
 INSERT dbo.UserSkill(user_id,skill_id,level,experience_months) VALUES(5,6,'beginner',-1);
 THROW 51001,N'CHECK тест буруу: сөрөг сар зөвшөөрөгдлөө.',1;
END TRY
BEGIN CATCH
 IF ERROR_NUMBER()<>547 THROW;
 PRINT N'Хүлээгдсэн CHECK алдаа: '+ERROR_MESSAGE();
END CATCH;
SELECT N'Lab02 бэлэн' AS Result;

-- 11. Эцсийн тооллого — үндсэн 9 хүснэгт тус бүрийн мөрийн тоог харах.
SELECT N'User' AS TableName,COUNT(*) AS [RowCount] FROM dbo.[User]
UNION ALL
SELECT N'Profile' AS TableName,COUNT(*) AS [RowCount] FROM dbo.[Profile]
UNION ALL
SELECT N'Skill' AS TableName,COUNT(*) AS [RowCount] FROM dbo.[Skill]
UNION ALL
SELECT N'UserSkill' AS TableName,COUNT(*) AS [RowCount] FROM dbo.[UserSkill]
UNION ALL
SELECT N'Project' AS TableName,COUNT(*) AS [RowCount] FROM dbo.[Project]
UNION ALL
SELECT N'ProjectRole' AS TableName,COUNT(*) AS [RowCount] FROM dbo.[ProjectRole]
UNION ALL
SELECT N'RoleSkill' AS TableName,COUNT(*) AS [RowCount] FROM dbo.[RoleSkill]
UNION ALL
SELECT N'Application' AS TableName,COUNT(*) AS [RowCount] FROM dbo.[Application]
UNION ALL
SELECT N'Membership' AS TableName,COUNT(*) AS [RowCount] FROM dbo.[Membership];

GO
ALTER TABLE dbo.[User] ADD CONSTRAINT email@ CHECK (email LIKE N'%@%');
