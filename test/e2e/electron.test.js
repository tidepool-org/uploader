const { test, expect, } = require('@playwright/test');
const { startElectron } = require('./utils/electron');

// @ts-check
test.describe('Home screen', () => {
  /** @type {import('@playwright/test').Page} */
  let window; 
  /** @type {import('@playwright/test').ElectronApplication} */
  let electronApp;
  
  // HOOKS
  test.beforeEach(async() => {
    electronApp = await startElectron();
    window = await electronApp.firstWindow();
  });

  test.afterEach(async() => {
    await electronApp.close();
  });

  // TESTS
  test('has correct links', async () => {
    await expect( await window.getByRole('link', {name: 'Get Support'}).getAttribute('href'))
      .toBe('http://support.tidepool.org/');
    await expect( await window.getByRole('link', {name: 'Privacy and Terms of Use'})
      .getAttribute('href')).toBe('http://tidepool.org/legal/');
  });

  test('hovered links have correct colors', async () => {
    const links = ['Get Support', 'Privacy and Terms of Use'];

    for (let linkText of links) {
      const linkElement = window.locator('a').getByText(linkText);
      const colorBefore = await linkElement.evaluate((e) => {
        return window.getComputedStyle(e).getPropertyValue('color');});
      expect(colorBefore).toBe('rgb(151, 151, 151)');
  
      await linkElement.hover();
      const color = await linkElement.evaluate((e) => {
        return window.getComputedStyle(e).getPropertyValue('color');});
      expect(color).toBe('rgb(98, 124, 255)');
    }
  });

  test('has correct title', async () => {
    await expect(await window.title()).toBe('Tidepool Uploader');
  });

  test('clicking on Log in button opens the login screen', async () => {
    await window.waitForSelector('body');
    window.on('domcontentloaded', async () => {
      return console.log('loaded');
    });

    // 1. Here, I am able to check the innerHTML of the div#app element
    const html = await window.$('div#app');
    console.log(await html.innerHTML());

    console.log('🔵 1');
    await window.waitForLoadState('domcontentloaded');
    console.log('🔵 2 - before timeout');
    await window.waitForTimeout(4000);
    // console.log("🔵 3")
    // window = await electronApp.firstWindow();
    console.log('🔵 4 - after timeout');

    // When I try to check same element again - 
    // the innerHTML of the div#app element after the timeout, 
    // it throws an error that the element is not found
    // I tried `body` as well, but with the same result
    const html1 = await window.$('div#app');
    console.log('🔵 5');
    console.log(html1);
  });
});
