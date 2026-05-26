MINDVAULT AI — APP ICONS
========================

You need to generate PNG icons from the SVG below and place them in this folder.
The design matches the book cover: black background, Mondrian colour blocks.

REQUIRED FILES:
  icon-32.png   — browser favicon
  icon-180.png  — iOS home screen icon (Apple Touch Icon)
  icon-192.png  — Android / PWA icon
  icon-512.png  — PWA splash / install prompt

FASTEST WAY TO GENERATE THEM:
1. Go to https://realfavicongenerator.net
2. Upload the SVG below (save it as icon.svg first)
3. Download the generated package
4. Copy the relevant PNG files into this folder

ALTERNATIVELY:
  - Use Figma, Canva, or any image editor
  - Design a 512×512 square with the Mondrian layout below
  - Export at 32, 180, 192, and 512 sizes

THE ICON DESIGN (Mondrian / Book-inspired):
  Background:        #0A0A0A  (black — full square)
  Top-left block:    #1D3557  (blue  — ~60% width, ~55% height)
  Bottom-left block: #E8B84B  (yellow — ~30% width, ~30% height)
  Bottom-right:      #C1121F  (red   — ~30% width, ~30% height)
  White space:       #FAFAF7  (top-right corner block)
  Label text:        "MV" in Unbounded font, white, centered

SVG SOURCE (save as icon.svg and open in a browser to preview):
---
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <!-- Background -->
  <rect width="512" height="512" fill="#0A0A0A"/>
  <!-- Blue block (top-left dominant, mirrors book cover) -->
  <rect x="16" y="16" width="288" height="272" fill="#1D3557"/>
  <!-- White block (top-right) -->
  <rect x="320" y="16" width="176" height="272" fill="#FAFAF7"/>
  <!-- Yellow block (bottom-left) -->
  <rect x="16" y="304" width="208" height="192" fill="#E8B84B"/>
  <!-- Red block (bottom-right) -->
  <rect x="240" y="304" width="256" height="192" fill="#C1121F"/>
  <!-- Grid lines -->
  <rect x="304" y="0"   width="16" height="512" fill="#0A0A0A"/>
  <rect x="0"   y="288" width="512" height="16"  fill="#0A0A0A"/>
  <rect x="224" y="288" width="16" height="224" fill="#0A0A0A"/>
  <!-- "MV" logotype -->
  <text x="256" y="175" font-family="monospace" font-size="96" font-weight="900"
        fill="#FAFAF7" text-anchor="middle" dominant-baseline="middle">MV</text>
</svg>
---

NOTE: iOS does not support maskable icons — use a plain square design.
      Android supports maskable icons with a safe zone of 80% of the canvas.
