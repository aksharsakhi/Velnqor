import { expect, test } from './fixtures'

test.describe('Menu Bar Companion Window (Tray Popover) @smoke', () => {
  test('renders companion popover with basic operations, bonding toggle and network adapters', async ({
    plexo
  }) => {
    // Navigate page into tray mode
    await plexo.page.evaluate(() => {
      window.location.search = '?mode=tray'
    })
    await plexo.page.waitForLoadState('domcontentloaded')

    // 1. Verify Brand Header & Status
    await expect(plexo.page.locator('text=Velnqor').first()).toBeVisible()
    await expect(plexo.page.locator('text=Standby').first()).toBeVisible()

    // 2. Verify Hero Bonding Control
    const activateBtn = plexo.page.getByRole('button', { name: /Activate/i })
    await expect(activateBtn).toBeVisible()
    await expect(plexo.page.locator('text=Bonding Inactive')).toBeVisible()

    // 3. Verify Speed Metrics
    await expect(plexo.page.locator('text=Download')).toBeVisible()
    await expect(plexo.page.locator('text=Upload')).toBeVisible()

    // 4. Verify Route Mac Traffic Toggle
    await expect(plexo.page.locator('text=Route Mac Traffic')).toBeVisible()
    await expect(plexo.page.locator('text=Accelerate all macOS apps')).toBeVisible()

    // 5. Verify Connected Adapters Section
    await expect(plexo.page.locator('text=Connected Adapters')).toBeVisible()

    // 6. Test Basic Operation: Activate Bonding
    await activateBtn.click()

    // Verify bonding state changes to active
    await expect(plexo.page.getByRole('button', { name: /Stop/i })).toBeVisible({ timeout: 10000 })
    await expect(plexo.page.locator('text=Bonding Active').first()).toBeVisible()

    // 7. Test Basic Operation: Stop Bonding
    const stopBtn = plexo.page.getByRole('button', { name: /Stop/i })
    await stopBtn.click()
    await expect(plexo.page.getByRole('button', { name: /Activate/i })).toBeVisible({
      timeout: 10000
    })

    // 8. Verify Navigation & Quit Buttons
    await expect(plexo.page.locator('text=Open Full Dashboard')).toBeVisible()
    await expect(plexo.page.locator('text=Quit Velnqor')).toBeVisible()
  })
})
