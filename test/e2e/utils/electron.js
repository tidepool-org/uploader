
const { _electron: electron, } = require('@playwright/test');

/**
 * Launches Electron using Playwright.
 * @returns {Promise<import('@playwright/test').ElectronApplication>} 
      The Electron application instance.
 */
async function startElectron () {
  return await electron.launch({ 
    args: ['./app/main.prod.js'], 
    
    // recordVideo: { dir: './videos' },
  });
}

exports.startElectron = startElectron;