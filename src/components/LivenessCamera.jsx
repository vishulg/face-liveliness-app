import React, { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import * as faceapi from "face-api.js";

const FACE_SIZE_THRESHOLD = 0.35;
const CALIBRATION_TIME_MS = 3000;
const BLINK_DROP = 0.025;
const CLOSED_FRAMES_REQUIRED = 2;
const TIMEOUT_MS = 15000;

export default function LivenessCamera() {
  const webcamRef = useRef(null);
  const detectionInterval = useRef(null);

  const baselineEAR = useRef(null);
  const closedFrameCount = useRef(0);
  const blinkDetected = useRef(false);
  const blinkState = useRef("OPEN");

  const calibrationStartTime = useRef(Date.now());
  const startTime = useRef(Date.now());
  const earSamples = useRef([]);
  const invalidFaceCount = useRef(0);

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [status, setStatus] = useState("Loading AI models...");
  const [captured, setCaptured] = useState(null);
  const [calibrating, setCalibrating] = useState(true);
  const [showWebcam, setShowWebcam] = useState(true);

  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  const getEAR = (eye) => {
    const v1 = distance(eye[1], eye[5]);
    const v2 = distance(eye[2], eye[4]);
    const h = distance(eye[0], eye[3]);
    return (v1 + v2) / (2.0 * h);
  };

  // Flip captured image
  const getFlippedScreenshot = () => {
    const video = webcamRef.current.video;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL("image/jpeg");
  };

  const handleTryAgain = async () => {
    if (detectionInterval.current) clearInterval(detectionInterval.current);

    baselineEAR.current = null;
    closedFrameCount.current = 0;
    blinkDetected.current = false;
    blinkState.current = "OPEN";
    calibrationStartTime.current = Date.now();
    startTime.current = Date.now();
    earSamples.current = [];
    invalidFaceCount.current = 0;

    setCaptured(null);
    setShowWebcam(true);
    setCalibrating(false);

    setTimeout(() => {
      setCalibrating(true);
      setStatus(
        "Calibrating... Keep your eyes open for 3 seconds and look at the camera."
      );
    }, 0);

    if (!modelsLoaded) {
      setStatus("Loading AI models...");
      await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
      await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
      setModelsLoaded(true);
    }
  };

  useEffect(() => {
    const load = async () => {
      await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
      await faceapi.nets.faceLandmark68Net.loadFromUri("/models");

      setModelsLoaded(true);
      setStatus(
        "Calibrating... Keep your eyes open for 3 seconds and look at the camera."
      );

      calibrationStartTime.current = Date.now();
      startTime.current = Date.now();
    };

    load();
  }, []);

  useEffect(() => {
    if (!modelsLoaded) return;

    detectionInterval.current = setInterval(async () => {
      const video = webcamRef.current?.video;
      if (!video || video.readyState !== 4) return;

      if (Date.now() - startTime.current > TIMEOUT_MS) {
        setStatus("Timed out. Please try again.");
        clearInterval(detectionInterval.current);
        setShowWebcam(false);
        return;
      }

      const detections = await faceapi
        .detectAllFaces(
          video,
          new faceapi.TinyFaceDetectorOptions({
            inputSize: 320,
            scoreThreshold: 0.5,
          })
        )
        .withFaceLandmarks();

      if (detections.length !== 1) {
        invalidFaceCount.current++;

        if (invalidFaceCount.current > 5) {
          setStatus("Ensure exactly one face is visible, has sufficient lighting, and no reflections.");
        }
        return;
      }

      invalidFaceCount.current = 0;

      const detection = detections[0];

      const ratio = detection.detection.box.width / video.videoWidth;

      if (ratio < FACE_SIZE_THRESHOLD) {
  setStatus("Move closer to the camera and align your face within the oval.");
        return;
      }

      const landmarks = detection.landmarks;

      const leftEAR = getEAR(landmarks.getLeftEye());
      const rightEAR = getEAR(landmarks.getRightEye());

      const ear = (leftEAR + rightEAR) / 2;

      if (calibrating) {
        earSamples.current.push(ear);

        if (
          Date.now() - calibrationStartTime.current >
          CALIBRATION_TIME_MS
        ) {
          const sorted = [...earSamples.current].sort((a, b) => a - b);
          const trim = Math.floor(sorted.length * 0.1);
          const trimmed = sorted.slice(trim, sorted.length - trim);
          const sum = trimmed.reduce((a, b) => a + b, 0);
          const avg = sum / trimmed.length;
          baselineEAR.current = avg > 0.15 ? avg : 0.26;
          setCalibrating(false);
          setStatus("Calibration complete. Please blink once and keep your eyes closed for 1 second.");
        } else {
          setStatus(
            "Calibrating... Keep your eyes open for 3 seconds and look at the camera."
          );
        }

        return;
      }

      if (!baselineEAR.current) return;

      const earDrop = baselineEAR.current - ear;

      if (earDrop > BLINK_DROP) {
        closedFrameCount.current++;

        if (
          closedFrameCount.current >= CLOSED_FRAMES_REQUIRED &&
          blinkState.current === "OPEN"
        ) {
          blinkState.current = "CLOSED";
          setStatus("Blink detected. Waiting for your eyes to open...");
        }
      } else {
        if (blinkState.current === "CLOSED") {
          blinkState.current = "OPEN";

          if (!blinkDetected.current) {
            blinkDetected.current = true;

            setStatus("Liveness verified ✅ (capturing...)");

            setTimeout(() => {
              const image = getFlippedScreenshot();
              setCaptured(image);
              setStatus("Liveness verified ✅");
              clearInterval(detectionInterval.current);
            }, 500);
          }
        }

        closedFrameCount.current = 0;
      }
    }, 150);

    return () => clearInterval(detectionInterval.current);
  }, [modelsLoaded, calibrating]);

  return (
    <div style={{ textAlign: "center", maxWidth: '100%', margin: "0 auto" }}>
      <h3>{status}</h3>

      {!captured && showWebcam && (
        <div style={{ position: 'relative', width: 400, height: 300, margin: '0 auto' }}>
          <Webcam
            ref={webcamRef}
            audio={false}
            mirrored={true}
            screenshotFormat="image/jpeg"
            videoConstraints={{
              facingMode: "user",
              width: 640,
              height: 480,
            }}
            className="webcam-feed"
            style={{ width: 400, height: 300, borderRadius: 8 }}
          />
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: 400,
              height: 300,
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="320" height="240" viewBox="0 0 320 240" style={{ position: 'absolute', left: 40, top: 30 }}>
              <ellipse
                cx="160"
                cy="120"
                rx="80"
                ry="110"
                fill="none"
                stroke="#888"
                strokeWidth="4"
                strokeDasharray="10,10"
              />
            </svg>
          </div>
        </div>
      )}

      {!captured && !showWebcam && (
        <div
          style={{
            width: 400,
            height: 300,
            maxWidth: 'calc(100vw - 2px)',
            background: "#f0f0f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 8,
            border: "1px solid #ccc",
            margin: "0 auto",
          }}
        >
          <span style={{ color: "#888", fontSize: 18 }}>
            Camera is off <br />
            Please click try again to recapture
          </span>
        </div>
      )}

      {status.startsWith("Timed out") && (
        <div>
          <button
            onClick={handleTryAgain}
            style={{ margin: 16, padding: "8px 24px", fontSize: 16 }}
          >
            Try Again
          </button>
        </div>
      )}

      {captured && (
        <div>
          <img src={captured} alt="Captured" />
          <br />
          <button
            onClick={handleTryAgain}
            style={{ margin: 16, padding: "8px 24px", fontSize: 16 }}
          >
            Retake Picture
          </button>
        </div>
      )}
    </div>
  );
}