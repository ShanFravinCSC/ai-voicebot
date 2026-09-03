// src/transferService.js

import { randomUUID } from "crypto";

/**
 * Human Agent Transfer Service
 *
 * Provider-independent service layer.
 *
 * For the current interview demo we use Jitsi.
 * A production implementation could replace the Jitsi
 * adapter with Twilio, SIP, a contact-center platform, etc.
 */

export async function transferToAgent({
    reason = "Customer requested human agent",
    customerName = null,
    customerPhone = null,
    appointmentId = null
} = {}) {

    const transferId = randomUUID();

    const roomName = `novacare-support-${transferId}`;

    const roomUrl = `https://meet.jit.si/${roomName}`;

    console.log("\n=================================");
    console.log("HUMAN AGENT TRANSFER");
    console.log("=================================");
    console.log("Transfer ID:", transferId);
    console.log("Reason:", reason);
    console.log("Customer:", customerName || "Unknown");
    console.log("Phone:", customerPhone || "Unknown");
    console.log("Appointment:", appointmentId || "None");
    console.log("Provider: Jitsi");
    console.log("Room:", roomName);
    console.log("=================================\n");

    return {
        success: true,

        transferId,

        provider: "jitsi",

        status: "TRANSFER_READY",

        reason,

        roomName,

        roomUrl
    };
}

