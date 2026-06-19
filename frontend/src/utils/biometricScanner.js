import * as faceapi from 'face-api.js';

const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

let modelsLoaded = false;

// Load face-api.js models from public CDN
export const loadFaceApiModels = async () => {
  if (modelsLoaded) return true;
  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);
    modelsLoaded = true;
    return true;
  } catch (err) {
    console.error("Failed to load face-api.js models from CDN:", err);
    return false;
  }
};

// Detect a single face in a video frame with landmarks and descriptor
export const detectFaceInVideo = async (videoEl) => {
  if (!videoEl || videoEl.paused || videoEl.ended) return null;
  try {
    const detection = await faceapi.detectSingleFace(
      videoEl,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.5 })
    ).withFaceLandmarks().withFaceDescriptor();
    return detection;
  } catch (err) {
    console.error("Face detection error:", err);
    return null;
  }
};

const dist = (p1, p2) => Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);

// Detect the direction/angle of the head based on landmark positions
export const getFaceAngle = (landmarks) => {
  if (!landmarks) return 'unknown';
  const pts = landmarks.positions;
  const leftJaw = pts[0].x;
  const rightJaw = pts[16].x;
  const noseTip = pts[30].x;

  const jawWidth = rightJaw - leftJaw;
  if (jawWidth <= 0) return 'unknown';

  const nosePosRatio = (noseTip - leftJaw) / jawWidth;

  if (nosePosRatio < 0.40) return 'left';
  if (nosePosRatio > 0.60) return 'right';
  return 'front';
};

// Calculate eye aspect ratio for blink detection
export const getEyeAspectRatio = (landmarks) => {
  if (!landmarks) return 1.0;
  const pts = landmarks.positions;
  
  // Left eye points 36 to 41
  const leftEye = pts.slice(36, 42);
  const leftEAR = (dist(leftEye[1], leftEye[5]) + dist(leftEye[2], leftEye[4])) / (2.0 * dist(leftEye[0], leftEye[3]));

  // Right eye points 42 to 47
  const rightEye = pts.slice(42, 48);
  const rightEAR = (dist(rightEye[1], rightEye[5]) + dist(rightEye[2], rightEye[4])) / (2.0 * dist(rightEye[0], rightEye[3]));

  return (leftEAR + rightEAR) / 2.0;
};

// Compare two face descriptors using Euclidean distance
export const compareDescriptors = (desc1, desc2) => {
  if (!desc1 || !desc2) return 0;
  try {
    const v1 = typeof desc1 === 'string' ? JSON.parse(desc1) : Array.from(desc1);
    const v2 = typeof desc2 === 'string' ? JSON.parse(desc2) : Array.from(desc2);

    if (v1.length !== v2.length) return 0;

    let sum = 0;
    for (let i = 0; i < v1.length; i++) {
      sum += (v1[i] - v2[i]) ** 2;
    }
    const distance = Math.sqrt(sum);
    
    // Similarity score: Euclidean distance of 0.6 is the default threshold in face-api
    // We scale distance so that a distance of 0 maps to 100% and 0.6 maps to 70%
    const score = Math.max(0, Math.min(100, Math.round((1 - (distance / 2)) * 100)));
    return { score, distance, matched: distance < 0.55 };
  } catch (err) {
    console.error("Error comparing descriptors:", err);
    return { score: 0, distance: 1, matched: false };
  }
};

// Helper for liveness state detection
export class FaceLivenessChecker {
  constructor() {
    this.blinkDetected = false;
    this.leftTurnDetected = false;
    this.rightTurnDetected = false;
    this.minEAR = 1.0;
  }

  reset() {
    this.blinkDetected = false;
    this.leftTurnDetected = false;
    this.rightTurnDetected = false;
    this.minEAR = 1.0;
  }

  processFrame(detection) {
    if (!detection) return;
    const landmarks = detection.landmarks;
    
    // 1. Check blinks (EAR below 0.22 is generally closed)
    const ear = getEyeAspectRatio(landmarks);
    if (ear < ear && ear < this.minEAR) {
      this.minEAR = ear;
    }
    if (ear < 0.22) {
      this.blinkDetected = true;
    }

    // 2. Check head rotations
    const angle = getFaceAngle(landmarks);
    if (angle === 'left') this.leftTurnDetected = true;
    if (angle === 'right') this.rightTurnDetected = true;
  }

  isLivenessValid() {
    // Requires at least a blink OR a head movement left/right to prove human interaction
    return this.blinkDetected || this.leftTurnDetected || this.rightTurnDetected;
  }
}
