/**
 * Phase 19 Social Integration E2E Test
 * Tests: Registration, Friends, Presence, Direct Join
 *
 * Run: npx playwright test e2e-social-test.ts --headed
 */
import { test, expect, chromium, Browser, BrowserContext, Page } from '@playwright/test'

const BASE_URL = 'https://server-production-b2a8.up.railway.app'
const ts = Date.now().toString().slice(-6) // short timestamp

const USER_A = { username: `testa${ts}`, password: 'TestPass123!', displayName: `AlphaP${ts}` }
const USER_B = { username: `testb${ts}`, password: 'TestPass123!', displayName: `BravoP${ts}` }

async function registerUser(page: Page, user: typeof USER_A) {
  await page.goto(BASE_URL)
  const loginLink = page.locator('text=Iniciar sesion')
  await loginLink.waitFor({ timeout: 10000 })
  await loginLink.click()
  await page.waitForURL('**/auth', { timeout: 10000 })

  // Switch to register form
  await page.getByText('Regístrate').click()
  await page.waitForTimeout(500)

  // Fill register form
  await page.fill('input[placeholder="tu_usuario"]', user.username)
  await page.fill('input[placeholder="Tu Nombre"]', user.displayName)
  await page.fill('input[placeholder="Mínimo 6 caracteres"]', user.password)
  await page.fill('input[placeholder="Repite la contraseña"]', user.password)

  await page.click('button:has-text("Crear Cuenta")')
  await page.waitForURL('**/', { timeout: 15000 })
  await expect(page.locator('button[title="Amigos"]')).toBeVisible({ timeout: 8000 })
  console.log(`  ✓ Registered: ${user.displayName}`)
}

test.describe.serial('Phase 19: Social Integration E2E', () => {
  let browser: Browser
  let ctxA: BrowserContext, ctxB: BrowserContext
  let pageA: Page, pageB: Page

  test.beforeAll(async () => {
    browser = await chromium.launch({ headless: false, slowMo: 400 })
    ctxA = await browser.newContext({ viewport: { width: 390, height: 844 } })
    ctxB = await browser.newContext({ viewport: { width: 390, height: 844 } })
    pageA = await ctxA.newPage()
    pageB = await ctxB.newPage()
  })

  test.afterAll(async () => {
    await browser.close()
  })

  test('1. Health check', async () => {
    const res = await pageA.request.get(`${BASE_URL}/health`)
    expect(res.status()).toBe(200)
    console.log('  ✓ Server healthy')
  })

  test('2. Register two users', async () => {
    await registerUser(pageA, USER_A)
    await registerUser(pageB, USER_B)
  })

  test('3. User A sends friend request to User B', async () => {
    await pageA.click('button[title="Amigos"]')
    await pageA.waitForTimeout(500)
    await pageA.click('button:has-text("Buscar")')
    await pageA.waitForTimeout(500)

    await pageA.fill('input[placeholder="Buscar por nombre de usuario..."]', USER_B.username)
    await pageA.waitForTimeout(2000)

    // Verify we found User B
    await expect(pageA.getByText(`@${USER_B.username}`)).toBeVisible({ timeout: 5000 })

    await pageA.click('button:has-text("Agregar")')
    await pageA.waitForTimeout(1500)
    console.log('  ✓ Friend request sent A → B')
  })

  test('4. User B accepts friend request', async () => {
    await pageB.click('button[title="Amigos"]')
    await pageB.waitForTimeout(1000)
    await pageB.click('button:has-text("Solicitudes")')
    await pageB.waitForTimeout(2000)

    // The real-time socket event delivers the request — look for Accept button
    const acceptBtn = pageB.locator('button:has-text("Aceptar")').first()
    await expect(acceptBtn).toBeVisible({ timeout: 10000 })
    await acceptBtn.click()
    await pageB.waitForTimeout(1500)
    console.log('  ✓ Friend request accepted by B')

    // Switch to friends tab and verify
    await pageB.click('button:has-text("Amigos")')
    await pageB.waitForTimeout(1500)
    await expect(pageB.getByText(USER_A.displayName).first()).toBeVisible({ timeout: 8000 })
    console.log('  ✓ User A appears in B\'s friend list')
  })

  test('5. Presence: A sees B as online', async () => {
    await pageA.click('text=Cerrar')
    await pageA.waitForTimeout(500)
    await pageA.click('button[title="Amigos"]')
    await pageA.waitForTimeout(500)
    await pageA.click('button:has-text("Amigos")')
    await pageA.waitForTimeout(2000)

    await expect(pageA.getByText(USER_B.displayName).first()).toBeVisible({ timeout: 8000 })
    await expect(pageA.getByText('En linea').first()).toBeVisible({ timeout: 5000 })
    console.log('  ✓ User A sees User B online')
  })

  test('6. Direct Join: A creates room, B joins via friend list', async () => {
    // User A creates a room
    await pageA.click('text=Cerrar')
    await pageA.waitForTimeout(500)
    await pageA.click('button:has-text("Crear Sala")')
    await pageA.waitForTimeout(500)

    // Name field should be auto-filled
    const nameInput = pageA.locator('input[placeholder="Jugador"]')
    const nameValue = await nameInput.inputValue()
    if (!nameValue) await nameInput.fill(USER_A.displayName)

    await pageA.locator('button:has-text("Crear Sala")').last().click()
    await pageA.waitForURL('**/lobby', { timeout: 15000 })
    console.log('  ✓ User A in lobby')

    // Wait for presence to propagate
    await pageA.waitForTimeout(3000)

    // User B refreshes friends list
    await pageB.click('text=Cerrar')
    await pageB.waitForTimeout(500)
    await pageB.click('button[title="Amigos"]')
    await pageB.waitForTimeout(500)
    await pageB.click('button:has-text("Amigos")')
    await pageB.waitForTimeout(3000)

    // Should see "En sala" and "Unirse"
    await expect(pageB.getByText('En sala').first()).toBeVisible({ timeout: 10000 })
    console.log('  ✓ User B sees "En sala" for User A')

    const joinBtn = pageB.locator('button:has-text("Unirse")')
    await expect(joinBtn.first()).toBeVisible({ timeout: 10000 })
    await joinBtn.first().click()
    await pageB.waitForURL('**/lobby', { timeout: 15000 })
    console.log('  ✓ User B joined via Direct Join!')

    // Both in same lobby
    await expect(pageA.getByText(USER_B.displayName).first()).toBeVisible({ timeout: 8000 })
    await expect(pageB.getByText(USER_A.displayName).first()).toBeVisible({ timeout: 8000 })
    console.log('  ✓ Both users in same lobby')
  })

  test('7. Final state verification', async () => {
    expect(pageA.url()).toContain('/lobby')
    expect(pageB.url()).toContain('/lobby')

    // Take final screenshots
    await pageA.screenshot({ path: 'test-results/final-lobby-userA.png' })
    await pageB.screenshot({ path: 'test-results/final-lobby-userB.png' })
    console.log('  ✓ All Phase 19 social features verified!')
  })
})
