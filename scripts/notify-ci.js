// Configure GitHub Actions secrets before enabling real mail delivery.
const required = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'MAIL_FROM', 'CI_MAIL_TO'];
if (required.some(key => !process.env[key])) {
  console.log('::notice::CI email skipped: configure SMTP_HOST, SMTP_USER, SMTP_PASSWORD, MAIL_FROM and CI_MAIL_TO secrets.');
} else {
  const { default: nodemailer } = await import('nodemailer');
  const port = Number(process.env.SMTP_PORT || 465);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port, secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    connectionTimeout: 10000, socketTimeout: 10000,
  });
  const repository = process.env.GITHUB_REPOSITORY;
  const run = `${process.env.GITHUB_SERVER_URL || 'https://github.com'}/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  await transport.sendMail({
    from: process.env.MAIL_FROM, to: process.env.CI_MAIL_TO,
    subject: `TeamUP CI амжилтгүй: ${repository}`,
    text: `Автомат тест эсвэл build амжилтгүй боллоо.\nRepository: ${repository}\nДэлгэрэнгүй: ${run}`,
  });
  console.log('CI failure notification sent.');
}
