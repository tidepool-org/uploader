const { test, _electron: electron, expect } = require('@playwright/test')

// @ts-check
test.describe('Home screen', () => {
  /** @type {import('@playwright/test').Page} */
  let window; 
  /** @type {import('@playwright/test').ElectronApplication} */
  let electronApp;
  test.beforeEach(async() => {
    electronApp = await electron.launch({ args: ['./app/main.prod.js'] });
    const appPath = await electronApp.evaluate(async ({ app }) => {
      // This runs in the main Electron process, parameter here is always
      // the result of the require('electron') in the main app script.
      return app.getAppPath();
    });
    console.log(appPath);
  
    // Get the first window that the app opens, wait if necessary.
    window = await electronApp.firstWindow();
  })

  test.afterEach(async() => {
    await electronApp.close();
  })

  test('has correct links', async () => {
    await expect( await window.getByRole("link", {name: "Get Support"}).getAttribute("href")).toBe("http://support.tidepool.org/")
    await expect( await window.getByRole("link", {name: "Privacy and Terms of Use"}).getAttribute("href")).toBe("http://tidepool.org/legal/")
  })

  test.only('hovered links have correct colors', async () => {
    const getSupportLink = window.locator('a').getByText('Get Support')
    const privacyLink = window.locator('a').getByText('Privacy and Terms of Use')
    const colorBefore = await getSupportLink.evaluate((e) => {
      return window.getComputedStyle(e).getPropertyValue("color")})
    expect(colorBefore).toBe('rgb(151, 151, 151)')

    await getSupportLink.hover()
    const color = await getSupportLink.evaluate((e) => {
      return window.getComputedStyle(e).getPropertyValue("color")})
    expect(color).toBe('rgb(98, 124, 255)')

    // privacy link
    const colorBefore2 = await privacyLink.evaluate((e) => {
      return window.getComputedStyle(e).getPropertyValue("color")})
    expect(colorBefore2).toBe('rgb(151, 151, 151)')
    await privacyLink.hover()
    const color2 = await privacyLink.evaluate((e) => {
      return window.getComputedStyle(e).getPropertyValue("color")})
    
    expect(color2).toBe('rgb(98, 124, 255)')
    
    // await window.waitForSelector('i:has-text("Sign up")');
    // const signUpLink = window.locator('i').withText(/Sign up/);
    // await signUpLink.screenshot({path: 'signup.png'})
    await window.waitForLoadState("load");

    // await window.getByText("Loading...").waitFor({state: "hidden"})
    const html = await window.$("body")
    const innerHtml = await html.innerHTML()

    await window.waitForTimeout(4000)

    const htmlAfter = await window.$("body")
    console.log(await htmlAfter.innerHTML())
    console.log(await htmlAfter.innerHTML() == innerHtml)
    // await window.waitForSelector('i:has-text("Sign up")')
    console.log(await window.locator('a').all())
  })

  test('has correct title', async () => {
    await expect(await window.title()).toBe('Tidepool Uploader')
  })

  test('has correct buttons', async () => {
    const signUpLink = window.locator('i').getByText(/Sign up/)
    
    const getSupportLink = window.locator('a').getByText('Get Support')
    const privacyLink = window.locator('a').getByText('Privacy and Terms of Use')


    
    await window.waitForTimeout(4000)
    await getSupportLink.screenshot({path: 'signup.png'})
    console.log('asdasdasd')
    // await expect(await signUpLink).toBeVisible()
    // await expect().toBeAttached()
    
  })
})
