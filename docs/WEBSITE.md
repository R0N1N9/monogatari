# The monogatari website

The website is the same app as the desktop version, in a browser. Visitors can
**sign in with Google** to save their story to their *own* Google Drive, or
**look around with an example story** without signing in.

- Address once published: **https://r0n1n9.github.io/monogatari/**
- Photos are read inside the visitor's browser and never uploaded.
- Writing is saved in a hidden monogatari folder in the visitor's own Google
  Drive. There is no monogatari server or database.
- It shares one story format with the desktop app (and, later, haiku).

## One-time setup (about 15 minutes)

Two things only you can do, because they're in your accounts: create a free
Google "client ID" so Google knows the website is allowed to offer sign-in, and
switch on GitHub's free web hosting.

### 1. Switch on GitHub Pages

1. Open the repository on GitHub → **Settings** → **Pages** (left side).
2. Under **Build and deployment → Source**, choose **GitHub Actions**.

### 2. Create the Google client ID

1. Go to **https://console.cloud.google.com** and sign in with the Google
   account you want to own the app.
2. At the top, open the project picker → **New project** → name it
   `monogatari` → **Create**. Make sure it's selected afterwards.
3. Search the top bar for **Google Drive API** → open it → **Enable**.
4. Search for **Google Auth Platform** (it may also appear as "OAuth consent
   screen") → **Get started**:
   - **App name:** `monogatari`
   - **User support email:** your email
   - **Audience:** **External**
   - **Contact information:** your email → agree → **Create**.
5. In Google Auth Platform → **Data access** → **Add or remove scopes** → find
   and tick **`.../auth/drive.appdata`** ("See, create, and delete its own
   configuration data in your Google Drive") → **Update** → **Save**.
   *(This is the only Drive permission monogatari uses. Google classifies it as
   non-sensitive: it can't see any other file.)*
6. Google Auth Platform → **Audience** → under **Test users**, **Add users** →
   add your own Gmail address (and anyone you want to let try it) → **Save**.
7. Google Auth Platform → **Clients** → **Create client**:
   - **Application type:** Web application
   - **Name:** `monogatari website`
   - **Authorized JavaScript origins:** add `https://r0n1n9.github.io`
     *(and `http://localhost:5173` if you'll try it on your own computer)*
   - Leave **Authorized redirect URIs** empty → **Create**.
8. Copy the **Client ID**. It looks like
   `123456789-abc...apps.googleusercontent.com`. It isn't a secret; it's meant
   to be public.

### 3. Give the client ID to GitHub

1. Repository → **Settings** → **Secrets and variables** → **Actions** →
   **Variables** tab → **New repository variable**:
   - **Name:** `GOOGLE_CLIENT_ID` · **Value:** the client ID you copied.
2. Optional, to show a "← Back to …" link to your blog or portfolio:
   - `HOME_URL` = your site's address, e.g. `https://yourname.com`
   - `HOME_LABEL` = the link text, e.g. `Back to my portfolio`

### 4. Publish

Repository → **Actions** → **Website** (left side) → **Run workflow** → **Run
workflow**. In about two minutes the site is live at
**https://r0n1n9.github.io/monogatari/**. After this, every change publishes
automatically.

## Opening it to everyone

While the Google app is in **Testing**, only the test users you added can sign
in (up to 100), and Google shows them an "unverified app" notice they can click
through. To let anyone sign in:

1. Google Auth Platform → **Branding**: add the app's home page
   (`https://r0n1n9.github.io/monogatari/`) and privacy policy
   (`https://r0n1n9.github.io/monogatari/privacy.html`), and your domain
   `r0n1n9.github.io` under **Authorized domains**.
2. Google Auth Platform → **Audience** → **Publish app**.

Because monogatari uses only a non-sensitive permission, Google doesn't require
its security review. If you want monogatari's name and logo shown on Google's
sign-in screen, Google offers a lighter "brand verification".

## Linking it from your blog or portfolio

- **A link or button** to `https://r0n1n9.github.io/monogatari/` works
  everywhere. Visitors can try the example story without an account.
- **Your own address** (e.g. `monogatari.yourname.com`): Repository →
  Settings → Pages → **Custom domain**, then add a CNAME record at your domain
  provider pointing to `r0n1n9.github.io`. Add the new address to the Google
  client's **Authorized JavaScript origins** too.
- **Embedding in a frame** on another page isn't recommended: browsers often
  block Google sign-in inside frames. Link to it instead.

## Trying the website on your own computer

Create a file named `.env.web.local` in the project folder:

```
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

Then:

```bash
npm run dev:web
```

and open http://localhost:5173 (that origin must be in the Google client's
**Authorized JavaScript origins**).

## How it behaves

| Situation | What happens |
|---|---|
| Typing | Saved to Drive half a second after you pause. |
| Google session ends (about hourly) | Renewed quietly if the browser allows; otherwise a **Reconnect** button. Nothing typed is lost meanwhile. |
| Offline, or the tab closes before saving | Kept in this browser and sent to Drive the next time you sign in here. Leaving with unsaved writing shows a warning. |
| Writing on the laptop app and the website | Both are kept. Where both changed the same chapter, the newer edit wins; deletions stay deleted. |
| Signing out with unsaved writing | You choose: stay, keep it in this browser, or discard it (sensible on a shared computer). |
| Photo folders | Read in the browser, never uploaded. Browsers can't reopen folders next visit, so you choose them again. |

Tested on every change by `npm run test:e2e:web`, which drives the real website
in a browser against a stand-in Google Drive.
