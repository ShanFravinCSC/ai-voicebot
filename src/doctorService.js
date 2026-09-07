// ========================================
// NOVACARE DOCTOR SERVICE
// ========================================
//
// Handles doctor-related business logic.
//
// Currently contains demo doctors for the
// medical appointment voicebot prototype.
//
// This data can later be replaced with:
// - Hospital API
// - Doctor database
// - Scheduling system
// - External healthcare API
//
// The appointment workflow should communicate
// with doctors through this service rather than
// hard-coding doctor information.
//
// ========================================


// ========================================
// DEMO DOCTOR DATA
// ========================================

const doctors = [
    {
        id: "D001",
        name: "Dr. Sarah Perera",
        specialty: "General Medicine",
        languages: [
            "English",
            "Tamil",
            "Sinhala"
        ],
        workingDays: [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday"
        ],
        workingHours: {
            start: "09:00",
            end: "17:00"
        }
    },

    {
        id: "D002",
        name: "Dr. Michael Fernando",
        specialty: "Cardiology",
        languages: [
            "English",
            "Sinhala"
        ],
        workingDays: [
            "Monday",
            "Tuesday",
            "Thursday",
            "Friday"
        ],
        workingHours: {
            start: "09:00",
            end: "16:00"
        }
    },

    {
        id: "D003",
        name: "Dr. Anjali Kumar",
        specialty: "Dermatology",
        languages: [
            "English",
            "Tamil",
            "Hindi"
        ],
        workingDays: [
            "Monday",
            "Wednesday",
            "Thursday",
            "Friday"
        ],
        workingHours: {
            start: "10:00",
            end: "17:00"
        }
    },

    {
        id: "D004",
        name: "Dr. David Silva",
        specialty: "Pediatrics",
        languages: [
            "English",
            "Sinhala",
            "Tamil"
        ],
        workingDays: [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Friday"
        ],
        workingHours: {
            start: "09:00",
            end: "15:00"
        }
    },

    {
        id: "D005",
        name: "Dr. Nisha Raj",
        specialty: "Neurology",
        languages: [
            "English",
            "Tamil",
            "Hindi"
        ],
        workingDays: [
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday"
        ],
        workingHours: {
            start: "10:00",
            end: "16:00"
        }
    }
];


// ========================================
// GET ALL DOCTORS
// ========================================
//
// Returns a copy of the doctor list.
//
// A copy is returned so callers cannot
// accidentally modify the original data.
//

export function getAllDoctors() {

    return doctors.map(
        doctor => ({
            ...doctor,
            languages: [
                ...doctor.languages
            ],
            workingDays: [
                ...doctor.workingDays
            ],
            workingHours: {
                ...doctor.workingHours
            }
        })
    );
}


// ========================================
// GET DOCTOR BY ID
// ========================================

export function getDoctorById(
    doctorId
) {

    if (!doctorId) {
        return null;
    }

    const normalizedId =
        String(doctorId)
            .trim()
            .toUpperCase();

    const doctor =
        doctors.find(
            item =>
                item.id.toUpperCase() ===
                normalizedId
        );

    return doctor || null;
}


// ========================================
// FIND DOCTOR BY NAME
// ========================================

export function findDoctorByName(
    name
) {

    if (!name) {
        return null;
    }

    const normalizedName =
        String(name)
            .trim()
            .toLowerCase();

    const doctor =
        doctors.find(
            item =>
                item.name
                    .toLowerCase()
                    .includes(
                        normalizedName
                    )
        );

    return doctor || null;
}


// ========================================
// FIND DOCTORS BY SPECIALTY
// ========================================

export function getDoctorsBySpecialty(
    specialty
) {

    if (!specialty) {
        return [];
    }

    const normalizedSpecialty =
        String(specialty)
            .trim()
            .toLowerCase();

    return doctors.filter(
        doctor =>
            doctor.specialty
                .toLowerCase()
                .includes(
                    normalizedSpecialty
                )
    );
}


// ========================================
// GET DOCTORS BY LANGUAGE
// ========================================
//
// Useful later when multilingual support
// is added.
//
// Example:
// getDoctorsByLanguage("Tamil")
//

export function getDoctorsByLanguage(
    language
) {

    if (!language) {
        return [];
    }

    const normalizedLanguage =
        String(language)
            .trim()
            .toLowerCase();

    return doctors.filter(
        doctor =>
            doctor.languages.some(
                supportedLanguage =>
                    supportedLanguage
                        .toLowerCase() ===
                    normalizedLanguage
            )
    );
}


// ========================================
// CHECK DOCTOR SUPPORTS LANGUAGE
// ========================================

export function doctorSupportsLanguage(
    doctorId,
    language
) {

    const doctor =
        getDoctorById(
            doctorId
        );

    if (!doctor || !language) {
        return false;
    }

    const normalizedLanguage =
        String(language)
            .trim()
            .toLowerCase();

    return doctor.languages.some(
        supportedLanguage =>
            supportedLanguage
                .toLowerCase() ===
            normalizedLanguage
    );
}


// ========================================
// CHECK DOCTOR WORKING DAY
// ========================================

export function isDoctorWorkingDay(
    doctorId,
    day
) {

    const doctor =
        getDoctorById(
            doctorId
        );

    if (!doctor || !day) {
        return false;
    }

    const normalizedDay =
        String(day)
            .trim()
            .toLowerCase();

    return doctor.workingDays.some(
        workingDay =>
            workingDay
                .toLowerCase() ===
            normalizedDay
    );
}


// ========================================
// GET DOCTOR SUMMARY
// ========================================
//
// Used when the conversational layer needs
// a clean doctor description.
//

export function getDoctorSummary(
    doctor
) {

    if (!doctor) {
        return null;
    }

    return {
        id: doctor.id,
        name: doctor.name,
        specialty: doctor.specialty
    };
}


// ========================================
// DEFAULT EXPORT
// ========================================

export default {
    getAllDoctors,
    getDoctorById,
    findDoctorByName,
    getDoctorsBySpecialty,
    getDoctorsByLanguage,
    doctorSupportsLanguage,
    isDoctorWorkingDay,
    getDoctorSummary
};