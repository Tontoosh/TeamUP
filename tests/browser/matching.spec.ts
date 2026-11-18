import { expect, test } from '@playwright/test';

const credentials = (owner = false) => ({ email: owner ? 'owner@teamup.mn' : 'student@teamup.mn', password: 'Teamup123!' });
const profile = {
  name: 'А. Анударь', school: 'МУИС', major: 'Мэдээллийн систем', skills: ['React', 'Figma'],
  skillLevels: [{ skill: 'React', level: 3 }, { skill: 'Figma', level: 2 }],
  interests: ['EdTech'], experience: '', portfolio: '', hours: 12, bio: '',
};

test('profile skill levels can be edited and survive a reload', async ({ page }) => {
  await page.request.post('/api/auth/login', { data: credentials() });
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Профайл засах' }).click();
  const dialog = page.getByRole('dialog', { name: 'Профайл засах' });
  await dialog.getByRole('textbox', { name: 'Ур чадвар', exact: true }).fill('React, Figma');
  await dialog.getByLabel('React түвшин').selectOption('3');
  await dialog.getByLabel('Figma түвшин').selectOption('2');
  await dialog.getByRole('button', { name: 'Хадгалах', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.skill-level-tags')).toContainText('React3/5');
  await expect(page.locator('.skill-level-tags')).toContainText('Figma2/5');
});

test('role requirements can be published and drive explainable people matching', async ({ page, request }, testInfo) => {
  await request.post('/api/auth/login', { data: credentials() });
  expect((await request.patch('/api/users/me', { data: profile })).ok()).toBe(true);
  await page.request.post('/api/auth/login', { data: credentials(true) });
  await page.goto('/projects/new');
  await page.getByLabel('Төслийн нэр', { exact: true }).fill('Browser matching project');
  await page.getByLabel('Товч танилцуулга').fill('Тохирох хамтрагч олох browser туршилтын төсөл.');
  await page.getByLabel('Зорилго, хүлээгдэж буй үр дүн').fill('Тодорхой үүрэгт тохирох хүнийг хамтран ажиллуулахаар олох.');
  await page.getByLabel('Шаардлагатай ур чадвар', { exact: true }).fill('React, Figma');
  await page.getByLabel('Нээлттэй үүргүүд', { exact: true }).fill('Frontend');
  await page.getByRole('combobox', { name: 'Frontend · React доод түвшин', exact: true }).selectOption('3');
  await page.getByLabel('Frontend · React заавал', { exact: true }).check();
  await page.getByRole('combobox', { name: 'Frontend · Figma доод түвшин', exact: true }).selectOption('2');
  const created = page.waitForResponse(response => response.url().endsWith('/api/projects') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Төсөл нийтлэх' }).click();
  const response = await created;
  expect(response.status()).toBe(201);
  const project = await response.json();
  await expect(page).toHaveURL(new RegExp(`/projects/${project.id}$`));
  await expect(page.locator('.role-requirements')).toContainText('React · 3/5');
  await page.getByRole('link', { name: 'Тохирох хамтрагч олох', exact: true }).click();
  await expect(page.locator('.person-card')).toHaveCount(1);
  await expect(page.locator('.person-card')).toContainText('А. Анударь');
  await expect(page.locator('.match-summary')).toContainText('97.5 / 100');
  await page.getByText('Яагаад санал болгосон бэ?', { exact: true }).click();
  await expect(page.locator('.score-breakdown')).toContainText('60 / 60');
  await page.screenshot({ path: testInfo.outputPath('matching-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('matching-mobile.png'), fullPage: true });
  await request.patch('/api/users/me', { data: { ...profile, skillLevels: [{ skill: 'React', level: 2 }] } });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Тохирох хамтрагч олдсонгүй' })).toBeVisible();
  await request.patch('/api/users/me', { data: profile });
});

test('a completed project unlocks a single peer review through the profile', async ({ page, request }, testInfo) => {
  await page.request.post('/api/auth/login', { data: credentials(true) });
  await request.post('/api/auth/login', { data: credentials() });
  const created = await page.request.post('/api/projects', { data: {
    name: 'Peer review browser project', description: 'Дууссан төслийн гишүүдийн үнэлгээний туршилт.', category: 'EdTech',
    project_type: 'Стартап', goal: 'Багт нэгдэж, төслөө дуусгаад хамтын ажиллагааг үнэлэх.', duration: 4,
    capacity: 3, skills: ['React'], roles: ['Хөгжүүлэгч'], hours: 8,
  } });
  expect(created.status()).toBe(201);
  const project = await created.json();
  const application = await request.post('/api/applications', { data: {
    project_id: project.id, role: 'Хөгжүүлэгч', introduction: 'React ашиглан хамтран хөгжүүлэх хүсэлтэй байна.',
  } });
  expect(application.status()).toBe(201);
  const item = await application.json();
  expect((await page.request.post(`/api/applications/${item.id}/decision`, { data: { action: 'accepted' } })).ok()).toBe(true);
  await page.goto(`/projects/${project.id}`);
  await page.getByRole('button', { name: 'Төсөл дуусгах', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Төслийн ажил дууссан уу?' });
  await dialog.getByRole('button', { name: 'Баталгаажуулах', exact: true }).click();
  await expect(page.locator('.detail-heading')).toContainText('Ажил дууссан');
  await page.getByRole('link', { name: 'Үнэлгээ өгөх', exact: true }).click();
  const reviews = page.locator('.profile-reviews');
  await reviews.getByRole('combobox', { name: 'Ажлын чанар', exact: true }).selectOption('5');
  await reviews.getByRole('combobox', { name: 'Хугацаа, хариуцлага', exact: true }).selectOption('4');
  await reviews.getByRole('combobox', { name: 'Харилцаа, хамтын ажиллагаа', exact: true }).selectOption('5');
  const comment = 'React хэсгийг хугацаанд нь хийж, багтайгаа ойлгомжтой харилцсан.';
  await reviews.getByLabel('Сэтгэгдэл', { exact: true }).fill(comment);
  await reviews.getByRole('button', { name: 'Үнэлгээ нийтлэх', exact: true }).click();
  await expect(reviews.locator('.review-list')).toContainText(comment);
  await expect(reviews.locator('.review-form')).toHaveCount(0);
  await page.reload();
  await expect(reviews.locator('.rating-summary')).toContainText('1 гишүүн · 1 үнэлгээ');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await reviews.screenshot({ path: testInfo.outputPath('peer-review-mobile.png') });
});
