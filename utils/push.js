import User from "../models/User.js";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// Expo accepts at most 100 messages per request; a phone rarely has more than
// a couple of tokens for one account, so a small slice is enough.
const MAX_TOKENS_PER_USER = 10;

export async function sendPushToUser(userId, { title, body, data = {} }) {
  try {
    const user = await User.findById(userId).select("expoPushTokens");
    const tokens = (user?.expoPushTokens || []).filter(Boolean).slice(0, MAX_TOKENS_PER_USER);
    if (!tokens.length) return { sent: 0 };

    const messages = tokens.map((to) => ({
      to,
      sound: "default",
      title,
      body,
      data,
      channelId: "messages",
      priority: "high",
    }));

    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(messages),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      console.error("Expo push request failed:", res.status, JSON.stringify(json));
      return { sent: 0, error: `HTTP ${res.status}` };
    }
    const tickets = json?.data || [];

    // Expo reports uninstalled apps; drop those tokens so we stop sending to them.
    const deadTokens = [];
    tickets.forEach((ticket, index) => {
      if (ticket?.status !== "error") return;
      if (ticket?.details?.error === "DeviceNotRegistered") {
        if (tokens[index]) deadTokens.push(tokens[index]);
      } else {
        // Log configuration problems (for example missing FCM credentials) so
        // delivery failures are visible in the Render logs.
        console.warn("Expo push ticket error:", ticket.message || ticket.details?.error);
      }
    });
    if (deadTokens.length) {
      await User.updateOne(
        { _id: userId },
        { $pull: { expoPushTokens: { $in: deadTokens } } }
      );
    }

    return { sent: messages.length - deadTokens.length };
  } catch (err) {
    // Push delivery is best-effort; the in-app notification is already stored.
    console.error("Push notification error:", err.message);
    return { sent: 0, error: err.message };
  }
}
