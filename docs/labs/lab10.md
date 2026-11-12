# Лаборатори 10 - Хоёрдогч Sprint, дэвшилтэт функцууд

Огноо: 2026-11-12. Төсөл: TeamUP.

## Sprint-ийн зорилго ба User Story
1. Хэрэглэгч бүртгүүлж, имэйлээ баталгаажуулж, нэвтэрч/гардаг байх.
2. Хэрэглэгч өөрийн амжилттай болон бүтэлгүй нэвтрэх түүхийг харах.
3. Сервер дахин асахад SQLite дэх бүртгэл, түүх хадгалагдах.
4. Программ эхлэхийн өмнө integration test амжилттай болсон байх.
5. Нэг серверийг 2-3 компьютерээс ашиглах Docker тохиргоотой байх.

## Өмнөх Sprint-ээс үргэлжлүүлсэн зүйл
Бүртгэл, scrypt нууц үг, баталгаажуулах token, session, logout, SQLite adapter өмнө байсан.
Lab6-ийн schema тусгаарлалт, lab8-ийн CI, lab9-ийн error contract дээр дараах боломжуудыг нэмэв.

## Хэрэгжүүлэлт
- `login_attempts` хүснэгт: id, user_id (олдсон хэрэглэгч), outcome, created_at; хэрэглэгч/огнооны индекс.
- success, invalid_credentials, unverified, suspended төлөв хадгална. Нууц үг/token/IP хадгалахгүй.
- Амжилттай нэвтрэлтийн түүх ба session нэг transaction-д үүснэ.
- `GET /api/auth/login-history` нь authenticated хэрэглэгчийн өөрийн сүүлийн 50 мөрийг буцаана.
- Settings → Нууцлал ба аюулгүй байдал хуудсанд түүх/огноо/шинэчлэх товч нэмэв.
- `.env.example` болон анхны серверийн тохиргоо нь жинхэнэ нэвтрэлт шаарддаг болсон.
- `npm run start:lab10` нь integration test ажиллуулж, амжилттай үед SQLite сервер асаана.
- Dockerfile/compose.yaml нь production build, тусдаа data volume, healthcheck, non-root user-тай.
- `HOST=0.0.0.0`, APP_URL тохиргоогоор localhost ба LAN клиент хандана. Дэлгэрэнгүй: DOCKER.md.

## Integration test
`tests/auth-integration.test.js` нь түр файл SQLite дээр дараах урсгалыг шалгана:
бүртгэл → давхар имэйл → баталгаажаагүй login → verify → буруу password → зөв login →
түүх харах → бусдын түүх тусгаарлалт → 50 мөрийн хязгаар/эрэмбэ → DB-г хааж дахин нээх → login → logout.
Нууц үг plaintext биш, session logout-оор хүчингүй болсон, түүх restart-аар хадгалагдсаныг шалгана.
SMTP хүргэлт тестлэхгүй; verify endpoint-д тусгаарласан тестийн token өгнө.

## Үр дүн ба хязгаарлалт
Бүх 34 тест амжилттай, TypeScript/Vite build болон 300 мөрийн шалгалт амжилттай.
Гурван тусдаа session-аар localhost HTTP API-д зэрэг нэвтэрч, өөрийн түүхийг 200 хариутай авсныг шалгав.
Browser дээр оюутнаар нэвтэрч Settings дахь түүхийг харав. Playwright/Edge headless асахад sandbox алдаа гарсан тул in-app browser ашиглав.
CSV болон Nodemailer dependency-г шинэчилж npm audit 0 болгосон.
Docker/WSL суулгаагүй учир контейнер болон 2-3 бодит компьютерийн LAN туршилт хийгдээгүй.
Одоо байгаа Windows `.env`/SQL Server өгөгдлийг солихгүй; lab10 startup нь тусдаа SQLite горим сонгоно.
Багийн sprint meeting, хүний review болон гадаад SMTP хүргэлтийн нотолгоог зохиогоогүй.

## Дүгнэлт
Нэвтрэх систем, persistent DB болон хэрэглэгчийн түүх нэг урсгалд интеграцлагдсан.
Автомат startup test нь сервер буруу integration-тай үед асахаас сэргийлнэ.
Docker суусны дараа нэг host дээр асааж, бусад клиентээс ижил DB-г ашиглах боломжтой.
