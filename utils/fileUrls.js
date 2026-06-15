/** Public origin for uploaded files (no /api suffix) */
export function getApiOrigin() {
  const fromEnv =
    process.env.API_ORIGIN ||
    process.env.RENDER_EXTERNAL_URL ||
    process.env.BACKEND_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const port = process.env.PORT || 1000;
  return `http://localhost:${port}`;
}

export function toAbsoluteUploadUrl(url) {
  if (!url) return "";
  if (String(url).startsWith("http")) return url;
  const origin = getApiOrigin();
  return `${origin}${url.startsWith("/") ? url : `/${url}`}`;
}

export function normalizePricelistPublicId(publicId) {
  if (!publicId) return null;
  const decoded = decodeURIComponent(String(publicId));
  if (decoded.startsWith("http")) return null;
  if (decoded.includes("/")) return decoded;
  return `axx-spaces/business/pricelists/${decoded}`;
}
