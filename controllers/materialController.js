import AuditLog from "../models/AuditLog.js";
import User from "../models/User.js";
import Material from "../models/Material.js";
import { sendMaterialEmail, sendMaterialApprovalEmail } from "../utils/email.js";

// Publishing on QuickSales is restricted to AXXSpace members and registered sellers
const PUBLISHING_ROLES = ["member", "seller", "admin"];

// ============ CREATE MATERIAL (AXXSpace members & sellers only) ============
export const createMaterial = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required to post items" });
    }

    if (!PUBLISHING_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        error: "Only AXXSpace members and registered sellers can publish items. Upgrade to an AXXSpace membership or create a seller account to start selling.",
        code: "MEMBERSHIP_REQUIRED",
        role: req.user.role,
      });
    }

    const {
      title, description, category, subcategory,
      price, quantity, condition, location, county,
      lat, lng, sellerPhone, sellerName
    } = req.body;

    if (!title || !description || !category || !price || !quantity || !location || !county) {
      return res.status(400).json({ error: "Missing required fields (title, description, category, price, quantity, location, county)" });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "Please upload at least one image" });
    }

    const imageUrls = req.files.map((file) => file.path);
    const resolvedPhone = (sellerPhone || req.user.phone || "").trim();
    const resolvedName = (sellerName || req.user.name || req.user.username || "Seller").trim();

    // Auto-save phone to user's profile if it was empty
    if (resolvedPhone && !req.user.phone) {
      try {
        await User.findByIdAndUpdate(req.user._id, { phone: resolvedPhone });
      } catch (err) {
        console.warn("Could not sync phone to user profile:", err.message);
      }
    }

    const material = new Material({
      title: title.trim(),
      description: description.trim(),
      category,
      subcategory: subcategory || "",
      price: parseFloat(price),
      quantity: parseInt(quantity) || 1,
      condition: condition || "Good",
      location: location.trim(),
      county: county.trim(),
      lat: lat ? parseFloat(lat) : undefined,
      lng: lng ? parseFloat(lng) : undefined,
      images: imageUrls,
      seller: req.user._id,
      sellerName: resolvedName,
      sellerPhone: resolvedPhone,
      status: "active", // Instant Live
      isVerified: !!req.user.isApproved || !!req.user.isVerified,
    });

    await material.save();

    try {
      await sendMaterialEmail(material, req.user);
    } catch (emailErr) {
      console.warn("Could not send material email notification:", emailErr.message);
    }

    res.status(201).json({ success: true, message: "Item posted successfully and is now live!", material });
  } catch (error) {
    console.error("Create material error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ============ GET ALL ACTIVE MATERIALS (Public Browse) ============
export const getApprovedMaterials = async (req, res) => {
  try {
    const { category, condition, minPrice, maxPrice, county, search, featured, limit } = req.query;

    //  FIXED: Only show materials with status "active"
    let filter = { status: "active" };

    if (category) filter.category = category;
    if (condition) filter.condition = condition;
    if (featured) filter.isFeatured = featured === "true";
    if (county) filter.county = county;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
      ];
    }

    // Check and expire promotions that have ended
    await Material.updateMany(
      {
        isFeatured: true,
        promotionEndDate: { $lt: new Date() }
      },
      {
        $set: {
          isFeatured: false,
          promotionTier: null,
          promotionStartDate: null,
          promotionEndDate: null
        }
      }
    );

    const materials = await Material.find(filter)
      .populate("seller", "name phone isApproved verificationBadges")
      .sort({ createdAt: -1 })
      .limit(limit ? parseInt(limit) : 50);

    res.json(materials);
  } catch (error) {
    console.error(" Get approved materials error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ============ GET SELLER'S OWN MATERIALS ============
export const getMyMaterials = async (req, res) => {
  try {
    const materials = await Material.find({ seller: req.user._id }).sort({ createdAt: -1 });
    res.json(materials);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ============ GET SINGLE MATERIAL BY ID ============
export const getMaterialById = async (req, res) => {
  try {
    const material = await Material.findById(req.params.id)
      .populate("seller", "name phone email isApproved verificationBadges");

    if (!material) return res.status(404).json({ error: "Material not found" });

    res.json(material);
  } catch (error) {
    console.error(" Get material by ID error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ============ ADMIN — APPROVE MATERIAL ============
export const approveMaterial = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }
    const material = await Material.findByIdAndUpdate(
      req.params.id,
      //  FIXED: status is now "active" to match the public fetch filter
      { status: "active", isVerified: true },
      { new: true }
    ).populate("seller", "email");
    if (!material) return res.status(404).json({ error: "Material not found" });
    await sendMaterialApprovalEmail(material.seller.email, material.title);
    await AuditLog.create({
  admin: req.user._id,
  action: 'approve_material',
  targetId: material._id,
  targetType: 'Material',
  details: { status: material.status, isVerified: material.isVerified }
});
res.json({ success: true, message: "Material approved!", material });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ============ ADMIN — REJECT MATERIAL ============
export const rejectMaterial = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }
    const material = await Material.findByIdAndUpdate(
      req.params.id,
      { status: "archived", isVerified: false },
      { new: true }
    );
    res.json({ success: true, material });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ============ MARK AS SOLD ============
export const markAsSold = async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);
    if (!material || material.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Unauthorized" });
    }
    material.status = "sold";
    await material.save();

    // Track commission for the platform (5% of material price)
    const commission = material.price * 0.05;
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { totalCommissionEarned: commission },
      $push: {
        commissionHistory: {
          type: "material_sale",
          amount: commission,
          referenceId: material._id,
          date: new Date(),
        },
      },
    });

    res.json({ success: true, material });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ============ SELLER — UPDATE OWN MATERIAL ============
export const updateMaterial = async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);
    if (!material) return res.status(404).json({ error: "Material not found" });
    if (material.seller.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized. You can only edit your own listings." });
    }

    const editable = ["title", "description", "category", "subcategory", "condition", "location", "county"];
    editable.forEach((field) => {
      if (req.body[field] !== undefined && req.body[field] !== "") {
        material[field] = req.body[field];
      }
    });
    if (req.body.price !== undefined && req.body.price !== "") material.price = parseFloat(req.body.price);
    if (req.body.quantity !== undefined && req.body.quantity !== "") material.quantity = parseInt(req.body.quantity);
    if (req.body.lat !== undefined && req.body.lat !== "") material.lat = parseFloat(req.body.lat);
    if (req.body.lng !== undefined && req.body.lng !== "") material.lng = parseFloat(req.body.lng);

    // Optional: attach newly uploaded images to the existing gallery
    if (req.files && req.files.length > 0) {
      material.images = material.images.concat(req.files.map((file) => file.path));
    }

    await material.save();
    res.json({ success: true, message: "Material updated!", material });
  } catch (error) {
    console.error(" Update material error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ============ DELETE MATERIAL ============
export const deleteMaterial = async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);
    if (!material) return res.status(404).json({ error: "Material not found" });
    if (material.seller.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized" });
    }
    await Material.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};