# TeamUP хөгжүүлэлтийн дүрэм

- JavaScript ES modules, React + TypeScript; 2 зайгаар догол мөр авна.
- Функц/хувьсагч camelCase, React component/type PascalCase байна.
- Нэг код файл 300 мөрөөс хэтрэхгүй: `npm run check:lines`.
- SQL утгыг `?` параметрээр дамжуулна. Клиентээс ирсэн object-ийг шууд DB update-д өгөхгүй.
- Хүсэлтийг Zod schema-аар шалгаж, authentication ба ownership-ийг сервер дээр баталгаажуулна.
- Нууц үг, token, `.env`, runtime DB, хэрэглэгчийн мэдээллийг commit/log-д оруулахгүй.
- Шалгалт: `npm test`, `npm run build`; PR дээр үр дүн, эрсдэл, шалгасан урсгалыг бичнэ.

## Pair programming ба review

1. Багийн хоёр бодит гишүүн driver/navigator үүргээ тохирно.
2. Driver код бичиж, navigator шаардлага, эрхийн шалгалт, edge case-ийг хянана.
3. 15-20 минут тутам үүргээ сольж, өөрчлөлтийг хамт шалгана.
4. Feature branch push хийгээд Pull Request нээнэ.
5. Өөр гишүүн review хийж, саналыг шийдвэрлэсний дараа merge хийнэ.
6. Оролцогч, хугацаа, PR/review холбоосыг lab6 тайланд бодитоор бүртгэнэ.

AI-assisted кодын шалгалт нь багийн хүний review-г орлохгүй.
