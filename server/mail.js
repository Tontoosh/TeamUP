import { randomBytes } from 'node:crypto';
import { hashToken } from './auth.js';

export async function sendAccountLink(db, user, purpose) {
  const token = randomBytes(32).toString('hex');
  await db.insert('tokens', {
    id: hashToken(token),
    user_id: user.id,
    purpose,
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
  const route = purpose === 'verify' ? 'verify' : 'reset';
  const url = `${process.env.APP_URL || 'http://localhost:5173'}/${route}?token=${token}`;
  if (process.env.SMTP_HOST) {
    const nodemailer = (await import('nodemailer')).default;
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_PORT === '465',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    });
    await transport.sendMail({
      from: process.env.MAIL_FROM || 'TeamUp <noreply@example.com>',
      to: user.email,
      subject: purpose === 'verify' ? 'Бүртгэлээ баталгаажуулах' : 'Нууц үг сэргээх',
      text: `Хамтдаа: ${url}\nХолбоос нэг цагийн хугацаанд нэг удаа хүчинтэй.`,
    });
  } else {
    console.log(`[Local mail: ${user.email}] ${url}`);
  }
}
