import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests', testMatch:'cinematic.browser.spec.ts', workers:1, timeout:60000,
  expect:{timeout:12000}, reporter:'list',
  use:{baseURL:'http://127.0.0.1:4180',viewport:{width:1100,height:850},screenshot:'only-on-failure',
    launchOptions:{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']}},
  webServer:{command:'node serve-game.mjs',env:{PORT:'4180'},url:'http://127.0.0.1:4180',reuseExistingServer:true},
});
