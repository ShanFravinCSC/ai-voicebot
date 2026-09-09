// ========================================
// NOVACARE AI VOICEBOT
// FRONTEND APPLICATION
// ========================================
//
// Voice-specific production handling:
//
// - Microphone permission errors
// - Speech recognition errors
// - Silence / no-speech timeout
// - Duplicate transcript protection
// - Recognition lifecycle management
// - Text + voice use same sendMessage()
// - TTS error handling
// - Network timeout handling
// - Prevent duplicate requests
// - Safe conversation state handling
//
// ========================================


// ========================================
// CONVERSATION STATE
// ========================================

let conversationHistory = [];

let appointmentState = null;


// ========================================
// REQUEST STATE
// ========================================

let isProcessing = false;


// ========================================
// SPEECH STATE
// ========================================

let recognition = null;

let isListening = false;

let recognitionStarted = false;

// ========================================
// NOVACARE SPEECH LANGUAGE CONFIGURATION
// ========================================
//
// Recognition and text-to-speech use the
// language selected by the user.
//
// The initial language remains English because
// the language-selection screen accepts:
//
// - 1
// - number one
// - first
// - Tamil
// - Sinhala
// etc.
//
// After selection, voice recognition switches
// to the selected language.
//
// ========================================

const SPEECH_LANGUAGE_MAP = {

    en: {
        recognition: "en-US",
        speech: "en-US"
    },

    si: {
        recognition: "si-LK",
        speech: "si-LK"
    },

    ta: {
        recognition: "ta-IN",
        speech: "ta-IN"
    },

    fr: {
        recognition: "fr-FR",
        speech: "fr-FR"
    },

    de: {
        recognition: "de-DE",
        speech: "de-DE"
    },

    zh: {
        recognition: "zh-CN",
        speech: "zh-CN"
    },

    vi: {
        recognition: "vi-VN",
        speech: "vi-VN"
    },

    el: {
        recognition: "el-GR",
        speech: "el-GR"
    },

    it: {
        recognition: "it-IT",
        speech: "it-IT"
    },

    es: {
        recognition: "es-ES",
        speech: "es-ES"
    }

};


// ========================================
// CURRENT SPEECH LANGUAGE
// ========================================
//
// English is used until the user selects
// a language.
//

let currentSpeechLanguage =
    "en";


// ========================================
// GET SPEECH CONFIGURATION
// ========================================

function getSpeechLanguageConfig() {

    return (
        SPEECH_LANGUAGE_MAP[
            currentSpeechLanguage
        ] ||
        SPEECH_LANGUAGE_MAP.en
    );

}


// ========================================
// UPDATE SPEECH LANGUAGE
// ========================================

function updateSpeechLanguage(
    languageCode
) {

    if (
        !languageCode ||
        !SPEECH_LANGUAGE_MAP[
            languageCode
        ]
    ) {

        currentSpeechLanguage =
            "en";

    } else {

        currentSpeechLanguage =
            languageCode;

    }


    const config =
        getSpeechLanguageConfig();


    console.log(
        "SPEECH LANGUAGE UPDATED:",
        {
            language:
                currentSpeechLanguage,

            recognition:
                config.recognition,

            speech:
                config.speech
        }
    );


    // Update recognition immediately
    // if the recognition object already exists.

    if (recognition) {

        recognition.lang =
            config.recognition;

    }

}


// ========================================
// VOICE TIMERS
// ========================================

// Maximum time Nova waits for the user
// to start speaking.
const SPEECH_TIMEOUT = 10000;

let speechTimeoutTimer = null;


// ========================================
// DUPLICATE SPEECH PROTECTION
// ========================================

let lastTranscript = "";

let lastTranscriptTime = 0;

const DUPLICATE_WINDOW = 2000;


// ========================================
// DOM ELEMENTS
// ========================================

const micButton =
    document.getElementById("micButton");

const textInput =
    document.getElementById("textInput");

const sendButton =
    document.getElementById("sendButton");

const conversation =
    document.getElementById("conversation");

const statusText =
    document.getElementById("statusText");

const statusDot =
    document.getElementById("statusDot");

const instruction =
    document.getElementById("instruction");


// ========================================
// INITIAL UI
// ========================================

setReadyState();


// ========================================
// SPEECH RECOGNITION
// ========================================

const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;


// ========================================
// CHECK BROWSER SUPPORT
// ========================================

if (!SpeechRecognition) {

    console.warn(
        "Speech recognition is not supported."
    );


    if (instruction) {

        instruction.textContent =
            "Speech recognition is not supported in this browser. Please use Google Chrome.";

    }


    if (micButton) {

        micButton.disabled = true;

    }

} else {

    initializeSpeechRecognition();

}


// ========================================
// INITIALIZE SPEECH RECOGNITION
// ========================================

function initializeSpeechRecognition() {

    recognition =
        new SpeechRecognition();


    // ------------------------------------
    // Recognition configuration
    // ------------------------------------

    recognition.continuous = false;

    recognition.interimResults = false;

    recognition.lang =
        getSpeechLanguageConfig().recognition;


    // ------------------------------------
    // SPEECH START
    // ------------------------------------

    recognition.onstart = () => {

        console.log(
            "VOICE: recognition started"
        );


        recognitionStarted = true;

        isListening = true;


        clearSpeechTimeout();


        micButton.classList.add(
            "listening"
        );


        statusText.textContent =
            "Listening...";


        instruction.textContent =
            "Speak now...";


        // Stop Nova from speaking
        // while user is talking.

        window.speechSynthesis.cancel();


        // --------------------------------
        // Silence protection
        // --------------------------------
        //
        // If the user doesn't speak within
        // 10 seconds, stop recognition.

        speechTimeoutTimer =
            setTimeout(() => {

                if (
                    isListening &&
                    !isProcessing
                ) {

                    console.log(
                        "VOICE: speech timeout"
                    );


                    stopRecognition();


                    statusText.textContent =
                        "No speech detected";


                    instruction.textContent =
                        "I couldn't hear you. Please try again.";


                    speak(
                        "I couldn't hear you. Please try again."
                    );

                }

            }, SPEECH_TIMEOUT);

    };


    // ------------------------------------
    // SPEECH RESULT
    // ------------------------------------

    recognition.onresult =
        async (event) => {

            clearSpeechTimeout();


            if (!event.results) {

                console.warn(
                    "VOICE: no results"
                );

                return;
            }


            const result =
                event.results[
                    event.results.length - 1
                ];


            if (!result || !result[0]) {

                return;
            }


            const transcript =
                result[0]
                    .transcript
                    .trim();


            console.log(
                "USER SAID:",
                transcript
            );


            if (!transcript) {

                console.warn(
                    "VOICE: empty transcript"
                );

                return;
            }


            // --------------------------------
            // DUPLICATE PROTECTION
            // --------------------------------

            if (
                isDuplicateTranscript(
                    transcript
                )
            ) {

                console.warn(
                    "VOICE: duplicate transcript ignored:",
                    transcript
                );

                return;
            }


            rememberTranscript(
                transcript
            );


            // --------------------------------
            // Stop recognition
            // --------------------------------

            stopRecognition();


            // --------------------------------
            // Send to SAME conversation
            // pipeline used by text input.
            // --------------------------------

            await sendMessage(
                transcript,
                "voice"
            );
        };


    // ------------------------------------
    // SPEECH END
    // ------------------------------------

    recognition.onend = () => {

        console.log(
            "VOICE: recognition ended"
        );


        clearSpeechTimeout();


        isListening = false;

        recognitionStarted = false;


        micButton.classList.remove(
            "listening"
        );


        // --------------------------------
        // IMPORTANT
        // --------------------------------
        //
        // Don't overwrite "Thinking..."
        // or "Speaking..." while backend
        // request / TTS is still running.

        if (!isProcessing) {

            setReadyState();

        }

    };


    // ------------------------------------
    // SPEECH ERROR
    // ------------------------------------

    recognition.onerror =
        (event) => {

            console.error(
                "VOICE RECOGNITION ERROR:",
                event.error
            );


            clearSpeechTimeout();


            isListening = false;

            recognitionStarted = false;


            micButton.classList.remove(
                "listening"
            );


            // --------------------------------
            // PERMISSION DENIED
            // --------------------------------

            if (
                event.error ===
                "not-allowed"
            ) {

                statusText.textContent =
                    "Microphone blocked";


                instruction.textContent =
                    "Please allow microphone access and try again.";


                return;
            }


            // --------------------------------
            // MICROPHONE NOT AVAILABLE
            // --------------------------------

            if (
                event.error ===
                "audio-capture"
            ) {

                statusText.textContent =
                    "Microphone unavailable";


                instruction.textContent =
                    "Please check your microphone and try again.";


                return;
            }


            // --------------------------------
            // NO SPEECH
            // --------------------------------

            if (
                event.error ===
                "no-speech"
            ) {

                statusText.textContent =
                    "No speech detected";


                instruction.textContent =
                    "I couldn't hear you. Please try again.";


                return;
            }


            // --------------------------------
            // SPEECH SERVICE ERROR
            // --------------------------------

            if (
                event.error ===
                    "service-not-allowed" ||
                event.error ===
                    "network"
            ) {

                statusText.textContent =
                    "Voice service unavailable";


                instruction.textContent =
                    "Voice recognition is temporarily unavailable. You can type your message instead.";


                return;
            }


            // --------------------------------
            // ABORTED
            // --------------------------------
            //
            // Usually caused by manually
            // stopping recognition.
            //
            // Don't show an error.

            if (
                event.error ===
                "aborted"
            ) {

                if (!isProcessing) {

                    setReadyState();

                }

                return;
            }


            // --------------------------------
            // UNKNOWN ERROR
            // --------------------------------

            statusText.textContent =
                "Voice error";


            instruction.textContent =
                "I couldn't process your voice. Please try again or type your message.";
        };
}


// ========================================
// MICROPHONE BUTTON
// ========================================

micButton.addEventListener(
    "click",
    () => {

        // --------------------------------
        // Browser doesn't support voice
        // --------------------------------

        if (!recognition) {

            return;
        }


        // --------------------------------
        // Don't allow voice while request
        // is being processed
        // --------------------------------

        if (isProcessing) {

            console.log(
                "VOICE: request already processing"
            );

            return;
        }


        // --------------------------------
        // Stop Nova speaking
        // --------------------------------

        window.speechSynthesis.cancel();


        // --------------------------------
        // Stop current recognition
        // --------------------------------

        if (isListening) {

            stopRecognition();

            return;
        }


        // --------------------------------
        // Start recognition
        // --------------------------------

        startRecognition();
    }
);


// ========================================
// START RECOGNITION
// ========================================


function startRecognition() {

    if (!recognition) {

        return;
    }


    if (isProcessing) {

        return;
    }


    if (isListening) {

        return;
    }


    // Clear previous timer

    clearSpeechTimeout();

    // ------------------------------------
    // Apply currently selected language
    // ------------------------------------

    recognition.lang =
        getSpeechLanguageConfig().recognition;


    console.log(
        "VOICE RECOGNITION LANGUAGE:",
        recognition.lang
    );


    try {

        recognition.start();

    } catch (error) {

        console.error(
            "VOICE START ERROR:",
            error
        );


        // Browser can throw if
        // start() is called too quickly.

        if (
            error.name ===
            "InvalidStateError"
        ) {

            console.warn(
                "VOICE: recognition already starting/running"
            );

            return;
        }


        statusText.textContent =
            "Voice unavailable";


        instruction.textContent =
            "Unable to start voice recognition. Please try again or type your message.";
    }
}


// ========================================
// STOP RECOGNITION
// ========================================

function stopRecognition() {

    clearSpeechTimeout();


    if (!recognition) {

        return;
    }


    isListening = false;


    micButton.classList.remove(
        "listening"
    );


    try {

        if (recognitionStarted) {

            recognition.stop();

        }

    } catch (error) {

        console.warn(
            "VOICE STOP ERROR:",
            error
        );

    }


    recognitionStarted = false;
}


// ========================================
// SPEECH TIMEOUT
// ========================================

function clearSpeechTimeout() {

    if (speechTimeoutTimer) {

        clearTimeout(
            speechTimeoutTimer
        );

        speechTimeoutTimer = null;

    }
}


// ========================================
// DUPLICATE TRANSCRIPT CHECK
// ========================================

function isDuplicateTranscript(
    transcript
) {

    const normalized =
        transcript
            .toLowerCase()
            .replace(
                /\s+/g,
                " "
            )
            .trim();


    const now =
        Date.now();


    return (
        normalized ===
            lastTranscript &&
        now -
            lastTranscriptTime <
            DUPLICATE_WINDOW
    );
}


// ========================================
// REMEMBER TRANSCRIPT
// ========================================

function rememberTranscript(
    transcript
) {

    lastTranscript =
        transcript
            .toLowerCase()
            .replace(
                /\s+/g,
                " "
            )
            .trim();


    lastTranscriptTime =
        Date.now();
}


// ========================================
// SEND BUTTON
// ========================================

sendButton.addEventListener(
    "click",
    () => {

        if (isProcessing) {

            return;
        }


        const message =
            textInput.value.trim();


        if (!message) {

            return;
        }


        textInput.value = "";


        sendMessage(
            message,
            "text"
        );
    }
);


// ========================================
// ENTER KEY
// ========================================

textInput.addEventListener(
    "keydown",
    event => {

        if (
            event.key !==
            "Enter"
        ) {

            return;
        }


        event.preventDefault();


        if (isProcessing) {

            return;
        }


        const message =
            textInput.value.trim();


        if (!message) {

            return;
        }


        textInput.value = "";


        sendMessage(
            message,
            "text"
        );
    }
);


// ========================================
// SEND MESSAGE TO BACKEND
// ========================================
//
// IMPORTANT:
//
// Voice and text both enter this same
// function.
//
// Therefore the appointment state
// machine doesn't care whether the
// user typed or spoke.
//
// ========================================

async function sendMessage(
    message,
    source = "text"
) {

    if (
        !message ||
        !message.trim()
    ) {

        return;
    }


    if (isProcessing) {

        console.warn(
            "MESSAGE IGNORED: request already processing"
        );

        return;
    }


    isProcessing = true;


    // ------------------------------------
    // Stop recognition if active
    // ------------------------------------

    if (isListening) {

        stopRecognition();

    }


    // ------------------------------------
    // Stop Nova speaking
    // ------------------------------------

    window.speechSynthesis.cancel();


    // ------------------------------------
    // Show user message
    // ------------------------------------

    addMessage(
        "user",
        "You",
        message
    );


    // ------------------------------------
    // Add user message to history
    // ------------------------------------

    conversationHistory.push({

        role: "user",

        content: message

    });


    // ------------------------------------
    // UI
    // ------------------------------------

    statusText.textContent =
        "Thinking...";


    instruction.textContent =
        source === "voice"
            ? "Nova is processing what you said..."
            : "Nova is processing your request...";


    // ------------------------------------
    // REQUEST CONTROLLER
    // ------------------------------------

    const controller =
        new AbortController();


    // ------------------------------------
    // Backend timeout
    // ------------------------------------

    const requestTimeout =
        setTimeout(() => {

            controller.abort();

        }, 30000);


    try {

        console.log(
            "SENDING MESSAGE:",
            {
                source,
                message,
                state:
                    appointmentState
            }
        );


        // --------------------------------
        // SEND REQUEST
        // --------------------------------

        const response =
            await fetch(
                "/api/chat",
                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            message:
                                message,

                            history:
                                conversationHistory,

                            state:
                                appointmentState

                        }),

                    signal:
                        controller.signal
                }
            );


        // --------------------------------
        // Parse response
        // --------------------------------

        let data;

        try {

            data =
                await response.json();

        } catch (jsonError) {

            throw new Error(
                "Invalid server response"
            );
        }


        // --------------------------------
        // HTTP ERROR
        // --------------------------------

        if (!response.ok) {

            throw new Error(
                data.error ||
                "Something went wrong"
            );
        }


        // --------------------------------
        // Validate response
        // --------------------------------

        if (
            !data.success ||
            !data.response
        ) {

            throw new Error(
                "Invalid response from server"
            );
        }


        // --------------------------------
        // SAVE APPOINTMENT STATE
        // --------------------------------

        if (
            data.state
        ) {

            appointmentState =
                data.state;

            console.log(
                "APPOINTMENT STATE UPDATED:",
                appointmentState
            );

            // --------------------------------
            // Update browser speech language
            // --------------------------------

            if (
                appointmentState.language
            ) {

                updateSpeechLanguage(
                    appointmentState.language
                );

            }
        }


        // --------------------------------
        // HUMAN SUPPORT TRANSFER
        // --------------------------------

        if (
            data.transfer &&
            data.transfer.success
        ) {

            console.log(
                "HUMAN SUPPORT TRANSFER RECEIVED:",
                data.transfer
            );

            showHumanSupport(
                data.transfer
            );
        }


        // --------------------------------
        // Nova response
        // --------------------------------

        const aiMessage =
            data.response;

        // --------------------------------
        // SAVE ASSISTANT MESSAGE
        // --------------------------------

        conversationHistory.push({

            role:
                "assistant",

            content:
                aiMessage

        });


        // --------------------------------
        // DISPLAY NOVA MESSAGE
        // --------------------------------

        addMessage(
            "bot",
            "Nova",
            aiMessage
        );


        // --------------------------------
        // SPEAK
        // --------------------------------

        statusText.textContent =
            "Speaking...";


        instruction.textContent =
            "Nova is responding...";


        speak(
            aiMessage
        );

    } catch (error) {

        console.error(
            "CHAT ERROR:",
            error
        );


        // --------------------------------
        // Remove user message from
        // history because request failed.
        // --------------------------------

        if (
            conversationHistory.length >
            0
        ) {

            conversationHistory.pop();

        }


        // --------------------------------
        // REQUEST TIMEOUT
        // --------------------------------

        if (
            error.name ===
            "AbortError"
        ) {

            handleVoiceOrNetworkFailure(
                "The request took too long to respond. Please try again."
            );

            return;
        }


        // --------------------------------
        // NETWORK FAILURE
        // --------------------------------

        if (
            error instanceof
            TypeError
        ) {

            handleVoiceOrNetworkFailure(
                "I'm having trouble connecting to the server. Please try again."
            );

            return;
        }


        // --------------------------------
        // GENERAL BACKEND ERROR
        // --------------------------------

        handleVoiceOrNetworkFailure(
            "Sorry, I'm having trouble right now. Please try again."
        );

    } finally {

        clearTimeout(
            requestTimeout
        );


        isProcessing = false;


        // Don't override TTS state.
        //
        // speak() will call setReadyState()
        // when speech finishes.

    }
}


// ========================================
// HANDLE VOICE / NETWORK FAILURE
// ========================================

function handleVoiceOrNetworkFailure(
    message
) {

    addMessage(
        "bot",
        "Nova",
        message
    );


    statusText.textContent =
        "Ready";


    instruction.textContent =
        "You can try speaking again or type your message.";


    speak(
        message
    );
}


// ========================================
// ADD MESSAGE
// ========================================

function addMessage(
    type,
    name,
    message
) {

    const messageDiv =
        document.createElement(
            "div"
        );


    messageDiv.className =
        `message ${type}`;


    messageDiv.innerHTML = `
        <strong>${escapeHtml(name)}</strong>
        <p>${escapeHtml(message)}</p>
    `;


    conversation.appendChild(
        messageDiv
    );


    // Scroll to latest message

    conversation.scrollTop =
        conversation.scrollHeight;
}

// ========================================
// FIND BEST BROWSER VOICE
// ========================================

function findBestVoice(
    voices,
    targetLanguage
) {

    if (
        !voices ||
        !voices.length ||
        !targetLanguage
    ) {

        return null;
    }


    const normalizedTarget =
        String(targetLanguage)
            .toLowerCase()
            .trim();


    const languageFamily =
        normalizedTarget
            .split("-")[0];


    console.log(
        "TTS: Looking for voice:",
        normalizedTarget
    );


    // ====================================
    // 1. EXACT MATCH
    // ====================================

    let voice =
        voices.find(
            item =>
                item.lang &&
                item.lang
                    .toLowerCase()
                    .trim() ===
                normalizedTarget
        );


    if (voice) {

        console.log(
            "TTS: Exact voice found:",
            voice.name,
            voice.lang
        );

        return voice;
    }


    // ====================================
    // 2. LANGUAGE FAMILY MATCH
    // ====================================

    voice =
        voices.find(
            item => {

                if (!item.lang) {
                    return false;
                }


                const voiceLanguage =
                    item.lang
                        .toLowerCase()
                        .trim()
                        .split("-")[0];


                return (
                    voiceLanguage ===
                    languageFamily
                );
            }
        );


    if (voice) {

        console.log(
            "TTS: Language-family voice found:",
            voice.name,
            voice.lang
        );

        return voice;
    }


    // ====================================
    // 3. GOOGLE VOICE PREFERENCE
    // ====================================
    //
    // Chrome may expose several voices.
    // Prefer Google voices when available.
    //

    voice =
        voices.find(
            item => {

                if (!item.lang) {
                    return false;
                }


                const voiceLanguage =
                    item.lang
                        .toLowerCase()
                        .trim()
                        .split("-")[0];


                const voiceName =
                    item.name
                        ? item.name.toLowerCase()
                        : "";


                return (
                    voiceLanguage ===
                    languageFamily &&
                    voiceName.includes("google")
                );
            }
        );


    if (voice) {

        console.log(
            "TTS: Google voice found:",
            voice.name,
            voice.lang
        );

        return voice;
    }


    return null;
}

// ========================================
// TEXT TO SPEECH
// ========================================

function speak(
    text
) {

    if (!text) {

        setReadyState();

        return;
    }


    // ====================================
    // STOP PREVIOUS SPEECH
    // ====================================

    window.speechSynthesis.cancel();


    // ====================================
    // CURRENT LANGUAGE
    // ====================================

    const languageConfig =
        getSpeechLanguageConfig();


    console.log(
        "===================================="
    );

    console.log(
        "NOVA TTS"
    );

    console.log(
        "Current language:",
        currentSpeechLanguage
    );

    console.log(
        "Requested speech language:",
        languageConfig.speech
    );


    // ====================================
    // GET AVAILABLE VOICES
    // ====================================

    const voices =
        window.speechSynthesis
            .getVoices();


    console.log(
        "Available TTS voices:",
        voices.length
    );


    // ====================================
    // FIND MATCHING VOICE
    // ====================================

    const selectedVoice =
        findBestVoice(
            voices,
            languageConfig.speech
        );


    // ====================================
    // CREATE SPEECH
    // ====================================

    const speech =
        new SpeechSynthesisUtterance(
            text
        );


    speech.lang =
        languageConfig.speech;


    speech.rate =
        1;


    speech.pitch =
        1;


    speech.volume =
        1;


    // ====================================
    // APPLY MATCHING VOICE
    // ====================================

    if (selectedVoice) {

        speech.voice =
            selectedVoice;


        // Use the actual voice language.
        //
        // This is important because some
        // browsers expose voices using:
        //
        // ta-IN
        // ta
        // Tamil
        //

        speech.lang =
            selectedVoice.lang;


        console.log(
            "TTS VOICE SELECTED:",
            {
                name:
                    selectedVoice.name,

                lang:
                    selectedVoice.lang,

                requested:
                    languageConfig.speech
            }
        );

    } else {

        console.error(
            "===================================="
        );

        console.error(
            "NO MATCHING TTS VOICE FOUND"
        );

        console.error(
            "Requested:",
            languageConfig.speech
        );

        console.error(
            "Available voices:"
        );


        voices.forEach(
            voice => {

                console.error(
                    `${voice.name} | ${voice.lang}`
                );

            }
        );


        console.error(
            "===================================="
        );

        // Keep the requested language.
        //
        // DO NOT intentionally fall back
        // to English.
        //

        speech.lang =
            languageConfig.speech;
    }


    // ====================================
    // SPEECH START
    // ====================================

    speech.onstart = () => {

        console.log(
            "TTS STARTED:",
            speech.lang
        );


        statusText.textContent =
            "Speaking...";


        instruction.textContent =
            "Nova is speaking...";
    };


    // ====================================
    // SPEECH END
    // ====================================

    speech.onend = () => {

        console.log(
            "TTS FINISHED"
        );


        setReadyState();
    };


    // ====================================
    // SPEECH ERROR
    // ====================================

    speech.onerror =
        event => {

            console.error(
                "TEXT TO SPEECH ERROR:",
                event.error
            );


            setReadyState();
        };


    // ====================================
    // SPEAK
    // ====================================

    console.log(
        "TTS: Speaking:",
        text
    );


    window.speechSynthesis.speak(
        speech
    );

}
// ========================================
// LOAD BROWSER VOICES
// ========================================

window.speechSynthesis.addEventListener(
    "voiceschanged",
    () => {

        const voices =
            window.speechSynthesis
                .getVoices();


        console.log(
            "===================================="
        );

        console.log(
            "TTS VOICES LOADED:",
            voices.length
        );


        voices.forEach(
            voice => {

                console.log(
                    `VOICE: ${voice.name} | ${voice.lang}`
                );

            }
        );


        console.log(
            "===================================="
        );

    }
);


// ========================================
// READY STATE
// ========================================

function setReadyState() {

    if (!statusText) {

        return;
    }


    statusText.textContent =
        "Ready";


    if (instruction) {

        instruction.textContent =
            "Click the microphone and start speaking";

    }


    if (micButton) {

        micButton.classList.remove(
            "listening"
        );

    }
}


// ========================================
// RESET CONVERSATION
// ========================================

function resetConversation() {

    console.log(
        "RESETTING NOVA CONVERSATION"
    );


    // ------------------------------------
    // Stop speech
    // ------------------------------------

    window.speechSynthesis.cancel();


    // ------------------------------------
    // Stop recognition
    // ------------------------------------

    stopRecognition();


    // ------------------------------------
    // Clear timers
    // ------------------------------------

    clearSpeechTimeout();


    // ------------------------------------
    // Reset conversation
    // ------------------------------------

    conversationHistory = [];


    appointmentState = null;

    currentSpeechLanguage =
    "en";


    // Reset recognition language
    if (recognition) {

        recognition.lang =
            "en-US";

    }


    isProcessing = false;


    // ------------------------------------
    // Reset duplicate protection
    // ------------------------------------

    lastTranscript = "";


    lastTranscriptTime = 0;


    // ------------------------------------
    // Clear UI
    // ------------------------------------

    conversation.innerHTML = "";


    // ------------------------------------
    // Clear input
    // ------------------------------------

    textInput.value = "";


    // ------------------------------------
    // Reset UI
    // ------------------------------------

    setReadyState();


    console.log(
        "Conversation reset."
    );
}


// ========================================
// HTML ESCAPE
// ========================================

function escapeHtml(
    text
) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        text;


    return div.innerHTML;
}


// ========================================
// HUMAN SUPPORT / JITSI
// ========================================

let jitsiApi = null;
let pendingTransfer = null;


// ----------------------------------------
// SHOW HUMAN SUPPORT
// ----------------------------------------

function showHumanSupport(transfer) {

    console.log(
        "SHOWING HUMAN SUPPORT:",
        transfer
    );

    pendingTransfer =
        transfer;

    const panel =
        document.getElementById(
            "humanSupportPanel"
        );

    const button =
        document.getElementById(
            "joinSupportButton"
        );

    if (!panel) {

        console.error(
            "ERROR: humanSupportPanel not found in HTML."
        );

        return;
    }

    if (!button) {

        console.error(
            "ERROR: joinSupportButton not found in HTML."
        );

        return;
    }

    panel.hidden =
        false;

    button.disabled =
        false;

    button.textContent =
        "Join Support Call";

    console.log(
        "Human support panel displayed successfully."
    );
}


// ----------------------------------------
// JOIN SUPPORT CALL
// ----------------------------------------

function joinSupportCall() {

    console.log(
        "JOIN SUPPORT CALL CLICKED"
    );

    if (!pendingTransfer) {

        console.error(
            "No active transfer."
        );

        return;
    }

    if (!window.JitsiMeetExternalAPI) {

        console.error(
            "Jitsi API is not loaded."
        );

        alert(
            "Support call service is currently unavailable."
        );

        return;
    }

    const container =
        document.getElementById(
            "jitsiContainer"
        );

    if (!container) {

        console.error(
            "jitsiContainer not found."
        );

        return;
    }

    container.innerHTML =
        "";

    const domain =
        "meet.jit.si";

    const options = {

        roomName:
            pendingTransfer.roomName,

        width:
            "100%",

        height:
            600,

        parentNode:
            container,

        userInfo: {

            displayName:
                "NovaCare Customer"

        },

        configOverwrite: {

            prejoinConfig: {

                enabled:
                    true

            }

        }

    };

    jitsiApi =
        new JitsiMeetExternalAPI(
            domain,
            options
        );

    console.log(
        "Joined Jitsi support room:",
        pendingTransfer.roomName
    );
}


// ----------------------------------------
// SUPPORT BUTTON EVENT
// ----------------------------------------

const joinSupportButton =
    document.getElementById(
        "joinSupportButton"
    );

if (
    joinSupportButton
) {

    joinSupportButton.addEventListener(
        "click",
        joinSupportCall
    );

}


// ========================================
// GLOBAL RESET
// ========================================

window.resetConversation =
    resetConversation;