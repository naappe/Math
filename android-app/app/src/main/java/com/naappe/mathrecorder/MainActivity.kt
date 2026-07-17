package com.naappe.mathrecorder

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Bundle
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.naappe.mathrecorder.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding
    private lateinit var projectionManager: MediaProjectionManager

    private val notificationPermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { }

    private val audioPermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) launchProjectionRequest() else binding.micCheck.isChecked = false
    }

    private val projectionPermission = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode != Activity.RESULT_OK || result.data == null) {
            setRecordingUi(false, "Screen-capture permission cancelled")
            return@registerForActivityResult
        }

        val serviceIntent = Intent(this, RecordingService::class.java).apply {
            action = RecordingService.ACTION_START
            putExtra(RecordingService.EXTRA_RESULT_CODE, result.resultCode)
            putExtra(RecordingService.EXTRA_RESULT_DATA, result.data)
            putExtra(RecordingService.EXTRA_WITH_MIC, binding.micCheck.isChecked)
        }
        ContextCompat.startForegroundService(this, serviceIntent)
        setRecordingUi(true, "Recording in progress")
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        projectionManager = getSystemService(MediaProjectionManager::class.java)

        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }

        binding.startButton.setOnClickListener {
            if (binding.micCheck.isChecked &&
                ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED
            ) {
                audioPermission.launch(Manifest.permission.RECORD_AUDIO)
            } else {
                launchProjectionRequest()
            }
        }

        binding.stopButton.setOnClickListener {
            startService(Intent(this, RecordingService::class.java).apply {
                action = RecordingService.ACTION_STOP
            })
            setRecordingUi(false, "Recording stopped")
        }
    }

    private fun launchProjectionRequest() {
        projectionPermission.launch(projectionManager.createScreenCaptureIntent())
    }

    private fun setRecordingUi(recording: Boolean, message: String) {
        binding.statusText.text = message
        binding.startButton.isEnabled = !recording
        binding.stopButton.isEnabled = recording
        binding.micCheck.isEnabled = !recording
    }
}
