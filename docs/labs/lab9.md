# Лаборатори 9 - Гадаад сангууд ба алдаа боловсруулах

Огноо: 2026-11-12. Төсөл: TeamUP.

## Зорилго
npm пакет ашиглаж, validation/HTTP/серверийн алдааг ялган барих, хэрэглэгчид ойлгомжтой мэдээлэл үзүүлэх.

## Хэрэгжүүлэлт
- `pino` dependency-г npm-ээр суулгаж package.json/package-lock.json-д хадгалав.
- Өмнөх Zod, Express санг үргэлжлүүлэн ашиглав; Python/Flask жишээг давхар систем болгож хуулаагүй.
- `server/errors.js`: AppError, ValidationError, request ID, нэгдсэн error middleware.
- `server/utils.js`: Zod issue-г Монгол тайлбартай field/details болгон хувиргана.
- 400 validation, 404 API route, malformed JSON, хэт том body, 500 серверийн алдааг ялгана.
- 500 үед хэрэглэгчид SQL/stack/нууц мэдээлэл буцаахгүй. Pino лог нь requestId/method/status/code л агуулна.
- `src/api.ts`: сүлжээ тасрах, JSON бус хариу ирэхэд Монгол тайлбар харуулж, AbortError-ийг хадгална.

## Шалгалт
`tests/error-handling.test.js`-ийн 3 тест: validation/404 contract, DB fault injection,
parser error болон логийн нууц мэдээлэл хамгаалалт.
Бүх өмнөх тестийг хамт ажиллуулж regression шалгасан. TypeScript/Vite build мөн шалгасан.
Хөгжүүлэлтийн терминал дахь Pino JSON мөрийг request ID-аар API хариутай холбож болно.

## Хязгаарлалт
Логийг дискэнд хязгааргүй хадгалахгүй; production орчинд stdout цуглуулагч/rotation тохируулна.
SMTP болон Google зэрэг гадаад үйлчилгээний алдааны бодит хүргэлтийг тусдаа орчинд шалгана.

## Дүгнэлт
Гадаад logging санг ашиглан алдааг мөрдөх боломж нэмэгдсэн. Хэрэглэгчийн хариу ба дотоод
алдааны мэдээлэл тусгаарлагдаж, validation-ийн Монгол тайлбар жигдэрсэн.
