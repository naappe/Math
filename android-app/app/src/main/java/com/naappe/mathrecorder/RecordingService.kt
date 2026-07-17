package com.naappe.mathrecorder

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.ContentValues
import android.content.Intent
import android.content.pm.ServiceInfo
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.MediaRecorder
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.IBinder
import android.provider.MediaStore
import android.util.DisplayMetrics
import android.view.WindowManager
import androidx.core.app.NotificationCompat
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class RecordingService : Service() {
    private var projection: MediaProjection? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var recorder: MediaRecorder? = null
    private var outputUri: Uri? = null
    private var recording = false

    private val projectionCallback = object : MediaProjection.Callback() {
        override fun onStop() {
            stopRecording()
        }
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> stopRecording()
            ACTION_START -> startRecording(intent)
        }
        return START_NOT_STICKY
    }

    private fun startRecording(intent: Intent) {
        if (recording) return

        val resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, 0)
        val resultData = if (Build.VERSION.SDK_INT >= 33) {
            intent.getParcelableExtra(EXTRA_RESULT_DATA, Intent::class.java)
        } else {
            @Suppress("DEPRECATION") intent.getParcelableExtra(EXTRA_RESULT_DATA)
        } ?: return stopSelf()
        val withMic = intent.getBooleanExtra(EXTRA_WITH_MIC, false)

        val notification = createNotification("Recording screen")
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION or
                    if (withMic) ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE else 0
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        try {
            val metrics = DisplayMetrics()
            @Suppress("DEPRECATION")
            (getSystemService(WINDOW_SERVICE) as WindowManager).defaultDisplay.getRealMetrics(metrics)
            val width = makeEven(metrics.widthPixels)
            val height = makeEven(metrics.heightPixels)

            recorder = if (Build.VERSION.SDK_INT >= 31) MediaRecorder(this) else @Suppress("DEPRECATION") MediaRecorder()
            recorder?.apply {
                if (withMic) setAudioSource(MediaRecorder.AudioSource.MIC)
                setVideoSource(MediaRecorder.VideoSource.SURFACE)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setVideoEncoder(MediaRecorder.VideoEncoder.H264)
                if (withMic) setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setVideoSize(width, height)
                setVideoFrameRate(30)
                setVideoEncodingBitRate(8_000_000)
                if (withMic) {
                    setAudioEncodingBitRate(128_000)
                    setAudioSamplingRate(44_100)
                }
                setOutputFile(createOutputFile())
                prepare()
            }

            val manager = getSystemService(MediaProjectionManager::class.java)
            projection = manager.getMediaProjection(resultCode, resultData).also {
                it.registerCallback(projectionCallback, null)
            }

            virtualDisplay = projection?.createVirtualDisplay(
                "MathScreenRecorder",
                width,
                height,
                metrics.densityDpi,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                recorder?.surface,
                null,
                null
            )

            recorder?.start()
            recording = true
        } catch (error: Exception) {
            cleanup(false)
        }
    }

    private fun createOutputFile(): java.io.FileDescriptor {
        val stamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
        return if (Build.VERSION.SDK_INT >= 29) {
            val values = ContentValues().apply {
                put(MediaStore.Video.Media.DISPLAY_NAME, "screen_$stamp.mp4")
                put(MediaStore.Video.Media.MIME_TYPE, "video/mp4")
                put(MediaStore.Video.Media.RELATIVE_PATH, Environment.DIRECTORY_MOVIES + "/MathRecorder")
                put(MediaStore.Video.Media.IS_PENDING, 1)
            }
            outputUri = contentResolver.insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, values)
                ?: error("Unable to create recording")
            contentResolver.openFileDescriptor(outputUri!!, "w")?.fileDescriptor
                ?: error("Unable to open recording")
        } else {
            val dir = File(getExternalFilesDir(Environment.DIRECTORY_MOVIES), "MathRecorder").apply { mkdirs() }
            val file = File(dir, "screen_$stamp.mp4")
            java.io.FileOutputStream(file).fd
        }
    }

    private fun stopRecording() {
        if (!recording) {
            cleanup(false)
            return
        }
        try {
            recorder?.stop()
            cleanup(true)
        } catch (_: RuntimeException) {
            cleanup(false)
        }
    }

    private fun cleanup(success: Boolean) {
        recording = false
        try { recorder?.reset() } catch (_: Exception) { }
        recorder?.release()
        recorder = null
        virtualDisplay?.release()
        virtualDisplay = null
        projection?.unregisterCallback(projectionCallback)
        projection?.stop()
        projection = null

        if (Build.VERSION.SDK_INT >= 29) {
            outputUri?.let { uri ->
                if (success) {
                    contentResolver.update(uri, ContentValues().apply {
                        put(MediaStore.Video.Media.IS_PENDING, 0)
                    }, null, null)
                } else {
                    contentResolver.delete(uri, null, null)
                }
            }
        }
        outputUri = null
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun createNotification(text: String): Notification {
        val stopIntent = Intent(this, RecordingService::class.java).apply { action = ACTION_STOP }
        val stopPendingIntent = PendingIntent.getService(
            this, 1, stopIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.presence_video_online)
            .setContentTitle("Math Screen Recorder")
            .setContentText(text)
            .setOngoing(true)
            .addAction(0, "Stop", stopPendingIntent)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            val channel = NotificationChannel(CHANNEL_ID, "Screen recording", NotificationManager.IMPORTANCE_LOW)
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    private fun makeEven(value: Int): Int = if (value % 2 == 0) value else value - 1

    override fun onDestroy() {
        if (recording) stopRecording()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val ACTION_START = "com.naappe.mathrecorder.START"
        const val ACTION_STOP = "com.naappe.mathrecorder.STOP"
        const val EXTRA_RESULT_CODE = "resultCode"
        const val EXTRA_RESULT_DATA = "resultData"
        const val EXTRA_WITH_MIC = "withMic"
        private const val CHANNEL_ID = "screen_recording"
        private const val NOTIFICATION_ID = 1001
    }
}
