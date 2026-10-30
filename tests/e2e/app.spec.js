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

  test('should open the list view from the ?view=list PWA shortcut', async ({ page }) => {
    await page.goto('/?view=list')
    await expect(page.locator('.tabs button').last()).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('.list-view')).toBeVisible({ timeout: 10000 })
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

  test('should open the autonomy editor with a numeric input', async ({ page }) => {
    await page.click('.autonomy-field')
    const autonomy = page.locator('.autonomy-editor .autonomy-input')
    await expect(autonomy).toBeVisible()
    await expect(autonomy).toHaveAttribute('inputmode', 'numeric')
  })

  test('should replace the autonomy by typing and pressing Enter', async ({ page }) => {
    await page.click('.autonomy-field')
    await page.fill('.autonomy-editor .autonomy-input', '180')
    await page.press('.autonomy-editor .autonomy-input', 'Enter')
    await expect(page.locator('.autonomy-editor')).toHaveCount(0)
    await expect(page.locator('.autonomy-number')).toHaveText('180')
  })

  test('should set the autonomy from a preset and the -10 step', async ({ page }) => {
    await page.click('.autonomy-field')
    await page.click('.autonomy-editor .preset:has-text("50 %")')
    await page.click('.autonomy-editor button[aria-label="Retirer 10 km"]')
    await expect(page.locator('.autonomy-editor .autonomy-input')).toHaveValue('225')
    await page.click('.autonomy-editor .confirm-btn')
    await expect(page.locator('.autonomy-number')).toHaveText('225')
  })

  test('should cancel the autonomy editor without changing the value', async ({ page }) => {
    await page.click('.autonomy-field')
    await page.fill('.autonomy-editor .autonomy-input', '42')
    await page.keyboard.press('Escape')
    await expect(page.locator('.autonomy-editor')).toHaveCount(0)
    await expect(page.locator('.autonomy-number')).toHaveText('100')
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

test.describe('Offline trip', () => {
  const TRIP_STORAGE_KEY = 'ev-finder:last-trip'
  const savedTrip = () => ({
    version: 1,
    savedAt: Date.now(),
    destination: { lat: 45.764, lng: 4.8357, name: 'Lyon, Métropole de Lyon' },
    destinationQuery: 'Lyon',
    selectedRouteIndex: 0,
    routes: [{
      id: 0,
      isMain: true,
      distance: 465000,
      duration: 17760,
      coordinates: [[2.3522, 48.8566], [3.5, 47.5], [4.8357, 45.764]]
    }],
    chargers: []
  })

  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation(PARIS)
  })

  test('should offer to resume the last saved trip', async ({ page }) => {
    await page.addInitScript(([key, trip]) => {
      localStorage.setItem(key, JSON.stringify(trip))
    }, [TRIP_STORAGE_KEY, savedTrip()])
    await page.goto('/')

    await page.click('.resume-trip .resume-main')
    await expect(page.locator('.route-summary')).toContainText('465 km')
    await expect(page.locator('.search-input')).toHaveValue('Lyon')
  })

  test('should forget the saved trip', async ({ page }) => {
    await page.addInitScript(([key, trip]) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem(key, JSON.stringify(trip))
        sessionStorage.setItem('seeded', '1')
      }
    }, [TRIP_STORAGE_KEY, savedTrip()])
    await page.goto('/')

    await page.click('.resume-trip .resume-forget')
    await expect(page.locator('.resume-trip')).toHaveCount(0)
    expect(await page.evaluate(key => localStorage.getItem(key), TRIP_STORAGE_KEY)).toBeNull()
  })

  test('should restore the last trip automatically when opened offline', async ({ page }) => {
    await page.addInitScript(([key, trip]) => {
      localStorage.setItem(key, JSON.stringify(trip))
      Object.defineProperty(Navigator.prototype, 'onLine', { get: () => false })
    }, [TRIP_STORAGE_KEY, savedTrip()])
    await page.goto('/')

    await expect(page.locator('.route-summary')).toContainText('465 km')
    await page.waitForSelector('.map-container', { timeout: 10000 })
    await expect(page.locator('.status-pill.offline')).toBeVisible()
  })
})


test.describe('Préférences Tesla et recharge', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation(PARIS)
    await page.goto('/')
    await page.getByRole('button', { name: 'Options' }).click()
  })

  test('exclut Tesla par défaut et mémorise la réactivation', async ({ page }) => {
    const tesla = page.getByRole('switch', { name: /Masquer les Superchargeurs Tesla/ })
    await expect(tesla).toBeChecked()
    await tesla.uncheck()
    await expect(tesla).not.toBeChecked()

    await page.reload()
    await page.getByRole('button', { name: 'Options' }).click()
    await expect(page.getByRole('switch', { name: /Masquer les Superchargeurs Tesla/ })).not.toBeChecked()
  })

  test('limite les recharges à 25 minutes par défaut et mémorise le choix', async ({ page }) => {
    const duration = page.getByRole('combobox', { name: 'Durée maximale de recharge par arrêt' })
    await expect(duration).toHaveValue('25')
    await duration.selectOption('15')
    await page.reload()
    await page.getByRole('button', { name: 'Options' }).click()
    await expect(page.getByRole('combobox', { name: 'Durée maximale de recharge par arrêt' })).toHaveValue('15')
  })
})

test.describe('Planification avec plafond de recharge', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation(PARIS)
    await page.addInitScript(() => {
      localStorage.setItem('ev-finder:last-trip', JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        destination: { lat: 48.9, lng: 2.3522, name: 'Destination test' },
        destinationQuery: 'Destination test',
        selectedRouteIndex: 0,
        routes: [{
          id: 0,
          distance: 322000,
          duration: 14400,
          coordinates: [[2.3522, 46], [2.3522, 46.7], [2.3522, 48.3], [2.3522, 48.9]]
        }],
        chargers: [
          {
            id: 1, name: 'Borne A', operator: 'Ionity',
            lat: 46.7, lng: 2.3522, distance: 80000, isOperational: true,
            connections: [{ type: 'CCS', typeId: 33, power: 150 }]
          },
          {
            id: 2, name: 'Borne B', operator: 'Ionity',
            lat: 48.3, lng: 2.3522, distance: 260000, isOperational: true,
            connections: [{ type: 'CCS', typeId: 33, power: 150 }]
          },
          {
            id: 3, name: 'Tesla Supercharger', operator: 'Tesla',
            lat: 46.7, lng: 2.3522, distance: 80000, isOperational: true,
            connections: [{ type: 'CCS', typeId: 33, power: 250 }]
          }
        ]
      }))
    })
    await page.goto('/')
    await page.locator('.map-container').waitFor()
    await page.locator('.resume-trip .resume-main').click()
  })

  test('retient au maximum 25 min par arrêt, sans exploiter Tesla par défaut', async ({ page }) => {
    await expect(page.locator('.stop-item')).toHaveCount(2)
    const details = await page.locator('.stop-details').allTextContents()
    const durations = details.map(text => Number(text.match(/≈\s*(\d+)\s*min/)?.[1]))
    expect(durations).toHaveLength(2)
    expect(durations.every(min => Number.isFinite(min) && min > 0 && min <= 25)).toBeTruthy()
    await expect(page.locator('.charge-time-hint')).toContainText('25 min max')
    await expect(page.locator('.maps-note')).toContainText('Google Maps calcule indépendamment')
    expect((await page.locator('.stop-item').allTextContents()).every(text => !text.includes('Tesla'))).toBeTruthy()
  })

  test('signale un trajet non couvert si la limite devient trop courte', async ({ page }) => {
    await page.getByRole('button', { name: 'Options' }).click()
    await page.getByRole('combobox', { name: 'Durée maximale de recharge par arrêt' }).selectOption('10')
    await page.getByRole('button', { name: 'Fermer' }).click()
    await expect(page.locator('.stop-warning')).toContainText('Trajet non réalisable')
  })
})

test.describe('Double-tap iPhone', () => {
  test.use({
    viewport: { width: 390, height: 700 },
    hasTouch: true,
    isMobile: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/143.0 Mobile/15E148 Safari/605.1.15'
  })

  test('garde la saisie et la navigation utilisables après deux taps rapprochés', async ({ page, context }) => {
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation(PARIS)
    await page.goto('/')
    await page.locator('.map-container').waitFor()

    const field = await page.locator('.autonomy-field').boundingBox()
    const x = field.x + field.width / 2
    const y = field.y + field.height / 2
    await page.touchscreen.tap(x, y)
    await page.touchscreen.tap(x, y)
    await expect(page.locator('.autonomy-editor')).toBeVisible()
    await page.locator('.autonomy-input').fill('50')
    await page.locator('.confirm-btn').tap()

    await expect(page.locator('.autonomy-number')).toHaveText('50')
    await expect(page.locator('.header')).toBeVisible()
    await expect(page.locator('.tabs')).toBeVisible()
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
    expect(await page.evaluate(() => getComputedStyle(document.body).touchAction)).toBe('manipulation')

    // Sur iOS, l'ancienne bannière apparaissait après 3 s et cachait les commandes.
    await page.waitForTimeout(3300)
    await expect(page.locator('.install-banner')).toHaveCount(0)
  })

  test('deux taps rapides sur -10 passent de 70 à 50 km sans zoom', async ({ page, context }) => {
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation(PARIS)
    await page.goto('/')
    await page.locator('.map-container').waitFor()

    await page.locator('.autonomy-field').tap()
    await page.locator('.autonomy-input').fill('70')
    const button = await page.locator('.step-btn[aria-label="Retirer 10 km"]').boundingBox()
    const x = button.x + button.width / 2
    const y = button.y + button.height / 2
    await page.touchscreen.tap(x, y)
    await page.touchscreen.tap(x, y)

    await expect(page.locator('.autonomy-input')).toHaveValue('50')
    await page.locator('.confirm-btn').tap()
    await expect(page.locator('.autonomy-number')).toHaveText('50')
    await expect(page.locator('.header')).toBeVisible()
    await expect(page.locator('.tabs')).toBeVisible()
  })
})
