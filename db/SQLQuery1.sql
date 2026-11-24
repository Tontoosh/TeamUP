-- Хэрэглэгчдийн жагсаалт — dbo.users хүснэгтийн бүртгэл, эрх, төлөв ба үүсгэсэн огноог унших.
-- Энэ query нь TeamUpDB-ийн dbo.users хүснэгтийн бүртгэлүүдийг уншина; Lab02-ийн dbo.[User] хүснэгтээс бүтэц нь ялгаатай.
USE [TeamUpDB];

-- [password]-ийг password_hash гэж зөвхөн нэрлэж харуулна; энэ alias нь утгыг хэшлэхгүй, баганын хадгалсан утгыг хэвээр буцаана.
SELECT
    id,
    name,
    email,
    [password] AS password_hash,
    role,
    status,
    verified,
    created_at
FROM dbo.users;
