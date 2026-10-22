# LinkedIn Theme Toggle

LinkedIn Theme Toggle is a lightweight Chromium extension (Manifest V3) that switches the LinkedIn theme cookie (`li_theme`) between `dark` and `light` with a single click on the extension icon.

No popup window, DevTools, or account settings navigation is required. The extension directly reads and updates the cookie and reloads the current LinkedIn tab.

## Features

- Toggles LinkedIn theme between dark and light with a single click.
- Updates the `li_theme` cookie directly via the `chrome.cookies` API.
- Preserves existing cookie attributes (domain, path, expiration, SameSite, Secure, HttpOnly).
- Creates a new `li_theme=dark` cookie with a 180-day lifetime if no cookie exists.
- Normalizes alternative states such as `system` directly to `dark`.
- Automatically reloads the active tab only if it is currently on LinkedIn (`https://*.linkedin.com/*`).
- Updates action badge text and background color to indicate the active theme state.
- Supports tab-specific cookie stores, preserving normal vs. incognito browsing contexts.
- Manifest V3 compliant service worker with zero external runtime dependencies.
- No build step required.

## How it works

The extension consists of two primary runtime components:

1. `manifest.json`: Declares permissions, host permissions, action metadata, icons, and registers the service worker.
2. `background.js`: Service worker listening for toolbar icon clicks, managing cookie reads and updates, setting the badge indicator, and triggering page reloads.

### Runtime behavior

When the extension icon is clicked:

1. Resolves the cookie store ID associated with the clicked tab (supporting incognito profiles).
2. Reads the `li_theme` cookie for `https://www.linkedin.com/`.
3. Determines the next theme value:
   - If current value is `dark`, switches to `light`.
   - If current value is `light`, `system`, or unset, switches to `dark`.
4. Reuses existing cookie scope attributes (domain, path, expiration date, secure, httpOnly, sameSite). If no cookie existed, sets a 180-day expiration.
5. Saves the updated cookie using `chrome.cookies.set`.
6. Updates the toolbar action badge and tooltip title to display the current theme status (or `ERR` on failure).
7. If the active tab URL belongs to `linkedin.com` or `*.linkedin.com`, reloads that tab. If clicked while on any other site, the cookie is updated without reloading the unrelated page.

## Project structure

```text
.
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── tests/
│   └── background.test.js
├── background.js
├── manifest.json
└── README.md
```

## File overview

### `manifest.json`

The Manifest V3 definition file.

It configures:

- Extension identity and metadata (name, version, description).
- Action toolbar icons in 16x16, 32x32, 48x48, and 128x128 dimensions.
- Background service worker registration (`background.js`).
- Minimal required permission: `cookies`.
- Host permissions restricted to `https://*.linkedin.com/*`.

### `background.js`

The background service worker running in response to action clicks.

Responsibilities:

- Listens to `chrome.action.onClicked`.
- Determines the tab's cookie store via `chrome.cookies.getAllCookieStores()`.
- Fetches the current `li_theme` cookie.
- Toggles the value between `dark` and `light`.
- Preserves cookie parameters (domain, path, expiration, secure, httpOnly, sameSite).
- Updates the extension badge text, badge background color, and tooltip title.
- Inspects tab URL and conditionally reloads the tab via `chrome.tabs.reload` if on LinkedIn.
- Captures errors and displays an error badge (`ERR`) with red background if cookie updates fail.

### `tests/background.test.js`

Automated test suite using Node.js built-in test runner.

Responsibilities:

- Simulates `chrome.cookies`, `chrome.tabs`, and `chrome.action` APIs in a sandbox context using `node:vm`.
- Verifies `dark -> light` toggling, attribute preservation, and LinkedIn tab reload.
- Verifies `light -> dark` toggling without reloading non-LinkedIn tabs.
- Verifies creation of missing cookies with 180-day lifetime.
- Verifies host-only cookie handling without domain attribute leaks.
- Verifies fallback from `system` to `dark`.

## Installing in Google Chrome using Developer mode

1. Clone or download this repository:

```bash
git clone https://github.com/Chavao/linkedin-theme-toggle-extension.git
```

2. Open Google Chrome.
3. Navigate to:

```text
chrome://extensions
```

4. Enable **Developer mode** in the top-right corner.
5. Click **Load unpacked**.
6. Select the repository root folder (the directory containing `manifest.json`).
7. Click the Chrome extensions puzzle piece icon and pin **LinkedIn Theme Toggle** to your toolbar.

## Installing in Brave using Developer mode

1. Clone or download this repository.
2. Open Brave.
3. Navigate to:

```text
brave://extensions
```

4. Enable **Developer mode**.
5. Click **Load unpacked**.
6. Select the repository root folder (the directory containing `manifest.json`).
7. Pin **LinkedIn Theme Toggle** to your toolbar.

## Usage

Click the extension icon in your browser toolbar:

- If current theme is `dark`, it switches to `light`.
- If current theme is `light`, it switches to `dark`.
- If no `li_theme` cookie exists, it creates `li_theme=dark` with a 180-day expiration.
- If the theme cookie holds another value (e.g., `system`), it switches to `dark`.

The badge updates to indicate the active theme state. The current tab automatically reloads if you are on LinkedIn. If you click the icon while visiting another website, the cookie updates silently and you can reload your LinkedIn tabs manually when returning to them.

## Development workflow

There is no build or compilation step. The extension runs directly from source files.

Typical workflow:

1. Edit `manifest.json` or `background.js`.
2. Navigate to `chrome://extensions` or `brave://extensions`.
3. Click the reload icon on the **LinkedIn Theme Toggle** card.
4. Test the behavior on LinkedIn.
5. Run automated tests to verify contract preservation.

## Testing

Automated tests require Node.js 20 or higher. Run tests with:

```bash
node --test tests/*.test.js
```

## Troubleshooting

### The extension does not appear after Load unpacked

Ensure you selected the root folder containing `manifest.json` directly, rather than an inner directory such as `icons` or `tests`.

### The page does not reload after clicking the icon

The extension only automatically reloads tabs on `https://*.linkedin.com/*`. If you click the icon while viewing a non-LinkedIn tab, the cookie is updated, but the active tab is not reloaded to avoid interrupting your work.

### Incognito tabs do not change theme

Chrome disables extensions in incognito mode by default. To enable:

1. Go to `chrome://extensions` (or `brave://extensions`).
2. Click **Details** on **LinkedIn Theme Toggle**.
3. Enable **Allow in Incognito**.

### The badge shows ERR

An error occurred while updating the cookie. Inspect the service worker console under `chrome://extensions` -> **LinkedIn Theme Toggle** -> **Inspect views: service worker** to view error logs.

## Permissions and Privacy

The extension requests minimal permissions in `manifest.json`:

```json
{
  "permissions": ["cookies"],
  "host_permissions": ["https://*.linkedin.com/*"]
}
```

- `cookies`: Required to read and write the `li_theme` cookie.
- `https://*.linkedin.com/*`: Restricts cookie access strictly to LinkedIn domains.
- Does not request the broad `tabs` permission (it uses `tab.id` passed to the action click handler to reload only the active tab).
- No data is collected, tracked, or transmitted to any external server.

## Limitations

- Relies on LinkedIn's `li_theme` cookie mechanism. LinkedIn's auxiliary `li_theme_set` cookie is not modified.
- Does not manage system-wide OS theme listeners; it performs an explicit toggle upon each user click.
- Automated tests run against mock Chrome APIs; changes to LinkedIn's internal cookie schema may require updates.

## License

This project is licensed under the MIT License.
