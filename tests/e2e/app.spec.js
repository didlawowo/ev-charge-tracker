import { test, expect } from '@playwright/test'

const PARIS = { latitude: 48.8566, longitude: 2.3522 }

test.describe('EV Finder App', () => {
  test.beforeEach(async ({ page, context }) => {
    // Mock geolocation (Paris)
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation(PARIS)
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

  test('should have a refresh button in the header', async ({ page }) => {
    await expect(page.locator('button[aria-label="Rafraîchir les bornes"]')).toBeVisible()
  })

  test('should open the options menu', async ({ page }) => {
    await page.click('button[aria-label="Options"]')
    await expect(page.locator('.options-panel')).toBeVisible()
  })
})

test.describe('Destination & autonomy', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation(PARIS)
    await page.goto('/')
    await page.waitForSelector('.map-container', { timeout: 10000 })
  })

  test('should have destination search input', async ({ page }) => {
    await expect(page.locator('.search-input')).toBeVisible()
  })

  test('should have a numeric autonomy input', async ({ page }) => {
    const autonomy = page.locator('.autonomy-input')
    await expect(autonomy).toBeVisible()
    await expect(autonomy).toHaveAttribute('inputmode', 'numeric')
  })
})

test.describe('Options menu', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation(PARIS)
    await page.goto('/')
    await page.waitForSelector('.map-container', { timeout: 10000 })
    await page.click('button[aria-label="Options"]')
    await page.waitForSelector('.options-panel', { timeout: 5000 })
  })

  test('should toggle winter mode', async ({ page }) => {
    const winterToggle = page.locator('.toggle.winter')
    await expect(winterToggle).toBeVisible()
    await expect(winterToggle).not.toHaveClass(/active/)

    await winterToggle.click()
    await expect(winterToggle).toHaveClass(/active/)

    await winterToggle.click()
    await expect(winterToggle).not.toHaveClass(/active/)
  })

  test('should toggle toll avoidance', async ({ page }) => {
    const tollToggle = page.locator('.toggle.toll')
    await expect(tollToggle).toBeVisible()
    await expect(tollToggle).not.toHaveClass(/active/)

    await tollToggle.click()
    await expect(tollToggle).toHaveClass(/active/)
  })

  test('should have a power filter', async ({ page }) => {
    await expect(page.locator('.options-panel select').first()).toBeVisible()
  })

  test('should have a radius filter', async ({ page }) => {
    await expect(page.locator('.radius-value')).toContainText('km')
  })
})

test.describe('Map Interactions', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation(PARIS)
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
    await context.setGeolocation(PARIS)
    await page.goto('/')

    await expect(page.locator('h1')).toContainText('EV Finder')
    await expect(page.locator('.tabs')).toBeVisible()
  })
})
