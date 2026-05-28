import Material from "../models/Material.js";
import User from "../models/User.js";
import { sendMaterialEmail, sendMaterialApprovalEmail } from "../utils/email.js";

// ============ CREATE MATERIAL ============
export const createMaterial = async (req, res) => {
  try {
    if (req.user.role !== "seller" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Only sellers can upload materials" });
    }
    const { title, description, category, subcategory, price, quantity, condition, location, county, lat, lng } = req.body;
    if (!title || !description || !category || !price || !quantity) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "Please upload at least one image" });
    }
    const imageUrls = req.files.map((file) => file.path);
    const material = new Material({
      title, description, category, subcategory,
      price: parseFloat(price),
      quantity: parseInt(quantity),
      condition, location, county,
      lat: lat ? parseFloat(lat) : undefined,
      lng: lng ? parseFloat(lng) : undefined,
      images: imageUrls,
      seller: req.user._id,
      sellerName: req.user.name,
      sellerPhone: req.user.phone,
      status: "pending",
      isVerified: false,
    });
    await material.save();
    await sendMaterialEmail(material, req.user);
    res.status(201).json({ success: true, message: "Material submitted!", material });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ============ GET ALL ACTIVE MATERIALS (Public Browse) ============
export const getApprovedMaterials = async (req, res) => {
  try {
    const { category, condition, minPrice, maxPrice, county, search } = req.query;

    // ✅ FIXED: Accept both "approved" and "active" to handle existing data
    // Also exclude "pending", "rejected", "sold", "archived"
    let filter = { status: { $nin: ["pending", "rejected", "sold", "archived"] } };

    if (category) filter.category = category;
    if (condition) filter.condition = condition;
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
    const materials = await Material.find(filter)
      .populate("seller", "name phone isApproved")
      .sort({ createdAt: -1 })
      .limit(50);

    console.log("Materials fetched:", materials.length, "with filter:", JSON.stringify(filter));
    if (materials.length > 0) {
      console.log("First material status:", materials[0].status, "isVerified:", materials[0].isVerified);
    }
    res.json(materials);
  } catch (error) {
    console.error("❌ Get approved materials error:", error);
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

// ============ ADMIN — APPROVE MATERIAL ============
export const approveMaterial = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }
    const material = await Material.findByIdAndUpdate(
      req.params.id,
      // ✅ FIXED: status is now "approved" to match the Material model enum
      { status: "approved", isVerified: true },
      { new: true }
    ).populate("seller", "email");
    if (!material) return res.status(404).json({ error: "Material not found" });
    await sendMaterialApprovalEmail(material.seller.email, material.title);
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