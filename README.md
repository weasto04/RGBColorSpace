# RGB Color Space — 3D Scatter (no frameworks)

This is a tiny frontend-only app that visualizes an image's pixels in RGB color space. Each pixel's red, green and blue channels (0..1) become the x,y,z coordinates in 3D space and are plotted as colored points.

Files added
- `index.html` — main UI
- `styles.css` — minimal styles
- `app.js` — sampling + rendering logic

How to open
1. Open `index.html` in your browser (double-click or use a local static server).
2. Choose one of the example images from the dropdown (they were extracted to `rgb_images/rgb_images/`), or upload your own image.
3. Adjust sampling `step` (larger = fewer points). Click `Render`.

Controls
- Drag on the canvas to rotate the view.
- Scroll to zoom.

Notes
- No build step required. The app uses only plain HTML/CSS/JS and the 2D canvas.
- If your browser blocks loading local images due to CORS when opening `index.html` directly, run a simple local server from the project root:

  python3 -m http.server 8000

Then open http://localhost:8000 in the browser.
# RGBColorSpace