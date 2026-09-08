// ========================================
// NOVACARE TRANSLATION SERVICE
// ========================================
//
// Translation architecture:
//
// DEFAULT:
//   MyMemory public translation endpoint
//
// OPTIONAL FALLBACK:
//   OpenAI
//
// This service is used ONLY at the
// input/output boundary in ai.js:
//
// - translateToEnglish():
//   incoming user message
//   -> English
//   -> appointment state machine
//
// - translateText():
//   English bot response
//   -> selected language
//
// appointmentState.js never needs to know
// this service exists.
//
// IMPORTANT:
// MyMemory is suitable for DEMO/POC usage.
// Do NOT send real patient/medical information
// through a public translation service in
// production.
// ========================================


import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();


// ========================================
// CONFIGURATION
// ========================================

// Translation provider.
//
// "mymemory" = free/demo provider
// "openai"   = OpenAI only
// "auto"     = MyMemory first, OpenAI fallback
//
// Default:
// MyMemory
//
const TRANSLATION_PROVIDER =
    (
        process.env.TRANSLATION_PROVIDER ||
        "mymemory"
    ).toLowerCase();


// ========================================
// MYMEMORY
// ========================================

const MYMEMORY_ENDPOINT =
    "https://api.mymemory.translated.net/get";


// MyMemory documents a maximum of 500 bytes
// for the q parameter.
//
// We stay below that limit to leave some
// safety margin for UTF-8 encoded languages
// such as Tamil, Sinhala and Chinese.
//
const MYMEMORY_MAX_BYTES =
    450;


// Optional email.
//
// MyMemory documents the "de" parameter as
// optional and recommends it for higher-volume
// CAT-tool usage.
//
// For the demo it can remain empty.
//
const MYMEMORY_EMAIL =
    process.env.MYMEMORY_EMAIL ||
    "";


// ========================================
// OPENAI FALLBACK
// ========================================

const OPENAI_API_KEY =
    process.env.OPENAI_API_KEY;

const OPENAI_MODEL =
    process.env.OPENAI_TRANSLATE_MODEL ||
    process.env.OPENAI_MODEL ||
    "gpt-5.1";


const openai =
    OPENAI_API_KEY
        ? new OpenAI({
            apiKey: OPENAI_API_KEY
        })
        : null;


// ========================================
// REQUEST TIMEOUT
// ========================================

const TRANSLATION_TIMEOUT_MS =
    Number(
        process.env.TRANSLATION_TIMEOUT_MS ||
        8000
    );


// ========================================
// LANGUAGE MAPPING
// ========================================
//
// MyMemory accepts ISO language codes and
// RFC3066 language identifiers.
//
// Keep this mapping separate so the rest of
// NovaCare continues using the language codes
// already defined in languageService.js.
//

const MYMEMORY_LANGUAGE_CODES = {

    en: "en",

    si: "si",

    ta: "ta",

    fr: "fr",

    de: "de",

    zh: "zh-CN",

    vi: "vi",

    el: "el",

    it: "it",

    es: "es"

};


// ========================================
// SIMPLE IN-MEMORY CACHE
// ========================================
//
// Voicebots repeat the same prompts frequently.
//
// Example:
//
// "Which doctor would you like to book?"
// "What is your phone number?"
// "Would you like to confirm?"
//
// Caching prevents unnecessary translation
// requests.
//

const cache =
    new Map();


function cacheKey(
    text,
    sourceLanguageCode,
    targetLanguageCode
) {

    return (
        `${sourceLanguageCode}->${targetLanguageCode}::${text}`
    );

}


// ========================================
// UTILITY:
// UTF-8 BYTE LENGTH
// ========================================

function getByteLength(text) {

    return Buffer
        .byteLength(
            String(text || ""),
            "utf8"
        );

}


// ========================================
// UTILITY:
// NORMALIZE LANGUAGE CODE
// ========================================

function normalizeLanguageCode(
    languageCode
) {

    if (!languageCode) {
        return null;
    }

    const normalized =
        String(
            languageCode
        )
            .trim()
            .toLowerCase();


    return (
        MYMEMORY_LANGUAGE_CODES[
            normalized
        ] ||
        normalized
    );

}


// ========================================
// UTILITY:
// PROTECT IMPORTANT VALUES
// ========================================
//
// Translation engines can sometimes modify:
//
// - phone numbers
// - dates
// - times
// - confirmation numbers
//
// We replace them with temporary tokens before
// translation and restore them afterwards.
//
// Example:
//
// "Your appointment is on September 11 at 10 AM"
// stays structurally intact.
//
// ========================================

function protectImportantValues(
    text
) {

    const values = [];

    let protectedText =
        String(text || "");


    // ------------------------------------
    // Phone-like numbers
    // ------------------------------------

    protectedText =
        protectedText.replace(
            /(?<!\w)(?:\+?\d[\d\s().-]{6,}\d)(?!\w)/g,
            match => {

                const token =
                    `__NOVACARE_VALUE_${values.length}__`;

                values.push(match);

                return token;

            }
        );


    // ------------------------------------
    // Dates
    // ------------------------------------

    protectedText =
        protectedText.replace(
            /\b\d{1,4}[\/.-]\d{1,2}[\/.-]\d{1,4}\b/g,
            match => {

                const token =
                    `__NOVACARE_VALUE_${values.length}__`;

                values.push(match);

                return token;

            }
        );


    // ------------------------------------
    // Times
    // ------------------------------------

    protectedText =
        protectedText.replace(
            /\b\d{1,2}(?::\d{2})?\s?(?:AM|PM|am|pm)\b/g,
            match => {

                const token =
                    `__NOVACARE_VALUE_${values.length}__`;

                values.push(match);

                return token;

            }
        );


    // ------------------------------------
    // Confirmation IDs
    // ------------------------------------

    protectedText =
        protectedText.replace(
            /\b(?:APT|APPOINTMENT|CONF|CONFIRMATION)[-_ ]?[A-Z0-9]{3,}\b/gi,
            match => {

                const token =
                    `__NOVACARE_VALUE_${values.length}__`;

                values.push(match);

                return token;

            }
        );


    return {
        text: protectedText,
        values
    };

}


// ========================================
// RESTORE IMPORTANT VALUES
// ========================================

function restoreImportantValues(
    text,
    values
) {

    let restored =
        String(
            text || ""
        );


    values.forEach(
        (value, index) => {

            const tokenNumber =
                index;


            // Match variations such as:
            //
            // __NOVACARE_VALUE_0__
            // __ NOVACARE_VALUE_0 __
            // _NOVACARE_VALUE_0_
            //
            // This protects us from translation
            // services adding spaces around tokens.

            const tokenPattern =
                new RegExp(
                    `_+\\s*NOVACARE\\s*_?\\s*VALUE\\s*_?\\s*${tokenNumber}\\s*_+`,
                    "gi"
                );


            restored =
                restored.replace(
                    tokenPattern,
                    value
                );

        }
    );


    // ------------------------------------
    // FINAL SAFETY NET
    // ------------------------------------
    //
    // Never allow internal NovaCare tokens
    // to reach the user.
    //

    restored =
        restored.replace(
            /_+\s*NOVACARE\s*_?\s*VALUE\s*_?\s*\d+\s*_+/gi,
            ""
        );


    return restored
        .replace(
            /\s{2,}/g,
            " "
        )
        .trim();

}


// ========================================
// SPLIT TEXT FOR MYMEMORY
// ========================================
//
// MyMemory documents a 500-byte q limit.
//
// We keep each request below 450 bytes.
//
// This is mainly protection for long user
// messages. Normal appointment prompts will
// generally fit into one request.
//

function splitIntoChunks(
    text
) {

    const input =
        String(text || "").trim();


    if (!input) {
        return [];
    }


    if (
        getByteLength(input)
        <= MYMEMORY_MAX_BYTES
    ) {

        return [input];

    }


    const words =
        input.split(
            /\s+/
        );


    const chunks = [];

    let current = "";


    for (
        const word
        of words
    ) {

        const candidate =
            current
                ? `${current} ${word}`
                : word;


        if (
            getByteLength(candidate)
            <= MYMEMORY_MAX_BYTES
        ) {

            current =
                candidate;

            continue;

        }


        if (current) {

            chunks.push(
                current
            );

        }


        // A single word may itself exceed
        // the limit. Break it safely by
        // characters.
        //
        if (
            getByteLength(word)
            > MYMEMORY_MAX_BYTES
        ) {

            let piece =
                "";

            for (
                const character
                of word
            ) {

                const next =
                    piece +
                    character;


                if (
                    getByteLength(next)
                    <= MYMEMORY_MAX_BYTES
                ) {

                    piece =
                        next;

                } else {

                    if (piece) {

                        chunks.push(
                            piece
                        );

                    }

                    piece =
                        character;

                }

            }


            current =
                piece;

        } else {

            current =
                word;

        }

    }


    if (current) {

        chunks.push(
            current
        );

    }


    return chunks;

}


// ========================================
// MYMEMORY SINGLE REQUEST
// ========================================

async function translateWithMyMemoryOnce(
    text,
    sourceLanguageCode,
    targetLanguageCode
) {

    const source =
        normalizeLanguageCode(
            sourceLanguageCode
        );

    const target =
        normalizeLanguageCode(
            targetLanguageCode
        );


    if (
        !source ||
        !target ||
        source === target
    ) {

        return text;

    }


    const controller =
        new AbortController();


    const timeout =
        setTimeout(
            () => {
                controller.abort();
            },
            TRANSLATION_TIMEOUT_MS
        );


    try {

        const params =
            new URLSearchParams();


        params.set(
            "q",
            text
        );


        params.set(
            "langpair",
            `${source}|${target}`
        );


        // Machine translation enabled.
        params.set(
            "mt",
            "1"
        );


        if (MYMEMORY_EMAIL) {

            params.set(
                "de",
                MYMEMORY_EMAIL
            );

        }


        const response =
            await fetch(
                `${MYMEMORY_ENDPOINT}?${params.toString()}`,
                {
                    method: "GET",

                    signal:
                        controller.signal,

                    headers: {
                        Accept:
                            "application/json"
                    }
                }
            );


        if (!response.ok) {

            throw new Error(
                `MyMemory HTTP ${response.status}`
            );

        }


        const data =
            await response.json();


        const translated =
            data
                ?.responseData
                ?.translatedText
                ?.trim();


        if (!translated) {

            throw new Error(
                "MyMemory returned an empty translation"
            );

        }


        // MyMemory can return an error-like
        // response with 200 status in some cases.
        //
        // Treat obvious failures as errors.
        //
        if (
            data?.responseStatus &&
            Number(data.responseStatus) >= 400
        ) {

            throw new Error(
                data?.responseDetails ||
                "MyMemory translation failed"
            );

        }


        return translated;

    } finally {

        clearTimeout(
            timeout
        );

    }

}


// ========================================
// MYMEMORY TRANSLATION
// ========================================

async function translateWithMyMemory(
    text,
    sourceLanguageCode,
    targetLanguageCode
) {

    const protectedResult =
        protectImportantValues(
            text
        );


    const chunks =
        splitIntoChunks(
            protectedResult.text
        );


    if (!chunks.length) {
        return text;
    }


    const translatedChunks = [];


    for (
        const chunk
        of chunks
    ) {

        const translated =
            await translateWithMyMemoryOnce(
                chunk,
                sourceLanguageCode,
                targetLanguageCode
            );


        translatedChunks.push(
            translated
        );

    }


    const translatedText =
        translatedChunks.join(
            " "
        );


    return restoreImportantValues(
        translatedText,
        protectedResult.values
    );

}


// ========================================
// OPENAI TRANSLATION
// ========================================

async function translateWithOpenAI(
    text,
    sourceLanguageCode,
    targetLanguageCode
) {

    if (!openai) {

        throw new Error(
            "OpenAI translation is not configured"
        );

    }


    const source =
        normalizeLanguageCode(
            sourceLanguageCode
        );

    const target =
        normalizeLanguageCode(
            targetLanguageCode
        );


    const completion =
        await openai.chat.completions.create({

            model:
                OPENAI_MODEL,

            messages: [

                {
                    role:
                        "system",

                    content:
                        `You are a translation engine for a medical appointment voice assistant.

Translate the user's message from language code "${source}" into language code "${target}".

Keep the translation natural for speech because the result will be read aloud by text-to-speech.

Preserve names, phone numbers, dates, times, numbers and confirmation numbers exactly as written.

Do not add information.

Respond with ONLY the translated text.
No quotes.
No explanation.`

                },

                {
                    role:
                        "user",

                    content:
                        text

                }

            ],

            temperature:
                0

        });


    return (
        completion
            ?.choices?.[0]
            ?.message
            ?.content
            ?.trim() ||
        text
    );

}


// ========================================
// PROVIDER:
// ENGLISH -> TARGET LANGUAGE
// ========================================

async function translateOutbound(
    text,
    targetLanguageCode
) {

    const target =
        normalizeLanguageCode(
            targetLanguageCode
        );


    if (
        !text ||
        !target ||
        target === "en"
    ) {

        return text;

    }


    // ------------------------------------
    // CACHE
    // ------------------------------------

    const key =
        cacheKey(
            text,
            "en",
            target
        );


    if (
        cache.has(key)
    ) {

        console.log(
            `TRANSLATION CACHE HIT: en -> ${target}`
        );

        return cache.get(
            key
        );

    }


    // ====================================
    // MYMEMORY FIRST
    // ====================================

    if (
        TRANSLATION_PROVIDER === "mymemory" ||
        TRANSLATION_PROVIDER === "auto"
    ) {

        try {

            console.log(
                `TRANSLATION PROVIDER: MYMEMORY | en -> ${target}`
            );


            const translated =
                await translateWithMyMemory(
                    text,
                    "en",
                    target
                );


            cache.set(
                key,
                translated
            );


            return translated;

        } catch (error) {

            console.error(
                "MYMEMORY TRANSLATION ERROR:",
                error.message
            );


            if (
                TRANSLATION_PROVIDER ===
                "mymemory"
            ) {

                // Even when MyMemory is the
                // configured provider, try
                // OpenAI if it is available.
                //
                if (openai) {

                    console.log(
                        "TRANSLATION PROVIDER: OPENAI_FALLBACK"
                    );

                    try {

                        const translated =
                            await translateWithOpenAI(
                                text,
                                "en",
                                target
                            );


                        cache.set(
                            key,
                            translated
                        );


                        return translated;

                    } catch (
                        openAIError
                    ) {

                        console.error(
                            "OPENAI TRANSLATION FALLBACK ERROR:",
                            openAIError.message
                        );

                    }

                }

            }

        }

    }


    // ====================================
    // OPENAI
    // ====================================

    if (
        TRANSLATION_PROVIDER === "openai" ||
        TRANSLATION_PROVIDER === "auto" ||
        openai
    ) {

        if (openai) {

            try {

                console.log(
                    `TRANSLATION PROVIDER: OPENAI | en -> ${target}`
                );


                const translated =
                    await translateWithOpenAI(
                        text,
                        "en",
                        target
                    );


                cache.set(
                    key,
                    translated
                );


                return translated;

            } catch (error) {

                console.error(
                    "OPENAI TRANSLATION ERROR:",
                    error.message
                );

            }

        }

    }


    // ====================================
    // FINAL SAFE FALLBACK
    // ====================================

    console.warn(
        "TRANSLATION FALLBACK: returning original English text"
    );


    return text;

}


// ========================================
// PROVIDER:
// SOURCE LANGUAGE -> ENGLISH
// ========================================

async function translateInbound(
    text,
    sourceLanguageCode
) {

    const source =
        normalizeLanguageCode(
            sourceLanguageCode
        );


    if (
        !text ||
        !source ||
        source === "en"
    ) {

        return text;

    }


    // ------------------------------------
    // CACHE
    // ------------------------------------

    const key =
        cacheKey(
            text,
            source,
            "en"
        );


    if (
        cache.has(key)
    ) {

        console.log(
            `TRANSLATION CACHE HIT: ${source} -> en`
        );

        return cache.get(
            key
        );

    }


    // ====================================
    // MYMEMORY
    // ====================================

    if (
        TRANSLATION_PROVIDER === "mymemory" ||
        TRANSLATION_PROVIDER === "auto"
    ) {

        try {

            console.log(
                `TRANSLATION PROVIDER: MYMEMORY | ${source} -> en`
            );


            const translated =
                await translateWithMyMemory(
                    text,
                    source,
                    "en"
                );


            cache.set(
                key,
                translated
            );


            return translated;

        } catch (error) {

            console.error(
                "MYMEMORY TRANSLATION ERROR:",
                error.message
            );


            if (
                openai
            ) {

                console.log(
                    "TRANSLATION PROVIDER: OPENAI_FALLBACK"
                );


                try {

                    const translated =
                        await translateWithOpenAI(
                            text,
                            source,
                            "en"
                        );


                    cache.set(
                        key,
                        translated
                    );


                    return translated;

                } catch (
                    openAIError
                ) {

                    console.error(
                        "OPENAI TRANSLATION FALLBACK ERROR:",
                        openAIError.message
                    );

                }

            }

        }

    }


    // ====================================
    // OPENAI
    // ====================================

    if (
        TRANSLATION_PROVIDER === "openai" ||
        TRANSLATION_PROVIDER === "auto"
    ) {

        if (openai) {

            try {

                console.log(
                    `TRANSLATION PROVIDER: OPENAI | ${source} -> en`
                );


                const translated =
                    await translateWithOpenAI(
                        text,
                        source,
                        "en"
                    );


                cache.set(
                    key,
                    translated
                );


                return translated;

            } catch (error) {

                console.error(
                    "OPENAI TRANSLATION ERROR:",
                    error.message
                );

            }

        }

    }


    // ====================================
    // FINAL SAFE FALLBACK
    // ====================================

    console.warn(
        "TRANSLATION FALLBACK: returning original source text"
    );


    return text;

}


// ========================================
// PUBLIC API
// ========================================
//
// IMPORTANT:
// These two functions intentionally keep the
// same names and signatures as your existing
// translationService.js.
//
// ai.js therefore does NOT need to change.
// ========================================


// ========================================
// ENGLISH -> TARGET LANGUAGE
// ========================================

export async function translateText(
    text,
    targetLanguageCode
) {

    return await translateOutbound(
        text,
        targetLanguageCode
    );

}


// ========================================
// SOURCE LANGUAGE -> ENGLISH
// ========================================

export async function translateToEnglish(
    text,
    sourceLanguageCode
) {

    return await translateInbound(
        text,
        sourceLanguageCode
    );

}


// ========================================
// DEFAULT EXPORT
// ========================================

export default {

    translateText,

    translateToEnglish

};