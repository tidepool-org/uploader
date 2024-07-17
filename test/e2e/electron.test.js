const { test, expect, chromium } = require('@playwright/test');
const { startElectron } = require('./utils/electron');
require('dotenv').config();
// @ts-check
test.describe('Home screen', () => {
  /** @type {import('@playwright/test').Page} */
  let window;
  /** @type {import('@playwright/test').ElectronApplication} */
  let electronApp;

  /** @type {import('@playwright/test').ChromiumBrowser} */
  let browser;

  // HOOKS
  test.beforeEach(async () => {
    electronApp = await startElectron();
    window = await electronApp.firstWindow();
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  // TESTS
  test('has correct links', async () => {
   expect(await window.getByRole('link', { name: 'Get Support' }).getAttribute('href'))
      .toBe('http://support.tidepool.org/');
   expect(await window.getByRole('link', { name: 'Privacy and Terms of Use' })
      .getAttribute('href')).toBe('http://tidepool.org/legal/');
  });

  test('hovered links have correct colors', async () => {
    const links = ['Get Support', 'Privacy and Terms of Use'];

    for (let linkText of links) {
      const linkElement = window.locator('a').getByText(linkText);
      const colorBefore = await linkElement.evaluate((e) => {
        return window.getComputedStyle(e).getPropertyValue('color');
      });
      expect(colorBefore).toBe('rgb(151, 151, 151)');

      await linkElement.hover();
      const color = await linkElement.evaluate((e) => {
        return window.getComputedStyle(e).getPropertyValue('color');
      });
      expect(color).toBe('rgb(98, 124, 255)');
    }
  });

  test('has correct title', async () => {
    expect(await window.title()).toBe('Tidepool Uploader');
  });

  test('can login with patient account', async () => {
    let url;
    await new Promise(async (resolve) => {
      await window.waitForSelector('body');
      await window.waitForLoadState('domcontentloaded');

      const login = window.getByRole('button', { name: 'Log in' });
      url = await login.getAttribute('data-testurl');
      console.log('[Electron][Auth URL] ', url);
      electronApp.close();
      resolve();
    }).then(async () => {
      browser = await chromium.launch();
      console.log('[Chromium] Started 🎉');
      const page = await browser.newPage();
      await page.goto(url);
      await page.getByPlaceholder('Email').waitFor('visible', { timeout: 10000 });
      await page.getByPlaceholder('Email').fill(process.env.E2E_USER_EMAIL);
      await page.getByRole('button', { name: 'Next' }).click();
      await page.getByPlaceholder('Password').waitFor('visible', { timeout: 10000 });
      await page.getByPlaceholder('Password').fill('tidepool');
      await page.getByRole('button', { name: 'Log In' }).click();
      
      console.log('[Chromium] Clicked Log In button');
      console.log('[Chromium] Waiting for the next page');
      const href = await page.getByRole('link', { name: 'Launch Uploader' }).getAttribute('href');
      console.log(href);
      await browser.close();

      return href;
    }).then(async (href) => {
      
      electronApp = await startElectron();
      window = await electronApp.firstWindow();
      
      await window.waitForLoadState('domcontentloaded');
      await window.evaluate((url) => {
        window.electron.handleIncomingUrl(url);
      }, href);
      await expect(window.getByRole('heading', { name: 'Choose devices' })).toBeVisible();
    });
  });
});
