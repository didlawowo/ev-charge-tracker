import { test, expect } from '@playwright/test'
import { getWinterSeason } from '../../src/composables/useSeasonalWinterMode.js'
import { navigationUrl, navigationLabel } from '../../src/utils.js'
import { verifyChargerRoadAccess } from '../../src/composables/useRouteAccess.js'

const PARIS = { latitude: 48.8566, longitude: 2.3522 }

test('mode hiver du 1er novembre au 31 mars et désactivation le 1er avril', () => {
  expect(getWinterSeason(new Date('2026-10-31T12:00:00')).winter).toBe(false)
  expect(getWinterSeason(new Date('2026-11-01T12:00:00')).winter).toBe(true)
  expect(getWinterSeason(new Date('2027-03-31T12:00:00')).winter).toBe(true)
  expect(getWinterSeason(new Date('2027-04-01T12:00:00')).winter).toBe(false)
})

test('Google et Plans ciblent la borne directement, sans origine figée', () => {
  const station = { lat: 45.76, lng: 4.83 }
  const google = new URL(navigationUrl('google', station))
  const apple = new URL(navigationUrl('apple', station))
  expect(google.hostname).toBe('www.google.com')
  expect(google.searchParams.get('destination')).toBe('45.76,4.83')
  expect(google.searchParams.get('waypoints')).toBeNull()
  expect(google.searchParams.get('origin')).toBeNull()
  expect(apple.hostname).toBe('maps.apple.com')
  expect(apple.searchParams.get('daddr')).toBe('45.76,4.83')
  expect(apple.searchParams.get('saddr')).toBeNull()
  expect(navigationLabel('apple')).toBe('Plans')
})

test('borne proche de la mauvaise chaussée autoroutière rejetée si détour routier', async () => {
  const stations = [
    { id: 1, name: 'Aire A6 sens Lyon', lat: 46.7, lng: 2, distance: 80000 },
    { id: 2, name: 'Aire A6 sens Paris', lat: 46.71, lng: 2, distance: 81000 }
  ]
  let requests = 0
  const mockedFetch = async url => {
    requests++
    const u = new URL(url)
    if (u.searchParams.get('sources') === '0') {
      return {
        ok: true,
        json: async () => ({
          code: 'Ok',
          durations: [[500, 400, 3600]],
          destinations: [{ distance: 10 }, { distance: 10 }, { distance: 0 }]
        })
      }
    }
    return {
      ok: true,
      json: async () => ({
        code: 'Ok',
        durations: [[3100], [4800]],
        sources: [{ distance: 15 }, { distance: 15 }]
      })
    }
  }
  const access = await verifyChargerRoadAccess(
    [[2, 46], [2, 46.7], [2, 47]], stations, mockedFetch
  )
  expect(requests).toBe(2)
  expect(access.get(1).roadAccess).toBe('routable')
  expect(access.get(2).roadAccess).toBe('detour')
  expect(access.get(2).roadDetourMinutes).toBeGreaterThan(10)
})

test('une vérification autoroutière indisponible ne valide jamais la borne', async () => {
  const stations = [{ id: 11, name: 'Aire A7', lat: 46.5, lng: 2, distance: 80000 }]
  const access = await verifyChargerRoadAccess(
    [[2, 46], [2, 46.5], [2, 47]], stations,
    async () => { throw new Error('OSRM indisponible') }
  )
  expect(access.get(11).roadAccess).toBe('unknown')
})

test.describe('Réutilisation des destinations', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation(PARIS)
    await page.goto('/')
  })

  test('affiche les 10 lieux récents, sans doublon, et permet la suppression', async ({ page }) => {
    await page.evaluate(() => {
      const places = Array.from({ length: 11 }, (_, i) => ({
        name: `Destination ${i}`,
        fullName: `Destination ${i}`,
        lat: 45 + i * 0.1,
        lng: 4
      }))
      places.push({ ...places[0] })
      localStorage.setItem('ev-finder:recent-destinations', JSON.stringify(places))
    })
    await page.reload()
    await page.locator('.search-input').focus()
    await expect(page.locator('.history-row')).toHaveCount(10)
    await page.locator('.history-remove').first().click()
    await expect(page.locator('.history-row')).toHaveCount(9)
    await page.locator('.history-select').first().click()
    await expect(page.locator('.search-input')).toHaveValue('Destination 1')
  })

  test('conserve Plans par défaut et mémorise Google Maps', async ({ page }) => {
    await page.getByRole('button', { name: 'Options' }).click()
    const app = page.getByRole('combobox', { name: 'Application de navigation' })
    await expect(app).toHaveValue('apple')
    await app.selectOption('google')
    await page.reload()
    await page.getByRole('button', { name: 'Options' }).click()
    await expect(page.getByRole('combobox', { name: 'Application de navigation' })).toHaveValue('google')
  })
})

test('réutiliser une destination pendant un déplacement recalcule depuis le GPS actuel', async ({ page, context }) => {
  const starts = []
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation(PARIS)
  await page.route('**/photon.komoot.io/**', async route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      features: [{
        properties: { osm_id: 123, country: 'France', name: 'Lyon', county: 'Rhône' },
        geometry: { coordinates: [4.83, 45.76] }
      }]
    })
  }))
  await page.route('**/router.project-osrm.org/route/v1/driving/**', async route => {
    const parts = decodeURIComponent(new URL(route.request().url()).pathname.split('/').at(-1)).split(';')
    const start = parts[0].split(',').map(Number)
    const end = parts.at(-1).split(',').map(Number)
    starts.push({ lat: start[1], lng: start[0] })
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        code: 'Ok',
        routes: [{ distance: 400000, duration: 14400,
          geometry: { type: 'LineString', coordinates: [start, end] } }]
      })
    })
  })

  await page.goto('/')
  await page.locator('.search-input').fill('Lyon')
  await page.locator('.suggestion-item').filter({ hasText: 'Lyon' }).first().click()
  await expect.poll(() => starts.length).toBeGreaterThan(0)
  expect(starts[0].lat).toBeCloseTo(PARIS.latitude, 3)

  // La voiture a avancé d'environ 3 km, puis l'utilisateur redemande Lyon.
  const newer = { latitude: 48.883, longitude: 2.38 }
  await context.setGeolocation(newer)
  await page.locator('.search-input').focus()
  await page.locator('.history-select').first().click()
  await expect.poll(() => starts.some(s => Math.abs(s.lat - newer.latitude) < 0.002)).toBe(true)
  expect(starts.at(-1).lat).toBeCloseTo(newer.latitude, 2)
})
