import fs from "fs/promises";
import { RESULTS_FILE, URLS_FILE } from "./alcampo.constants.js";
import { MENU, MENU_CATEGORIES, TOTAL_RESULTS } from "./alcampo.selectors.js";
import ProgressBar from "progress";

export async function getCategoriesURLs(page) {
  const urls = await page.evaluate(
    (menuSelector, menuCategoriesSelector) => {
      const _urls = [];
      const menu = document.querySelector(menuSelector);
      menu
        .querySelectorAll(menuCategoriesSelector)
        .forEach((a) => _urls.push(a.href));
      return _urls;
    },
    MENU,
    MENU_CATEGORIES
  );
  return urls;
}

function hasBeenScraped(category, candidate) {
  try {
    const cagegoryURL = new URL(category);
    const candidateURL = new URL(candidate);
    const slug = cagegoryURL.pathname.substring(
      0,
      cagegoryURL.pathname.indexOf("/c/")
    );

    return candidateURL.pathname.includes(slug);
  } catch {
    console.error("Tried to parse an invalid URL", category, candidate);
    return true;
  }
}

export async function getUnscrapedURLs(urlsToScrape) {
  await fs.writeFile(URLS_FILE, JSON.stringify([urlsToScrape]));
  const data = await fs.readFile(RESULTS_FILE, "utf8");

  try {
    const scraped = JSON.parse(data);

    return urlsToScrape.filter((category) => {
      return !scraped.some((candidate) => {
        if (candidate) {
          return hasBeenScraped(category, candidate.url);
        }
        return false;
      });
    });
  } catch {
    console.error(
      `Failed reading previously saved results from ${RESULTS_FILE} `
    );
  }
}

export function getTotalPages(page) {
  return page.evaluate(async (totalResultsSelector) => {
    const totalItems = document
      .querySelector(totalResultsSelector)
      .textContent.replace(".", "")
      .trim()
      .split(" ");

    if (totalItems.length) {
      return +totalItems[0] > 48 ? Math.floor(+totalItems[0] / 48) + 1 : 1;
    } else {
      return 1;
    }
  }, TOTAL_RESULTS);
}

export function createProgressBar(title, total) {
  return new ProgressBar(`  ${title} [:bar] :percent :etas`, {
    complete: "=",
    incomplete: " ",
    width: 30,
    total,
  });
}

export function getProductPrices(el) {
  const brutePrice = el
    .querySelector(".price")
    ?.textContent.replaceAll("\n", "")
    .split("€");

  return {
    price: `${brutePrice.length ? brutePrice[0] : brutePrice}€`,
    priceExtra: `${brutePrice.length > 1 ? brutePrice[1] : brutePrice}€)`,
  };
}

export function getProductName(el, productNameSelector) {
  return el
    .querySelector(productNameSelector)
    ?.textContent.replaceAll("\n", "");
}

export function getProductBrand(el) {
  return el.querySelector(brandSelector)?.textContent?.replaceAll("\n", "");
}

export function getProductLink(el) {
  return el.querySelector("a")?.href;
}

export function getProductImgSrc(el) {
  return el.querySelector("img").src;
}

export async function scrapeItem(el, productNameSelector, brandSelector) {
  const prices = await getProductPrices(el);
  return {
    name: await getProductName(el, productNameSelector),
    brand: await getProductBrand(el, brandSelector),
    url: await getProductLink(el),
    img: await getProductImgSrc(el),
    ...prices,
  };
}

export async function saveResults(productsData) {
  const savedData = await fs.readFile(RESULTS_FILE, "utf8");
  const results = JSON.parse(savedData);
  try {
    await fs.writeFile(
      RESULTS_FILE,
      JSON.stringify([...results, ...productsData])
    );
  } catch {
    console.error("Could not save results");
  }
}
