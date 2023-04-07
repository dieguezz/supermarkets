import puppeteer from "puppeteer-extra";
import fs from "fs";

import StealthPlugin from "puppeteer-extra-plugin-stealth";
import AdblockerPlugin from "puppeteer-extra-plugin-adblocker";
import {
  COOKIES_BUTTON,
  MODAL_OVERLAY,
  PRODUCT_BRAND,
  PRODUCT_GRID,
  PRODUCT_GRID_ITEM,
  PRODUCT_NAME,
  PRODUCT_PRICE,
} from "./alcampo.selectors.js";
import {
  exposeReadFile,
  exposeWriteFile,
} from "./alcampo.scraper.exposed.js";
import {
  createProgressBar,
  getCategoriesURLs,
  getTotalPages,
  getUnscrapedURLs,
  saveResults,
  scrapeItem,
} from "./alcampo.helpers.js";
import { START_URL, URLS_FILE } from "./alcampo.constants.js";

puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

(async () => {
  puppeteer.launch({ headless: true }).then(async (browser) => {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(START_URL);
    await page.waitForSelector(COOKIES_BUTTON);
    await page.click(COOKIES_BUTTON);
    await page.waitForSelector(MODAL_OVERLAY);
    await page.click(MODAL_OVERLAY);

    await exposeReadFile(page);
    await exposeWriteFile(page);

    const categoriesURLs = await getCategoriesURLs(page);
    const unScraped = await getUnscrapedURLs(categoriesURLs);

    const progress = createProgressBar("Scraping", unScraped.length);

    for (let index = 0; index < unScraped.length; index++) {
      await scrapeCategory(page, unScraped[index]);
      progress.tick();
    }

    if (progress.complete) {
      console.log("\nFinished scraping all categories\n");
    }

    fs.writeFileSync(URLS_FILE, JSON.stringify(unScraped));

    await browser.close();
  });
})();

async function scrapePage(page) {
  const productsData = await page.evaluate(
    async (itemSelector, productNameSelector, brandSelector, priceSelector) => {
      try {
        const products = document.querySelectorAll(itemSelector);
        return Array.from(products).map((el) => {
          try {
            const brutePrice = el
              .querySelector(priceSelector)
              ?.textContent.replaceAll("\n", "")
              .split("€");
            return {
              name: el
                .querySelector(productNameSelector)
                ?.textContent.replaceAll("\n", ""),
              brand: el
                .querySelector(brandSelector)
                ?.textContent?.replaceAll("\n", ""),
              url: el.querySelector("a")?.href,
              img: el.querySelector("img").src,
              price: `${brutePrice.length ? brutePrice[0] : brutePrice}€`,
              priceExtra: `${
                brutePrice.length > 1 ? brutePrice[1] : brutePrice
              }€)`,
            };
          } catch (e) {
            console.error("Could not scrape product data", e);
            return false;
          }
        });
      } catch {
        console.error("Could not select elements in page");
        return [];
      }
    },
    PRODUCT_GRID_ITEM,
    PRODUCT_NAME,
    PRODUCT_BRAND,
    PRODUCT_PRICE
  );

  await saveResults(productsData);
}

async function scrapeCategory(page, link) {
  await page.goto(link);
  await page.waitForSelector(PRODUCT_GRID);

  const totalPages = await getTotalPages(page);

  let _page = 0;

  for (let index = 0; index < totalPages; index++) {
    await page.goto(`${link}?q=%3Arelevance&page=${_page}`);
    await page.waitForTimeout(1000);
    await scrapePage(page);
    _page++;
  }
}
