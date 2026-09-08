import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import {
    generateAIResponse
} from "./ai.js";

import {
    createInitialState
} from "./appointmentState.js";


// ========================================
// ENVIRONMENT
// ========================================

dotenv.config();


// ========================================
// EXPRESS APP
// ========================================

const app = express();

const PORT =
    process.env.PORT || 3000;


// ========================================
// PATH CONFIGURATION
// ========================================

const __filename =
    fileURLToPath(import.meta.url);

const __dirname =
    path.dirname(__filename);


// ========================================
// MIDDLEWARE
// ========================================

app.use(
    express.json()
);


// ========================================
// FRONTEND
// ========================================

app.use(
    express.static(
        path.join(
            __dirname,
            "../public"
        )
    )
);


// ========================================
// HEALTH CHECK
// ========================================

app.get(
    "/api/health",
    (req, res) => {

        res.json({

            status:
                "online",

            service:
                "AI Voicebot"

        });

    }
);


// ========================================
// CHAT API
// ========================================

app.post(
    "/api/chat",
    async (req, res) => {

        try {

            const {
                message,
                history = [],
                state = null
            } = req.body;


            // ----------------------------
            // VALIDATE MESSAGE
            // ----------------------------

            if (
                !message ||
                typeof message !== "string" ||
                !message.trim()
            ) {

                return res.status(400).json({

                    success:
                        false,

                    error:
                        "Message is required"

                });

            }


            // ----------------------------
            // INITIALIZE STATE
            // ----------------------------

            const currentState =
                state ||
                createInitialState();


            console.log("");

            console.log(
                "========================================"
            );

            console.log(
                "USER:",
                message
            );

            console.log(
                "CURRENT STATE:",
                currentState.state
            );


            // ----------------------------
            // AI RESPONSE
            // ----------------------------

            const result =
                await generateAIResponse(

                    message,

                    history,

                    currentState

                );


            console.log(
                "BOT:",
                result.response
            );

            console.log(
                "NEW STATE:",
                result.state.state
            );

            console.log(
                "DATE:",
                result.state.date
            );

            console.log(
                "TIME:",
                result.state.time
            );

            console.log(
                "========================================"
            );

            console.log("");


            // ----------------------------
            // RESPONSE
            // ----------------------------

            console.log(
                "FINAL API RESULT:",
                JSON.stringify(
                    result,
                    null,
                    2
                )
            );

            return res.json({

                success:
                    true,

                response:
                    result.response,

                state:
                    result.state,

                transfer:
                     result.transfer || null,

                ended:
                     result.ended || false

            });

        } catch (error) {

            console.error(
                "SERVER CHAT ERROR:",
                error
            );


            return res.status(500).json({

                success:
                    false,

                error:
                    "Sorry, I encountered a problem. Please try again."

            });

        }

    }
);


// ========================================
// ROOT ROUTE
// ========================================

app.get(
    "/",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "../public/index.html"
            )
        );

    }
);

import {
    bookAppointment,
    getAppointment,
    cancelAppointment,
    rescheduleAppointment
} from "./appointmentService.js";


// ========================================
// APPOINTMENT API
// ========================================

// CREATE APPOINTMENT
app.post(
    "/api/appointments",
    async (req, res) => {

        try {

            const {
                name,
                phone,
                reason,
                date,
                time
            } = req.body;


            const result =
                await bookAppointment({

                    date,
                    time,

                    customerName:
                        name,

                    customerPhone:
                        phone,

                    reason

                });


            if (!result.success) {

                return res.status(400).json(
                    result
                );

            }


            return res.status(201).json({

                success:
                    true,

                appointment:
                    result.appointment

            });

        } catch (error) {

            console.error(
                "CREATE APPOINTMENT ERROR:",
                error
            );


            return res.status(500).json({

                success:
                    false,

                error:
                    "Unable to create appointment."

            });

        }

    }
);


// ========================================
// GET APPOINTMENT
// ========================================

app.get(
    "/api/appointments/:confirmationNumber",
    async (req, res) => {

        try {

            const {
                confirmationNumber
            } = req.params;


            const appointment =
                await getAppointment(
                    confirmationNumber
                );


            if (!appointment) {

                return res.status(404).json({

                    success:
                        false,

                    error:
                        "Appointment not found."

                });

            }


            return res.json({

                success:
                    true,

                appointment

            });

        } catch (error) {

            console.error(
                "GET APPOINTMENT ERROR:",
                error
            );


            return res.status(500).json({

                success:
                    false,

                error:
                    "Unable to find appointment."

            });

        }

    }
);


// ========================================
// CANCEL APPOINTMENT
// ========================================

app.delete(
    "/api/appointments/:confirmationNumber",
    async (req, res) => {

        try {

            const {
                confirmationNumber
            } = req.params;


            const result =
                await cancelAppointment(
                    confirmationNumber
                );


            if (!result.success) {

                return res.status(400).json(
                    result
                );

            }


            return res.json({

                success:
                    true,

                appointment:
                    result.appointment

            });

        } catch (error) {

            console.error(
                "CANCEL APPOINTMENT ERROR:",
                error
            );


            return res.status(500).json({

                success:
                    false,

                error:
                    "Unable to cancel appointment."

            });

        }

    }
);


// ========================================
// START SERVER
// ========================================

app.listen(
    PORT,
    () => {

        console.log("");

        console.log(
            "========================================"
        );

        console.log(
            "       NOVACARE AI VOICEBOT"
        );

        console.log(
            "========================================"
        );

        console.log("");

        console.log(
            `Server: http://localhost:${PORT}`
        );

        console.log("");

        console.log(
            `Health: http://localhost:${PORT}/api/health`
        );

        console.log("");

        console.log(
            "========================================"
        );

        console.log("");

    }
);