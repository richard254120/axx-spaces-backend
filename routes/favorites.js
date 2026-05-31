import express from "express";
import { auth } from "../middleware/auth.js";
import Favorite from "../models/Favorite.js";
import Business from "../models/Business.js";

const router = express.Router();

// ====================== GET USER'S FAVORITES ======================
router.get("/", auth, async (req, res) => {
  try {
    const { category } = req.query;
    const filter = { user: req.user.id };
    
    if (category && category !== "all") {
      filter.category = category;
    }

    const favorites = await Favorite.find(filter)
      .populate("business")
      .sort({ createdAt: -1 });

    res.json({ success: true, favorites });
  } catch (error) {
    console.error("Get favorites error:", error);
    res.status(500).json({ error: "Failed to fetch favorites" });
  }
});

// ====================== ADD TO FAVORITES ======================
router.post("/", auth, async (req, res) => {
  try {
    const { businessId, notes, category } = req.body;

    // Check if business exists
    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    // Check if already favorited
    const existingFavorite = await Favorite.findOne({
      user: req.user.id,
      business: businessId,
    });

    if (existingFavorite) {
      return res.status(400).json({ error: "Business already in favorites" });
    }

    const favorite = new Favorite({
      user: req.user.id,
      business: businessId,
      notes: notes || "",
      category: category || "general",
    });

    await favorite.save();

    res.json({ success: true, message: "Added to favorites", favorite });
  } catch (error) {
    console.error("Add favorite error:", error);
    res.status(500).json({ error: "Failed to add to favorites" });
  }
});

// ====================== UPDATE FAVORITE ======================
router.put("/:favoriteId", auth, async (req, res) => {
  try {
    const favorite = await Favorite.findById(req.params.favoriteId);

    if (!favorite) {
      return res.status(404).json({ error: "Favorite not found" });
    }

    if (favorite.user.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized to update this favorite" });
    }

    const { notes, category } = req.body;

    favorite.notes = notes !== undefined ? notes : favorite.notes;
    favorite.category = category !== undefined ? category : favorite.category;

    await favorite.save();

    res.json({ success: true, message: "Favorite updated", favorite });
  } catch (error) {
    console.error("Update favorite error:", error);
    res.status(500).json({ error: "Failed to update favorite" });
  }
});

// ====================== REMOVE FROM FAVORITES ======================
router.delete("/:favoriteId", auth, async (req, res) => {
  try {
    const favorite = await Favorite.findById(req.params.favoriteId);

    if (!favorite) {
      return res.status(404).json({ error: "Favorite not found" });
    }

    if (favorite.user.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized to remove this favorite" });
    }

    await Favorite.findByIdAndDelete(req.params.favoriteId);

    res.json({ success: true, message: "Removed from favorites" });
  } catch (error) {
    console.error("Remove favorite error:", error);
    res.status(500).json({ error: "Failed to remove from favorites" });
  }
});

// ====================== CHECK IF BUSINESS IS FAVORITED ======================
router.get("/check/:businessId", auth, async (req, res) => {
  try {
    const favorite = await Favorite.findOne({
      user: req.user.id,
      business: req.params.businessId,
    });

    res.json({ success: true, isFavorited: !!favorite, favoriteId: favorite?._id });
  } catch (error) {
    console.error("Check favorite error:", error);
    res.status(500).json({ error: "Failed to check favorite status" });
  }
});

export default router;
