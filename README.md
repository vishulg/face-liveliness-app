# Capture Live Face

A React + Vite app for live face liveness detection using blink verification. The app uses your webcam to ensure a real person is present by requiring a natural blink, then captures a live photo. Built with face-api.js and react-webcam.

## Features
- Live face detection and liveness check via blink
- Calibration phase for accurate eye aspect ratio (EAR) baseline
- Only allows capture if a single face is present and close enough
- Timeout and retry/retake support
- Webcam preview is mirrored for a natural selfie experience
- Captured image is also mirrored
- Responsive UI with clear status messages

## How it works
1. **Model Loading:** Loads face-api.js models from `/public/models`.
2. **Calibration:** User keeps eyes open for 3 seconds to calibrate EAR.
3. **Liveness Check:** User blinks; the app detects a soft blink (small eye closure) and waits for eyes to reopen before capturing.
4. **Capture:** When a valid blink is detected, a live photo is captured and displayed.
5. **Timeout/Retry:** If the process takes too long, the camera turns off and a retry button appears. Retake is also supported after capture.

## Getting Started

### Prerequisites
- Node.js (v16+ recommended)
- npm

### Install dependencies
```bash
npm install
```

### Run the app
```bash
npm run dev
```
Open the local URL shown in the terminal (e.g., http://localhost:5173) and allow camera access.

### Build for production
```bash
npm run build
```

## Project Structure
- `src/components/LivenessCamera.jsx` — Main liveness detection and capture logic
- `public/models/` — face-api.js models (required for detection)
- `src/App.jsx`, `src/main.jsx` — App entry points

## Customization
- Adjust blink sensitivity in `LivenessCamera.jsx` via `BLINK_DROP` and `CLOSED_FRAMES_REQUIRED`.
- Change timeout duration with `TIMEOUT_MS`.
- Update UI styles as needed.

## License
MIT
