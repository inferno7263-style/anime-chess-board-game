import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

const square = (page: Page, name: string) => page.getByRole('button', { name: new RegExp(`^${name}(?:,|$)`) });
const moves = (page: Page) => page.locator('.count-badge');
async function move(page: Page, from: string, to: string) {
  await square(page, from).click();
  await square(page, to).click();
}
async function openFlat(page: Page, url = '/') {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '2D accessible board', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Chessboard', exact: true })).toBeVisible();
}
async function createHost(browser: Browser) {
  const context = await browser.newContext({ viewport: { width: 1360, height: 1000 } });
  const page = await context.newPage();
  await openFlat(page);
  await page.getByRole('button', { name: 'Online Multiplayer', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Create private room', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Create private room', exact: true }).click();
  await expect(page.getByTestId('room-code')).toBeVisible();
  const code = await page.getByTestId('room-code').innerText();
  const invitation = await page.getByLabel('Invitation link', { exact: true }).inputValue();
  return { context, page, code, invitation };
}
async function joinGuest(browser: Browser, invitation: string) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await openFlat(page, invitation);
  await expect(page.getByRole('button', { name: 'Join room', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Join room', exact: true }).click();
  await expect(page.getByText('YOU ARE BLACK', { exact: true })).toBeVisible();
  return { context, page };
}
async function withPlayers(browser: Browser, run: (host: Awaited<ReturnType<typeof createHost>>, guest: Awaited<ReturnType<typeof joinGuest>>) => Promise<void>) {
  const host = await createHost(browser);
  let guest: Awaited<ReturnType<typeof joinGuest>> | undefined;
  try { guest = await joinGuest(browser, host.invitation); await run(host, guest); }
  finally { await guest?.context.close(); await host.context.close(); }
}
async function expectMoves(pages: Page[], count: number) {
  for (const page of pages) await expect(moves(page)).toHaveText(`${String(count).padStart(2, '0')} MOVES`);
}

test('two separate devices join by invitation, receive opposite sides, and synchronize validated moves and captures', async ({ browser }) => {
  await withPlayers(browser, async (host, guest) => {
    await expect(host.page.getByText('YOU ARE WHITE', { exact: true })).toBeVisible();
    await expect(host.page.locator('.opponent-status')).toContainText('Opponent connected');
    expect(new URL(host.invitation).searchParams.get('room')).toBe(host.code);
    expect(new URL(host.invitation).searchParams.has('token')).toBe(false);
    // Black's automatically flipped board begins at h1; White's at a8.
    await expect(host.page.locator('.flat-square').first()).toHaveAttribute('aria-label', /^a8,/);
    await expect(guest.page.locator('.flat-square').first()).toHaveAttribute('aria-label', /^h1,/);
    await move(guest.page, 'e7', 'e5');
    await expectMoves([host.page, guest.page], 0);
    await move(host.page, 'e2', 'e5');
    await expectMoves([host.page, guest.page], 0);
    await move(host.page, 'e2', 'e4');
    await expectMoves([host.page, guest.page], 1);
    await expect(host.page.locator('.match-status strong')).toHaveText("Opponent's turn");
    await expect(guest.page.locator('.match-status strong')).toHaveText('Your turn');
    await move(host.page, 'd2', 'd4');
    await expectMoves([host.page, guest.page], 1);
    await move(guest.page, 'd7', 'd5');
    await expectMoves([host.page, guest.page], 2);
    await move(host.page, 'e4', 'd5');
    await expectMoves([host.page, guest.page], 3);
    for (const page of [host.page, guest.page]) {
      await expect(square(page, 'd5')).toHaveAttribute('aria-label', /Heroes Gon Freecss, Pawn/);
      await expect(page.locator('.captured-list .avatar')).toHaveCount(1);
      await expect(page.getByRole('button', { name: 'Undo move', exact: true })).toBeDisabled();
    }
    expect(await guest.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});

test('reload and a temporary network outage restore the same seat and authoritative game', async ({ browser }) => {
  await withPlayers(browser, async (host, guest) => {
    await move(host.page, 'e2', 'e4');
    await expectMoves([host.page, guest.page], 1);
    await move(guest.page, 'e7', 'e5');
    await expectMoves([host.page, guest.page], 2);
    await guest.page.reload({ waitUntil: 'domcontentloaded' });
    await guest.page.getByRole('button', { name: '2D accessible board', exact: true }).click();
    await expect(guest.page.getByText('YOU ARE BLACK', { exact: true })).toBeVisible();
    await expectMoves([host.page, guest.page], 2);
    await expect(square(guest.page, 'e5')).toHaveAttribute('aria-label', /Villains Akaza, Pawn/);
    await guest.context.setOffline(true);
    await guest.page.reload({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => undefined);
    await expect(host.page.locator('.opponent-status')).toContainText('Opponent disconnected', { timeout: 15000 });
    await move(host.page, 'd2', 'd4');
    await expectMoves([host.page], 2);
    await guest.context.setOffline(false);
    await openFlat(guest.page, '/');
    await expect(guest.page.getByText('YOU ARE BLACK', { exact: true })).toBeVisible();
    await expect(guest.page.getByTestId('room-code')).toHaveText(host.code);
    await expect(host.page.locator('.opponent-status')).toContainText('Opponent connected');
    await expectMoves([host.page, guest.page], 2);
    await move(host.page, 'd2', 'd4');
    await expectMoves([host.page, guest.page], 3);
  });
});

test('checkmate and its final board are synchronized across both independent sessions', async ({ browser }) => {
  await withPlayers(browser, async (host, guest) => {
    let count = 0;
    for (const [page, from, to] of [
      [host.page, 'f2', 'f3'], [guest.page, 'e7', 'e5'],
      [host.page, 'g2', 'g4'], [guest.page, 'd8', 'h4'],
    ] as const) {
      await move(page, from, to);
      await expectMoves([host.page, guest.page], ++count);
    }
    for (const page of [host.page, guest.page]) {
      await expect(page.getByRole('dialog')).toContainText(/checkmate/i);
      await expectMoves([page], 4);
      await page.getByRole('button', { name: 'Review the battlefield', exact: true }).click();
      await expect(square(page, 'h4')).toHaveAttribute('aria-label', /Villains Ryomen Sukuna, Queen/);
      await expect(page.locator('.match-status strong')).toContainText(/Villains|Black/i);
    }
  });
});

test('a full private room refuses a third player and leaving ends the active game for the opponent', async ({ browser }) => {
  await withPlayers(browser, async (host, guest) => {
    const thirdContext = await browser.newContext();
    try {
      const third = await thirdContext.newPage();
      await openFlat(third, host.invitation);
      await third.getByRole('button', { name: 'Join room', exact: true }).click();
      await expect(third.getByRole('alert')).toContainText(/full|taken/i);
      await expect(third.getByText('YOU ARE BLACK', { exact: true })).toHaveCount(0);
    } finally { await thirdContext.close(); }
    await guest.page.getByRole('button', { name: 'Leave room', exact: true }).click();
    const dialog = guest.page.getByRole('dialog', { name: 'Leave this battlefield?' });
    await expect(dialog).toContainText(/resigns/i);
    await dialog.getByRole('button', { name: 'Leave room', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(guest.page.getByRole('button', { name: 'Create private room', exact: true })).toBeVisible();
    await expect(host.page.getByRole('dialog')).toContainText(/resign|left/i);
    await expect(host.page.locator('.match-status strong')).toContainText(/Heroes|White/i);
  });
});

test('creator can close an unused room and its invitation cannot admit another player', async ({ browser }) => {
  const host = await createHost(browser);
  let guestContext: BrowserContext | undefined;
  try {
    await host.page.getByRole('button', { name: 'Close room', exact: true }).click();
    await host.page.getByRole('dialog', { name: 'Close this battlefield?' }).getByRole('button', { name: 'Close room', exact: true }).click();
    await expect(host.page.getByRole('dialog', { name: 'Close this battlefield?', exact: true })).toHaveCount(0);
    await expect(host.page.getByRole('dialog', { name: 'Room closed', exact: true })).toContainText(/closed/i);
    guestContext = await browser.newContext();
    const page = await guestContext.newPage();
    await openFlat(page, host.invitation);
    await page.getByRole('button', { name: 'Join room', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText(/closed|expired|not found|no longer accepting/i);
  } finally { await guestContext?.close(); await host.context.close(); }
});


test('permanent stale-session errors clear saved credentials and permit creating a new battle', async ({ browser }) => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await openFlat(page);
    // This is the same missing-room response produced after a backend restart.
    await page.evaluate(() => sessionStorage.setItem('anime-chess:online-seat', JSON.stringify({ code: 'ZZZZZZZZ', token: '0'.repeat(64), color: 'w' })));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '2D accessible board', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText(/no longer exists|not found|expired/i);
    expect(await page.evaluate(() => sessionStorage.getItem('anime-chess:online-seat'))).toBeNull();
    await expect(page.getByRole('button', { name: 'Create private room', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Create private room', exact: true }).click();
    await expect(page.getByText('YOU ARE WHITE', { exact: true })).toBeVisible();
    // A syntactically valid but incorrect token cannot recover the new seat either.
    await page.evaluate(() => {
      const saved = JSON.parse(sessionStorage.getItem('anime-chess:online-seat')!);
      saved.token = 'f'.repeat(64);
      sessionStorage.setItem('anime-chess:online-seat', JSON.stringify(saved));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '2D accessible board', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText(/cannot claim|invalid/i);
    expect(await page.evaluate(() => sessionStorage.getItem('anime-chess:online-seat'))).toBeNull();
    await page.getByRole('button', { name: 'Create private room', exact: true }).click();
    await expect(page.getByText('YOU ARE WHITE', { exact: true })).toBeVisible();
  } finally { await context.close(); }
});
