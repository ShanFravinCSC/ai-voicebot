// ========================================
// NOVACARE LANGUAGE SERVICE
// ========================================
//
// Handles:
//
// - Supported languages
// - Language names
// - Native language names
// - Numeric selection
// - Number words
// - Ordinal words
// - Ordinal numbers
//
// Examples:
//
// 1
// number 1
// number one
// one
// first
// 1st
// English
//
// All should select English.
//
// ========================================


export const SUPPORTED_LANGUAGES = [

    {
        code: "en",
        name: "English",
        nativeName: "English"
    },

    {
        code: "si",
        name: "Sinhala",
        nativeName: "සිංහල"
    },

    {
        code: "ta",
        name: "Tamil",
        nativeName: "தமிழ்"
    },

    {
        code: "fr",
        name: "French",
        nativeName: "Français"
    },

    {
        code: "de",
        name: "German",
        nativeName: "Deutsch"
    },

    {
        code: "zh",
        name: "Chinese",
        nativeName: "中文"
    },

    {
        code: "vi",
        name: "Vietnamese",
        nativeName: "Tiếng Việt"
    },

    {
        code: "el",
        name: "Greek",
        nativeName: "Ελληνικά"
    },

    {
        code: "it",
        name: "Italian",
        nativeName: "Italiano"
    },

    {
        code: "es",
        name: "Spanish",
        nativeName: "Español"
    }

];


// ========================================
// NUMBER WORDS
// ========================================

const NUMBER_WORDS = {

    zero: 0,

    one: 1,

    two: 2,

    three: 3,

    four: 4,

    five: 5,

    six: 6,

    seven: 7,

    eight: 8,

    nine: 9,

    ten: 10

};


// ========================================
// ORDINAL WORDS
// ========================================

const ORDINAL_WORDS = {

    first: 1,

    second: 2,

    third: 3,

    fourth: 4,

    fifth: 5,

    sixth: 6,

    seventh: 7,

    eighth: 8,

    ninth: 9,

    tenth: 10

};


// ========================================
// GET LANGUAGE PROMPT
// ========================================

export function getLanguagePromptText() {

    return SUPPORTED_LANGUAGES
        .map(
            (language, index) =>
                `${index + 1}. ${language.name} (${language.nativeName})`
        )
        .join(", ");

}


// ========================================
// NORMALIZE USER INPUT
// ========================================

function normalizeInput(
    message
) {

    return String(
        message || ""
    )
        .trim()
        .toLowerCase()
        .replace(
            /[.,!?]/g,
            ""
        )
        .replace(
            /\s+/g,
            " "
        );

}


// ========================================
// EXTRACT LANGUAGE NUMBER
// ========================================
//
// Supports:
//
// 1
// 01
// 1st
// 2nd
// 3rd
// 10th
// number 1
// number one
// language 1
// language one
// option 1
// option one
// one
// first
// second
//
// ========================================

function extractLanguageNumber(
    message
) {

    const normalized =
        normalizeInput(
            message
        );


    if (!normalized) {
        return null;
    }


    // ------------------------------------
    // Direct numeric values
    // ------------------------------------

    let match =
        normalized.match(
            /^(?:number|language|option)?\s*(\d{1,2})(?:st|nd|rd|th)?$/
        );


    if (match) {

        const number =
            Number(
                match[1]
            );


        if (
            number >= 1 &&
            number <= SUPPORTED_LANGUAGES.length
        ) {

            return number;

        }

    }


    // ------------------------------------
    // Number words
    // ------------------------------------

    if (
        Object.prototype.hasOwnProperty.call(
            NUMBER_WORDS,
            normalized
        )
    ) {

        const number =
            NUMBER_WORDS[
                normalized
            ];


        if (
            number >= 1 &&
            number <= SUPPORTED_LANGUAGES.length
        ) {

            return number;

        }

    }


    // ------------------------------------
    // "number one"
    // "language one"
    // "option one"
    // ------------------------------------

    match =
        normalized.match(
            /^(?:number|language|option)\s+([a-z]+)$/
        );


    if (match) {

        const word =
            match[1];


        if (
            Object.prototype.hasOwnProperty.call(
                NUMBER_WORDS,
                word
            )
        ) {

            const number =
                NUMBER_WORDS[
                    word
                ];


            if (
                number >= 1 &&
                number <= SUPPORTED_LANGUAGES.length
            ) {

                return number;

            }

        }


        if (
            Object.prototype.hasOwnProperty.call(
                ORDINAL_WORDS,
                word
            )
        ) {

            const number =
                ORDINAL_WORDS[
                    word
                ];


            if (
                number >= 1 &&
                number <= SUPPORTED_LANGUAGES.length
            ) {

                return number;

            }

        }

    }


    // ------------------------------------
    // Ordinal words
    //
    // first
    // second
    // third
    // ...
    // ------------------------------------

    if (
        Object.prototype.hasOwnProperty.call(
            ORDINAL_WORDS,
            normalized
        )
    ) {

        const number =
            ORDINAL_WORDS[
                normalized
            ];


        if (
            number >= 1 &&
            number <= SUPPORTED_LANGUAGES.length
        ) {

            return number;

        }

    }


    return null;

}


// ========================================
// DETECT LANGUAGE SELECTION
// ========================================

export function detectLanguageSelection(
    message
) {

    const raw =
        String(
            message || ""
        ).trim();


    if (!raw) {
        return null;
    }


    const normalized =
        normalizeInput(
            raw
        );


    // ====================================
    // 1. NUMBER / ORDINAL SELECTION
    // ====================================

    const selectedNumber =
        extractLanguageNumber(
            normalized
        );


    if (
        selectedNumber !== null
    ) {

        return (
            SUPPORTED_LANGUAGES[
                selectedNumber - 1
            ] || null
        );

    }


    // ====================================
    // 2. LANGUAGE NAME
    // ====================================

    const languageByName =
        SUPPORTED_LANGUAGES.find(
            language => {

                const languageName =
                    language.name
                        .toLowerCase();

                const nativeName =
                    language.nativeName
                        .toLowerCase();


                return (

                    normalized ===
                    languageName

                    ||

                    normalized.includes(
                        languageName
                    )

                    ||

                    raw ===
                    language.nativeName

                    ||

                    raw.includes(
                        language.nativeName
                    )

                );

            }
        );


    if (
        languageByName
    ) {

        return languageByName;

    }


    // ====================================
    // 3. LANGUAGE CODE
    // ====================================

    const languageByCode =
        SUPPORTED_LANGUAGES.find(
            language =>
                normalized ===
                language.code
        );


    if (
        languageByCode
    ) {

        return languageByCode;

    }


    return null;

}


// ========================================
// GET LANGUAGE BY CODE
// ========================================

export function getLanguageByCode(
    code
) {

    return (
        SUPPORTED_LANGUAGES.find(
            language =>
                language.code ===
                code
        ) || null
    );

}


export function getNumberedLanguagePromptText() {
    return SUPPORTED_LANGUAGES
        .map(
            (language, index) =>
                `${index + 1}. ${language.name}`
        )
        .join(", ");
}