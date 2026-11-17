# Customize the starter

Open the **Appearance** panel at the top of the signed-in owner page.

- Set the songbook title and subtitle.
- Choose accent, page background, panel and text colors.
- Set an optional logo and optional background image.
- Replace the default reward chibi. This updates milestone awards, stickers, reward previews and the default profile image.
- Optionally enable the animated music background; it is off in the basic theme.

Choose **Save appearance**. Changes apply immediately on the owner page and open listener pages refresh them within 30 seconds. They persist in D1 across restarts and show resets. Only the owner can save appearance settings. The saved images are public to listeners.

## Images

Use an image URL beginning with HTTPS, a local asset path such as `/my-chibi.png`, or the upload control. Upload PNG, JPEG, WebP or GIF up to 300 KB per field. For larger images, place files in `public/` and use their paths, or use a hosted HTTPS URL. SVG uploads are not accepted. Keep chibi backgrounds transparent where possible.

Uploads are saved as small image data URLs in the appearance settings, so the starter does not require an external media bucket. Large galleries or many per-reward images should use a media bucket instead.

**Use default** clears an optional image or restores the generic chibi. **Reset draft to defaults** prepares the basic theme; save to apply it.

## Developer changes

- `lib/appearance.ts`: generic defaults.
- `app/owner-appearance.tsx`: editor.
- `app/appearance-provider.tsx`: shared appearance and color application.
- `app/api/appearance/route.ts`: public read/protected update.
- `lib/special-rewards.ts`: generic reward labels, prices and IDs.
- `lib/listener-rewards.ts`: milestone sayings and rules.
- `app/globals.css`: responsive layout and CSS variables.
- `public/default-chibi.png`: generic moogle bard default.

The default chibi was newly generated as a simple transparent moogle with a lute, with no personal character likeness, tattoos or band branding. It is a starter asset rather than the owner's artwork. Add songs through the owner interface; do not commit a personal catalog into `lib/songs.ts`.
