# Лаборатори 6 - Үргэлжлүүлэн хөгжүүлэлт ба код хянах

Огноо: 2026-11-12. Төсөл: TeamUP. Стек: React/TypeScript, Express, Zod, SQLite/SQL Server.

## Зорилго
Pair Programming, Pull Request, code review болон нэгдсэн coding convention-ыг төсөлд хэрэглэх.
PDF-ийн Python код нь жишээ тул TeamUP-ийн JavaScript/TypeScript стек дээр хэрэгжүүлэв.

## Гүйцэтгэл
- Профайлын Zod schema-г route-оос `server/validation/profile.js` рүү салгав.
- `tests/profile-review.test.js` нь role/verified/id зэрэг нэмэлт талбарыг хасаж байгааг шалгана.
- javascript URL, 3000-аас урт bio, буруу hours, 30-аас олон skill-ийг татгалзана.
- `.editorconfig`, `CONTRIBUTING.md`, PR template нэмэв.

## Кодын хяналтын тэмдэглэл
| Шалгасан зүйл | Дүгнэлт / шийдэл |
| --- | --- |
| Privilege escalation | Schema whitelist хэвээр; role, verified, id талбар нэвтрэхгүйг тестлэв. |
| SQL injection | Profile update нь parameterized query ашигладаг; өөрчлөх шаардлагагүй. |
| Давхар хариуцлага | Validation schema-г тусдаа модульд салгаж, шууд unit test хийв. |
| Уншигдахуун | 2 зай, ES module, нэршил, 300 мөрийн дүрмийг баримтжуулав. |

## Баталгаажуулалт
Анхны 28 тест амжилттай. Нэмэлт 2 profile unit test амжилттай.
`node --test --test-isolation=none --test-concurrency=1 tests/*.test.js`, TypeScript build,
Vite build болон мөрийн хязгаарын шалгалт ашиглав.

## Бодит оролцоо ба үлдсэн алхам
Энэ өөрчлөлтийг AI тусламжтай боловсруулж хянав. Хоёр хүний pair programming уулзалт,
багийн гишүүний review/approval хийгдээгүй; оролцогч, хугацааг зохиогоогүй.
GitHub PR холбоосыг нийтлэлт амжилттай болсны дараа нэмнэ.
Хүний review-г `CONTRIBUTING.md`-ийн дарааллаар хийж, бодит холбоосоор тайланг гүйцээнэ.

## Дүгнэлт
Profile validation-ийг тусгаарласнаар эрх нэмэгдүүлэх оролдлого болон буруу оролтыг
тестээр тогтмол шалгах боломжтой болсон. Багийн хамтын ажиллагааны нотолгоо тусдаа шаардлагатай.
