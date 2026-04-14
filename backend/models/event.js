import mongoose from "mongoose";

const eventSchema = new mongoose.Schema({
    type: { type: String, required: true },
    payload: { type: Object, required: true },
    sessionId: { type: String, required: false },
    sessionContext: {
        user: {
            id: { type: String, required: false },
            name: { type: String, required: false },
            email: { type: String, required: false }
        },
        timestamp: { type: String, required: false }
    },
    receivedAt: { type: Date, default: Date.now },
});

export default mongoose.model("Event", eventSchema);
