const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
    type: { type: String, required: true },
    payload: { type: Object, required: true },
    receivedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Event", eventSchema);
