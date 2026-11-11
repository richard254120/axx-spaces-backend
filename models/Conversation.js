import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    contextType: {
      type: String,
      enum: ["property", "accommodation", "business"],
      required: true,
    },
    contextId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    // Snapshot of the listing so the inbox still renders if the listing is
    // edited, renamed or later removed.
    contextTitle: {
      type: String,
      default: "",
      trim: true,
    },
    contextImage: {
      type: String,
      default: "",
    },
    participantIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      validate: {
        validator: (ids) => Array.isArray(ids) && ids.length === 2,
        message: "A conversation must have exactly two participants",
      },
    },
    // Sorted participant ids + context, so the same pair always upserts to the
    // same conversation thread.
    participantKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    lastMessage: {
      type: String,
      default: "",
      maxlength: 300,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastSender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // userId -> unread message count
    unread: {
      type: Map,
      of: Number,
      default: () => ({}),
    },
    archivedBy: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
  },
  { timestamps: true }
);

conversationSchema.index({ participantIds: 1, lastMessageAt: -1 });

export function buildParticipantKey(contextType, contextId, a, b) {
  const ids = [String(a), String(b)].sort();
  return `${contextType}:${String(contextId)}:${ids[0]}:${ids[1]}`;
}

const Conversation =
  mongoose.models.Conversation ||
  mongoose.model("Conversation", conversationSchema);

export default Conversation;
