# Лаборатори 8 - Тасралтгүй интеграцчилал (CI)

Огноо: 2026-11-12. Төсөл: TeamUP.

## Зорилго
Push/PR бүрийн дараа тест, build автоматаар ажиллуулах; алдаа гарвал тохируулсан имэйлд мэдэгдэх.

## Хэрэгжүүлэлт
`.github/workflows/ci.yml` нь push, pull_request, workflow_dispatch үйл явдлаар асна.
Node.js 22 ба 24 матриц дээр `npm ci --ignore-scripts`, unit/integration тест,
`npm run build` ажиллуулж JUnit XML үр дүнг artifact болгон хадгална.
Натив SQL Server addon нь SQLite CI-д хэрэггүй тул install script ажиллуулахгүй.
Workflow нь read-only contents permission, хуучин run-ийг цуцлах concurrency тохиргоотой.

`notify-on-failure` нь test job амжилтгүй болсны дараа зөвхөн push/manual run дээр ажиллана.
Fork/PR дээр нууц мэдээлэл шаардсан mail ажиллахгүй. `scripts/notify-ci.js` нь Nodemailer ашиглана.

## GitHub тохиргоо
Repository → Settings → Secrets and variables → Actions хэсэгт:
`SMTP_HOST`, `SMTP_PORT` (465 эсвэл 587), `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`, `CI_MAIL_TO`.
Secret байхгүй үед workflow mail-ийг алгасаад тодорхой notice гаргана; илгээгдсэн гэж тайлагнахгүй.
Нууц үгийг код, тайлан эсвэл `.env.example` дотор бичихгүй.

## Шалгалт ба нотолгоо
Локал 30 тест амжилттай; TypeScript, Vite build, 300 мөрийн хязгаар амжилттай.
SMTP secret-гүй `node scripts/notify-ci.js` ажиллуулахад skipped notice гарсныг шалгав.
GitHub Actions-ийн бодит run ба SMTP хүргэлт нь push/authentication болон secret тохиргооны дараа батлагдана.
Алдаа мэдэгдэхийг шалгахдаа тусдаа branch дээр нэг assert-ийг түр унагаж, Actions log/artifact-ийг шалгаад буцаана.
Бодит имэйл хүргэлтийг энэ ажлын явцад туршаагүй.

## Дүгнэлт
Нэг орчны санамсаргүй амжилтаас хамаарахгүйгээр хоёр Node хувилбар дээр тест ба build шалгах
pipeline нэмэв. GitHub-ийн credential болон SMTP secrets нь гадаад тохиргооны үлдсэн нөхцөл юм.

Эх сурвалж: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax
