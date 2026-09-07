import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

// ========================================
// NOVACARE APPOINTMENT REPOSITORY
// ========================================
//
// Persistence layer.
//
// Handles:
// - JSON database initialization
// - Reading appointments
// - Writing appointments
// - Creating appointments
// - Finding appointments
// - Updating appointments
// - Deleting appointments
// - Finding appointments by date
//
// ========================================


// ========================================
// PATH CONFIGURATION
// ========================================

const __filename =
    fileURLToPath(import.meta.url);

const __dirname =
    path.dirname(__filename);

const DATA_DIR =
    path.join(
        __dirname,
        "../data"
    );

const DATA_FILE =
    path.join(
        DATA_DIR,
        "appointments.json"
    );


// ========================================
// INITIALIZE DATABASE
// ========================================

async function initializeDatabase() {

    await fs.mkdir(
        DATA_DIR,
        {
            recursive: true
        }
    );

    try {

        await fs.access(
            DATA_FILE
        );

    } catch {

        await fs.writeFile(
            DATA_FILE,
            "[]",
            "utf8"
        );

    }
}


// ========================================
// NORMALIZE CONFIRMATION NUMBER
// ========================================

function normalizeConfirmationNumber(
    confirmationNumber
) {

    if (
        confirmationNumber === null ||
        confirmationNumber === undefined
    ) {
        return null;
    }

    return String(
        confirmationNumber
    )
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "");
}


// ========================================
// READ APPOINTMENTS
// ========================================

async function readAppointments() {

    await initializeDatabase();

    try {

        const data =
            await fs.readFile(
                DATA_FILE,
                "utf8"
            );

        if (!data.trim()) {
            return [];
        }

        const appointments =
            JSON.parse(data);

        if (!Array.isArray(appointments)) {

            console.error(
                "APPOINTMENTS DATABASE IS NOT AN ARRAY"
            );

            return [];

        }

        return appointments;

    } catch (error) {

        console.error(
            "READ APPOINTMENTS ERROR:",
            error
        );

        return [];
    }
}


// ========================================
// WRITE APPOINTMENTS
// ========================================

async function writeAppointments(
    appointments
) {

    await initializeDatabase();

    await fs.writeFile(

        DATA_FILE,

        JSON.stringify(
            appointments,
            null,
            2
        ),

        "utf8"

    );
}


// ========================================
// CREATE APPOINTMENT
// ========================================

export async function createAppointment(
    appointment
) {

    const appointments =
        await readAppointments();

    appointments.push(
        appointment
    );

    await writeAppointments(
        appointments
    );

    return appointment;
}


// ========================================
// FIND BY CONFIRMATION NUMBER
// ========================================
//
// Supports:
// NC-123456
// nc-123456
// NC - 123456
//
// Also checks appointment.id as a
// fallback so old appointments continue
// to work.
//

export async function findAppointmentByConfirmationNumber(
    confirmationNumber
) {

    const normalized =
        normalizeConfirmationNumber(
            confirmationNumber
        );

    if (!normalized) {
        return null;
    }

    const appointments =
        await readAppointments();

    const appointment =
        appointments.find(
            item => {

                const confirmation =
                    normalizeConfirmationNumber(
                        item.confirmationNumber
                    );

                const legacyConfirmation =
                    normalizeConfirmationNumber(
                        item.legacyConfirmationNumber
                    );

                const id =
                    normalizeConfirmationNumber(
                        item.id
                    );

                return (
                    confirmation === normalized ||
                    legacyConfirmation === normalized ||
                    id === normalized
                );

            }
        );

    return appointment || null;
}


// ========================================
// FIND BY ID
// ========================================

export async function findAppointmentById(
    id
) {

    const normalizedId =
        normalizeConfirmationNumber(
            id
        );

    if (!normalizedId) {
        return null;
    }

    const appointments =
        await readAppointments();

    return (
        appointments.find(
            appointment =>
                normalizeConfirmationNumber(
                    appointment.id
                ) === normalizedId
        ) || null
    );
}


// ========================================
// UPDATE APPOINTMENT
// ========================================

export async function updateAppointment(
    id,
    updates
) {

    const normalizedId =
        normalizeConfirmationNumber(
            id
        );

    if (!normalizedId) {
        return null;
    }

    const appointments =
        await readAppointments();

    const index =
        appointments.findIndex(
            appointment =>
                normalizeConfirmationNumber(
                    appointment.id
                ) === normalizedId
        );

    if (index === -1) {

        return null;

    }

    appointments[index] = {

        ...appointments[index],

        ...updates,

        updatedAt:
            new Date().toISOString()

    };

    await writeAppointments(
        appointments
    );

    return appointments[index];
}


// ========================================
// DELETE APPOINTMENT
// ========================================

export async function deleteAppointment(
    id
) {

    const normalizedId =
        normalizeConfirmationNumber(
            id
        );

    if (!normalizedId) {
        return false;
    }

    const appointments =
        await readAppointments();

    const index =
        appointments.findIndex(
            appointment =>
                normalizeConfirmationNumber(
                    appointment.id
                ) === normalizedId
        );

    if (index === -1) {

        return false;

    }

    appointments.splice(
        index,
        1
    );

    await writeAppointments(
        appointments
    );

    return true;
}


// ========================================
// GET ALL APPOINTMENTS
// ========================================

export async function getAllAppointments() {

    return await readAppointments();

}


// ========================================
// FIND APPOINTMENTS BY DATE
// ========================================

export async function findAppointmentsByDate(
    date
) {

    const appointments =
        await readAppointments();

    return appointments.filter(
        appointment =>
            appointment.date === date
    );
}