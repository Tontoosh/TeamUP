import { expect, test } from '@playwright/test';

test('verification resend is reachable and gives a neutral confirmation', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('link', { name: 'Баталгаажуулах холбоос дахин авах', exact: true }).click();
  await expect(page).toHaveURL(/\/resend$/);
  await page.getByLabel('Имэйл хаяг').fill('unknown@example.com');
  await page.getByRole('button', { name: 'Холбоос илгээх', exact: true }).click();
  await expect(page.locator('.success-panel')).toContainText('баталгаажуулах холбоос илгээгдлээ');
  await page.getByRole('link', { name: 'Нэвтрэх хуудас руу', exact: true }).click();
  await expect(page.getByLabel('Имэйл хаяг')).toBeVisible();
});

test('auth pages reset success, errors and password visibility on navigation', async ({ page }) => {
  await page.goto('/forgot');
  await page.getByLabel('Имэйл хаяг').fill('student@teamup.mn');
  await page.getByRole('button', { name: 'Холбоос илгээх' }).click();
  await page.getByRole('link', { name: 'Нэвтрэх хуудас руу' }).click();
  await expect(page.getByLabel('Имэйл хаяг')).toBeVisible();
  await page.getByLabel('Имэйл хаяг').fill('student@teamup.mn');
  await page.locator('input[name="password"]').fill('Incorrect123!');
  await page.getByRole('button', { name: 'Нууц үг харах', exact: true }).click();
  await page.getByRole('button', { name: 'Нэвтрэх', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('link', { name: 'Бүртгүүлэх', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('input[name="password"]')).toHaveAttribute('type', 'password');
  await expect(page.locator('input[name="password"]')).toHaveValue('');
});

test('project search debounces typing and keeps browser history compact', async ({ page }) => {
  await page.goto('/projects');
  await expect(page.locator('.project-card').first()).toBeVisible();
  const historyLength = await page.evaluate(() => history.length);
  const queries: string[] = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname === '/api/projects') queries.push(url.searchParams.get('q') || '');
  });
  await page.getByRole('textbox', { name: 'Төслийн нэр', exact: true })
    .pressSequentially('StudyBuddy', { delay: 30 });
  await expect(page.locator('.project-card')).toHaveCount(1);
  await expect(page.locator('.project-card h3')).toContainText('StudyBuddy');
  expect(queries).toEqual(['StudyBuddy']);
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  await expect(page).toHaveURL(/q=StudyBuddy/);
});

test('a new search cancels the old request and keeps the latest result', async ({ page }) => {
  await page.goto('/projects');
  await expect(page.locator('.project-card').first()).toBeVisible();
  const project = await page.request.get('/api/projects?size=1').then(r => r.json());
  let release = () => {};
  const pending = new Promise<void>(resolve => { release = resolve; });
  let oldStarted = false;
  let oldAborted = false;
  page.on('requestfailed', request => {
    if (new URL(request.url()).searchParams.get('q') === 'slow') oldAborted = true;
  });
  await page.route('**/api/projects?**', async route => {
    const query = new URL(route.request().url()).searchParams.get('q');
    if (query === 'slow') {
      oldStarted = true;
      await pending;
    }
    await route.fulfill({ json: {
      ...project, items: [{ ...project.items[0], name: query === 'slow' ? 'Хуучин үр дүн' : 'Шинэ үр дүн' }],
    } }).catch(() => {});
  });
  const search = page.getByRole('textbox', { name: 'Төслийн нэр', exact: true });
  await search.fill('slow');
  await expect.poll(() => oldStarted).toBe(true);
  await search.fill('latest');
  await expect(page.locator('.project-card h3')).toHaveText('Шинэ үр дүн');
  await expect.poll(() => oldAborted).toBe(true);
  release();
  await expect(page.locator('.project-card h3')).toHaveText('Шинэ үр дүн');
});

test('landing project errors can be retried', async ({ page }) => {
  await page.route('**/api/projects?size=3', route => route.fulfill({
    status: 503, json: { message: 'Төслүүдийг ачаалж чадсангүй.' },
  }), { times: 1 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Дахин оролдох' }).click();
  await expect(page.locator('.project-card').first()).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('mobile menu supports focus, Escape, resizing and logout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.request.post('/api/auth/login', {
    data: { email: 'student@teamup.mn', password: 'Teamup123!' },
  });
  await page.goto('/projects');
  await expect(page.locator('.account')).toBeVisible();
  const opener = page.getByRole('button', { name: 'Цэс нээх', exact: true });
  await expect(page.locator('.sidebar')).toHaveAttribute('inert', '');
  await opener.click();
  const menu = page.getByRole('dialog', { name: 'Үндсэн цэс' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Цэс хаах' })).toBeFocused();
  await expect(page.locator('.workspace')).toHaveAttribute('inert', '');
  await menu.getByRole('button', { name: 'Гарах', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(menu.locator('.brand')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(opener).toBeFocused();
  await expect(page.locator('.sidebar')).toHaveAttribute('inert', '');
  await opener.click();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator('.sidebar-backdrop')).toHaveCount(0);
  await expect(page.locator('.workspace')).not.toHaveAttribute('inert');
  await page.setViewportSize({ width: 390, height: 844 });
  await opener.click();
  await menu.getByRole('button', { name: 'Гарах', exact: true }).click();
  await expect(page.locator('.top-actions').getByRole('link', { name: 'Нэвтрэх' })).toBeVisible();
  await expect(page.locator('.sidebar-backdrop')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
