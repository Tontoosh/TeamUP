# TeamUP - нэг сервер, 2-3 компьютер

Нэг компьютер дээр Docker Desktop/Engine ажиллуулна. Бусад компьютерт Docker хэрэггүй:
ижил LAN/Wi-Fi дотроос browser-аар серверийн IP:3001 хаягт хандана.
Бүх хэрэглэгч нэг SQLite DB болон uploads volume ашиглана; тус тусдаа session-тай.

## 1. Docker суулгах

Windows дээр Docker Desktop-ийн албан ёсны installer:
https://docs.docker.com/desktop/setup/install/windows-install/

WSL 2 backend болон hardware virtualization шаардлагатай. Энэ компьютер дээр шалгахад
Docker суулгаагүй, `wsl --status` нь WSL суулгаагүй гэж буцаасан.
Administrator PowerShell-д `wsl --install --no-distribution` ажиллуулж, шаардвал restart хийнэ.
Docker Desktop суулгаж асаагаад `docker version`, `docker compose version` шалгана.
UAC/BIOS/restart алхмыг компьютерийн эзэмшигч гүйцэтгэнэ.

## 2. Энэ компьютер дээр асаах

Төслийн хавтсаас:

```powershell
docker compose up --build -d
docker compose ps
```

http://localhost:3001 нээнэ. Эхлээд тусгаарласан түр SQLite дээр integration test ажиллана.
Тест амжилттай бол веб/API асна; бодит DB-г тест өөрчлөхгүй.
`docker compose logs -f teamup` командаар тест/серверийн лог харна.

## 3. Бусад 2-3 компьютерээс хандах

Серверийн IPv4 хаягийг `ipconfig`-оор харна. Жишээ IP 192.168.1.10 бол:

```powershell
.\start-docker.ps1 -ServerIP 192.168.1.10
```

Бүх компьютерт http://192.168.1.10:3001 нээнэ. APP_URL нь энэ хаяг болж CSRF origin
шалгалт болон mail холбоос зөв ажиллана. Сервер дээр localhost:3001 мөн ажиллана.
Windows Firewall шаардлагатай бол TCP 3001 inbound-ийг зөвхөн Private profile/LocalSubnet-д
зөвшөөрнө. Guest Wi-Fi/client isolation-гүй, нэг дотоод сүлжээнд байх шаардлагатай.
Энэ тохиргоо public интернэт deployment биш; сервер унтарвал бусад клиент хандахгүй.

## 4. Бүртгэл ба өгөгдөл

Шинэ volume дээр жишээ хэрэглэгчид үүснэ:
student@teamup.mn, owner@teamup.mn, admin@teamup.mn. Нууц үг: Teamup123!
Эдгээр нь lab demo-д зориулагдсан. Бодит хэрэглээнд хоосон volume дээр
`TEAMUP_SEED_DEMO=false` тохируулж SMTP болон админ үүсгэх ажиллагааг тусад нь бэлдэнэ.
Шинээр бүртгүүлсэн хэрэглэгчийн баталгаажуулах холбоос SMTP байхгүй үед серверийн log-д гарна.

`TEAMUP_SMTP_HOST`, `TEAMUP_SMTP_PORT`, `TEAMUP_SMTP_USER`, `TEAMUP_SMTP_PASSWORD`,
`TEAMUP_MAIL_FROM` environment хувьсагчаар SMTP-г тохируулж болно; Git-д secret оруулахгүй.

`teamup-data` named volume нь контейнер дахин үүсэхэд хадгалагдана.
`docker compose down` нь өгөгдөл устгахгүй. `down -v` хэрэглэхгүй: DB/uploads устгана.
Өөр компьютерт ижил кодыг clone хийгээд асааж болно; хуучин DB-г зөөх бол контейнерийг
зогсоосны дараа data volume-г бүхэлд нь backup/restore хийнэ. Зөвхөн image зөөвөл DB дагахгүй.

## Баталгаажуулалтын хүрээ

Локал Node орчинд integration/full tests болон production build шалгасан.
Docker daemon байхгүй тул image build, compose healthcheck, LAN-ийн 3 бодит төхөөрөмжийн
холболтыг одоогоор баталгаажуулаагүй. Docker суусны дараа дээрх командаар шалгана.
