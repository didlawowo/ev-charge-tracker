import { test, expect } from '@playwright/test'

test.describe('EV Finder App', () => {
  test.beforeEach(async ({ page, context }) => {
    // Mock geolocation (Paris)
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation({ latitude: 48.8566, longitude: 2.3522 })
    await page.goto('/')
  })

  test('should display header with app title', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('EV Finder')
  })

  test('should show loading state then map', async ({ page }) => {
    // Map should be visible after geolocation
    await expect(page.locator('.map-container')).toBeVisible({ timeout: 10000 })
  })

  test('should have navigation tabs', async ({ page }) => {
    await expect(page.locator('.tabs button')).toHaveCount(2)
    await expect(page.locator('.tabs button').first()).toContainText('Carte')
    await expect(page.locator('.tabs button').last()).toContainText('Liste')
  })

  test('should switch between map and list views', async ({ page }) => {
    await page.waitForSelector('.map-container', { timeout: 10000 })

    // Click on Liste tab
    await page.click('.tabs button:has-text("Liste")')
    await expect(page.locator('.list-view')).toBeVisible()

    // Click on Carte tab
    await page.click('.tabs button:has-text("Carte")')
    await expect(page.locator('.map-container')).toBeVisible()
  })

  test('should display filter bar', async ({ page }) => {
    await expect(page.locator('.filter-bar')).toBeVisible()
  })
})

test.describe('Destination Search', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation({ latitude: 48.8566, longitude: 2.3522 })
    await page.goto('/')
    await page.waitForSelector('.map-container', { timeout: 10000 })
  })

  test('should have destination search input', async ({ page }) => {
    await expect(page.locator('.search-input')).toBeVisible()
  })

  test('should show autonomy controls', async ({ page }) => {
    await expect(page.locator('.autonomy-controls')).toBeVisible()
  })

  test('should toggle winter mode', async ({ page }) => {
    const winterToggle = page.locator('.winter-toggle')
    await expect(winterToggle).toBeVisible()

    // Initial state
    await expect(winterToggle).not.toHaveClass(/active/)

    // Toggle on
    await winterToggle.click()
    await expect(winterToggle).toHaveClass(/active/)

    // Toggle off
    await winterToggle.click()
    await expect(winterToggle).not.toHaveClass(/active/)
  })

  test('should toggle toll avoidance', async ({ page }) => {
    const tollToggle = page.locator('.toll-toggle')
    await expect(tollToggle).toBeVisible()

    // Initial state (tolls allowed)
    await expect(tollToggle).not.toHaveClass(/active/)

    // Toggle to avoid tolls
    await tollToggle.click()
    await expect(tollToggle).toHaveClass(/active/)
  })
})

test.describe('Filter Bar', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation({ latitude: 48.8566, longitude: 2.3522 })
    await page.goto('/')
    await page.waitForSelector('.filter-bar', { timeout: 10000 })
  })

  test('should have radius filter', async ({ page }) => {
    await expect(page.locator('.filter-bar').getByText(/km/)).toBeVisible()
  })

  test('should have power filter', async ({ page }) => {
    await expect(page.locator('.filter-bar select').first()).toBeVisible()
  })
})

test.describe('Map Interactions', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation({ latitude: 48.8566, longitude: 2.3522 })
    await page.goto('/')
    await page.waitForSelector('.map-container', { timeout: 10000 })
  })

  test('should have center on user button', async ({ page }) => {
    await expect(page.locator('.center-btn')).toBeVisible()
  })

  test('should have map loaded with tiles', async ({ page }) => {
    // Check that Leaflet has loaded tiles
    await expect(page.locator('.leaflet-tile-pane img').first()).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('should display correctly on mobile', async ({ page, context }) => {
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation({ latitude: 48.8566, longitude: 2.3522 })
    await page.goto('/')

    await expect(page.locator('h1')).toContainText('EV Finder')
    await expect(page.locator('.tabs')).toBeVisible()
  })
})
