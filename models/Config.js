import mongoose from "mongoose";

const configSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  description: {
    type: String,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Static method to get a single config value
configSchema.statics.getConfig = async function(key) {
  const config = await this.findOne({ key });
  return config ? config.value : null;
};

// Static method to set a config value
configSchema.statics.setConfig = async function(key, value, description = "") {
  const config = await this.findOneAndUpdate(
    { key },
    { value, description, updatedAt: new Date() },
    { upsert: true, new: true }
  );
  return config;
};

// Static method to get all configs
configSchema.statics.getAllConfigs = async function() {
  const configs = await this.find({});
  const result = {};
  configs.forEach(config => {
    result[config.key] = config.value;
  });
  return result;
};

export default mongoose.model("Config", configSchema, "configs");
