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

            // iOS detection - this is critical
            if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) {
                state.isIOS = true;
                state.isAndroid = false;
                state.isSupported = false;
                return 'ios';
            }

            // Android detection
            if (/Android/.test(ua)) {
                state.isIOS = false;
                state.isAndroid = true;
                state.isSupported = true;
                return 'android';
            }

            // Desktop or other
            state.isIOS = false;
            state.isAndroid = false;
            state.isSupported = true;
            return 'desktop';
        }

        function checkSupport() {
            const hasGetDisplayMedia = !!navigator.mediaDevices?.getDisplayMedia;
            const hasMediaRecorder = !!window.MediaRecorder;

            if (state.isIOS) {
                return {
                    supported: false,
                    reason: 'iOS Safari does not support getDisplayMedia()',
                };
            }

            if (!hasGetDisplayMedia) {
                return {
                    supported: false,
                    reason: 'getDisplayMedia() not available in this browser',
                };
            }

            if (!hasMediaRecorder) {
                return {
                    supported: false,
                    reason: 'MediaRecorder not available in this browser',
                };
            }

            return {
                supported: true,
                reason: 'Ready to record!',
            };
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

        // ─── Status ───────────────────────────────────────────────────────

        function setStatus(text, dotType = 'idle') {
            badgeText.textContent = text;
            badgeDot.className = `dot ${dotType}`;
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
            }, 200);
        }

        function stopTimer() {
            clearInterval(state.timerInterval);
            state.timerInterval = null;
        }

        // ─── Main Recording ──────────────────────────────────────────────

        async function startRecording() {
            // Check support first
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
                // ──────────────────────────────────────────────────────────
                // STEP 1: Get screen stream (browser shows system dialog)
                // ──────────────────────────────────────────────────────────

                const screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                        frameRate: { ideal: 30 },
                    },
                    audio: false,
                });

                log('✅ Screen capture approved!', 'success');

                // ──────────────────────────────────────────────────────────
                // STEP 2: Get microphone (optional)
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
                if (!mimeType) mimeType = 'video/webm';

                state.recorder = new MediaRecorder(state.stream, {
                    mimeType: mimeType,
                    videoBitsPerSecond: 2500000,
                    audioBitsPerSecond: 128000,
                });

                state.recordedChunks = [];

                state.recorder.ondataavailable = (e) => {
                    if (e.data && e.data.size > 0) {
                        state.recordedChunks.push(e.data);
                        const totalSize = state.recordedChunks.reduce((acc, chunk) => acc + chunk.size, 0);
                        const sizeMB = (totalSize / (1024 * 1024)).toFixed(1);
                        sizeInfo.textContent = `${sizeMB} MB`;
                    }
                };

                state.recorder.onstop = () => {
                    log('📦 Recording stopped, preparing download...', 'info');
                    downloadBtn.disabled = false;
                };

                // ──────────────────────────────────────────────────────────
                // STEP 6: Start recording
                // ──────────────────────────────────────────────────────────

                state.recorder.start(1000);
                state.isRecording = true;

                // ──────────────────────────────────────────────────────────
                // STEP 7: FPS counter
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
                // STEP 8: Start timer
                // ──────────────────────────────────────────────────────────

                startTimer();

                // ──────────────────────────────────────────────────────────
                // STEP 9: Update UI
                // ──────────────────────────────────────────────────────────

                startBtn.disabled = true;
                stopBtn.disabled = false;
                downloadBtn.disabled = true;
                setStatus('🔴 REC', 'recording');

                log('⏺️ Recording started!', 'record');

                // ──────────────────────────────────────────────────────────
                // STEP 10: Handle stream end (user taps OS Stop)
                // ──────────────────────────────────────────────────────────

                const videoTrack = state.stream.getVideoTracks()[0];
                if (videoTrack) {
                    videoTrack.onended = () => {
                        log('⏹️ User stopped via system button', 'warning');
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
                        setStatus('Denied', 'error');
                        break;
                    case 'AbortError':
                        msg = '❌ User cancelled the dialog';
                        setStatus('Cancelled', 'error');
                        break;
                    case 'SecurityError':
                        msg = '❌ Security: Must be triggered by a tap/click';
                        setStatus('Security Error', 'error');
                        break;
                    case 'NotFoundError':
                        msg = '❌ No screen sources available';
                        setStatus('No sources', 'error');
                        break;
                    default:
                        msg = `❌ ${error.name}: ${error.message}`;
                        setStatus('Error', 'error');
                }

                log(msg, type);
                startBtn.disabled = false;
            }
        }

        // ─── Stop Recording ──────────────────────────────────────────────

        function stopRecording() {
            if (!state.isRecording) return;

            log('⏹️ Stopping recording...', 'info');
            state.isRecording = false;

            stopTimer();

            if (state.recorder && state.recorder.state !== 'inactive') {
                state.recorder.stop();
            }

            if (state.stream) {
                state.stream.getTracks().forEach(track => track.stop());
                state.stream = null;
            }

            preview.classList.remove('active');
            previewWrapper.classList.remove('active');
            timerOverlay.classList.remove('active');
            placeholder.style.display = 'flex';

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

            preview.srcObject = null;
            preview.load();
        }

        // ─── Download ─────────────────────────────────────────────────────

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
                link.click();

                setTimeout(() => URL.revokeObjectURL(url), 5000);

                const sizeMB = (blob.size / (1024 * 1024)).toFixed(2);
                log(`⬇️ Downloading: ${sizeMB} MB`, 'success');
                log(`📁 ${link.download}`, 'info');

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

        stopBtn.addEventListener('click', stopRecording);
        stopBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            stopRecording();
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

        // ─── Cleanup ──────────────────────────────────────────────────────

        window.addEventListener('beforeunload', () => {
            if (state.isRecording) stopRecording();
            if (state.stream) state.stream.getTracks().forEach(t => t.stop());
        });

        // ─── Initialization ──────────────────────────────────────────────

        function init() {
            const device = detectDevice();
            const support = checkSupport();

            // Update device info
            if (device === 'ios') {
                deviceBadge.innerHTML = '🍎 iOS';
                deviceBadge.className = 'badge-text ios';
                deviceMessage.textContent = '❌ Screen recording is NOT supported on iOS Safari (Apple restriction)';
                unsupportedOverlay.classList.add('visible');
                setStatus('Unsupported', 'unsupported');
                startBtn.disabled = true;
                log('❌ iOS is not supported for screen recording', 'error');
                log('💡 iOS users can use the built-in Screen Recording feature', 'info');
                return;
            }

            if (device === 'android') {
                deviceBadge.innerHTML = '🤖 Android';
                deviceBadge.className = 'badge-text android';
                deviceMessage.textContent = '✅ Screen recording is supported on Android Chrome/Firefox';
                unsupportedOverlay.classList.remove('visible');
                log('📱 Android device detected', 'info');
            }

            if (device === 'desktop') {
                deviceBadge.innerHTML = '💻 Desktop';
                deviceBadge.className = 'badge-text desktop';
                deviceMessage.textContent = '✅ Screen recording is fully supported';
                unsupportedOverlay.classList.remove('visible');
                log('💻 Desktop device detected', 'info');
            }

            if (!support.supported) {
                log(`❌ ${support.reason}`, 'error');
                setStatus('Unsupported', 'error');
                startBtn.disabled = true;
                return;
            }

            log('✅ Screen recording is supported', 'success');
            log('💡 Tap "Start" to begin recording', 'info');
            setStatus('Ready', 'ready');

            console.log('%c┌──────────────────────────────────────────────────────┐', 'color:#00d2d3');
            console.log('%c│            MOBILE SCREEN RECORDER                  │', 'color:#00d2d3');
            console.log('%c├──────────────────────────────────────────────────────┤', 'color:#00d2d3');
            console.log('%c│                                                      │', 'color:#00d2d3');
            console.log(`%c│  📱 Device: ${device.padEnd(35)}│`, 'color:#888');
            console.log(`%c│  ✅ Support: ${support.supported ? 'Supported' : 'Unsupported'.padEnd(35)}│`, 'color:#888');
            console.log('%c│                                                      │', 'color:#00d2d3');
            console.log('%c│  HOW IT WORKS ON MOBILE:                           │', 'color:#ffd93d');
            console.log('%c│  1. Tap "Start" (user gesture)                     │', 'color:#888');
            console.log('%c│  2. System dialog appears                          │', 'color:#888');
            console.log('%c│  3. Tap "Share" or "Start now"                     │', 'color:#888');
            console.log('%c│  4. Recording starts                               │', 'color:#888');
            console.log('%c│  5. Tap "Stop" or use system button to end         │', 'color:#888');
            console.log('%c│                                                      │', 'color:#00d2d3');
            console.log('%c│  ⚠️  iOS Safari: NOT supported (Apple restriction) │', 'color:#ff4444');
            console.log('%c│  ✅ Android Chrome/Firefox: FULLY supported        │', 'color:#00d2d3');
            console.log('%c└──────────────────────────────────────────────────────┘', 'color:#00d2d3');
        }

        // ─── Run ──────────────────────────────────────────────────────────

        init();
