// ========================================
// NOVACARE APPOINTMENT SERVICE
// ========================================
//
// Business logic layer.
//
// Handles:
// - Date validation
// - Time validation
// - Working hours
// - Availability
// - Alternative slots
// - Booking
// - Appointment lookup
// - Cancellation
// - Rescheduling
//
// Persistence is handled by:
// appointmentRepository.js
// ========================================

import {
    createAppointment,
    findAppointmentByConfirmationNumber,
    updateAppointment,
    findAppointmentsByDate,
    getAllAppointments
} from "./appointmentRepository.js";


import {
    getDoctorById
} from "./doctorService.js";


// ========================================
// CONFIGURATION
// ========================================

const BUSINESS_HOURS = {
    start: 9,
    end: 17
};

const APPOINTMENT_DURATION = 30;

const MAX_APPOINTMENTS_PER_SLOT = 1;

const WORKING_DAYS = [
    1, // Monday
    2, // Tuesday
    3, // Wednesday
    4, // Thursday
    5  // Friday
];


// ========================================
// DATE HELPERS
// ========================================

function formatDate(date) {

    const year =
        date.getFullYear();

    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            date.getDate()
        ).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


// ========================================
// NORMALIZE DATE
// ========================================

function normalizeDate(date) {

    if (!date) {
        return null;
    }

    const value =
        String(date)
            .trim()
            .toLowerCase();


    // TODAY
    if (value === "today") {

        return formatDate(
            new Date()
        );
    }


    // TOMORROW
    if (value === "tomorrow") {

        const tomorrow =
            new Date();

        tomorrow.setDate(
            tomorrow.getDate() + 1
        );

        return formatDate(
            tomorrow
        );
    }


    // DAY AFTER TOMORROW
    if (
        value ===
        "day after tomorrow"
    ) {

        const date =
            new Date();

        date.setDate(
            date.getDate() + 2
        );

        return formatDate(
            date
        );
    }


    // NEXT WEEKDAY
    const nextDay =
        value.match(
            /^next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/
        );

    if (nextDay) {

        return getNextWeekdayDate(
            nextDay[1]
        );
    }


    // WEEKDAY
    const weekdays = [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday"
    ];

    if (
        weekdays.includes(value)
    ) {

        return getNextWeekdayDate(
            value
        );
    }


    // YYYY-MM-DD
    if (
        /^\d{4}-\d{2}-\d{2}$/.test(
            value
        )
    ) {

        return value;
    }


    // DD/MM/YYYY
    const slashMatch =
        value.match(
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
        );

    if (slashMatch) {

        const day =
            slashMatch[1]
                .padStart(2, "0");

        const month =
            slashMatch[2]
                .padStart(2, "0");

        const year =
            slashMatch[3];

        return `${year}-${month}-${day}`;
    }


    // DD-MM-YYYY
    const dashMatch =
        value.match(
            /^(\d{1,2})-(\d{1,2})-(\d{4})$/
        );

    if (dashMatch) {

        const day =
            dashMatch[1]
                .padStart(2, "0");

        const month =
            dashMatch[2]
                .padStart(2, "0");

        const year =
            dashMatch[3];

        return `${year}-${month}-${day}`;
    }


    // MONTH DAY
    // August 31
    // August 31 2026
    const monthDate =
        value.match(
            /^(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?$/
        );

    if (monthDate) {

        const monthNames = [
            "january",
            "february",
            "march",
            "april",
            "may",
            "june",
            "july",
            "august",
            "september",
            "october",
            "november",
            "december"
        ];

        const month =
            monthNames.indexOf(
                monthDate[1]
            ) + 1;

        const day =
            Number(
                monthDate[2]
            );

        const year =
            monthDate[3]
                ? Number(monthDate[3])
                : new Date().getFullYear();

        return (
            `${year}-` +
            `${String(month).padStart(2, "0")}-` +
            `${String(day).padStart(2, "0")}`
        );
    }


    // DAY MONTH
    // 31 August
    // 31 August 2026
    const dateMonth =
        value.match(
            /^(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+(\d{4}))?$/
        );

    if (dateMonth) {

        const monthNames = [
            "january",
            "february",
            "march",
            "april",
            "may",
            "june",
            "july",
            "august",
            "september",
            "october",
            "november",
            "december"
        ];

        const day =
            Number(
                dateMonth[1]
            );

        const month =
            monthNames.indexOf(
                dateMonth[2]
            ) + 1;

        const year =
            dateMonth[3]
                ? Number(dateMonth[3])
                : new Date().getFullYear();

        return (
            `${year}-` +
            `${String(month).padStart(2, "0")}-` +
            `${String(day).padStart(2, "0")}`
        );
    }


    return null;
}


// ========================================
// NEXT WEEKDAY
// ========================================

function getNextWeekdayDate(
    weekday
) {

    const days = {
        sunday: 0,
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6
    };

    const target =
        days[weekday];

    if (
        target === undefined
    ) {
        return null;
    }

    const today =
        new Date();

    const current =
        today.getDay();

    let difference =
        target - current;

    if (
        difference <= 0
    ) {
        difference += 7;
    }

    const result =
        new Date(today);

    result.setDate(
        today.getDate() +
        difference
    );

    return formatDate(
        result
    );
}


// ========================================
// VALIDATE DATE
// ========================================

function isValidDate(
    dateString
) {

    if (
        !dateString ||
        !/^\d{4}-\d{2}-\d{2}$/.test(
            dateString
        )
    ) {
        return false;
    }

    const date =
        new Date(
            `${dateString}T00:00:00`
        );

    return (
        !Number.isNaN(
            date.getTime()
        ) &&
        formatDate(date) ===
            dateString
    );
}


// ========================================
// PAST DATE
// ========================================

function isPastDate(
    dateString
) {

    const today =
        formatDate(
            new Date()
        );

    return (
        dateString <
        today
    );
}


// ========================================
// WEEKEND
// ========================================

function isWeekend(
    dateString
) {

    const date =
        new Date(
            `${dateString}T00:00:00`
        );

    const day =
        date.getDay();

    return !WORKING_DAYS.includes(
        day
    );
}


// ========================================
// VALIDATE APPOINTMENT DATE
// ========================================

export function validateAppointmentDate(
    date
) {

    const normalizedDate =
        normalizeDate(date);

    if (!normalizedDate) {

        return {
            valid: false,
            reason:
                "I couldn't understand that date."
        };
    }

    if (
        !isValidDate(
            normalizedDate
        )
    ) {

        return {
            valid: false,
            reason:
                "That doesn't appear to be a valid date."
        };
    }

    if (
        isPastDate(
            normalizedDate
        )
    ) {

        return {
            valid: false,
            reason:
                "Appointments cannot be booked for a past date."
        };
    }

    if (
        isWeekend(
            normalizedDate
        )
    ) {

        return {
            valid: false,
            reason:
                "Appointments are available Monday to Friday."
        };
    }

    return {
        valid: true,
        date:
            normalizedDate
    };
}


// ========================================
// NORMALIZE TIME
// ========================================

function normalizeTime(
    time
) {

    if (!time) {
        return null;
    }

    const value =
        String(time)
            .trim()
            .toLowerCase();


    // Remove unnecessary spaces
    const cleaned =
        value.replace(
            /\s+/g,
            " "
        );


    // AM / PM
    // 10 AM
    // 10:30 AM
    // 10am
    // 10:30pm
    const amPmMatch =
        cleaned.match(
            /^(\d{1,2})(?::(\d{1,2}))?\s*(am|pm)$/
        );

    if (amPmMatch) {

        let hour =
            Number(
                amPmMatch[1]
            );

        const minute =
            Number(
                amPmMatch[2] || "0"
            );

        const period =
            amPmMatch[3];

        if (
            hour < 1 ||
            hour > 12 ||
            minute < 0 ||
            minute > 59
        ) {
            return null;
        }

        if (
            period === "pm" &&
            hour !== 12
        ) {
            hour += 12;
        }

        if (
            period === "am" &&
            hour === 12
        ) {
            hour = 0;
        }

        return (
            String(hour).padStart(2, "0") +
            ":" +
            String(minute).padStart(2, "0")
        );
    }


    // 24 HOUR
    const twentyFour =
        cleaned.match(
            /^([01]\d|2[0-3]):([0-5]\d)$/
        );

    if (twentyFour) {

        return twentyFour[0];
    }


    return null;
}


// ========================================
// TIME TO MINUTES
// ========================================

function timeToMinutes(
    time
) {

    const [
        hour,
        minute
    ] =
        time
            .split(":")
            .map(Number);

    return (
        hour * 60 +
        minute
    );
}


// ========================================
// MINUTES TO TIME
// ========================================

function minutesToTime(
    minutes
) {

    const hour =
        Math.floor(
            minutes / 60
        );

    const minute =
        minutes % 60;

    return (
        String(hour)
            .padStart(2, "0") +
        ":" +
        String(minute)
            .padStart(2, "0")
    );
}


// ========================================
// FORMAT TIME FOR SPEECH
// ========================================

export function formatTimeForSpeech(
    time
) {

    if (!time) {
        return "";
    }

    const normalized =
        normalizeTime(time);

    if (!normalized) {
        return String(time);
    }

    const [
        hourString,
        minuteString
    ] =
        normalized.split(":");

    let hour =
        Number(hourString);

    const minute =
        minuteString;

    const period =
        hour >= 12
            ? "PM"
            : "AM";

    if (hour === 0) {
        hour = 12;
    }

    if (hour > 12) {
        hour -= 12;
    }

    if (
        minute === "00"
    ) {

        return `${hour} ${period}`;
    }

    return (
        `${hour}:${minute} ${period}`
    );
}


// ========================================
// FORMAT DATE FOR SPEECH
// ========================================

export function formatDateForSpeech(
    date
) {

    if (!date) {
        return "";
    }

    const normalized =
        normalizeDate(date);

    if (!normalized) {
        return String(date);
    }

    const parsedDate =
        new Date(
            `${normalized}T00:00:00`
        );

    return parsedDate.toLocaleDateString(
        "en-US",
        {
            month: "long",
            day: "numeric",
            year: "numeric"
        }
    );
}


///// Voice Speech/////

export function formatConfirmationForSpeech(confirmationNumber) {

    if (!confirmationNumber) {
        return "";
    }

    const value = String(confirmationNumber)
        .trim()
        .toUpperCase();

    const shortMatch =
        value.match(/^NC(\d{1,4})$/);

    if (shortMatch) {

        const digits = shortMatch[1]
            .padStart(2, "0")
            .split("")
            .map(
                digit => ({
                    "0": "zero",
                    "1": "one",
                    "2": "two",
                    "3": "three",
                    "4": "four",
                    "5": "five",
                    "6": "six",
                    "7": "seven",
                    "8": "eight",
                    "9": "nine"
                })[digit]
            )
            .join(" ");

        return `N C ${digits}`;
    }

    // Backward compatibility for old confirmation numbers.
    const legacyMatch =
        value.match(/^NC-(\d+)-(\d+)$/);

    if (!legacyMatch) {
        return value;
    }

    const [, mainNumber, suffix] = legacyMatch;

    const spokenMain = mainNumber
        .split("")
        .join(" ");

    const spokenSuffix = suffix
        .split("")
        .join(" ");

    return `N C. ${spokenMain}. ${spokenSuffix}`;
}

// ========================================
// DOCTOR SCHEDULE HELPERS
// ========================================

function getDoctorSchedule(
    doctorId
) {
    if (!doctorId) {
        return {
            workingDays: WORKING_DAYS,
            start: BUSINESS_HOURS.start,
            end: BUSINESS_HOURS.end
        };
    }

    const doctor =
        getDoctorById(
            doctorId
        );

    if (!doctor) {
        return null;
    }

    return {
        workingDays:
            doctor.workingDays ||
            WORKING_DAYS,

        start:
            doctor.workingHours?.start ??
            BUSINESS_HOURS.start,

        end:
            doctor.workingHours?.end ??
            BUSINESS_HOURS.end
    };
}


// ========================================
// DOCTOR WORKING DAY
// ========================================

function isDoctorWorkingDay(
    doctorId,
    dateString
) {
    const schedule =
        getDoctorSchedule(
            doctorId
        );

    if (!schedule) {
        return false;
    }

    const date =
        new Date(
            `${dateString}T00:00:00`
        );

    const dayNames = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday"
    ];

    const dayName =
        dayNames[date.getDay()];

    return schedule.workingDays.some(
        workingDay =>
            String(workingDay)
                .trim()
                .toLowerCase() ===
            dayName.toLowerCase()
    );
}


// ========================================
// DOCTOR WORKING HOURS
// ========================================

function isWithinDoctorWorkingHours(
    doctorId,
    time
) {
    const schedule =
        getDoctorSchedule(
            doctorId
        );

    if (!schedule) {
        return false;
    }

    const minutes =
        timeToMinutes(
            time
        );

    const start =
        typeof schedule.start === "number"
            ? schedule.start * 60
            : timeToMinutes(schedule.start);

    const end =
        typeof schedule.end === "number"
            ? schedule.end * 60
            : timeToMinutes(schedule.end);

    const appointmentEnd =
        minutes +
        APPOINTMENT_DURATION;

    return (
        minutes >= start &&
        appointmentEnd <= end
    );
}


// ========================================
// BUSINESS HOURS
// ========================================

function isWithinBusinessHours(
    time
) {

    const minutes =
        timeToMinutes(
            time
        );

    const start =
        BUSINESS_HOURS.start *
        60;

    const end =
        BUSINESS_HOURS.end *
        60;

    // Appointment must finish
    // before closing time.
    const appointmentEnd =
        minutes +
        APPOINTMENT_DURATION;

    return (
        minutes >= start &&
        appointmentEnd <= end
    );
}


// ========================================
// CHECK AVAILABILITY
// ========================================

export async function checkAvailability(
    date,
    time,
    doctorId = null
) {

    const normalizedDate =
        normalizeDate(
            date
        );

    const normalizedTime =
        normalizeTime(
            time
        );


    // -------------------------------
    // BASIC VALIDATION
    // -------------------------------

    if (
        !normalizedDate ||
        !normalizedTime
    ) {
        return {
            available: false,
            reason:
                "Invalid appointment date or time."
        };
    }


    // -------------------------------
    // DOCTOR VALIDATION
    // -------------------------------

    let doctor = null;

    if (doctorId) {

        doctor =
            getDoctorById(
                doctorId
            );

        if (!doctor) {

            return {
                available: false,
                date:
                    normalizedDate,
                time:
                    normalizedTime,
                reason:
                    "The selected doctor could not be found."
            };
        }
    }


    // -------------------------------
    // DATE VALIDATION
    // -------------------------------

    const dateValidation =
        validateAppointmentDate(
            normalizedDate
        );

    if (
        !dateValidation.valid
    ) {
        return {
            available: false,
            date:
                normalizedDate,
            time:
                normalizedTime,
            reason:
                dateValidation.reason
        };
    }


    // -------------------------------
    // DOCTOR WORKING DAY
    // -------------------------------

    if (
        doctorId &&
        !isDoctorWorkingDay(
            doctorId,
            normalizedDate
        )
    ) {

        return {
            available: false,
            date:
                normalizedDate,
            time:
                normalizedTime,
            reason:
                `${doctor.name} is not available on that day.`
        };
    }


    // -------------------------------
    // WORKING HOURS
    // -------------------------------

    const withinWorkingHours =
        doctorId
            ? isWithinDoctorWorkingHours(
                  doctorId,
                  normalizedTime
              )
            : isWithinBusinessHours(
                  normalizedTime
              );

    if (
        !withinWorkingHours
    ) {

        return {
            available: false,
            date:
                normalizedDate,
            time:
                normalizedTime,
            reason:
                doctor
                    ? `${doctor.name} is available between ${formatTimeForSpeech(
                        doctor.workingHours?.start ??
                        `${String(BUSINESS_HOURS.start).padStart(2, "0")}:00`
                    )} and ${formatTimeForSpeech(
                        doctor.workingHours?.end ??
                        `${String(BUSINESS_HOURS.end).padStart(2, "0")}:00`
                    )}.`
                    : "Appointments are available between 9 AM and 5 PM."
                    };
    }


    // -------------------------------
    // CHECK EXISTING APPOINTMENTS
    // -------------------------------

    const appointments =
        await findAppointmentsByDate(
            normalizedDate
        );


    const matchingAppointments =
        appointments.filter(
            appointment => {

                if (
                    appointment.status !==
                    "CONFIRMED"
                ) {
                    return false;
                }

                // If doctorId is supplied,
                // only appointments for
                // that doctor are conflicts.
                if (
                    doctorId
                ) {
                    return (
                        appointment.doctorId ===
                        doctorId
                    );
                }

                // Backward compatibility:
                // old appointments without
                // doctorId still use the
                // original global slot logic.
                return true;
            }
        );


    if (
        matchingAppointments.length >=
        MAX_APPOINTMENTS_PER_SLOT
    ) {

        return {
            available: false,
            date:
                normalizedDate,
            time:
                normalizedTime,
            reason:
                doctor
                    ? `${doctor.name} already has an appointment at that time.`
                    : "That time slot is already booked."
        };
    }


    return {
        available: true,
        date:
            normalizedDate,
        time:
            normalizedTime,
        doctorId:
            doctor?.id ||
            doctorId ||
            null,
        doctorName:
            doctor?.name ||
            null
    };
}


// ========================================
// ALTERNATIVE SLOTS
// ========================================

export async function getAlternativeSlots(
    date,
    requestedTime,
    limit = 3,
    doctorId = null
) {

    const normalizedDate =
        normalizeDate(date);

    const normalizedTime =
        normalizeTime(
            requestedTime
        );

    if (
        !normalizedDate ||
        !normalizedTime
    ) {

        return {
            success: false,
            slots: []
        };
    }


    const validation =
        validateAppointmentDate(
            normalizedDate
        );

    if (
        !validation.valid
    ) {

        return {
            success: false,
            slots: []
        };
    }


    const appointments =
        await findAppointmentsByDate(
            normalizedDate
        );


    const bookedTimes =
    new Set(
        appointments
            .filter(
                appointment => {

                    if (
                        appointment.status !==
                        "CONFIRMED"
                    ) {
                        return false;
                    }

                    if (
                        doctorId
                    ) {
                        return (
                            appointment.doctorId ===
                            doctorId
                        );
                    }

                    return true;
                }
            )
            .map(
                appointment =>
                    appointment.time
            )
    );


    const requestedMinutes =
        timeToMinutes(
            normalizedTime
        );


    const slots = [];


    const offsets = [
        -120,
        -90,
        -60,
        -30,
        30,
        60,
        90,
        120
    ];


   for (
    const offset of offsets
        ) {
            if (
                slots.length >= limit
            ) {
                break;
            }

            const candidateMinutes =
                requestedMinutes + offset;

            const candidateTime =
                minutesToTime(
                    candidateMinutes
                );


            const withinWorkingHours =
                doctorId
                    ? isWithinDoctorWorkingHours(
                        doctorId,
                        candidateTime
                    )
                    : isWithinBusinessHours(
                        candidateTime
                    );


            if (!withinWorkingHours) {
                continue;
            }

                    if (
                        bookedTimes.has(
                            candidateTime
                        )
                    ) {
                        continue;
                    }


                    if (
                        slots.some(
                            slot =>
                                slot.time ===
                                candidateTime
                        )
                    ) {
                        continue;
                    }


        slots.push({

            time:
                candidateTime,

            display:
                formatTimeForSpeech(
                    candidateTime
                )

        });
    }


    return {
        success: true,
        slots
    };
}


// ========================================
// ID GENERATOR
// ========================================

function generateAppointmentId() {

    return (
        "NC-" +
        Date.now() +
        "-" +
        Math.floor(
            Math.random() * 1000
        )
    );
}


// ========================================
// GENERATE CUSTOMER CONFIRMATION NUMBER
// ========================================
//
// Short, voice-friendly confirmation number.
// Example: NC01, NC02, NC03
//
// The internal appointment id remains separate
// and continues to use the long unique format.
// ========================================

async function generateConfirmationNumber() {

    const appointments =
        await getAllAppointments();

    const usedNumbers =
        appointments
            .map(
                appointment => {
                    const match =
                        String(
                            appointment.confirmationNumber ||
                            ""
                        )
                            .trim()
                            .toUpperCase()
                            .match(/^NC(\d+)$/);

                    return match
                        ? Number(match[1])
                        : null;
                }
            )
            .filter(
                number =>
                    Number.isInteger(number)
            );

    let nextNumber = 1;

    while (
        usedNumbers.includes(nextNumber)
    ) {
        nextNumber++;
    }

    return `NC${String(nextNumber).padStart(2, "0")}`;
}


// ========================================
// NORMALIZE CONFIRMATION NUMBER
// ========================================

function normalizeConfirmationNumber(
    confirmationNumber
) {

    if (
        confirmationNumber ===
        null ||
        confirmationNumber ===
        undefined
    ) {
        return null;
    }

    return String(
        confirmationNumber
    )
        .trim()
        .toUpperCase();
}


// ========================================
// BOOK APPOINTMENT
// ========================================

export async function bookAppointment({

    doctorId = null,

    doctorName = null,

    date,

    time,

    customerName =
        "Guest",

    customerPhone =
        null,

    reason =
        null

}) {

    // -------------------------------
    // VALIDATE DOCTOR
    // -------------------------------

    let doctor = null;

    if (
        doctorId
    ) {

        doctor =
            getDoctorById(
                doctorId
            );

        if (!doctor) {

            return {
                success: false,
                error:
                    "The selected doctor could not be found."
            };
        }
    }


    // -------------------------------
    // CHECK AVAILABILITY
    // -------------------------------

    const availability =
        await checkAvailability(
            date,
            time,
            doctorId
        );


    if (
        !availability.available
    ) {

        return {
            success: false,
            error:
                availability.reason
        };
    }


    // -------------------------------
    // CREATE APPOINTMENT
    // -------------------------------

    const appointment = {

        id:
            generateAppointmentId(),

        confirmationNumber:
            await generateConfirmationNumber(),

        doctorId:
            doctor?.id ||
            doctorId ||
            null,

        doctorName:
            doctor?.name ||
            doctorName ||
            null,

        doctorSpecialty:
            doctor?.specialty ||
            null,

        customerName,

        customerPhone,

        reason,

        date:
            availability.date,

        time:
            availability.time,

        status:
            "CONFIRMED",

        createdAt:
            new Date().toISOString(),

        updatedAt:
            new Date().toISOString()

    };


    // -------------------------------
    // SAVE
    // -------------------------------

    const saved =
        await createAppointment(
            appointment
        );


    return {

        success: true,

        appointment:
            saved

    };
}


// ========================================
// GET APPOINTMENT
// ========================================

export async function getAppointment(
    appointmentId
) {

    const confirmationNumber =
        normalizeConfirmationNumber(
            appointmentId
        );


    if (!confirmationNumber) {

        return null;
    }


    const appointment =
        await findAppointmentByConfirmationNumber(
            confirmationNumber
        );


    return appointment;
}


// ========================================
// CANCEL APPOINTMENT
// ========================================

export async function cancelAppointment(
    appointmentId
) {

    const confirmationNumber =
        normalizeConfirmationNumber(
            appointmentId
        );


    if (!confirmationNumber) {

        return {
            success: false,
            error:
                "Please provide a valid appointment confirmation number."
        };
    }


    const appointment =
        await getAppointment(
            confirmationNumber
        );


    if (!appointment) {

        return {
            success: false,
            error:
                "Appointment not found."
        };
    }


    if (
        appointment.status ===
        "CANCELLED"
    ) {

        return {
            success: false,
            error:
                "This appointment is already cancelled.",
            appointment
        };
    }


    if (
        appointment.status !==
        "CONFIRMED"
    ) {

        return {
            success: false,
            error:
                "Only confirmed appointments can be cancelled.",
            appointment
        };
    }


    const updated =
        await updateAppointment(
            appointment.id,
            {
                status:
                    "CANCELLED",

                cancelledAt:
                    new Date().toISOString()
            }
        );


    if (!updated) {

        return {
            success: false,
            error:
                "Unable to cancel the appointment."
        };
    }


    return {
        success: true,
        message:
            "Appointment cancelled successfully.",
        appointment:
            updated
    };
}


// ========================================
// RESCHEDULE APPOINTMENT
// ========================================

export async function rescheduleAppointment(
    appointmentId,
    newDate,
    newTime
) {

    const confirmationNumber =
        normalizeConfirmationNumber(
            appointmentId
        );


    if (!confirmationNumber) {

        return {
            success: false,
            error:
                "Please provide a valid appointment confirmation number."
        };
    }


    const appointment =
        await getAppointment(
            confirmationNumber
        );


    if (!appointment) {

        return {
            success: false,
            error:
                "Appointment not found."
        };
    }


    if (
        appointment.status !==
        "CONFIRMED"
    ) {

        return {
            success: false,
            error:
                "Only confirmed appointments can be rescheduled."
        };
    }


    const normalizedDate =
        normalizeDate(
            newDate
        );

    const normalizedTime =
        normalizeTime(
            newTime
        );


    if (
        !normalizedDate ||
        !normalizedTime
    ) {

        return {
            success: false,
            error:
                "Invalid new appointment date or time."
        };
    }


    // DATE VALIDATION
    const validation =
        validateAppointmentDate(
            normalizedDate
        );


    if (
        !validation.valid
    ) {

        return {
            success: false,
            error:
                validation.reason
        };
    }


    // TIME VALIDATION
    if (
        !isWithinBusinessHours(
            normalizedTime
        )
    ) {

        return {
            success: false,
            error:
                "Appointments are available between 9 AM and 5 PM."
        };
    }


    // CHECK NEW DATE
    const appointments =
        await findAppointmentsByDate(
            normalizedDate
        );


    // IMPORTANT:
    // Ignore the current appointment
    // when checking the new slot.
    const conflict =
        appointments.some(
            item => {

                if (
                    item.id ===
                    appointment.id
                ) {
                    return false;
                }

                if (
                    item.status !==
                    "CONFIRMED"
                ) {
                    return false;
                }

                if (
                    item.time !==
                    normalizedTime
                ) {
                    return false;
                }

                // If the original appointment
                // has a doctor, only appointments
                // for that doctor are conflicts.
                if (
                    appointment.doctorId
                ) {
                    return (
                        item.doctorId ===
                        appointment.doctorId
                    );
                }

                // Backward compatibility
                // for old appointments.
                return true;
            }
        );


    if (conflict) {

        return {
            success: false,
            error:
                "That time slot is already booked."
        };
    }


    const updated =
        await updateAppointment(
            appointment.id,
            {
                date:
                    normalizedDate,

                time:
                    normalizedTime,

                status:
                    "CONFIRMED",

                rescheduledAt:
                    new Date().toISOString()
            }
        );


    if (!updated) {

        return {
            success: false,
            error:
                "Unable to reschedule the appointment."
        };
    }


    return {
        success: true,
        message:
            "Appointment rescheduled successfully.",
        appointment:
            updated
    };
}


// ========================================
// EXPORT CONFIGURATION
// ========================================

export const appointmentConfig = {

    businessHours: {
        start:
            BUSINESS_HOURS.start,

        end:
            BUSINESS_HOURS.end
    },

    appointmentDuration:
        APPOINTMENT_DURATION,

    workingDays:
        WORKING_DAYS,

    maxAppointmentsPerSlot:
        MAX_APPOINTMENTS_PER_SLOT

};