// ================================================================
// MOBILE SCREEN RECORDER - Complete Implementation
// ================================================================
// Works on: Android Chrome, Firefox, Samsung Internet, Edge
// Works on: Desktop Chrome, Edge, Firefox, Opera
// Does NOT work on: iOS Safari (Apple restriction)
// ================================================================

// ─── State ────────────────────────────────────────────────────────

const state = {
    stream: null,
    recorder: null,
    recordedChunks: [],
    isRecording: false,
    startTime: 0,
    timerInterval: null,
    frameCount: 0,
    lastFpsUpdate: 0,
    fps: 0,
    isIOS: false,
    isAndroid: false,
    isSupported: false,
};

// ─── DOM Refs ─────────────────────────────────────────────────────

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const downloadBtn = document.getElementById('downloadBtn');
const preview = document.getElementById('preview');
const placeholder = document.getElementById('placeholder');
const previewWrapper = document.getElementById('previewWrapper');
const timerOverlay = document.getElementById('timerOverlay');
const timerDisplay = document.getElementById('timerDisplay');
const badgeDot = document.getElementById('badgeDot');
const badgeText = document.getElementById('badgeText');
const resolutionInfo = document.getElementById('resolutionInfo');
const fpsInfo = document.getElementById('fpsInfo');
const sizeInfo = document.getElementById('sizeInfo');
const logContainer = document.getElementById('logContainer');
const deviceBadge = document.getElementById('deviceBadge');
const deviceMessage = document.getElementById('deviceMessage');
const unsupportedOverlay = document.getElementById('unsupportedOverlay');

// ─── Device Detection ────────────────────────────────────────────

function detectDevice() {
    const ua = navigator.userAgent || navigator.vendor || window.opera;

    if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) {
        state.isIOS = true;
        state.isAndroid = false;
        state.isSupported = false;
        return 'ios';
    }

    if (/Android/.test(ua)) {
        state.isIOS = false;
        state.isAndroid = true;
        state.isSupported = true;
        return 'android';
    }

    state.isIOS = false;
    state.isAndroid = false;
    state.isSupported = true;
    return 'desktop';
}

function checkSupport() {
    const hasGetDisplayMedia = !!navigator.mediaDevices?.getDisplayMedia;
    const hasMediaRecorder = !!window.MediaRecorder;

    if (state.isIOS) {
        return { supported: false, reason: 'iOS Safari does not support getDisplayMedia()' };
    }

    if (!hasGetDisplayMedia) {
        return { supported: false, reason: 'Screen capture is not available in this mobile browser' };
    }

    if (!hasMediaRecorder) {
        return { supported: false, reason: 'MediaRecorder is not available in this browser' };
    }

    return { supported: true, reason: 'Ready to record!' };
}

// ─── Logging ──────────────────────────────────────────────────────

function log(message, type = 'info') {
    const entry = document.createElement('div');
    entry.className = 'entry';
    const time = new Date().toISOString().split('T')[1].slice(0, 8);
    entry.innerHTML = `
        <span class="time">[${time}]</span>
        <span class="msg ${type}">${message}</span>
    `;
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

function setStatus(text, dotType = 'idle') {
    badgeText.textContent = text;
    badgeDot.className = `dot ${dotType}`;
}

function formatTime(seconds) {
    const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const s = String(Math.floor(seconds % 60)).padStart(2, '0');
    return `${h}:${m}:${s}`;
}

function startTimer() {
    state.startTime = Date.now();
    state.timerInterval = setInterval(() => {
        const elapsed = (Date.now() - state.startTime) / 1000;
        timerDisplay.textContent = formatTime(elapsed);
    }, 200);
}

function stopTimer() {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
}

async function startRecording() {
    if (state.isRecording || startBtn.disabled) return;

    const support = checkSupport();
    if (!support.supported) {
        log(`❌ ${support.reason}`, 'error');
        setStatus('Unsupported', 'error');
        return;
    }

    log('🔍 Requesting screen capture...', 'info');
    setStatus('Requesting...', 'ready');
    startBtn.disabled = true;

    try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                frameRate: { ideal: 30 },
            },
            audio: false,
        });

        log('✅ Screen capture approved!', 'success');

        let audioStream = null;
        try {
            audioStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });
            log('🎤 Microphone connected', 'success');
        } catch (audioError) {
            log('⚠️ Microphone not available (audio will be silent)', 'warning');
        }

        const tracks = [...screenStream.getTracks()];
        if (audioStream) tracks.push(...audioStream.getTracks());
        state.stream = new MediaStream(tracks);

        preview.srcObject = state.stream;
        await preview.play();
        preview.classList.add('active');
        placeholder.style.display = 'none';
        previewWrapper.classList.add('active');
        timerOverlay.classList.add('active');

        const mimeTypes = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm;codecs=h264,opus',
            'video/webm',
        ];

        let mimeType = mimeTypes.find(mt => MediaRecorder.isTypeSupported(mt));
        if (!mimeType) mimeType = 'video/webm';

        state.recorder = new MediaRecorder(state.stream, {
            mimeType,
            videoBitsPerSecond: 2500000,
            audioBitsPerSecond: 128000,
        });

        state.recordedChunks = [];
        sizeInfo.textContent = '0.0 MB';

        state.recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
                state.recordedChunks.push(e.data);
                const totalSize = state.recordedChunks.reduce((acc, chunk) => acc + chunk.size, 0);
                sizeInfo.textContent = `${(totalSize / (1024 * 1024)).toFixed(1)} MB`;
            }
        };

        state.recorder.onstop = () => {
            log('📦 Recording stopped, preparing download...', 'info');
            downloadBtn.disabled = state.recordedChunks.length === 0;
        };

        state.recorder.start(1000);
        state.isRecording = true;
        state.frameCount = 0;
        state.lastFpsUpdate = performance.now();

        function countFrames() {
            if (!state.isRecording) return;
            state.frameCount++;
            const now = performance.now();
            if (now - state.lastFpsUpdate >= 1000) {
                state.fps = state.frameCount;
                state.frameCount = 0;
                state.lastFpsUpdate = now;
                fpsInfo.textContent = `${state.fps} fps`;

                const settings = state.stream?.getVideoTracks()[0]?.getSettings();
                if (settings?.width && settings?.height) {
                    resolutionInfo.textContent = `${settings.width}×${settings.height}`;
                }
            }
            requestAnimationFrame(countFrames);
        }
        requestAnimationFrame(countFrames);

        startTimer();
        stopBtn.disabled = false;
        downloadBtn.disabled = true;
        setStatus('🔴 REC', 'recording');
        log('⏺️ Recording started!', 'record');

        const videoTrack = state.stream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.onended = () => {
                log('⏹️ User stopped via system button', 'warning');
                stopRecording();
            };
        }
    } catch (error) {
        console.error('Recording error:', error);

        let msg;
        switch (error.name) {
            case 'NotAllowedError':
                msg = '❌ Permission denied or screen-share dialog cancelled';
                setStatus('Denied', 'error');
                break;
            case 'AbortError':
                msg = '❌ Screen-share dialog cancelled';
                setStatus('Cancelled', 'error');
                break;
            case 'SecurityError':
                msg = '❌ Screen capture must start from one direct tap';
                setStatus('Security Error', 'error');
                break;
            case 'NotFoundError':
                msg = '❌ No screen source is available';
                setStatus('No sources', 'error');
                break;
            default:
                msg = `❌ ${error.name}: ${error.message}`;
                setStatus('Error', 'error');
        }

        log(msg, 'error');
        startBtn.disabled = false;
    }
}

function stopRecording() {
    if (!state.isRecording) return;

    log('⏹️ Stopping recording...', 'info');
    state.isRecording = false;
    stopTimer();

    if (state.recorder && state.recorder.state !== 'inactive') state.recorder.stop();
    if (state.stream) {
        state.stream.getTracks().forEach(track => track.stop());
        state.stream = null;
    }

    preview.classList.remove('active');
    previewWrapper.classList.remove('active');
    timerOverlay.classList.remove('active');
    placeholder.style.display = 'flex';
    preview.srcObject = null;
    preview.load();

    setStatus('Stopped', 'idle');
    startBtn.disabled = false;
    stopBtn.disabled = true;

    if (state.recordedChunks.length > 0) {
        downloadBtn.disabled = false;
        log(`📦 Recording saved (${state.recordedChunks.length} chunks)`, 'success');
    } else {
        downloadBtn.disabled = true;
        log('⚠️ No data recorded', 'warning');
    }
}

function downloadRecording() {
    if (state.recordedChunks.length === 0) {
        log('⚠️ No recording to download', 'warning');
        return;
    }

    try {
        const blob = new Blob(state.recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        link.download = `screen-recording-${timestamp}.webm`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);

        log(`⬇️ Downloading: ${(blob.size / (1024 * 1024)).toFixed(2)} MB`, 'success');
        log(`📁 ${link.download}`, 'info');
    } catch (error) {
        log(`❌ Download error: ${error.message}`, 'error');
    }
}

// A mobile tap already produces a click event. Using both click and touchend
// can trigger two permission requests, so each action has one listener only.
startBtn.addEventListener('click', startRecording);
stopBtn.addEventListener('click', stopRecording);
downloadBtn.addEventListener('click', downloadRecording);

document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !startBtn.disabled) startBtn.click();
    if (e.key === 'Escape' && !stopBtn.disabled) stopBtn.click();
    if (e.key.toLowerCase() === 'd' && !downloadBtn.disabled) downloadBtn.click();
});

window.addEventListener('beforeunload', () => {
    if (state.stream) state.stream.getTracks().forEach(t => t.stop());
});

function init() {
    const device = detectDevice();
    const support = checkSupport();

    if (device === 'ios') {
        deviceBadge.innerHTML = '🍎 iOS';
        deviceBadge.className = 'badge-text ios';
        deviceMessage.textContent = '❌ Browser screen capture is unavailable on this iPhone/iPad';
        unsupportedOverlay.classList.add('visible');
        setStatus('Unsupported', 'unsupported');
        startBtn.disabled = true;
        log('❌ iOS browser screen recording is not available', 'error');
        return;
    }

    if (device === 'android') {
        deviceBadge.innerHTML = '🤖 Android';
        deviceBadge.className = 'badge-text android';
        deviceMessage.textContent = support.supported
            ? '✅ Screen recording is available in this Android browser'
            : '❌ This Android browser does not expose screen capture';
        log('📱 Android device detected', 'info');
    } else {
        deviceBadge.innerHTML = '💻 Desktop';
        deviceBadge.className = 'badge-text desktop';
        deviceMessage.textContent = support.supported
            ? '✅ Screen recording is fully supported'
            : '❌ Screen recording is not supported in this browser';
        log('💻 Desktop device detected', 'info');
    }

    unsupportedOverlay.classList.remove('visible');

    if (!support.supported) {
        log(`❌ ${support.reason}`, 'error');
        setStatus('Unsupported', 'error');
        startBtn.disabled = true;
        return;
    }

    log('✅ Screen recording is supported', 'success');
    log('💡 Tap Start once, then approve the system dialog', 'info');
    setStatus('Ready', 'ready');
}

init();
