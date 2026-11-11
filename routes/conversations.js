import express from "express";
import mongoose from "mongoose";
import { auth } from "../middleware/auth.js";
import Conversation, { buildParticipantKey } from "../models/Conversation.js";
import Message from "../models/Message.js";
import Notification from "../models/Notification.js";
import Property from "../models/Property.js";
import Accommodation from "../models/Accommodation.js";
import AccommodationImage from "../models/AccommodationImage.js";
import Business from "../models/Business.js";
import User from "../models/User.js";

const router = express.Router();

const CONTEXT_MODELS = {
  property: Property,
  accommodation: Accommodation,
  business: Business,
};

const CONTEXT_NOTIFICATION_FIELDS = {
  property: "propertyId",
  accommodation: "accommodationId",
  business: "businessId",
};

// Load the listing a conversation hangs off and normalise the fields the
// inbox/chat UI needs: title, first image, and the contactable staff.
async function resolveContext(contextType, contextId) {
  const Model = CONTEXT_MODELS[contextType];
  if (!Model) return null;

  const doc = await Model.findById(contextId).select(
    "title name images logo owner assignedAgent"
  );
  if (!doc) return null;

  let image = "";
  if (contextType === "accommodation") {
    const primary = await AccommodationImage.findOne({ accommodation: doc._id })
      .sort({ isPrimary: -1, order: 1 })
      .select("imageUrl");
    image = primary?.imageUrl || "";
  } else if (contextType === "business") {
    image = doc.images?.[0] || doc.logo || "";
  } else {
    image = doc.images?.[0] || "";
  }

  return {
    title: doc.name || doc.title || "Listing",
    image,
    ownerId: doc.owner ? String(doc.owner) : null,
    agentId: doc.assignedAgent ? String(doc.assignedAgent) : null,
  };
}

function otherParticipant(conversation, userId) {
  return conversation.participantIds.find(
    (id) => String(id._id || id) !== String(userId)
  );
}

async function deliverMessage(conversation, sender, text) {
  const senderId = String(sender._id);
  const recipient = otherParticipant(conversation, senderId);
  const recipientId = String(recipient._id || recipient);

  const message = await Message.create({
    conversation: conversation._id,
    sender: sender._id,
    text,
    readBy: [sender._id],
  });

  await Conversation.updateOne(
    { _id: conversation._id },
    {
      $set: {
        lastMessage: text.slice(0, 300),
        lastMessageAt: message.createdAt,
        lastSender: sender._id,
      },
      $inc: { [`unread.${recipientId}`]: 1 },
      $pull: { archivedBy: recipientId },
    }
  );

  try {
    await Notification.create({
      type: "message",
      userId: recipientId,
      userName: sender.name,
      userPhone: sender.phone,
      userEmail: sender.email,
      message: `${sender.name}: ${text.slice(0, 160)}`,
      conversationId: conversation._id,
      [CONTEXT_NOTIFICATION_FIELDS[conversation.contextType]]:
        conversation.contextId,
    });
  } catch (notifyErr) {
    // A notification failure must never block the message itself.
    console.error("Message notification error:", notifyErr.message);
  }

  return message;
}

// POST /api/conversations
// Start (or find) the thread for a listing between the caller and the
// listing's owner/agent. Users must say who they are messaging when a listing
// has both an owner and an assigned agent.
router.post("/", auth, async (req, res) => {
  try {
    const { contextType, contextId, recipientId, message } = req.body || {};

    if (!CONTEXT_MODELS[contextType]) {
      return res.status(400).json({ error: "Invalid listing type" });
    }
    if (!mongoose.isValidObjectId(contextId)) {
      return res.status(400).json({ error: "Invalid listing id" });
    }

    const context = await resolveContext(contextType, contextId);
    if (!context) {
      return res.status(404).json({ error: "Listing not found" });
    }

    const me = String(req.user._id);
    const staffIds = [context.ownerId, context.agentId].filter(Boolean);
    if (staffIds.length === 0) {
      return res.status(400).json({ error: "This listing has no owner to message" });
    }

    const iAmStaff = staffIds.includes(me);
    let peerId;

    if (iAmStaff) {
      if (!recipientId) {
        return res
          .status(400)
          .json({ error: "recipientId is required when the listing owner starts a chat" });
      }
      if (!mongoose.isValidObjectId(recipientId)) {
        return res.status(400).json({ error: "Invalid recipient id" });
      }
      peerId = String(recipientId);
      const recipient = await User.findById(peerId).select("_id");
      if (!recipient) {
        return res.status(404).json({ error: "Recipient not found" });
      }
    } else {
      if (recipientId && !staffIds.includes(String(recipientId))) {
        return res
          .status(403)
          .json({ error: "You can only message the owner or agent of this listing" });
      }
      peerId = recipientId ? String(recipientId) : context.ownerId || context.agentId;
    }

    if (peerId === me) {
      return res.status(400).json({ error: "You cannot start a conversation with yourself" });
    }

    const participantKey = buildParticipantKey(contextType, contextId, me, peerId);
    let conversation = await Conversation.findOne({ participantKey });

    if (!conversation) {
      try {
        conversation = await Conversation.create({
          contextType,
          contextId,
          contextTitle: context.title,
          contextImage: context.image,
          participantIds: [me, peerId],
          participantKey,
        });
      } catch (createErr) {
        if (createErr.code === 11000) {
          // Concurrent start of the same thread — use the existing one.
          conversation = await Conversation.findOne({ participantKey });
        } else {
          throw createErr;
        }
      }
    }

    if (!conversation) {
      return res.status(500).json({ error: "Could not open conversation" });
    }

    // Rejoining an archived thread should bring it back to both inboxes.
    await Conversation.updateOne(
      { _id: conversation._id },
      { $pull: { archivedBy: me } }
    );

    let firstMessage = null;
    if (typeof message === "string" && message.trim()) {
      if (message.trim().length > 2000) {
        return res.status(400).json({ error: "Message cannot exceed 2000 characters" });
      }
      firstMessage = await deliverMessage(
        conversation,
        req.user,
        message.trim()
      );
    }

    res.status(201).json({
      success: true,
      conversation: {
        _id: conversation._id,
        contextType: conversation.contextType,
        contextId: conversation.contextId,
        contextTitle: conversation.contextTitle,
        contextImage: conversation.contextImage,
        lastMessage: conversation.lastMessage,
        lastMessageAt: conversation.lastMessageAt,
      },
      message: firstMessage,
    });
  } catch (err) {
    console.error("Start conversation error:", err);
    res.status(500).json({ error: "Failed to start conversation" });
  }
});

// GET /api/conversations — inbox for the logged-in user
router.get("/", auth, async (req, res) => {
  try {
    const me = String(req.user._id);
    const conversations = await Conversation.find({
      participantIds: req.user._id,
      archivedBy: { $ne: req.user._id },
    })
      .sort({ lastMessageAt: -1 })
      .limit(100)
      .populate("participantIds", "name profileImage role")
      .lean();

    let totalUnread = 0;
    const items = conversations.map((conv) => {
      const unreadCount = Number(conv.unread?.[me] || 0);
      totalUnread += unreadCount;
      const peer = conv.participantIds.find((p) => String(p._id) !== me) || null;
      const { unread, participantIds, ...rest } = conv;
      return { ...rest, peer, unreadCount };
    });

    res.json({ success: true, totalUnread, conversations: items });
  } catch (err) {
    console.error("List conversations error:", err);
    res.status(500).json({ error: "Failed to load conversations" });
  }
});

// GET /api/conversations/summary — lightweight unread counters for badges
router.get("/summary", auth, async (req, res) => {
  try {
    const me = String(req.user._id);
    const conversations = await Conversation.find({
      participantIds: req.user._id,
      archivedBy: { $ne: req.user._id },
    })
      .select("unread lastMessageAt")
      .lean();

    let totalUnread = 0;
    let unreadConversations = 0;
    for (const conv of conversations) {
      const count = Number(conv.unread?.[me] || 0);
      totalUnread += count;
      if (count > 0) unreadConversations += 1;
    }

    res.json({ success: true, totalUnread, unreadConversations });
  } catch (err) {
    console.error("Conversation summary error:", err);
    res.status(500).json({ error: "Failed to load conversation summary" });
  }
});

// GET /api/conversations/:id/messages?before=<ISO>&limit=50
router.get("/:id/messages", auth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid conversation id" });
    }

    const conversation = await Conversation.findOne({
      _id: req.params.id,
      participantIds: req.user._id,
    });
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const query = { conversation: conversation._id };
    if (req.query.before && !Number.isNaN(Date.parse(req.query.before))) {
      query.createdAt = { $lt: new Date(req.query.before) };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("sender", "name profileImage role")
      .lean();

    messages.reverse();

    res.json({
      success: true,
      conversation: {
        _id: conversation._id,
        contextType: conversation.contextType,
        contextId: conversation.contextId,
        contextTitle: conversation.contextTitle,
        contextImage: conversation.contextImage,
        participantIds: conversation.participantIds,
      },
      messages,
      hasMore: messages.length === limit,
    });
  } catch (err) {
    console.error("Load messages error:", err);
    res.status(500).json({ error: "Failed to load messages" });
  }
});

// POST /api/conversations/:id/messages
router.post("/:id/messages", auth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid conversation id" });
    }

    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!text) {
      return res.status(400).json({ error: "Message text is required" });
    }
    if (text.length > 2000) {
      return res.status(400).json({ error: "Message cannot exceed 2000 characters" });
    }

    const conversation = await Conversation.findOne({
      _id: req.params.id,
      participantIds: req.user._id,
    });
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const message = await deliverMessage(
      conversation,
      req.user,
      text
    );

    res.status(201).json({ success: true, message });
  } catch (err) {
    console.error("Send message error:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// PUT /api/conversations/:id/read — clear unread counter + mark messages read
router.put("/:id/read", auth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid conversation id" });
    }

    const conversation = await Conversation.findOne({
      _id: req.params.id,
      participantIds: req.user._id,
    });
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const me = String(req.user._id);
    await Conversation.updateOne(
      { _id: conversation._id },
      { $set: { [`unread.${me}`]: 0 } }
    );

    await Message.updateMany(
      {
        conversation: conversation._id,
        sender: { $ne: req.user._id },
        readBy: { $ne: req.user._id },
      },
      { $addToSet: { readBy: req.user._id } }
    );

    await Notification.updateMany(
      { userId: req.user._id, type: "message", conversationId: conversation._id, read: false },
      { $set: { read: true } }
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Mark conversation read error:", err);
    res.status(500).json({ error: "Failed to mark conversation read" });
  }
});

// DELETE /api/conversations/:id — archive from this user's inbox only
router.delete("/:id", auth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid conversation id" });
    }

    const me = String(req.user._id);
    const conversation = await Conversation.findOneAndUpdate(
      { _id: req.params.id, participantIds: req.user._id },
      {
        $addToSet: { archivedBy: req.user._id },
        $set: { [`unread.${me}`]: 0 },
      },
      { new: true }
    );

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Archive conversation error:", err);
    res.status(500).json({ error: "Failed to archive conversation" });
  }
});

export default router;
