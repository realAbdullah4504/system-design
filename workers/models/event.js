import mongoose from "mongoose";

const eventSchema = new mongoose.Schema({
    type: { type: String, required: true },
    payload: { type: Object, required: true },
    receivedAt: { type: Date, default: Date.now },
});

export default mongoose.model("Event", eventSchema);
