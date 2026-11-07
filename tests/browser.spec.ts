import { expect, test, type Page } from '@playwright/test';
import { PerspectiveCamera, Vector3 } from 'three';
import { getSceneFov, sceneCameraPosition, sceneCameraTarget } from '../src/scene/camera';

const square = (page: Page, name: string) => page.getByRole('button', { name: new RegExp(`^${name}(?:,|$)`) });
async function openFlatBoard(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '2D accessible board', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Chessboard', exact: true })).toBeVisible();
}
async function move(page: Page, from: string, to: string) {
  await square(page, from).click();
  await square(page, to).click();
}

test('3D arena loads all 32 original GLB figurines without browser errors', async ({ page }) => {
  const errors: string[] = [];
  const models = new Set<string>();
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.ok() && /\/models\/[^/]+\.glb$/.test(response.url())) models.add(response.url());
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(() => models.size, { timeout: 30000 }).toBe(32);
  await expect(page.getByText('3D unavailable on this device')).toHaveCount(0);
  expect(await page.locator('canvas').evaluate(canvas => (canvas as HTMLCanvasElement).width)).toBeGreaterThan(100);
  // Project real board coordinates through the scene's initial camera, then
  // exercise pointer capture/raycast dragging rather than a test-only API.
  const box = await page.locator('canvas').boundingBox();
  expect(box).not.toBeNull();
  const aspect = box!.width / box!.height;
  const camera = new PerspectiveCamera(getSceneFov(aspect), aspect, .1, 100);
  camera.position.set(...sceneCameraPosition);
  camera.lookAt(...sceneCameraTarget);
  camera.updateMatrixWorld();
  const screen = (x: number, y: number, z: number) => {
    const projected = new Vector3(x, y, z).project(camera);
    return { x: box!.x + (projected.x + 1) * box!.width / 2, y: box!.y + (1 - projected.y) * box!.height / 2 };
  };
  const from = screen(.5, .46, 2.5); // e2 figurine torso
  const to = screen(.5, .1, .5); // e4 board plane
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
  await expect(page.locator('.count-badge')).toHaveText('01 MOVES');
  await expect(page.locator('.match-status strong')).toHaveText('Villains to move');
  expect(errors).toEqual([]);
});

test('local chess rejects illegal moves, alternates turns, and restores moves with undo', async ({ page }) => {
  await openFlatBoard(page);
  await expect(square(page, 'e2')).toHaveAttribute('aria-label', /Heroes Gon Freecss, Pawn/);
  await square(page, 'e2').click();
  await expect(square(page, 'e4')).toHaveAttribute('aria-label', /legal destination/);
  await square(page, 'e5').click();
  await expect(page.locator('.count-badge')).toHaveText('00 MOVES');
  await expect(square(page, 'e2')).toHaveAttribute('aria-label', /Gon Freecss/);
  await move(page, 'e2', 'e4');
  await expect(page.locator('.count-badge')).toHaveText('01 MOVES');
  await expect(page.locator('.match-status strong')).toHaveText('Villains to move');
  await move(page, 'a2', 'a4');
  await expect(page.locator('.count-badge')).toHaveText('01 MOVES');
  await move(page, 'e7', 'e5');
  await expect(page.locator('.count-badge')).toHaveText('02 MOVES');
  await expect(page.locator('.match-status strong')).toHaveText('Heroes to move');
  await expect(square(page, 'e5')).toHaveAttribute('aria-label', /Villains Akaza, Pawn/);
  await page.getByRole('button', { name: 'Undo move', exact: true }).click();
  await expect(square(page, 'e7')).toHaveAttribute('aria-label', /Akaza/);
  await page.getByRole('button', { name: 'Undo move', exact: true }).click();
  await expect(page.locator('.count-badge')).toHaveText('00 MOVES');
  await expect(square(page, 'e2')).toHaveAttribute('aria-label', /Gon Freecss/);
  await expect(page.getByRole('button', { name: 'Undo move', exact: true })).toBeDisabled();
});

test('Stockfish WASM responds with a legal black move and undo removes the complete turn', async ({ page }) => {
  await openFlatBoard(page);
  await page.getByRole('button', { name: 'vs. Computer', exact: true }).click();
  await expect(page.locator('.match-status')).toContainText('You are the Heroes · Stockfish opponent');
  await move(page, 'e2', 'e4');
  // Reselecting the active mode must not cancel and strand an in-flight search.
  await page.getByRole('button', { name: 'vs. Computer', exact: true }).click();
  await expect(page.locator('.count-badge')).toHaveText('02 MOVES', { timeout: 30000 });
  await expect(page.locator('.match-status strong')).toHaveText('Heroes to move');
  await expect(page.locator('.move-row > span').nth(2)).not.toBeEmpty();
  await expect(page.getByText('Engine unavailable')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo move', exact: true }).click();
  await expect(page.locator('.count-badge')).toHaveText('00 MOVES');
  await expect(square(page, 'e2')).toHaveAttribute('aria-label', /Gon Freecss/);
  await expect(page.locator('.match-status strong')).toHaveText('Heroes to move');
});

test('checkmate ends the game and a confirmed new battle clears the position', async ({ page }) => {
  await openFlatBoard(page);
  await move(page, 'f2', 'f3');
  await move(page, 'e7', 'e5');
  await move(page, 'g2', 'g4');
  await move(page, 'd8', 'h4');
  const dialog = page.getByRole('dialog', { name: 'Villains win', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Checkmate.');
  await dialog.getByRole('button', { name: 'Review the battlefield', exact: true }).click();
  await expect(page.locator('.match-status strong')).toHaveText('Villains win');
  await page.getByRole('button', { name: 'New battle', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'A new war awaits.', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start new battle', exact: true }).click();
  await expect(page.locator('.count-badge')).toHaveText('00 MOVES');
  await expect(square(page, 'e1')).toHaveAttribute('aria-label', /Heroes Naruto Uzumaki, King/);
  await expect(square(page, 'd8')).toHaveAttribute('aria-label', /Villains Ryomen Sukuna, Queen/);
});

test('promotion requires a choice and preserves identity through underpromotion and undo', async ({ page }) => {
  await openFlatBoard(page);
  for (const [from, to] of [['a2','a4'],['b7','b5'],['a4','b5'],['a7','a6'],['b5','a6'],['h7','h6'],['a6','a7'],['h6','h5'],['a7','b8']]) {
    await move(page, from, to);
  }
  const dialog = page.getByRole('dialog', { name: 'A legend ascends.', exact: true });
  await expect(dialog).toBeVisible();
  await expect(page.locator('.count-badge')).toHaveText('08 MOVES');
  await dialog.getByRole('button', { name: /Knight/ }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.count-badge')).toHaveText('09 MOVES');
  await expect(square(page, 'b8')).toHaveAttribute('aria-label', /Heroes Tanjiro Kamado, Knight/);
  await expect(page.locator('.captured-section .section-label')).toContainText('3 / 32');
  await page.getByRole('button', { name: 'Undo move', exact: true }).click();
  await expect(square(page, 'a7')).toHaveAttribute('aria-label', /Heroes Tanjiro Kamado, Pawn/);
  await expect(square(page, 'b8')).toHaveAttribute('aria-label', /Villains Meruem, Knight/);
  await expect(page.locator('.captured-section .section-label')).toContainText('2 / 32');
});

test('en passant removes the passed pawn and undo restores both characters', async ({ page }) => {
  await openFlatBoard(page);
  for (const [from, to] of [['e2','e4'],['a7','a6'],['e4','e5'],['d7','d5'],['e5','d6']]) {
    await move(page, from, to);
  }
  await expect(square(page, 'd6')).toHaveAttribute('aria-label', /Heroes Gon Freecss, Pawn/);
  await expect(square(page, 'd5')).toHaveAttribute('aria-label', 'd5');
  await expect(page.locator('.captured-list [title]')).toHaveAttribute('title', /Blackbeard/);
  await page.getByRole('button', { name: 'Undo move', exact: true }).click();
  await expect(square(page, 'e5')).toHaveAttribute('aria-label', /Gon Freecss/);
  await expect(square(page, 'd5')).toHaveAttribute('aria-label', /Blackbeard/);
});

test('castling moves Naruto and Asta together and undo restores both', async ({ page }) => {
  await openFlatBoard(page);
  for (const [from, to] of [['e2','e4'],['e7','e5'],['g1','f3'],['b8','c6'],['f1','c4'],['g8','f6'],['e1','g1']]) {
    await move(page, from, to);
  }
  await expect(square(page, 'g1')).toHaveAttribute('aria-label', /Heroes Naruto Uzumaki, King/);
  await expect(square(page, 'f1')).toHaveAttribute('aria-label', /Heroes Asta, Rook/);
  await expect(square(page, 'h1')).toHaveAttribute('aria-label', 'h1');
  await page.getByRole('button', { name: 'Undo move', exact: true }).click();
  await expect(square(page, 'e1')).toHaveAttribute('aria-label', /Heroes Naruto Uzumaki, King/);
  await expect(square(page, 'h1')).toHaveAttribute('aria-label', /Heroes Asta, Rook/);
});

test('roster lists exact team and role assignments and supports search', async ({ page }) => {
  await openFlatBoard(page);
  await page.getByRole('button', { name: 'Explore the roster', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Not pieces. Legends.', exact: true });
  await expect(dialog.locator('.roster-character')).toHaveCount(16);
  const naruto = dialog.locator('.roster-character').filter({ has: page.getByRole('heading', { name: 'Naruto Uzumaki', exact: true }) });
  await expect(naruto).toContainText('E1');
  await expect(naruto).toContainText('King');
  await dialog.getByRole('button', { name: 'Villains · 16', exact: true }).click();
  await expect(dialog.locator('.roster-character')).toHaveCount(16);
  const search = dialog.getByRole('textbox', { name: 'Search characters', exact: true });
  await search.pressSequentially('Madara');
  await expect(search).toBeFocused();
  await expect(search).toHaveValue('Madara');
  await expect(dialog.locator('.roster-character')).toHaveCount(1);
  await expect(dialog.locator('.roster-character')).toContainText('Madara Uchiha');
  await expect(dialog.locator('.roster-character')).toContainText('E8');
  await expect(dialog.locator('.roster-character')).toContainText('King');
  await dialog.getByRole('textbox', { name: 'Search characters', exact: true }).fill('missing legend');
  await expect(dialog.getByText('No legends found on this team.', { exact: false })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});

test('sound, aura and quality controls update their actual state', async ({ page }) => {
  await openFlatBoard(page);
  await page.getByRole('button', { name: 'Enable sound', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mute sound', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Set the atmosphere.', exact: true });
  await expect(dialog.getByRole('switch', { name: 'Battle sounds' })).toBeChecked();
  await dialog.getByRole('switch', { name: 'Battle sounds' }).click();
  await expect(dialog.getByRole('switch', { name: 'Battle sounds' })).not.toBeChecked();
  await dialog.getByRole('switch', { name: 'Character auras' }).click();
  await expect(dialog.getByRole('switch', { name: 'Character auras' })).not.toBeChecked();
  await dialog.getByRole('combobox').selectOption('low');
  await expect(dialog.getByRole('combobox')).toHaveValue('low');
  await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Enable sound', exact: true })).toBeVisible();
});

test('mobile layout fits the viewport and the accessible board remains playable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFlatBoard(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(square(page, 'e2')).toBeVisible();
  await move(page, 'e2', 'e4');
  await expect(page.locator('.count-badge')).toHaveText('01 MOVES');
  await expect(page.locator('.match-status strong')).toHaveText('Villains to move');
  await expect(page.getByRole('button', { name: 'New battle', exact: true })).toBeVisible();
});
