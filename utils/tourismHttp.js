/** Consistent JSON responses for tourism API */
export function sendSuccess(res, data = {}, status = 200, extra = {}) {
  return res.status(status).json({ success: true, ...extra, data });
}

export function sendError(res, message, status = 500) {
  return res.status(status).json({ success: false, error: message });
}

export function handleServiceError(res, error) {
  const status = error.status || 500;
  if (status >= 500) console.error("Tourism API error:", error);
  return sendError(res, error.message || "Something went wrong", status);
}
