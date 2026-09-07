// ========================================
// NOVACARE APPOINTMENT STATE MACHINE
// ========================================
//
// Conversation flow layer.
//
// Handles:
// - Booking
// - Customer information
// - Date/time collection
// - Availability
// - Confirmation
// - Cancellation
// - Rescheduling
// - Human agent
//
// Business logic stays inside:
// appointmentService.js
// ========================================


import {
    checkAvailability,
    getAlternativeSlots,
    bookAppointment,
    getAppointment,
    cancelAppointment,
    rescheduleAppointment,
    validateAppointmentDate,
    formatDateForSpeech,
    formatTimeForSpeech
} from "./appointmentService.js";


import { transferToAgent } from "./transferService.js";

// ========================================
// STATES
// ========================================

export const STATES = {

    IDLE:
        "IDLE",

    COLLECTING_NAME:
        "COLLECTING_NAME",

    COLLECTING_PHONE:
        "COLLECTING_PHONE",

    COLLECTING_REASON:
        "COLLECTING_REASON",

    COLLECTING_DATE:
        "COLLECTING_DATE",

    COLLECTING_TIME:
        "COLLECTING_TIME",

    CONFIRMING:
        "CONFIRMING",

    BOOKED:
        "BOOKED",

    CANCELLING:
        "CANCELLING",

    CANCELLING_CONFIRM:
        "CANCELLING_CONFIRM",

    RESCHEDULING:
        "RESCHEDULING",

    RESCHEDULE_DATE:
        "RESCHEDULE_DATE",

    RESCHEDULE_TIME:
        "RESCHEDULE_TIME",

    RESCHEDULE_CONFIRM:
        "RESCHEDULE_CONFIRM",

    HUMAN_AGENT:
        "HUMAN_AGENT"

};


// ========================================
// INITIAL STATE
// ========================================

export function createInitialState() {

    return {

        state:
            STATES.IDLE,

        intent:
            null,

        customerName:
            null,

        customerPhone:
            null,

        reason:
            null,

        date:
            null,

        time:
            null,

        confirmed:
            false,

        appointmentId:
            null
    };
}


// ========================================
// NORMALIZE TEXT
// ========================================

function normalizeText(text) {

    return String(text)
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ");

}


// ========================================
// VOICE NORMALIZATION
// ========================================

function normalizeVoiceText(text) {

    let value =
        normalizeText(text);

    // Remove common speech fillers
    value = value
        .replace(/^(um|umm|uh|uhh|erm|hmm)\s+/i, "")
        .replace(/^(well|so)\s+/i, "");

    return value.trim();
}




// ========================================
// INTENT DETECTION
// ========================================

export function detectIntent(message) {

    const text =
        normalizeVoiceText(message);


    // ====================================
    // HUMAN AGENT
    // ====================================

    if (
        text.includes("human") ||
        text.includes("agent") ||
        text.includes("representative") ||
        text.includes("real person") ||
        text === "person"
    ) {

        return "HUMAN_AGENT";

    }


    // ====================================
    // CANCEL
    // ====================================

    if (
        text.includes("cancel my appointment") ||
        text.includes("cancel appointment") ||
        text.includes("cancel the appointment") ||
        text.includes("cancel an appointment") ||
        text.includes("i want to cancel") ||
        text.includes("i need to cancel") ||
        text.includes("can i cancel") ||
        text.includes("could i cancel") ||
        text === "cancel" ||
        text === "cancellation"
    ) {

        return "CANCEL";

    }


    // ====================================
    // RESCHEDULE
    // ====================================

    if (
        text.includes("reschedule") ||
        text.includes("rescheduling") ||
        text.includes("change my appointment") ||
        text.includes("change appointment") ||
        text.includes("move my appointment") ||
        text.includes("move appointment")
    ) {

        return "RESCHEDULE";

    }


    // ====================================
// YES / CONFIRMATION
// ====================================

const yesPatterns = [
    /^yes$/,
    /^yeah$/,
    /^yep$/,
    /^yup$/,
    /^sure$/,
    /^confirm$/,
    /^confirmed$/,
    /^okay$/,
    /^ok$/,
    /^go ahead$/,
    /^yes please$/,
    /^please do$/,

    // Voice-friendly confirmations
    /^yes\s+(confirm|confirmed|proceed|continue|please|go ahead).*$/,
    /^yeah\s+(confirm|confirmed|proceed|continue|please|go ahead).*$/,
    /^yep\s+(confirm|confirmed|proceed|continue|please|go ahead).*$/,
    /^sure\s+(confirm|confirmed|proceed|continue|please|go ahead).*$/,
    /^okay\s+(confirm|confirmed|proceed|continue|please|go ahead).*$/,
    /^ok\s+(confirm|confirmed|proceed|continue|please|go ahead).*$/,

    // Natural spoken confirmations
    /^yes.*go ahead.*$/,
    /^yes.*proceed.*$/,
    /^yes.*continue.*$/,
    /^yes.*confirm.*$/,
    /^yes.*that's fine.*$/,
    /^yes.*that is fine.*$/,
    /^yes.*sounds good.*$/,
    /^yes.*do it.*$/,
    /^yes.*book it.*$/,
    /^yes.*please.*$/,

    /^yeah.*go ahead.*$/,
    /^yeah.*proceed.*$/,
    /^yeah.*continue.*$/,
    /^sure.*go ahead.*$/,
    /^sure.*proceed.*$/,
    /^okay.*go ahead.*$/,
    /^okay.*proceed.*$/,

    // Speech recognition may prepend filler words
    /^(hello|hi|hey)\s+(yes|yeah|yep|yup).*$/,
    /^(well|so|okay|ok)\s+(yes|yeah|yep|yup).*$/,
];

if (
    yesPatterns.some(pattern =>
        pattern.test(text)
    )
) {
    return "YES";
}



// ====================================
// NO / REJECTION
// ====================================

const noPatterns = [
    /^no$/,
    /^nope$/,
    /^nah$/,
    /^no thanks$/,
    /^no thank you$/,
    /^not now$/,
    /^never mind$/,
    /^nevermind$/,
    /^forget it$/,
    /^don't$/,
    /^do not$/,

    // Natural spoken rejection
    /^no.*change.*$/,
    /^no.*different.*$/,
    /^no.*not.*$/,
    /^no.*cancel.*$/,
    /^no.*keep.*$/,
    /^no.*want.*$/,
    /^no.*thanks.*$/,

    /^don't.*book.*$/,
    /^do not.*book.*$/,
    /^i don't want.*$/,
    /^i do not want.*$/,
    /^i'd rather not.*$/,
];

if (
    noPatterns.some(pattern =>
        pattern.test(text)
    )
) {
    return "NO";
}


// ====================================
// CANCEL CURRENT CONVERSATION FLOW
// ====================================

const cancelPatterns = [
     /^cancel$/,
    /^cancel it$/,
    /^cancel this$/,
    /^no need$/,
    /^cancel appointment$/,
    /^cancel my appointment$/,
    /^i want to cancel$/,
    /^i want to cancel it$/,
    /^i want to cancel my appointment$/,
    /^can i cancel.*$/,
    /^could i cancel.*$/,
    /^i need to cancel.*$/,
    /^i need cancel.*$/,
    /^i'd like to cancel.*$/,
    /^i would like to cancel.*$/,
    /^i want my appointment cancelled.*$/,
    /^please cancel.*$/,
    /^cancel the appointment.*$/,
    /^cancel this appointment.*$/,
    /^cancel my booking.*$/,
    /^cancel the booking.*$/,
    /^i want to cancel the booking.*$/,
    /^actually.*cancel.*$/,
    /^can you cancel.*$/,
    /^can you please cancel.*$/,
    /^please cancel my appointment.*$/,
    /^i don't need the appointment.*$/,
    /^i no longer need the appointment.*$/,
];

if (
    cancelPatterns.some(pattern =>
        pattern.test(text)
    )
) {
    return "CANCEL";
}


    // ====================================
    // BOOK
    // ====================================
    //
    // IMPORTANT:
    // Do NOT treat every mention of
    // "appointment" as a booking request.
    //
    // Example:
    //
    // "How does appointment booking work?"
    // "What information do I need for an appointment?"
    // "How do appointments work?"
    //
    // These are information questions,
    // NOT booking requests.
    //

    const bookingRequest =
        text.includes("book an appointment") ||
        text.includes("book appointment") ||
        text.includes("want to book") ||
        text.includes("need to book") ||
        text.includes("like to book") ||
        text.includes("would like to book") ||
        text.includes("please book") ||
        text.includes("book me") ||
        text.includes("make an appointment") ||
        text.includes("schedule an appointment") ||
        text.includes("schedule appointment") ||
        text.includes("schedule me") ||
        text.includes("need an appointment") ||
        text.includes("want an appointment") ||
        text.includes("would like an appointment") ||
        text.includes("i need to schedule") ||
        text.includes("i want to schedule");


    if (bookingRequest) {

        return "BOOK";

    }


        return "UNKNOWN";

    }


// ========================================
// EXTRACT DATE
// ========================================

export function extractDate(message) {

    const text =
        normalizeText(message);


    // ====================================
    // DAY AFTER TOMORROW
    // ====================================

    if (
        text.includes("day after tomorrow")
    ) {

        return "day after tomorrow";

    }


    // ====================================
    // TODAY
    // ====================================

    if (
        /\btoday\b/.test(text)
    ) {

        return "today";

    }


    // ====================================
    // TOMORROW
    // ====================================

    if (
        /\btomorrow\b/.test(text)
    ) {

        return "tomorrow";

    }


    // ====================================
    // NEXT WEEKDAY
    // ====================================

    const nextDay =
        text.match(
            /\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/
        );


    if (nextDay) {

        return nextDay[0];

    }


    // ====================================
    // WEEKDAY
    // ====================================

    const days = [

        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday"

    ];


    for (
        const day of days
    ) {

        if (
            new RegExp(
                `\\b${day}\\b`
            ).test(text)
        ) {

            return day;

        }

    }


    // ====================================
    // YYYY-MM-DD
    // ====================================

    const isoMatch =
        text.match(
            /\b\d{4}-\d{2}-\d{2}\b/
        );


    if (isoMatch) {

        return isoMatch[0];

    }


    // ====================================
    // DD/MM/YYYY
    // ====================================

    const fullDate =
        text.match(
            /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}\b/
        );


    if (fullDate) {

        return fullDate[0];

    }


    // ====================================
    // DD/MM
    // ====================================

    const shortDate =
        text.match(
            /\b\d{1,2}[\/\-]\d{1,2}\b/
        );


    if (shortDate) {

        return shortDate[0];

    }


    // ====================================
    // AUGUST 31
    // ====================================

    const monthDate =
        text.match(
            /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?(?:\s+\d{4})?\b/
        );


    if (monthDate) {

        return monthDate[0];

    }


    // ====================================
    // 31 AUGUST
    // ====================================

    const dateMonth =
        text.match(
            /\b\d{1,2}(?:st|nd|rd|th)?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+\d{4})?\b/
        );


    if (dateMonth) {

        return dateMonth[0];

    }


    return null;

}


// ====================================
// EXTRACT TIME
// ====================================

export function extractTime(message) {

    let text =
        normalizeText(message);

    // ------------------------------------
    // NORMALIZE SPOKEN AM / PM
    // ------------------------------------

    text = text
        .replace(/\ba\.m\.\b/gi, "am")
        .replace(/\bp\.m\.\b/gi, "pm")
        .replace(/\ba\.m\b/gi, "am")
        .replace(/\bp\.m\b/gi, "pm")
        .replace(/\ba m\b/gi, "am")
        .replace(/\bp m\b/gi, "pm");

    // ====================================
    // AM / PM
    //
    // Examples:
    // 10 am
    // 10 a.m.
    // 10 a m
    // 10:00 am
    // 10.00 am
    // 10 pm
    // ====================================

    const timeMatch =
        text.match(
            /\b(\d{1,2})(?:[:.](\d{1,2}))?\s*(am|pm)\b/i
        );

    if (timeMatch) {

        const hour =
            timeMatch[1];

        const minute =
            timeMatch[2] || "00";

        const period =
            timeMatch[3].toUpperCase();

        return `${hour}:${minute} ${period}`;
    }

    // ====================================
    // 24 HOUR
    //
    // Examples:
    // 10:00
    // 14:30
    // ====================================

    const twentyFour =
        text.match(
            /\b([01]?\d|2[0-3]):([0-5]\d)\b/
        );

    if (twentyFour) {
        return twentyFour[0];
    }

    // ====================================
    // HOUR ONLY
    //
    // Example:
    // "10"
    //
    // IMPORTANT:
    // Don't automatically assume AM here.
    // The system should ask for AM/PM when
    // the hour is ambiguous.
    // ====================================

    const hourOnly =
        text.match(
            /\b(9|10|11|12)\b/
        );

    if (hourOnly) {
        return `${hourOnly[1]}:00`;
    }

    return null;
}

// ========================================
// EXTRACT PHONE
// ========================================

function extractPhone(message) {

    const digits =
        String(message)
            .replace(/\D/g, "");


    if (
        digits.length < 7 ||
        digits.length > 15
    ) {

        return null;

    }


    return digits;

}


// ========================================
// EXTRACT APPOINTMENT ID
// ========================================

function extractAppointmentId(message) {

    let text = String(message)
        .trim()
        .toUpperCase();

    // ----------------------------------------
    // NORMALIZE VOICE TRANSCRIPT
    // ----------------------------------------

    text = text
        .replace(/\bDASH\b/g, "-")
        .replace(/\bHYPHEN\b/g, "-")
        .replace(/\bSPACE\b/g, " ")
        .replace(/\bZERO\b/g, "0")
        .replace(/\bOH\b/g, "0")
        .replace(/\bONE\b/g, "1")
        .replace(/\bTWO\b/g, "2")
        .replace(/\bTHREE\b/g, "3")
        .replace(/\bFOUR\b/g, "4")
        .replace(/\bFIVE\b/g, "5")
        .replace(/\bSIX\b/g, "6")
        .replace(/\bSEVEN\b/g, "7")
        .replace(/\bEIGHT\b/g, "8")
        .replace(/\bNINE\b/g, "9")
        .replace(/[.,]/g, " ")
        .replace(/\s+/g, " ")
        .trim();


    // ----------------------------------------
    // SHORT CUSTOMER FORMAT
    // NC01 / NC 01 / N C 01
    // N C zero one / N C oh one
    // ----------------------------------------

    const shortMatch =
        text.match(/\bN?\s*C\s*(\d{1,4})\b/);

    if (shortMatch) {

        return `NC${String(
            Number(shortMatch[1])
        ).padStart(2, "0")}`;
    }


    // ----------------------------------------
    // LEGACY FORMAT
    // NC-1788278322595-645
    // ----------------------------------------

    const standardMatch =
        text.match(
            /\bNC-\d+-\d+\b/
        );

    if (standardMatch) {
        return standardMatch[0];
    }


    // ----------------------------------------
    // LEGACY VOICE FORMAT
    // NC 1788278322595 645
    // ----------------------------------------

    const voiceMatch =
        text.match(
            /\bNC\s+(\d+)\s+(\d+)\b/
        );

    if (voiceMatch) {

        return `NC-${voiceMatch[1]}-${voiceMatch[2]}`;
    }


    // ----------------------------------------
    // LEGACY VOICE FORMAT WITH DASH
    // ----------------------------------------

    const dashMatch =
        text.match(
            /\bNC\s*-\s*(\d+)\s*-\s*(\d+)\b/
        );

    if (dashMatch) {

        return `NC-${dashMatch[1]}-${dashMatch[2]}`;
    }


    return null;
}


// ========================================
// RESET BOOKING DATA
// ========================================

function resetBookingData(state) {

    state.intent =
        null;

    state.customerName =
        null;

    state.customerPhone =
        null;

    state.reason =
        null;

    state.date =
        null;

    state.time =
        null;

    state.confirmed =
        false;

    state.appointmentId =
        null;

}


// ========================================
// PROCESS MESSAGE
// ========================================

export async function processAppointmentMessage(
    currentState,
    message
) {

    const state = {

        ...(currentState ||
            createInitialState())

    };


    const intent =
        detectIntent(message);


    const date =
        extractDate(message);


    const time =
        extractTime(message);

    // ====================================
    // CANCEL CURRENT CONVERSATION FLOW
    // ====================================
    //
    // Examples:
    // "no need"
    // "no need thanks"
    // "never mind"
    // "forget it"
    // "don't change it"
    //
    // This cancels the current booking,
    // cancellation, or rescheduling workflow
    // without cancelling an actual appointment.
    //



    // ====================================
// RESCHEDULE ABANDONMENT
// ====================================
//
// IMPORTANT:
// This must run BEFORE the global CANCEL flow.
//
// "no need" is also detected as a general
// cancellation request. But when the user is
// confirming a reschedule, "no need" should
// simply abandon the reschedule.
//
// The original appointment remains unchanged.
// ====================================

if (
    state.state === STATES.RESCHEDULE_CONFIRM
) {

    const abandonReschedulePatterns = [
        /^no need$/,
        /^no need for now$/,
        /^no need right now$/,
        /^no need thanks$/,
        /^no need thank you$/,
        /^not now$/,
        /^not for now$/,
        /^never mind$/,
        /^nevermind$/,
        /^forget it$/,
        /^forget about it$/,
        /^leave it$/,
        /^leave it for now$/,
        /^maybe later$/,
        /^later$/,
        /^i don't need it$/,
        /^i do not need it$/,
        /^i don't want to change it$/,
        /^i do not want to change it$/,
        /^don't change it$/,
        /^do not change it$/
    ];

    const normalizedMessage =
        String(message)
            .toLowerCase()
            .trim()
            .replace(/\s+/g, " ");

    if (
        abandonReschedulePatterns.some(
            pattern =>
                pattern.test(
                    normalizedMessage
                )
        )
    ) {

        // Clear only the pending
        // reschedule date/time.
        //
        // DO NOT cancel the original
        // appointment.

        state.date = null;
        state.time = null;

        state.state = STATES.IDLE;

        return {
            state,

            response:
                "No problem. The reschedule has been cancelled. Your original appointment remains unchanged. How else can I help you?"
        };
    }
}

    if (
        intent === "CANCEL_FLOW"
    ) {

        const activeFlow =
            state.state !== STATES.IDLE &&
            state.state !== STATES.BOOKED;

        if (
            activeFlow
        ) {

            resetBookingData(
                state
            );

            state.state =
                STATES.IDLE;

            return {

                state,

                response:
                    "No problem. I won't make any changes. How else can I help you?"

            };

        }

        // If already BOOKED, don't erase the
        // customer's existing appointment state.

        return {

            state,

            response:
                "No problem. Your appointment remains unchanged. How else can I help you?"

        };
    }


    // ====================================
    // HUMAN AGENT REQUEST
    // ====================================

    if (intent === "HUMAN_AGENT") {

        state.intent = "HUMAN_AGENT";

        state.state = STATES.HUMAN_AGENT;

        const transferResult = await transferToAgent({
            reason: "Customer requested human agent",
            customerName: state.customerName || null,
            customerPhone: state.customerPhone || null,
            appointmentId: state.appointmentId || null
        });

        // --------------------------------
        // TRANSFER FAILED
        // --------------------------------

        if (!transferResult.success) {

            state.state = STATES.IDLE;

            return {
                state,
                response:
                    "I'm sorry, I couldn't connect you with a human agent right now. Please try again later."
            };
        }

        // --------------------------------
        // TRANSFER READY
        // --------------------------------

        state.state = STATES.IDLE;

        return {
            state,

            response:
                "I'll connect you with a human agent now. Please use the support call button below.",

            transfer: transferResult
        };
}


// ====================================
// POLITE CLOSING
// ====================================

function isPoliteClosing(message) {
    const text = normalizeText(message);

    return (
        text === "thanks" ||
        text === "thank you" ||
        text === "thanks nova" ||
        text === "thank you nova" ||
        text === "great thanks" ||
        text === "that's all" ||
        text === "that is all" ||
        text === "all good" ||
        text === "okay thanks" ||
        text === "perfect thanks"
    );
}

// ====================================
// END CONVERSATION AFTER COMPLETION
// ====================================

if (
    isPoliteClosing(message) &&
    (
        state.state === STATES.BOOKED ||
        state.state === STATES.IDLE
    )
) {
    return {
        state,
        response:
            "You're welcome. Have a great day!"
    };
}


    // ====================================
    // CANCEL CURRENT BOOKING
    // ====================================

    if (
        intent === "NO" &&
        (
            state.state ===
                STATES.COLLECTING_NAME ||

            state.state ===
                STATES.COLLECTING_PHONE ||

            state.state ===
                STATES.COLLECTING_REASON ||

            state.state ===
                STATES.COLLECTING_DATE ||

            state.state ===
                STATES.COLLECTING_TIME
        )
    ) {

        resetBookingData(
            state
        );


        state.state =
            STATES.IDLE;


        return {

            state,

            response:
                "No problem. I won't book an appointment. How else can I help you?"

        };

    }


    // ====================================
    // GLOBAL CANCEL REQUEST
    // ====================================

    if (
        intent === "CANCEL"
    ) {

        // --------------------------------
        // USER IS CURRENTLY BOOKING
        // BUT HAS NOT CREATED AN
        // APPOINTMENT YET
        // --------------------------------

        const bookingInProgress =
            state.state === STATES.COLLECTING_NAME ||
            state.state === STATES.COLLECTING_PHONE ||
            state.state === STATES.COLLECTING_REASON ||
            state.state === STATES.COLLECTING_DATE ||
            state.state === STATES.COLLECTING_TIME ||
            state.state === STATES.CONFIRMING;


        if (
            bookingInProgress &&
            !state.appointmentId
        ) {

            resetBookingData(
                state
            );

            state.state =
                STATES.IDLE;

            return {

                state,

                response:
                    "You haven't booked this new appointment yet. I've stopped the booking. If you'd like to cancel an existing appointment, please provide its confirmation number."

            };

        }


        // --------------------------------
        // NORMAL EXISTING APPOINTMENT
        // CANCELLATION
        // --------------------------------

        state.intent =
            "CANCEL";

        state.state =
            STATES.CANCELLING;

        return {

            state,

            response:
                "Sure. Please provide your appointment confirmation number."

        };
    }


    // ====================================
    // GLOBAL RESCHEDULE REQUEST
    // ====================================

    if (
        intent === "RESCHEDULE"
    ) {

        state.intent =
            "RESCHEDULE";


        state.state =
            STATES.RESCHEDULING;


        return {

            state,

            response:
                "Sure. Please provide your appointment confirmation number."

        };

    }


    // ====================================
    // IDLE → BOOKING
    // ====================================

    if (
        state.state ===
            STATES.IDLE &&

        intent ===
            "BOOK"
    ) {

        resetBookingData(
            state
        );


        state.intent =
            "BOOK";


        state.state =
            STATES.COLLECTING_NAME;


        return {

            state,

            response:
                "Sure. May I have your name?"

        };

    }


    // ====================================
    // COLLECT NAME
    // ====================================

    if (
        state.state ===
        STATES.COLLECTING_NAME
    ) {

        const name =
            String(message)
                .trim();


        if (!name) {

            return {

                state,

                response:
                    "May I have your name?"

            };

        }


        if (
            detectIntent(message) ===
                "BOOK" ||

            detectIntent(message) ===
                "CANCEL" ||

            detectIntent(message) ===
                "RESCHEDULE"
        ) {

            return {

                state,

                response:
                    "Before we continue, may I have your name?"

            };

        }


        state.customerName =
            name;


        state.state =
            STATES.COLLECTING_PHONE;


        return {

            state,

            response:
                `Thanks, ${name}. What is your phone number?`

        };

    }


    // ====================================
    // COLLECT PHONE
    // ====================================

    if (
        state.state ===
        STATES.COLLECTING_PHONE
    ) {

        const phone =
            extractPhone(
                message
            );


        if (!phone) {

            return {

                state,

                response:
                    "I couldn't understand that phone number. Please say or enter your phone number again."

            };

        }


        state.customerPhone =
            phone;


        state.state =
            STATES.COLLECTING_REASON;


        return {

            state,

            response:
                "What is the reason for your appointment?"

        };

    }


    // ====================================
    // COLLECT REASON
    // ====================================

    if (
        state.state ===
        STATES.COLLECTING_REASON
    ) {

        const reason =
            String(message)
                .trim();


        if (!reason) {

            return {

                state,

                response:
                    "What is the reason for your appointment?"

            };

        }


        state.reason =
            reason;


        state.state =
            STATES.COLLECTING_DATE;


        return {

            state,

            response:
                "What date would you like the appointment?"

        };

    }


    // ========================================
// COLLECT DATE
// ========================================

if (
    state.state ===
    STATES.COLLECTING_DATE
) {

    if (!date) {

        return {

            state,

            response:
                "What date would you like the appointment?"

        };

    }


    const validation =
        validateAppointmentDate(
            date
        );


    if (
        !validation.valid
    ) {

        return {

            state,

            response:
                `${validation.reason} What date would you like instead?`

        };

    }


    state.date =
        validation.date;


    // --------------------------------
    // USER MAY HAVE GIVEN TIME TOO
    // --------------------------------

    if (time) {

        const availability =
            await checkAvailability(
                state.date,
                time
            );


        // ----------------------------
        // SLOT NOT AVAILABLE
        // ----------------------------

        if (
            !availability.available
        ) {

            const alternatives =
                await getAlternativeSlots(
                    state.date,
                    time,
                    3
                );


            let response =
                availability.reason ||
                "That time is not available.";


            if (
                alternatives.success &&
                alternatives.slots.length > 0
            ) {

                const slots =
                    alternatives.slots
                        .map(
                            slot =>
                                slot.display
                        )
                        .join(", ");


                response +=
                    ` I have ${slots} available. Which would you prefer?`;

            }


            state.state =
                STATES.COLLECTING_TIME;


            return {

                state,

                response

            };

        }


        // ----------------------------
        // SLOT AVAILABLE
        // ----------------------------

        state.date =
            availability.date;

        state.time =
            availability.time;


        state.state =
            STATES.CONFIRMING;


        return {

            state,

            response:
                `Your appointment is available on ${formatDateForSpeech(state.date)} at ${formatTimeForSpeech(state.time)}. Shall I confirm these details?`

        };

    }


    // --------------------------------
    // TIME NOT PROVIDED
    // --------------------------------

    state.state =
        STATES.COLLECTING_TIME;


    return {

        state,

        response:
            `Got it, ${formatDateForSpeech(state.date)}. What time would you prefer?`

    };

}


    // ====================================
    // COLLECT TIME
    // ====================================

    if (
        state.state ===
        STATES.COLLECTING_TIME
    ) {

        if (!time) {

            return {

                state,

                response:
                    "What time would you prefer?"

            };

        }


        // --------------------------------
        // CHECK AVAILABILITY
        // --------------------------------

        const availability =
            await checkAvailability(
                state.date,
                time
            );


        // --------------------------------
        // NOT AVAILABLE
        // --------------------------------

        if (
            !availability.available
        ) {

            const alternatives =
                await getAlternativeSlots(
                    state.date,
                    time,
                    3
                );


            let response =
                availability.reason ||
                "That time is not available.";


            if (
                alternatives.success &&
                alternatives.slots.length > 0
            ) {

                const slotText =
                    alternatives.slots
                        .map(
                            slot =>
                                slot.display
                        )
                        .join(", ");


                response +=
                    ` I have ${slotText} available. Which would you prefer?`;

            }


            state.state =
                STATES.COLLECTING_TIME;


            return {

                state,

                response

            };

        }


        // --------------------------------
        // SAVE NORMALIZED VALUES
        // --------------------------------

        state.date =
            availability.date;

        state.time =
            availability.time;


        state.state =
            STATES.CONFIRMING;


        return {

            state,

            response:
                `Your appointment is available on ${formatDateForSpeech(state.date)} at ${formatTimeForSpeech(state.time)}. Shall I confirm these details?`

        };

    }


    // ====================================
    // CONFIRM BOOKING
    // ====================================

    if (
        state.state ===
        STATES.CONFIRMING
    ) {


        // --------------------------------
        // NO
        // --------------------------------

        if (
            intent === "NO"
        ) {

            state.confirmed =
                false;

            state.date =
                null;

            state.time =
                null;


            state.state =
                STATES.COLLECTING_DATE;


            return {

                state,

                response:
                    "No problem. What date would you like instead?"

            };

        }


        // --------------------------------
        // YES
        // --------------------------------

        if (
            intent === "YES"
        ) {

            // IMPORTANT:
            // Always perform a fresh availability
            // check immediately before booking.

            const availability =
                await checkAvailability(
                    state.date,
                    state.time
                );


            // --------------------------------
            // SLOT NO LONGER AVAILABLE
            // --------------------------------

            if (
                !availability.available
            ) {

                const alternatives =
                    await getAlternativeSlots(
                        state.date,
                        state.time,
                        3
                    );


                let response =
                    `I'm sorry, that slot is no longer available. ${availability.reason || "Please choose another time."}`;


                if (
                    alternatives.success &&
                    alternatives.slots.length > 0
                ) {

                    const slots =
                        alternatives.slots
                            .map(
                                slot =>
                                    slot.display
                            )
                            .join(", ");


                    response +=
                        ` I have ${slots} available. Which would you prefer?`;

                }


                state.state =
                    STATES.COLLECTING_TIME;


                return {

                    state,

                    response

                };

            }


            // --------------------------------
            // NORMALIZE FINAL DATE/TIME
            // --------------------------------

            state.date =
                availability.date ||
                state.date;

            state.time =
                availability.time ||
                state.time;


            // --------------------------------
            // CREATE BOOKING
            // --------------------------------

            const booking =
                await bookAppointment({

                    date:
                        state.date,

                    time:
                        state.time,

                    customerName:
                        state.customerName,

                    customerPhone:
                        state.customerPhone,

                    reason:
                        state.reason

                });


            // --------------------------------
            // BOOKING FAILED
            // --------------------------------

            if (
                !booking.success
            ) {

                state.state =
                    STATES.COLLECTING_TIME;


                return {

                    state,

                    response:
                        `I couldn't complete the appointment. ${booking.error || "Please choose another time."}`

                };

            }


            // --------------------------------
            // SUCCESS
            // --------------------------------

            state.confirmed =
                true;


            state.state =
                STATES.BOOKED;


            state.appointmentId =
                booking.appointment.confirmationNumber ||
                booking.appointment.id;


            state.date =
                booking.appointment.date;


            state.time =
                booking.appointment.time;


            return {

                state,

               response:
                `Your appointment is confirmed for ${formatDateForSpeech(state.date)} at ${formatTimeForSpeech(state.time)}. Your confirmation number is ${state.appointmentId}.`

            };

        }


        return {

            state,

            response:
                "Please say yes to confirm or no to change the appointment."

        };

    }


    // ====================================
    // BOOKED
    // ====================================

    if (
        state.state ===
        STATES.BOOKED
    ) {

        if (
            intent === "BOOK"
        ) {

            resetBookingData(
                state
            );


            state.intent =
                "BOOK";


            state.state =
                STATES.COLLECTING_NAME;


            return {

                state,

                response:
                    "Sure. May I have your name?"

            };

        }


        return {

            state,

            response:
                "Your appointment is confirmed. How else can I help you?"

        };

    }


    // ====================================
    // CANCELLING
    // ====================================

    if (
        state.state ===
        STATES.CANCELLING
    ) {

        const appointmentId =
            extractAppointmentId(
                message
            );


        if (!appointmentId) {

            return {

                state,

                response:
                    "Please provide your appointment confirmation number, for example NC01."

            };

        }


        const appointment =
            await getAppointment(
                appointmentId
            );


        if (!appointment) {

            return {

                state,

                response:
                    "I couldn't find an appointment with that confirmation number. Please check the number and try again."

            };

        }


        if (
            appointment.status ===
            "CANCELLED"
        ) {

            state.state =
                STATES.IDLE;


            return {

                state,

                response:
                    "That appointment has already been cancelled."

            };

        }


        if (
            appointment.status !==
            "CONFIRMED"
        ) {

            state.state =
            STATES.IDLE;

         return {
            state,

        response:
            "That appointment cannot be rescheduled because it is not currently confirmed."
    };
}

        state.appointmentId =
            appointment.confirmationNumber ||
            appointment.id;


        state.state =
            STATES.CANCELLING_CONFIRM;


        return {

            state,

            response:
                `I found your appointment for ${formatDateForSpeech(appointment.date)} at ${formatTimeForSpeech(appointment.time)}. Would you like me to cancel it?`

        };

    }


    // ====================================
    // CONFIRM CANCELLATION
    // ====================================

    if (
        state.state ===
        STATES.CANCELLING_CONFIRM
    ) {

        // --------------------------------
        // YES
        // --------------------------------

        if (
            intent === "YES"
        ) {

            const result =
                await cancelAppointment(
                    state.appointmentId
                );


            if (
                !result.success
            ) {

                state.state =
                    STATES.IDLE;


                return {

                    state,

                    response:
                        result.error ||
                        "I couldn't cancel that appointment."

                };

            }


            const cancelledId =
                state.appointmentId;


            resetBookingData(
                state
            );


            state.state =
                STATES.IDLE;


            return {

                state,

                response:
                    `Your appointment ${cancelledId} has been cancelled successfully. How else can I help you?`

            };

        }


        // --------------------------------
        // NO
        // --------------------------------

        if (
            intent === "NO"
        ) {

            resetBookingData(
                state
            );


            state.state =
                STATES.IDLE;


            return {

                state,

                response:
                    "No problem. Your appointment has not been cancelled. How else can I help you?"

            };

        }


        return {

            state,

            response:
                "Please say yes to cancel the appointment, or no to keep it."

        };

    }


    // ====================================
    // RESCHEDULING
    // ====================================

    if (
        state.state ===
        STATES.RESCHEDULING
    ) {

        const appointmentId =
            extractAppointmentId(
                message
            );


        if (!appointmentId) {

            return {

                state,

                response:
                    "Please provide your appointment confirmation number."

            };

        }


        const appointment =
            await getAppointment(
                appointmentId
            );


        if (!appointment) {

            return {

                state,

                response:
                    "I couldn't find an appointment with that confirmation number. Please check the number and try again."

            };

        }


        if (
            appointment.status !==
            "CONFIRMED"
        ) {

            state.state =
                STATES.IDLE;


            return {
                state,
                response:
                    `Your appointment has been rescheduled successfully to ${formatDateForSpeech(appointment.date)} at ${formatTimeForSpeech(appointment.time)}. Your confirmation number is ${formatConfirmationForSpeech(appointmentId)}.`
};

        }


        state.appointmentId =
            appointment.confirmationNumber ||
            appointment.id;


        state.state =
            STATES.RESCHEDULE_DATE;


        return {

            state,

            response:
                `I found your appointment for ${formatDateForSpeech(appointment.date)} at ${formatTimeForSpeech(appointment.time)}. What new date would you like?`

        };

    }


    // ====================================
    // RESCHEDULE DATE
    // ====================================

    if (
        state.state ===
        STATES.RESCHEDULE_DATE
    ) {

        if (!date) {

            return {

                state,

                response:
                    "What new date would you like?"

            };

        }


        const validation =
            validateAppointmentDate(
                date
            );


        if (
            !validation.valid
        ) {

            return {

                state,

                response:
                    `${validation.reason} What new date would you like?`

            };

        }


        state.date =
            validation.date;


        state.state =
            STATES.RESCHEDULE_TIME;


        return {

            state,

            response:
                `Got it, ${formatDateForSpeech(state.date)}. What new time would you prefer?`

        };

    }


    // ====================================
    // RESCHEDULE TIME
    // ====================================

    if (
        state.state ===
        STATES.RESCHEDULE_TIME
    ) {

        if (!time) {

            return {

                state,

                response:
                    "What new time would you prefer?"

            };

        }


        // IMPORTANT:
        // Await service call.

        const availability =
            await checkAvailability(
                state.date,
                time
            );


        // --------------------------------
        // NEW SLOT NOT AVAILABLE
        // --------------------------------

        if (
            !availability.available
        ) {

            const alternatives =
                await getAlternativeSlots(
                    state.date,
                    time,
                    3
                );


            let response =
                availability.reason ||
                "That time is not available.";


            if (
                alternatives.success &&
                alternatives.slots.length > 0
            ) {

                const slots =
                    alternatives.slots
                        .map(
                            slot =>
                                slot.display
                        )
                        .join(", ");


                response +=
                    ` I have ${slots} available. Which would you prefer?`;

            }


            return {

                state,

                response

            };

        }


        state.date =
            availability.date;


        state.time =
            availability.time;


        state.state =
            STATES.RESCHEDULE_CONFIRM;


        return {

            state,

            response:
                `The new appointment will be on ${formatDateForSpeech(state.date)} at ${formatTimeForSpeech(state.time)}. Shall I confirm the change?`

        };

    }


    // ====================================
    // CONFIRM RESCHEDULE
    // ====================================

    if (
        state.state ===
        STATES.RESCHEDULE_CONFIRM
    ) {

        // --------------------------------
        // NO
        // --------------------------------

        // --------------------------------
        // ABANDON RESCHEDULE
        // --------------------------------

        const abandonReschedulePatterns = [
            /^no need$/,
            /^no need for now$/,
            /^no need right now$/,
            /^no need thanks$/,
            /^no need thank you$/,
            /^not now$/,
            /^not for now$/,
            /^never mind$/,
            /^nevermind$/,
            /^forget it$/,
            /^forget about it$/,
            /^leave it$/,
            /^leave it for now$/,
            /^maybe later$/,
            /^later$/,
            /^i don't need it$/,
            /^i do not need it$/,
            /^i don't want to change it$/,
            /^i do not want to change it$/,
            /^don't change it$/,
            /^do not change it$/
        ];

        if (
            abandonReschedulePatterns.some(
                pattern =>
                    pattern.test(
                        String(message)
                            .toLowerCase()
                            .trim()
                    )
            )
        ) {

            // Clear only the pending new
            // reschedule date/time.
            // Keep the original appointment ID.

            state.date =
                null;

            state.time =
                null;

            state.state =
                STATES.IDLE;

            return {

                state,

                response:
                    "No problem. The reschedule has been cancelled. Your original appointment remains unchanged. How else can I help you?"

            };
        }


        // --------------------------------
        // NO = CHOOSE DIFFERENT DATE
        // --------------------------------

        if (
            intent === "NO"
        ) {

            state.state =
                STATES.RESCHEDULE_DATE;

            state.date =
                null;

            state.time =
                null;

            return {

                state,

                response:
                    "No problem. What new date would you like?"

            };

        }


        // --------------------------------
        // YES
        // --------------------------------

        if (
            intent === "YES"
        ) {

            const result =
                await rescheduleAppointment(

                    state.appointmentId,

                    state.date,

                    state.time

                );


            if (
                !result.success
            ) {

                state.state =
                    STATES.RESCHEDULE_TIME;


                return {

                    state,

                    response:
                        `${result.error || "I couldn't reschedule the appointment."} Please choose another time.`

                };

            }


            const appointment =
                result.appointment;

            const appointmentId =
                appointment.confirmationNumber ||
                appointment.id;

                state.date =
                appointment.date;

                state.time =
                appointment.time;

                state.appointmentId =
                appointmentId;

                state.state =
                STATES.BOOKED;

        return {
            state,

            response:
                `Your appointment has been rescheduled successfully to ${formatDateForSpeech(appointment.date)} at ${formatTimeForSpeech(appointment.time)}. Your confirmation number is ${appointmentId}.`
        };

        }


        return {

            state,

            response:
                "Please say yes to confirm the new appointment time, or no to change it."

        };

    }


    // ====================================
    // DEFAULT
    // ====================================

    return {

        state,

        response:
            "Sure. How can I help you with your appointment?"

    };

}