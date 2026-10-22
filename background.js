const COOKIE_NAME = "li_theme";
const LINKEDIN_URL = "https://www.linkedin.com/";
const COOKIE_LIFETIME_SECONDS = 180 * 24 * 60 * 60;

function isLinkedInTab(tab) {
  if (!tab?.url) return false;

  try {
    const url = new URL(tab.url);
    return url.protocol === "https:" &&
      (url.hostname === "linkedin.com" || url.hostname.endsWith(".linkedin.com"));
  } catch {
    return false;
  }
}

async function getStoreIdForTab(tab) {
  if (tab?.id == null) return undefined;

  const stores = await chrome.cookies.getAllCookieStores();
  return stores.find((store) => store.tabIds.includes(tab.id))?.id;
}

async function toggleTheme(tab) {
  // Respect the normal/incognito profile of the clicked tab.
  const storeId = await getStoreIdForTab(tab);
  const storeOptions = storeId === undefined ? {} : { storeId };

  const previous = await chrome.cookies.get({
    url: LINKEDIN_URL,
    name: COOKIE_NAME,
    ...storeOptions
  });

  const nextValue = previous?.value === "dark" ? "light" : "dark";
  // Reuse scope and attributes to avoid creating a duplicate cookie with the same name.
  const path = previous?.path || "/";
  const url = previous?.hostOnly
    ? `https://${previous.domain}${path}`
    : `https://www.linkedin.com${path}`;

  const options = {
    url,
    name: COOKIE_NAME,
    value: nextValue,
    path,
    secure: previous?.secure ?? true,
    httpOnly: previous?.httpOnly ?? false,
    sameSite: previous?.sameSite ?? "no_restriction",
    ...storeOptions
  };

  if (!previous?.hostOnly) {
    options.domain = previous?.domain || ".linkedin.com";
  }

  if (previous) {
    if (!previous.session && previous.expirationDate !== undefined) {
      options.expirationDate = previous.expirationDate;
    }
  } else {
    options.expirationDate = Math.floor(Date.now() / 1000) + COOKIE_LIFETIME_SECONDS;
  }

  const updated = await chrome.cookies.set(options);
  if (!updated || updated.value !== nextValue) {
    throw new Error("Failed to update li_theme cookie.");
  }

  const themeIndicator = nextValue === "dark" ? "⬛" : "⬜";

  // The badge indicates the active theme even if no LinkedIn tab is open.
  await Promise.all([
    chrome.action.setBadgeText({ text: themeIndicator }),
    chrome.action.setBadgeBackgroundColor({
      color: nextValue === "dark" ? "#202938" : "#A1A1AA"
    }),
    chrome.action.setTitle({ title: themeIndicator })
  ]);

  // Reload only the current tab without disrupting work in other tabs.
  if (isLinkedInTab(tab) && tab.id !== undefined) {
    await chrome.tabs.reload(tab.id);
  }
}

chrome.action.onClicked.addListener((tab) => {
  toggleTheme(tab).catch(async (error) => {
    console.error("Error toggling LinkedIn theme:", error);
    await Promise.allSettled([
      chrome.action.setBadgeText({ text: "ERR" }),
      chrome.action.setBadgeBackgroundColor({ color: "#B91C1C" }),
      chrome.action.setTitle({ title: `Error toggling theme: ${error.message}` })
    ]);
  });
});
