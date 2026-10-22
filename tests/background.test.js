const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.resolve(__dirname, "../background.js"), "utf8");

function setup(initialCookie) {
  let cookie = initialCookie;
  const written = [];
  const reloaded = [];
  const badges = [];
  const titles = [];

  const chrome = {
    cookies: {
      getAllCookieStores: async () => [{ id: "0", tabIds: [42] }],
      get: async () => cookie,
      set: async (options) => {
        written.push(options);
        cookie = { ...options, value: options.value };
        return cookie;
      }
    },
    tabs: { reload: async (id) => reloaded.push(id) },
    action: {
      onClicked: { addListener: () => {} },
      setBadgeText: async (details) => badges.push(details.text),
      setBadgeBackgroundColor: async () => {},
      setTitle: async (details) => titles.push(details.title)
    }
  };
  const context = { chrome, URL, console, Date };
  vm.runInNewContext(`${source}\nglobalThis.__toggleTheme = toggleTheme;`, context);
  return { toggle: context.__toggleTheme, written, reloaded, badges, titles };
}

const existing = {
  name: "li_theme",
  domain: ".linkedin.com",
  hostOnly: false,
  path: "/",
  secure: true,
  httpOnly: false,
  sameSite: "no_restriction",
  session: false,
  expirationDate: 1810000000,
  value: "dark"
};

const tab = { id: 42, url: "https://www.linkedin.com/feed/" };

test("dark -> light, preserving attributes and reloading LinkedIn", async () => {
  const harness = setup(existing);
  await harness.toggle(tab);
  assert.equal(harness.written.length, 1);
  assert.equal(harness.written[0].value, "light");
  assert.equal(harness.written[0].domain, ".linkedin.com");
  assert.equal(harness.written[0].expirationDate, existing.expirationDate);
  assert.equal(harness.written[0].storeId, "0");
  assert.deepEqual(harness.reloaded, [42]);
  assert.deepEqual(harness.badges, ["⬜"]);
  assert.deepEqual(harness.titles, ["⬜"]);
});

test("light -> dark without reloading a tab from another site", async () => {
  const harness = setup({ ...existing, value: "light" });
  await harness.toggle({ id: 42, url: "https://example.com/" });
  assert.equal(harness.written[0].value, "dark");
  assert.deepEqual(harness.reloaded, []);
  assert.deepEqual(harness.badges, ["⬛"]);
  assert.deepEqual(harness.titles, ["⬛"]);
});

test("nonexistent cookie is created with correct scope", async () => {
  const harness = setup(undefined);
  await harness.toggle(tab);
  assert.equal(harness.written[0].value, "dark");
  assert.equal(harness.written[0].domain, ".linkedin.com");
  assert.ok(harness.written[0].expirationDate > Date.now() / 1000);
});

test("host-only cookie keeps scope without domain attribute", async () => {
  const harness = setup({ ...existing, domain: "www.linkedin.com", hostOnly: true, session: true });
  await harness.toggle(tab);
  assert.equal(harness.written[0].url, "https://www.linkedin.com/");
  assert.equal(harness.written[0].domain, undefined);
  assert.equal(harness.written[0].expirationDate, undefined);
});

test("system value toggles to dark", async () => {
  const harness = setup({ ...existing, value: "system" });
  await harness.toggle(tab);
  assert.equal(harness.written[0].value, "dark");
});
