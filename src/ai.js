import dotenv from "dotenv";
import OpenAI from "openai";

import {
    processAppointmentMessage
} from "./appointmentState.js";

import {
    translateText,
    translateToEnglish
} from "./translationService.js";

dotenv.config();


// ========================================
// OPENAI CONFIGURATION
// ========================================

const apiKey =
    process.env.OPENAI_API_KEY;

const MODEL =
    process.env.OPENAI_MODEL || "gpt-5.1";


console.log(
    "OpenAI API Key loaded:",
    apiKey ? "YES" : "NO"
);


const openai =
    apiKey
        ? new OpenAI({
            apiKey
        })
        : null;


// ========================================
// SYSTEM PROMPT
// ========================================

const SYSTEM_PROMPT = `
You are Nova, a professional AI appointment assistant for NovaCare.

You help customers with:

- Booking appointments
- Cancelling appointments
- Rescheduling appointments
- General NovaCare questions

Rules:

1. Keep responses short.
2. Speak naturally.
3. Ask only one question at a time.
4. Never invent information.
5. Never invent appointment availability.
6. Never claim an appointment was booked unless the appointment service confirms it.
7. Never claim an appointment was cancelled unless the appointment service confirms it.
8. Never claim an appointment was rescheduled unless the appointment service confirms it.
9. Keep responses suitable for voice.
10. Do not expose internal errors or technical details.
`;


// ========================================
// TEXT NORMALIZATION
// ========================================

function normalizeText(message) {

    return String(message || "")
        .toLowerCase()
        .trim()
        .replace(/[?!.,]/g, "")
        .replace(/\s+/g, " ");

}


// ========================================
// GENERAL INFORMATION
// ========================================

function getGeneralInformationResponse(message) {

    const text =
        normalizeText(message);


    // ====================================
    // SERVICES
    // ====================================

    if (

        text.includes(
            "what services do you provide"
        ) ||

        text.includes(
            "what services do you offer"
        ) ||

        text === "what services" ||

        text.includes(
            "what can you do"
        ) ||

        text.includes(
            "what do you offer"
        ) ||

        text.includes(
            "how can you help"
        )

    ) {

        return (
            "I can help you book, cancel, or reschedule appointments, and I can answer general questions about NovaCare."
        );

    }


    // ====================================
    // BOOKING INFORMATION
    // ====================================

    if (

        text.includes(
            "how does appointment booking work"
        ) ||

        text.includes(
            "how does booking work"
        ) ||

        text.includes(
            "how do appointments work"
        ) ||

        text.includes(
            "explain appointment booking"
        ) ||

        text.includes(
            "explain the booking process"
        ) ||

        text.includes(
            "explain appointment process"
        ) ||

        text.includes(
            "what is the booking process"
        ) ||

        text.includes(
            "what is appointment booking"
        ) ||

        text.includes(
            "appointment booking process"
        ) ||

        text.includes(
            "booking process"
        ) ||

        text.includes(
            "how to book an appointment"
        ) ||

        text.includes(
            "how can i book an appointment"
        ) ||

        text.includes(
            "what information do i need to book"
        ) ||

        text.includes(
            "what information do i need for an appointment"
        )

    ) {

        return (
            "To book an appointment, I'll ask for your name, phone number, reason for the appointment, preferred date, and preferred time. I'll then check availability and ask you to confirm before booking."
        );

    }


    // ====================================
    // CANCELLATION INFORMATION
    // ====================================

    if (

        text.includes(
            "how do i cancel an appointment"
        ) ||

        text.includes(
            "how can i cancel an appointment"
        ) ||

        text.includes(
            "how does cancellation work"
        ) ||

        text.includes(
            "how to cancel an appointment"
        )

    ) {

        return (
            "To cancel an appointment, I'll ask for your confirmation number, find the appointment, and ask you to confirm the cancellation."
        );

    }


    // ====================================
    // RESCHEDULING INFORMATION
    // ====================================

    if (

        text.includes(
            "how do i reschedule an appointment"
        ) ||

        text.includes(
            "how can i reschedule an appointment"
        ) ||

        text.includes(
            "how does rescheduling work"
        ) ||

        text.includes(
            "how to reschedule an appointment"
        )

    ) {

        return (
            "To reschedule an appointment, I'll ask for your confirmation number, check the existing appointment, and help you select a new available date and time."
        );

    }


    return null;

}


// ========================================
// CLOSING
// ========================================

function isClosingMessage(message) {

    const text =
        normalizeText(message);


    return (

        text === "thanks" ||
        text === "thank you" ||
        text === "thanks nova" ||
        text === "thank you nova" ||
        text === "thanks a lot" ||
        text === "thank you so much" ||
        text === "great thanks" ||
        text === "perfect thanks" ||
        text === "no thanks" ||
        text === "no thank you" ||
        text === "no need" ||
        text === "nothing else" ||
        text === "nothing" ||
        text === "all good" ||
        text === "thats all" ||
        text === "that's all" ||
        text === "that is all" ||
        text === "thats it" ||
        text === "that's it" ||
        text === "that is it"

    );

}


// ========================================
// GOODBYE
// ========================================

function isGoodbye(message) {

    const text =
        normalizeText(message);


    return (

        text === "bye" ||
        text === "goodbye" ||
        text === "bye nova" ||
        text === "goodbye nova" ||
        text === "see you" ||
        text === "see you later"

    );

}


// ========================================
// OPENAI ERROR CLASSIFICATION
// ========================================

function classifyOpenAIError(error) {

    const status =
        error?.status;

    const message =
        String(
            error?.message || ""
        ).toLowerCase();


    // ====================================
    // RATE LIMIT / NO CREDITS
    // ====================================

    if (
        status === 429 ||
        message.includes("429") ||
        message.includes("no credits") ||
        message.includes("quota") ||
        message.includes("rate limit")
    ) {

        return "RATE_LIMIT";

    }


    // ====================================
    // AUTHENTICATION
    // ====================================

    if (
        status === 401 ||
        message.includes("invalid api key") ||
        message.includes("authentication")
    ) {

        return "AUTHENTICATION";

    }


    // ====================================
    // SERVER ERROR
    // ====================================

    if (
        status >= 500
    ) {

        return "PROVIDER_ERROR";

    }


    // ====================================
    // NETWORK
    // ====================================

    if (
        message.includes("network") ||
        message.includes("timeout") ||
        message.includes("timed out") ||
        message.includes("fetch failed")
    ) {

        return "NETWORK_ERROR";

    }


    return "UNKNOWN";

}


// ========================================
// OPENAI RESPONSE
// ========================================

async function generateOpenAIResponse(
    message,
    history = [],
    state = null
) {

    // ====================================
    // NO CLIENT
    // ====================================

    if (!openai) {

        console.warn(
            "OPENAI_UNAVAILABLE: API client not configured"
        );

        return {

            success: false,

            type:
                "CONFIGURATION",

            response:
                null

        };

    }


    try {

        const conversationHistory =
            Array.isArray(history)
                ? history
                    .slice(-10)
                    .filter(item =>
                        item &&
                        (
                            item.role === "user" ||
                            item.role === "assistant"
                        ) &&
                        typeof item.content === "string" &&
                        item.content.trim()
                    )
                    .map(item => ({

                        role:
                            item.role,

                        content:
                            item.content.trim()

                    }))
                : [];


        const appointmentContext = {

            state:
                state?.state || "IDLE",

            name:
                state?.name ||
                state?.customerName ||
                null,

            phone:
                state?.phone ||
                state?.customerPhone ||
                null,

            reason:
                state?.reason || null,

            date:
                state?.date || null,

            time:
                state?.time || null

        };


        const instructions = `
${SYSTEM_PROMPT}

Current appointment context:

${JSON.stringify(
    appointmentContext,
    null,
    2
)}
`;


        const response =
            await openai.responses.create({

                model:
                    MODEL,

                instructions,

                input: [

                    ...conversationHistory,

                    {
                        role: "user",
                        content: message
                    }

                ]

            });


        if (
            !response ||
            !response.output_text
        ) {

            return {

                success: false,

                type:
                    "EMPTY_RESPONSE",

                response:
                    null

            };

        }


        return {

            success: true,

            type:
                "SUCCESS",

            response:
                response.output_text.trim()

        };

    } catch (error) {

        const errorType =
            classifyOpenAIError(
                error
            );


        console.error(
            "OPENAI_PROVIDER_ERROR:",
            {

                type:
                    errorType,

                status:
                    error?.status || null,

                message:
                    error?.message || "Unknown error"

            }
        );


        return {

            success: false,

            type:
                errorType,

            response:
                null

        };

    }

}


// ========================================
// OPENAI FALLBACK
// ========================================

function getAIUnavailableResponse(
    errorType
) {

    switch (errorType) {

        case "RATE_LIMIT":

            return (
                "I'm unable to answer that right now. I can still help you with booking, cancelling, or rescheduling an appointment."
            );


        case "AUTHENTICATION":

            return (
                "I'm unable to access my information service right now. I can still help you with appointments."
            );


        case "NETWORK_ERROR":

            return (
                "I'm having trouble connecting right now. I can still help you with your appointment."
            );


        case "PROVIDER_ERROR":

            return (
                "My information service is temporarily unavailable. I can still help you with appointments."
            );


        case "CONFIGURATION":

            return (
                "My information service isn't available right now. I can still help you with appointments."
            );


        default:

            return (
                "I'm unable to answer that right now. I can still help you with your appointment."
            );

    }

}


// ========================================
// TRANSLATE INBOUND MESSAGE
// ========================================
//
// Only translates when a non-English language
// has already been explicitly selected for this
// call. Before that (e.g. during the language
// picker turn itself), messages pass through
// untouched.
// ========================================

async function translateInboundMessage(
    message,
    currentState
) {

    const sourceLanguage =
        currentState?.language;

    const languageSelected =
        currentState?.languageSelected;


    if (
        !languageSelected ||
        !sourceLanguage ||
        sourceLanguage === "en"
    ) {
        return message;
    }


    return await translateToEnglish(
        message,
        sourceLanguage
    );

}


// ========================================
// MAIN AI FUNCTION
// ========================================

export async function generateAIResponse(
    message,
    history = [],
    state = null
) {

    // ====================================
    // VALIDATE
    // ====================================

    if (
        !message ||
        typeof message !== "string" ||
        !message.trim()
    ) {

        return {

            response:
                "How can I help you?",

            state

        };

    }


    try {

        const cleanMessage =
            message.trim();


        const currentState =
            state || {
                state: "IDLE"
            };


        const currentStateName =
            currentState.state ||
            "IDLE";


        console.log(
            "AI ROUTER:",
            cleanMessage
        );

        console.log(
            "CURRENT STATE:",
            currentStateName
        );


        // ========================================
        // 1. GENERAL QUESTIONS
        // ========================================

        if (
            currentStateName === "IDLE"
        ) {

            const generalResponse =
                getGeneralInformationResponse(
                    cleanMessage
                );


            if (
                generalResponse
            ) {

                console.log(
                    "ROUTER RESULT: GENERAL INFORMATION"
                );


                return {

                    response:
                        generalResponse,

                    state:
                        currentState

                };

            }


            // ====================================
            // CLOSING
            // ====================================

            if (
                isClosingMessage(
                    cleanMessage
                )
            ) {

                console.log(
                    "ROUTER RESULT: CLOSING"
                );


                return {

                    response:
                        "You're welcome. Have a great day!",

                    state:
                        currentState

                };

            }


            // ====================================
            // GOODBYE
            // ====================================

            if (
                isGoodbye(
                    cleanMessage
                )
            ) {

                console.log(
                    "ROUTER RESULT: GOODBYE"
                );


                return {

                    response:
                        "Goodbye! Have a great day.",

                    state:
                        currentState

                };

            }

        }


        // ========================================
        // 2. APPOINTMENT STATE MACHINE
        // ========================================

        console.log(
            "ROUTING TO APPOINTMENT STATE:",
            cleanMessage
        );


        const appointmentResult =
            await processAppointmentMessage(
                currentState,
                await translateInboundMessage(
                    cleanMessage,
                    currentState
                )
            );


        const newState =
            appointmentResult?.state ||
            currentState;


        const appointmentResponse =
            appointmentResult?.response;


        // ========================================
        // IMPORTANT APPOINTMENT RESULT HANDLING
        // ========================================
        //
        // DO NOT check only:
        //
        // newState.state !== "IDLE"
        //
        // because a completed appointment operation
        // can intentionally return to IDLE.
        //
        // Example:
        //
        // CONFIRM_CANCELLATION
        //       ↓
        // appointmentService.cancelAppointment()
        //       ↓
        // SUCCESS
        //       ↓
        // state = IDLE
        //
        // The previous code would ignore the successful
        // response and continue to OpenAI.
        //
        // This caused:
        //
        // "I'm unable to answer that right now..."
        //
        // even though the appointment was actually
        // CANCELLED.
        //


        if (
            typeof appointmentResponse === "string" &&
            appointmentResponse.trim()
        ) {

            console.log(
                "ROUTER RESULT: APPOINTMENT RESPONSE"
            );

            console.log(
                "APPOINTMENT RESPONSE:",
                appointmentResponse
            );

            console.log(
                "APPOINTMENT NEW STATE:",
                newState?.state
            );


            return {

                response:
                    await translateText(
                        appointmentResponse.trim(),
                        newState?.language
                    ),

                state:
                    newState,

                transfer:
                    appointmentResult?.transfer || null,

                ended:
                    appointmentResult?.ended || false

            };

        }


        // ========================================
        // 3. OPENAI
        // ========================================

        console.log(
            "ROUTING TO OPENAI"
        );


        const aiResult =
            await generateOpenAIResponse(
                cleanMessage,
                history,
                newState
            );


        // ========================================
        // OPENAI SUCCESS
        // ========================================

        if (
            aiResult.success &&
            aiResult.response
        ) {

            console.log(
                "OPENAI RESULT: SUCCESS"
            );


            return {

                response:
                    aiResult.response,

                state:
                    newState

            };

        }


        // ========================================
        // OPENAI FAILURE
        // ========================================

        console.warn(
            "OPENAI RESULT: FALLBACK",
            aiResult.type
        );


        return {

            response:
                getAIUnavailableResponse(
                    aiResult.type
                ),

            state:
                newState

        };

    } catch (error) {

        // ========================================
        // FINAL SAFETY NET
        // ========================================

        console.error(
            "AI UNEXPECTED ERROR:",
            error
        );


        return {

            response:
                "I'm having a temporary problem. I can still help you with an appointment.",

            state

        };

    }

}