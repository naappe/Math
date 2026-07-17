        // ================================================================
        // SCREEN RECORDER PRO - Complete Implementation
        // ================================================================
        // Features:
        //   1. Screen + Microphone recording
        //   2. Auto-stop after 60s of inactivity (closes the loophole!)
        //   3. Download as WebM video
        //   4. Real-time timer, FPS, size tracking
        //   5. Desktop + Android support
        // ================================================================

        // ─── Configuration ────────────────────────────────────────────────

        const CONFIG = {
            INACTIVITY_TIMEOUT: 60, // Seconds before auto-stop
            VIDEO_BITS: 2500000, // 2.5 Mbps
            AUDIO_BITS: 128000, // 128 kbps
            FRAME_RATE: 30,
            MAX_RESOLUTION: 1920,
        };

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
            inactivityTimer: null,
            lastActivity: Date.now(),
            isAutoStopped: false,
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
        const statusBadge = document.getElementById('statusBadge');
        const badgeDot = document.getElementById('badgeDot');
        const badgeText = document.getElementById('badgeText');
        const resolutionInfo = document.getElementById('resolutionInfo');
        const fpsInfo = document.getElementById('fpsInfo');
        const sizeInfo = document.getElementById('sizeInfo');
        const recordTime = document.getElementById('recordTime');
        const permissionStatus = document.getElementById('permissionStatus');
        const logContainer = document.getElementById('logContainer');
        const inactivityTimeDisplay = document.getElementById('inactivityTimeDisplay');

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
                return { supported: false, reason: 'iOS Safari does not support screen sharing' };
            }

            if (!hasGetDisplayMedia) {
                return { supported: false, reason: 'getDisplayMedia() not available' };
            }

            if (!hasMediaRecorder) {
                return { supported: false, reason: 'MediaRecorder not available' };
            }

            return { supported: true, reason: 'All good!' };
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

        // ─── Status Updates ──────────────────────────────────────────────

        function setStatus(text, isRecording = false, isError = false) {
            badgeText.textContent = text;
            badgeDot.className = 'dot';
            if (isRecording) {
                badgeDot.classList.add('recording');
            } else if (isError) {
                badgeDot.style.background = '#ff4444';
                badgeDot.style.animation = 'none';
            } else {
                badgeDot.style.background = '#888';
                badgeDot.style.animation = 'none';
            }
        }

        // ─── Timer ────────────────────────────────────────────────────────

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
                recordTime.textContent = formatTime(elapsed);
            }, 200);
        }

        function stopTimer() {
            clearInterval(state.timerInterval);
            state.timerInterval = null;
        }

        // ─── Inactivity Auto-Stop ─────────────────────────────────────────

        function resetInactivityTimer() {
            state.lastActivity = Date.now();

            if (!state.isRecording) return;

            // Show that we're active
            permissionStatus.textContent = '🔴 Recording';
            permissionStatus.style.color = '#ff6b6b';

            clearTimeout(state.inactivityTimer);

            state.inactivityTimer = setTimeout(() => {
                if (state.isRecording) {
                    state.isAutoStopped = true;
                    log('⏹️ Auto-stopped due to inactivity! (loophole closed)', 'warning');
                    stopRecording(true);
                }
            }, CONFIG.INACTIVITY_TIMEOUT * 1000);
        }

        function startInactivityTracking() {
            // Track user activity
            const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'touchmove', 'scroll'];
            events.forEach(event => {
                document.addEventListener(event, resetInactivityTimer);
            });

            // Initial reset
            resetInactivityTimer();
            log(`🛡️ Inactivity auto-stop: ${CONFIG.INACTIVITY_TIMEOUT}s`, 'info');
        }

        function stopInactivityTracking() {
            clearTimeout(state.inactivityTimer);
            const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'touchmove', 'scroll'];
            events.forEach(event => {
                document.removeEventListener(event, resetInactivityTimer);
            });
        }

        // ─── Main Recording ──────────────────────────────────────────────

        async function startRecording() {
            // Check support
            const support = checkSupport();
            if (!support.supported) {
                log(`❌ ${support.reason}`, 'error');
                setStatus('Unsupported', false, true);
                return;
            }

            log('🔍 Starting screen capture...', 'info');
            setStatus('Requesting...', false);
            startBtn.disabled = true;

            try {
                // ──────────────────────────────────────────────────────────
                // STEP 1: Get screen stream (browser shows OS dialog)
                // ──────────────────────────────────────────────────────────

                const screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        width: { ideal: CONFIG.MAX_RESOLUTION },
                        height: { ideal: CONFIG.MAX_RESOLUTION * 9 / 16 },
                        frameRate: { ideal: CONFIG.FRAME_RATE },
                    },
                    audio: false,
                });

                log('✅ Screen capture approved!', 'success');

                // ──────────────────────────────────────────────────────────
                // STEP 2: Get microphone (optional, user can deny)
                // ──────────────────────────────────────────────────────────

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

                // ──────────────────────────────────────────────────────────
                // STEP 3: Combine streams
                // ──────────────────────────────────────────────────────────

                const tracks = [...screenStream.getTracks()];
                if (audioStream) {
                    tracks.push(...audioStream.getTracks());
                }

                state.stream = new MediaStream(tracks);

                // ──────────────────────────────────────────────────────────
                // STEP 4: Display preview
                // ──────────────────────────────────────────────────────────

                preview.srcObject = state.stream;
                await preview.play();
                preview.classList.add('active');
                placeholder.style.display = 'none';
                previewWrapper.classList.add('active');
                timerOverlay.classList.add('active');

                // ──────────────────────────────────────────────────────────
                // STEP 5: Setup MediaRecorder
                // ──────────────────────────────────────────────────────────

                const mimeTypes = [
                    'video/webm;codecs=vp9,opus',
                    'video/webm;codecs=vp8,opus',
                    'video/webm;codecs=h264,opus',
                    'video/webm',
                ];

                let mimeType = mimeTypes.find(mt => MediaRecorder.isTypeSupported(mt));
                if (!mimeType) {
                    mimeType = 'video/webm';
                }

                state.recorder = new MediaRecorder(state.stream, {
                    mimeType: mimeType,
                    videoBitsPerSecond: CONFIG.VIDEO_BITS,
                    audioBitsPerSecond: CONFIG.AUDIO_BITS,
                });

                state.recordedChunks = [];

                state.recorder.ondataavailable = (e) => {
                    if (e.data && e.data.size > 0) {
                        state.recordedChunks.push(e.data);
                        // Update size info
                        const totalSize = state.recordedChunks.reduce((acc, chunk) => acc + chunk.size, 0);
                        const sizeMB = (totalSize / (1024 * 1024)).toFixed(1);
                        sizeInfo.textContent = `${sizeMB} MB`;
                    }
                };

                state.recorder.onstop = () => {
                    log('📦 Recording stopped, preparing download...', 'info');
                    downloadBtn.disabled = false;
                };

                state.recorder.onerror = (e) => {
                    log(`❌ Recorder error: ${e.error}`, 'error');
                };

                // ──────────────────────────────────────────────────────────
                // STEP 6: Start recording
                // ──────────────────────────────────────────────────────────

                state.recorder.start(1000); // Capture in 1s chunks
                state.isRecording = true;
                state.isAutoStopped = false;

                // ──────────────────────────────────────────────────────────
                // STEP 7: Start FPS counter
                // ──────────────────────────────────────────────────────────

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

                        // Update resolution
                        const track = state.stream?.getVideoTracks()[0];
                        const settings = track?.getSettings();
                        if (settings?.width && settings?.height) {
                            resolutionInfo.textContent = `${settings.width}×${settings.height}`;
                        }
                    }
                    requestAnimationFrame(countFrames);
                }
                requestAnimationFrame(countFrames);

                // ──────────────────────────────────────────────────────────
                // STEP 8: Start timer and inactivity tracking
                // ──────────────────────────────────────────────────────────

                startTimer();
                startInactivityTracking();

                // ──────────────────────────────────────────────────────────
                // STEP 9: Update UI
                // ──────────────────────────────────────────────────────────

                startBtn.disabled = true;
                stopBtn.disabled = false;
                downloadBtn.disabled = true;
                setStatus('🔴 REC', true);
                permissionStatus.textContent = '🔴 Recording';
                permissionStatus.style.color = '#ff6b6b';

                log('⏺️ Recording started!', 'record');
                log(`🛡️ Auto-stop enabled: ${CONFIG.INACTIVITY_TIMEOUT}s of inactivity`, 'info');
                log('💡 Move your mouse or touch the screen to keep recording', 'info');

                // ──────────────────────────────────────────────────────────
                // STEP 10: Handle stream end (user clicks OS Stop)
                // ──────────────────────────────────────────────────────────

                const videoTrack = state.stream.getVideoTracks()[0];
                if (videoTrack) {
                    videoTrack.onended = () => {
                        log('⏹️ User stopped via OS button', 'warning');
                        stopRecording();
                    };
                }

            } catch (error) {
                console.error('Recording error:', error);

                let msg = error.message;
                let type = 'error';

                switch (error.name) {
                    case 'NotAllowedError':
                        msg = '❌ User denied permission or cancelled';
                        setStatus('Denied', false, true);
                        break;
                    case 'AbortError':
                        msg = '❌ User cancelled the dialog';
                        setStatus('Cancelled', false, true);
                        break;
                    case 'SecurityError':
                        msg = '❌ Security: Must be triggered by a tap/click';
                        setStatus('Security Error', false, true);
                        break;
                    case 'NotFoundError':
                        msg = '❌ No screen sources available';
                        setStatus('No sources', false, true);
                        break;
                    default:
                        msg = `❌ ${error.name}: ${error.message}`;
                        setStatus('Error', false, true);
                }

                log(msg, type);
                permissionStatus.textContent = '❌ Error';
                permissionStatus.style.color = '#ff4444';

                startBtn.disabled = false;
            }
        }

        // ─── Stop Recording ──────────────────────────────────────────────

        function stopRecording(autoStopped = false) {
            if (!state.isRecording) return;

            log(`⏹️ Stopping recording...${autoStopped ? ' (auto-stopped)' : ''}`, 'info');

            state.isRecording = false;

            // Stop inactivity tracking
            stopInactivityTracking();

            // Stop timer
            stopTimer();

            // Stop recorder
            if (state.recorder && state.recorder.state !== 'inactive') {
                state.recorder.stop();
            }

            // Stop all tracks
            if (state.stream) {
                state.stream.getTracks().forEach(track => track.stop());
                state.stream = null;
            }

            // Reset UI
            preview.classList.remove('active');
            previewWrapper.classList.remove('active');
            timerOverlay.classList.remove('active');
            placeholder.style.display = 'flex';

            // Reset status
            setStatus('Stopped', false);
            permissionStatus.textContent = '⏹️ Stopped';
            permissionStatus.style.color = '#888';

            // Update buttons
            startBtn.disabled = false;
            stopBtn.disabled = true;

            if (state.recordedChunks.length > 0) {
                downloadBtn.disabled = false;
                log(`📦 Recording saved (${state.recordedChunks.length} chunks)`, 'success');
            } else {
                downloadBtn.disabled = true;
                log('⚠️ No data recorded', 'warning');
            }

            if (autoStopped) {
                log('🛡️ Auto-stop triggered - recording saved!', 'success');
                log('💡 The "loophole" has been closed!', 'info');
            } else {
                log('✅ Recording stopped successfully', 'success');
            }

            // Clear preview
            preview.srcObject = null;
            preview.load();

            // Reset inactivity timer display
            clearTimeout(state.inactivityTimer);

            // Reset permission status after a moment
            setTimeout(() => {
                if (!state.isRecording) {
                    permissionStatus.textContent = 'Idle';
                    permissionStatus.style.color = '#888';
                }
            }, 3000);
        }

        // ─── Download ─────────────────────────────────────────────────────

        function downloadRecording() {
            if (state.recordedChunks.length === 0) {
                log('⚠️ No recording to download', 'warning');
                return;
            }

            try {
                const blob = new Blob(state.recordedChunks, {
                    type: 'video/webm'
                });

                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                link.download = `screen-recording-${timestamp}.webm`;
                link.href = url;
                link.click();

                // Clean up
                setTimeout(() => URL.revokeObjectURL(url), 5000);

                const sizeMB = (blob.size / (1024 * 1024)).toFixed(2);
                log(`⬇️ Downloading: ${sizeMB} MB`, 'success');
                log(`📁 Filename: ${link.download}`, 'info');

            } catch (error) {
                log(`❌ Download error: ${error.message}`, 'error');
            }
        }

        // ─── Event Listeners ─────────────────────────────────────────────

        startBtn.addEventListener('click', startRecording);
        startBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            startRecording();
        });

        stopBtn.addEventListener('click', () => stopRecording(false));
        stopBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            stopRecording(false);
        });

        downloadBtn.addEventListener('click', downloadRecording);
        downloadBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            downloadRecording();
        });

        // ─── Keyboard shortcuts ──────────────────────────────────────────

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !startBtn.disabled) startBtn.click();
            if (e.key === 'Escape' && !stopBtn.disabled) stopBtn.click();
            if (e.key === 'd' && !downloadBtn.disabled) downloadBtn.click();
        });

        // ─── Cleanup on unload ───────────────────────────────────────────

        window.addEventListener('beforeunload', () => {
            if (state.isRecording) {
                stopRecording(false);
            }
            if (state.stream) {
                state.stream.getTracks().forEach(t => t.stop());
            }
            stopInactivityTracking();
        });

        // ─── Initialization ──────────────────────────────────────────────

        function init() {
            const device = detectDevice();
            const support = checkSupport();

            inactivityTimeDisplay.textContent = CONFIG.INACTIVITY_TIMEOUT;

            if (!support.supported) {
                log(`❌ ${support.reason}`, 'error');
                setStatus('Unsupported', false, true);
                startBtn.disabled = true;
                permissionStatus.textContent = '❌ Unsupported';
                permissionStatus.style.color = '#ff4444';
                return;
            }

            log(`📱 Device: ${device}`, 'info');
            log('✅ Screen recording is supported', 'success');
            log(`🛡️ Auto-stop: ${CONFIG.INACTIVITY_TIMEOUT}s of inactivity`, 'info');
            log('💡 Tap "Start" to begin recording', 'info');

            setStatus('Ready', false);
            permissionStatus.textContent = '✅ Ready';
            permissionStatus.style.color = '#00d2d3';

            console.log('%c┌──────────────────────────────────────────────────────┐', 'color:#ff6b6b');
            console.log('%c│            SCREEN RECORDER PRO v2.0              │', 'color:#ff6b6b');
            console.log('%c├──────────────────────────────────────────────────────┤', 'color:#ff6b6b');
            console.log('%c│                                                      │', 'color:#ff6b6b');
            console.log(`%c│  📱 Device: ${device.padEnd(35)}│`, 'color:#888');
            console.log(`%c│  🛡️ Auto-stop: ${String(CONFIG.INACTIVITY_TIMEOUT).padEnd(26)}s │`, 'color:#ffd93d');
            console.log('%c│                                                      │', 'color:#ff6b6b');
            console.log('%c│  HOW IT WORKS:                                     │', 'color:#ffd93d');
            console.log('%c│  1. Tap "Start" → Browser shows system dialog      │', 'color:#888');
            console.log('%c│  2. Tap "Share" → Recording starts                 │', 'color:#888');
            console.log('%c│  3. Auto-stop tracks your activity                 │', 'color:#888');
            console.log('%c│  4. Walk away → Auto-stops after 60s              │', 'color:#ffd93d');
            console.log('%c│  5. Tap "Save" → Download your recording          │', 'color:#888');
            console.log('%c│                                                      │', 'color:#ff6b6b');
            console.log('%c│  🔒 THE LOOPHOLE IS CLOSED:                       │', 'color:#ffd93d');
            console.log('%c│  If you forget to stop, the recorder stops FOR YOU │', 'color:#ffd93d');
            console.log('%c└──────────────────────────────────────────────────────┘', 'color:#ff6b6b');
        }

        init();
    
