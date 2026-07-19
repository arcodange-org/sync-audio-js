# SyncAudio Demo Scripts

This directory contains scripts for generating demo assets (videos, GIFs, screenshots) for the SyncAudio library.

## 🎬 Available Scripts

### 1. `record-gif.js` (Recommended)
Creates a short GIF demo that can be embedded in README.

**Usage:**
```bash
node scripts/record-gif.js
```

**What it does:**
- Records a short video of the demo page using Playwright
- Converts it to a GIF (8 seconds, 8 fps, 800px wide)
- Updates README.md with the GIF
- Saves GIF to `docs/assets/sync-audio-demo.gif`

**Requirements:**
- Playwright installed (`npx playwright install`)
- FFmpeg installed (`sudo apt install ffmpeg` or `brew install ffmpeg`)
- GitHub Pages deployed

**Output:**
- `docs/assets/sync-audio-demo.gif` - Demo GIF
- Updated `README.md` with GIF reference

---

### 2. `generate-demo-video.js` (Full Video)
Creates a complete demo video in multiple formats.

**Usage:**
```bash
node scripts/generate-demo-video.js
```

**What it does:**
- Records a full walkthrough video
- Converts to MP4 format
- Creates a GIF version
- Creates a thumbnail
- Updates README.md

**Output:**
- `demo-assets/sync-audio-demo.webm` - Original video
- `demo-assets/sync-audio-demo.mp4` - MP4 version
- `demo-assets/sync-audio-demo.gif` - GIF version
- `demo-assets/sync-audio-demo-thumbnail.png` - Thumbnail
- Updated `README.md`

---

### 3. `capture-screenshots.js`
Captures static screenshots of different sections.

**Usage:**
```bash
node scripts/capture-screenshots.js
```

**What it does:**
- Captures screenshots of hero, features, demo, and usage sections
- Updates README.md with screenshots

**Output:**
- `docs/assets/hero.png`
- `docs/assets/features.png`
- `docs/assets/demo.png`
- `docs/assets/usage.png`
- Updated `README.md`

---

### 4. `check-pages.js`
Checks if GitHub Pages is deployed and accessible.

**Usage:**
```bash
node scripts/check-pages.js
```

**What it does:**
- Checks DNS resolution
- Checks HTTP response
- Checks page content
- Retries every 5 seconds for 1 minute

**Output:**
- Console output with deployment status

---

## 📦 npm Scripts

All scripts are also available via npm:

| Script | Command | Description |
|--------|---------|-------------|
| `demo:gif` | `npm run demo:gif` | Create demo GIF |
| `demo:video` | `npm run demo:video` | Create full demo video |
| `demo:screenshots` | `npm run demo:screenshots` | Capture screenshots |
| `demo:check` | `npm run demo:check` | Check GitHub Pages |
| `test:demo` | `npm run test:demo` | Run demo video test |

---

## 🎯 Quick Start

### To create a demo GIF for README:

```bash
# 1. Install dependencies
npm install
npx playwright install

# 2. Make sure GitHub Pages is deployed
node scripts/check-pages.js

# 3. Generate the GIF
npm run demo:gif

# 4. Commit and push
git add docs/assets/ README.md
git commit -m "Add demo GIF to README"
git push
```

### To create a full demo video:

```bash
# 1. Install FFmpeg
# Ubuntu: sudo apt install ffmpeg
# Mac: brew install ffmpeg
# Windows: Download from https://ffmpeg.org/

# 2. Generate the video
npm run demo:video

# 3. Commit and push
git add demo-assets/ README.md
git commit -m "Add demo video assets"
git push
```

---

## 💡 Tips

1. **Playwright Installation**: If you get errors about missing browsers, run:
   ```bash
   npx playwright install --with-deps
   ```

2. **FFmpeg Installation**: 
   - Ubuntu/Debian: `sudo apt install ffmpeg`
   - Mac: `brew install ffmpeg`
   - Windows: Download from [ffmpeg.org](https://ffmpeg.org/)

3. **GitHub Pages**: Make sure your GitHub Pages is configured:
   - Branch: `main`
   - Folder: `/docs`
   - URL: `https://arcodange-org.github.io/sync-audio-js/`

4. **Custom URL**: If you want to test locally, start the server:
   ```bash
   npm start
   ```
   Then run the scripts with `--url=http://localhost:8080`

---

## 🐛 Troubleshooting

### Playwright errors
- **Error: No browser found** → Run `npx playwright install`
- **Error: Browser not downloaded** → Run `npx playwright install --with-deps`
- **Error: Timeout** → Increase timeout in the test file

### FFmpeg errors
- **Error: ffmpeg not found** → Install FFmpeg (see above)
- **Error: Permission denied** → Make sure you have write permissions

### GitHub Pages errors
- **Error: 404** → Check that GitHub Pages is enabled in repository settings
- **Error: DNS not resolved** → Wait a few minutes for DNS propagation

---

## 📚 Test Files

- `tests/demo-video.spec.js` - Playwright test for recording demo video
- `tests/qa.spec.js` - QA test suite for the library

---

## 🎨 Demo Video Content

The demo video script (`tests/demo-video.spec.js`) records:

1. Loading the demo page
2. Scrolling to features section
3. Scrolling to demo section
4. Highlighting demo panels
5. Showing control buttons
6. Showing audio players
7. Scrolling to usage section
8. Scrolling back to top
9. Showing footer

This creates a comprehensive walkthrough of the SyncAudio demo page.
