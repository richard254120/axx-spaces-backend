import express from "express";

const router = express.Router();

// The APK build artifact hosted on the Expo EAS CDN. Vercel can't carry the
// ~86 MB binary, so we keep it on Expo's CDN and expose a clean, branded
// download endpoint on our own domain. Update APP_APK_URL (env) after each new
// EAS build; the value below is the current fallback.
const APK_URL =
  process.env.APP_APK_URL ||
  "https://expo.dev/artifacts/eas/tfbHKWKT1XUGv5tHV7rAnRi59n5fPcRWqFWZGS-QsU4.apk";

const APK_FILENAME = process.env.APP_APK_FILENAME || "Axxspace.apk";

// Resolve the final, direct CDN file URL by following Expo's short-lived
// redirects server-side. Falls back to the original URL if resolution fails.
async function resolveFinalUrl() {
  try {
    const r = await fetch(APK_URL, { redirect: "follow" });
    const finalUrl = r.url || APK_URL;
    // Don't download the body — release the stream immediately.
    r.body?.cancel().catch(() => {});
    return finalUrl;
  } catch {
    return APK_URL;
  }
}

// @desc    Redirect the browser straight to the APK so it downloads directly
// @route   GET /api/app/download
// @access  Public
router.get("/download", async (req, res) => {
  const finalUrl = await resolveFinalUrl();
  // 302 (not cached) so the short-lived signed URL is always fresh.
  return res.redirect(302, finalUrl);
});

// @desc    Report the current app version + download info (handy for clients)
// @route   GET /api/app/version
// @access  Public
router.get("/version", (req, res) => {
  res.json({
    downloadUrl: `${req.protocol}://${req.get("host")}/api/app/download`,
    filename: APK_FILENAME,
  });
});

export default router;
