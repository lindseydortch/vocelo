import { expect, test } from '@playwright/test'
import { signInAs } from './helpers/auth'

test.use({ viewport: { width: 1280, height: 800 } })

for (const plan of ['free', 'creator'] as const) {
  test(`${plan}: confirms disconnect, lands on /, and can sign back in`, async ({
    page,
  }, testInfo) => {
    await signInAs(page, plan)
    await page.goto('/app/settings')
    await page.waitForLoadState('networkidle')
    await page
      .getByRole('button', { name: 'Disconnect Buffer', exact: true })
      .click()
    const dialog = page.getByRole('dialog', { name: 'Disconnect Buffer?' })
    await expect(dialog).toBeVisible()
    const billingWarning = dialog.getByText(
      'Your Creator plan keeps billing.',
      { exact: false },
    )
    if (plan === 'creator') await expect(billingWarning).toBeVisible()
    else await expect(billingWarning).toHaveCount(0)
    await expect(
      dialog.getByText('To fully remove access', { exact: false }),
    ).toBeVisible()

    await page.screenshot({
      path: testInfo.outputPath('disconnect-dialog.png'),
    })
    const request = page.waitForRequest(
      (req) => req.method() === 'POST' && req.url().includes('_serverFn'),
    )
    await dialog
      .getByRole('button', { name: 'Disconnect Buffer', exact: true })
      .click()
    const post = await request
    await expect(page).toHaveURL(/\/$/)
    expect(
      (
        await page.request.get(post.url(), {
          headers: { Origin: new URL(post.url()).origin },
        })
      ).status(),
    ).toBe(405)
    await page.goto('/app')
    await expect(page).toHaveURL(/\/signin\?returnTo=%2Fapp$/)
    await signInAs(page, plan)
    await page.goto('/app/settings')
    await expect(
      page.getByRole('button', { name: 'Disconnect Buffer', exact: true }),
    ).toBeVisible()
  })
}

test('cancel and Escape keep the connection and session', async ({ page }) => {
  await signInAs(page, 'free')
  await page.goto('/app/settings')
  await page.waitForLoadState('networkidle')
  const button = page.getByRole('button', {
    name: 'Disconnect Buffer',
    exact: true,
  })
  const dialog = page.getByRole('dialog', { name: 'Disconnect Buffer?' })
  await button.click()
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(button).toBeFocused()
  await button.click()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await page.reload()
  await button.click()
  await expect(dialog).toBeVisible()
})

test('an expired session shows an error instead of reporting a successful disconnect', async ({
  page,
  context,
}) => {
  await signInAs(page, 'creator')
  await page.goto('/app/settings')
  await page.waitForLoadState('networkidle')
  await page
    .getByRole('button', { name: 'Disconnect Buffer', exact: true })
    .click()
  const dialog = page.getByRole('dialog', { name: 'Disconnect Buffer?' })
  await expect(dialog).toBeVisible()
  await context.clearCookies()
  await dialog
    .getByRole('button', { name: 'Disconnect Buffer', exact: true })
    .click()
  await expect(dialog.getByRole('alert')).toHaveText(
    "Couldn't disconnect Buffer. Try again.",
  )
  await expect(page).toHaveURL(/\/app\/settings/)
})
