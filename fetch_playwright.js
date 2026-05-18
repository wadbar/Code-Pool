const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Fake User Agent
  await page.setExtraHTTPHeaders({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36'
  });
  
  try {
    await page.goto('https://olucasandrade.medium.com/14-reposit%C3%B3rios-excelentes-do-github-para-ajudar-na-sua-carreira-52b0184b7fab', { waitUntil: 'load', timeout: 15000 });
    
    // Evaluate inside browser context
    const repos = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const githubLinks = links.map(a => a.href).filter(href => href.startsWith('https://github.com/') && href.split('/').length >= 4);
      return Array.from(new Set(githubLinks));
    });
    
    console.log("REPOS:");
    console.log(repos.join('\n'));
  } catch (error) {
    console.error("Error navigating:", error);
  } finally {
    await browser.close();
  }
})();
