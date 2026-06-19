import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import API from '../../api/axios';
import Logo from '../Common/Logo';
import { toast } from 'react-toastify';
import { HiOutlineBackspace } from 'react-icons/hi';
import { Shield, Fingerprint as LucideFingerprint, Scan as LucideScan, Lock as LucideLock, AlertTriangle, RefreshCw } from 'lucide-react';
import { loadFaceApiModels, detectFaceInVideo, compareDescriptors, FaceLivenessChecker } from '../../utils/biometricScanner';

const successAnimationStyles = `
  @keyframes drawCheck {
    to {
      stroke-dashoffset: 0;
    }
  }
  @keyframes scaleUp {
    0% { transform: scale(1); }
    50% { transform: scale(1.15); }
    100% { transform: scale(1); }
  }
  @keyframes scanLine {
    0% { top: 0%; }
    50% { top: 100%; }
    100% { top: 0%; }
  }
  @keyframes ripple {
    0% { transform: scale(1); opacity: 0.8; }
    50% { transform: scale(1.35); opacity: 0.3; }
    100% { transform: scale(1.7); opacity: 0; }
  }
  .animate-draw-check {
    stroke-dasharray: 50;
    stroke-dashoffset: 50;
    animation: drawCheck 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }
  .animate-success-circle {
    animation: scaleUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }
  .animate-scan-line {
    animation: scanLine 2.2s ease-in-out infinite;
  }
  .animate-ripple {
    animation: ripple 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  }
`;

const base64urlToUint8Array = (base64url) => {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

const SecurityLockScreen = ({ onUnlock }) => {
  const { user, logout } = useAuth();
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Real-time Biometrics states
  const [showBiometricModal, setShowBiometricModal] = useState(false);
  const [activeScanType, setActiveScanType] = useState('face'); // 'face' | 'fingerprint'
  const [biometricStatus, setBiometricStatus] = useState('Waiting for Face');
  const [livenessVerified, setLivenessVerified] = useState(false);
  const [matchScore, setMatchScore] = useState(0);
  const [deviceSupportsBio, setDeviceSupportsBio] = useState(false);
  const [hasCamera, setHasCamera] = useState(false);
  const [unlockSuccess, setUnlockSuccess] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameId = useRef(null);
  const livenessDetector = useRef(new FaceLivenessChecker());

  // Check support for WebAuthn platform authenticator and camera support
  useEffect(() => {
    const checkBiometricSupport = async () => {
      if (window.PublicKeyCredential) {
        try {
          const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          setDeviceSupportsBio(available);
        } catch {
          setDeviceSupportsBio(false);
        }
      }
    };

    const checkCameraSupport = async () => {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoSupport = devices.some(device => device.kind === 'videoinput');
          setHasCamera(videoSupport);
        } catch {
          setHasCamera(false);
        }
      } else {
        setHasCamera(false);
      }
    };

    checkBiometricSupport();
    checkCameraSupport();
  }, []);

  const verifyPin = useCallback(async (enteredPin) => {
    setVerifying(true);
    try {
      await API.post('/auth/verify-pin', { pin: enteredPin });
      sessionStorage.setItem('udhaar-unlocked', 'true');
      toast.success('Unlocked!');
      onUnlock();
    } catch (err) {
      setShake(true);
      toast.error(err.response?.data?.message || 'Incorrect PIN');
      setPin('');
      setTimeout(() => setShake(false), 500);
    } finally {
      setVerifying(false);
    }
  }, [onUnlock]);

  const handleKeyPress = useCallback((num) => {
    if (verifying) return;
    setPin((prev) => (prev.length < 4 ? prev + num : prev));
  }, [verifying]);

  const handleBackspace = useCallback(() => {
    if (verifying) return;
    setPin((prev) => prev.slice(0, -1));
  }, [verifying]);

  useEffect(() => {
    if (pin.length === 4) {
      verifyPin(pin);
    }
  }, [pin, verifyPin]);

  // Handle server-side biometric unlock validation
  const verifyBiometricOnServer = useCallback(async () => {
    setVerifying(true);
    try {
      await API.post('/auth/verify-biometric', { credentialId: user.biometricCredentialId });
      sessionStorage.setItem('udhaar-unlocked', 'true');
      setUnlockSuccess(true);
      setTimeout(() => {
        onUnlock();
      }, 1500);
    } catch (err) {
      toast.error('Server verification failed');
      setBiometricStatus('Verification Failed');
    } finally {
      setVerifying(false);
    }
  }, [user, onUnlock]);

  // Run real-time webcam frame processor
  const startCameraScan = async () => {
    setLivenessVerified(false);
    setMatchScore(0);
    setBiometricStatus('Waiting for Face');
    livenessDetector.current.reset();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' }
      });
      setCameraStream(stream);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // Initialize hidden processing canvas
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
        canvasRef.current.width = 160;
        canvasRef.current.height = 120;
      }

      // Process loop
      let consecutiveMatches = 0;
      let checkCount = 0;

      const processFrame = () => {
        if (!videoRef.current || !canvasRef.current || videoRef.current.paused || videoRef.current.ended) {
          animationFrameId.current = requestAnimationFrame(processFrame);
          return;
        }

        const res = detectFaceInFrame(videoRef.current, canvasRef.current);

        if (!res.facePresent) {
          setBiometricStatus('No Face Detected');
          consecutiveMatches = 0;
        } else {
          setBiometricStatus('Face Detected');
          checkCount++;

          // 1. Analyze Liveness (Require blink, turn, or smile)
          const liveness = livenessDetector.current.analyzeFrame(canvasRef.current, res.boundingBox, res.centroid);

          if (!livenessVerified) {
            setBiometricStatus('Face Detected. Please blink to verify liveness.');
            if (liveness.blink || liveness.smile || liveness.headTurnLeft || liveness.headTurnRight) {
              setLivenessVerified(true);
              toast.success('Liveness Verified!');
            }
          } else {
            // 2. Perform template comparison
            setBiometricStatus('Verifying Identity');

            const liveTemplate = extractFaceTemplate(videoRef.current, res.boundingBox);
            const score = compareFaceTemplates(liveTemplate, user?.biometricFaceTemplate);
            setMatchScore(score);

            if (score >= 75) {
              consecutiveMatches++;
              if (consecutiveMatches >= 3) {
                // Verified successfully
                setBiometricStatus('Face Verified');
                cancelScan();
                verifyBiometricOnServer();
                return;
              }
            } else {
              consecutiveMatches = 0;
              if (checkCount > 45) { // ~3 seconds of active scanning
                setBiometricStatus('Face Not Recognized');
              }
            }
          }
        }

        animationFrameId.current = requestAnimationFrame(processFrame);
      };

      animationFrameId.current = requestAnimationFrame(processFrame);

    } catch (err) {
      console.error('Camera capture error:', err);
      toast.error('Could not access camera for Face Unlock');
      setShowBiometricModal(false);
    }
  };

  const cancelScan = () => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  };

  const handleCloseBiometricModal = () => {
    cancelScan();
    setShowBiometricModal(false);
  };

  // Start Fingerprint/Passkey verification using browser WebAuthn API
  const handleFingerprintAuth = async () => {
    if (!user?.isBiometricEnabled || !user?.biometricCredentialId) {
      toast.error('Fingerprint unlock has not been registered');
      return;
    }

    try {
      setBiometricStatus('Verifying Fingerprint');
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      let credentialIdBuffer;
      try {
        credentialIdBuffer = base64urlToUint8Array(user.biometricCredentialId);
      } catch {
        credentialIdBuffer = new TextEncoder().encode(user.biometricCredentialId);
      }

      const getOptions = {
        publicKey: {
          challenge,
          rpId: window.location.hostname,
          allowCredentials: [{
            id: credentialIdBuffer,
            type: 'public-key'
          }],
          userVerification: 'required',
          timeout: 60000
        }
      };

      const credential = await navigator.credentials.get(getOptions);
      if (credential) {
        setUnlockSuccess(true);
        verifyBiometricOnServer();
      }
    } catch (err) {
      console.error('Fingerprint auth failed:', err);
      toast.error('Fingerprint recognition failed');
      setBiometricStatus('Fingerprint Not Recognized');
    }
  };

  // Open modal and show selection of biometric unlock methods
  const triggerBiometricSelection = () => {
    if (user?.isBiometricEnabled) {
      setActiveScanType('choice');
      setShowBiometricModal(true);
    } else {
      toast.warning('Biometric authentication is not enabled or registered for this account');
    }
  };

  // Physical keyboard support
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (verifying || showBiometricModal) return;
      const key = e.key;
      if (key >= '0' && key <= '9') {
        handleKeyPress(parseInt(key, 10));
      } else if (key === 'Backspace') {
        handleBackspace();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [verifying, showBiometricModal, handleKeyPress, handleBackspace]);

  // Clean up streams on unmount
  useEffect(() => {
    return () => cancelScan();
  }, [cameraStream]);

  // Autofocus lock-screen
  useEffect(() => {
    const wrapper = document.getElementById('lock-screen-wrapper');
    if (wrapper) wrapper.focus();
  }, []);

  const renderDots = () => (
    <div className={`flex gap-4 justify-center my-8 ${shake ? 'animate-shake' : ''}`}>
      {[0, 1, 2, 3].map((idx) => (
        <div
          key={idx}
          className={`w-4.5 h-4.5 rounded-full border-2 transition-all duration-150 ${idx < pin.length
              ? 'bg-[#DC2626] border-[#DC2626] scale-110 shadow-md shadow-red-600/30'
              : 'border-slate-gray/30 bg-transparent'
            }`}
        />
      ))}
    </div>
  );

  return (
    <div
      id="lock-screen-wrapper"
      tabIndex={0}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50 p-5 overflow-hidden outline-none"
    >
      <style>{successAnimationStyles}</style>

      {/* Decorative background gradients */}
      <div className="absolute w-[500px] h-[500px] bg-radial from-red-600/5 to-transparent -top-[100px] -right-[100px] rounded-full"></div>
      <div className="absolute w-[400px] h-[400px] bg-radial from-red-600/5 to-transparent -bottom-[80px] -left-[80px] rounded-full"></div>

      <div className="w-full max-w-md p-8 bg-white border border-slate-100 rounded-3xl shadow-xl relative z-10 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center p-2 shadow-inner">
          <Logo />
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-1 font-outfit">Udhaar Khata Locked</h1>
        <p className="text-sm text-slate-500 mb-6">Enter your security PIN or use biometrics to unlock</p>

        {renderDots()}

        <div className="grid grid-cols-3 gap-y-4 gap-x-6 max-w-xs mx-auto mt-4 mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeyPress(num)}
              disabled={verifying}
              className="w-16 h-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center font-bold text-lg text-slate-800 hover:bg-[#DC2626] hover:text-white transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {num}
            </button>
          ))}

          {/* Biometrics key */}
          {user?.isBiometricEnabled && (hasCamera || deviceSupportsBio) ? (
            <button
              type="button"
              onClick={triggerBiometricSelection}
              disabled={verifying}
              className="w-16 h-16 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-[#DC2626] hover:bg-[#DC2626] hover:text-white transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
              title="Authenticate using Device Biometrics"
            >
              {hasCamera ? (
                <LucideScan size={24} />
              ) : (
                <LucideFingerprint size={24} />
              )}
            </button>
          ) : (
            <div className="w-16 h-16" />
          )}

          <button
            type="button"
            onClick={() => handleKeyPress(0)}
            disabled={verifying}
            className="w-16 h-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center font-bold text-lg text-slate-800 hover:bg-[#DC2626] hover:text-white transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
          >
            0
          </button>

          <button
            type="button"
            onClick={handleBackspace}
            disabled={verifying}
            className="w-16 h-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-lg text-slate-800 hover:bg-[#DC2626] hover:text-white transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <HiOutlineBackspace size={24} />
          </button>
        </div>

        <button
          onClick={logout}
          className="text-xs text-slate-400 hover:text-[#DC2626] hover:underline font-semibold bg-transparent border-none cursor-pointer"
        >
          Sign Out of Account
        </button>
      </div>

      {/* Real-time Biometric Authenticator Dialog */}
      {showBiometricModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white border border-slate-100 p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 text-center animate-in zoom-in-95 duration-200 relative overflow-hidden">

            {activeScanType === 'choice' && (
              <>
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-[#DC2626] mb-4 border border-red-100/50">
                  <Shield className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 font-outfit">Unlock Your Account</h2>
                <p className="text-xs text-slate-500 mt-2 mb-6">Choose a secure way to continue.</p>

                <div className="w-full space-y-3">
                  {/* Face ID option */}
                  {hasCamera && (
                    <button
                      onClick={() => {
                        if (!user?.biometricFaceTemplate && !user?.biometricCredentialId?.startsWith('face-id-')) {
                          toast.error('Face ID is not registered for this account. Please enable it in Settings.');
                          return;
                        }
                        setActiveScanType('face');
                        setTimeout(() => startCameraScan(), 150);
                      }}
                      className="w-full py-3.5 px-5 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-semibold text-sm rounded-2xl flex items-center justify-between transition-all duration-200 shadow-md shadow-red-600/10 hover:shadow-lg hover:shadow-red-600/20 active:scale-[0.99] cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <LucideScan className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
                        <span>Continue with Face ID</span>
                      </div>
                    </button>
                  )}

                  {/* Fingerprint option */}
                  {deviceSupportsBio && (
                    <button
                      onClick={() => {
                        if (!user?.biometricCredentialId || user?.biometricCredentialId?.startsWith('face-id-')) {
                          toast.error('Fingerprint is not registered for this account. Please enable it in Settings.');
                          return;
                        }
                        setActiveScanType('fingerprint');
                        setTimeout(() => handleFingerprintAuth(), 150);
                      }}
                      className="w-full py-3.5 px-5 font-semibold text-sm rounded-2xl flex items-center justify-between border bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300 transition-all duration-200 active:scale-[0.99] cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <LucideFingerprint className="w-5 h-5 text-[#DC2626] group-hover:scale-110 transition-all" />
                        <span>Use Fingerprint</span>
                      </div>
                    </button>
                  )}

                  {/* PIN Option - Always visible */}
                  <button
                    onClick={handleCloseBiometricModal}
                    className="w-full py-3.5 px-5 font-semibold text-sm rounded-2xl flex items-center justify-between border bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300 transition-all duration-200 active:scale-[0.99] cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <LucideLock className="w-5 h-5 text-[#DC2626] group-hover:scale-110 transition-all" />
                      <span>Enter PIN</span>
                    </div>
                  </button>

                  <div className="pt-4 border-t border-slate-100 mt-2 text-center">
                    <p className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
                      <Shield className="w-3 h-3 text-[#DC2626]" /> Your data is encrypted and protected
                    </p>
                  </div>
                </div>
              </>
            )}

            {activeScanType !== 'choice' && (
              <>
                {unlockSuccess ? (
                  /* Success View */
                  <div className="py-6 flex flex-col items-center">
                    <div className="relative w-20 h-20 rounded-full flex items-center justify-center bg-green-50 text-green-500 animate-success-circle border border-green-500/20 mb-4">
                      <svg className="w-10 h-10 text-green-500 animate-draw-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 font-outfit">Identity Verified</h2>
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                      Unlocking your account...
                    </p>
                  </div>
                ) : (
                  /* Scanning/Processing View */
                  <>
                    <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-[#DC2626] mb-4 border border-red-100/50">
                      <Shield className="w-5 h-5" />
                    </div>

                    {activeScanType === 'face' ? (
                      /* Real-time Camera Preview inside custom circular mask */
                      <div className="relative w-40 h-40 rounded-full overflow-hidden border-4 border-[#DC2626] bg-black flex items-center justify-center shadow-lg mb-6">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover scale-x-[-1]"
                        />
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#DC2626]/5 to-transparent animate-pulse" />
                        {biometricStatus !== 'No Face Detected' && biometricStatus !== 'Face Not Recognized' && (
                          <div className="absolute left-0 right-0 h-0.5 bg-[#DC2626] shadow-md shadow-red-600/80 animate-scan-line" />
                        )}
                      </div>
                    ) : (
                      /* Fingerprint Ripple View */
                      <div className="relative w-32 h-32 mb-6 flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full bg-red-100/40 border border-red-200/40 animate-ripple" style={{ animationDelay: '0s' }} />
                        <div className="absolute inset-0 rounded-full bg-red-100/40 border border-red-200/40 animate-ripple" style={{ animationDelay: '0.6s' }} />
                        <div className="absolute inset-0 rounded-full bg-red-100/40 border border-red-200/40 animate-ripple" style={{ animationDelay: '1.2s' }} />

                        <div className="relative w-20 h-20 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-[#DC2626] shadow-sm">
                          <LucideFingerprint className="w-10 h-10" />
                        </div>
                      </div>
                    )}

                    <h2 className="text-lg font-bold text-slate-900 font-outfit">
                      {activeScanType === 'face' ? 'Face Verification' : 'Fingerprint Verification'}
                    </h2>

                    {/* Real-time status tracker */}
                    <div className="mt-2 min-h-[48px] flex flex-col items-center">
                      <p className="text-xs text-slate-500 font-medium max-w-[280px] leading-relaxed">
                        {biometricStatus}
                      </p>
                      {activeScanType === 'face' && livenessVerified && biometricStatus === 'Verifying Identity' && (
                        <div className="text-[10px] text-red-600 font-semibold mt-1">
                          {matchScore}%
                        </div>
                      )}
                    </div>

                    {/* Cancel or Fallback buttons */}
                    <div className="w-full mt-6 space-y-2">
                      {biometricStatus === 'Face Not Recognized' ? (
                        <button
                          onClick={startCameraScan}
                          className="w-full py-2.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-all"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Retry Scan
                        </button>
                      ) : activeScanType === 'fingerprint' && biometricStatus === 'Fingerprint Not Recognized' ? (
                        <button
                          onClick={handleFingerprintAuth}
                          className="w-full py-2.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-all"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Try Fingerprint Again
                        </button>
                      ) : null}

                      <button
                        onClick={() => {
                          cancelScan();
                          setActiveScanType('choice');
                        }}
                        className="w-full py-2.5 bg-transparent border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 font-bold text-xs rounded-xl cursor-pointer transition-colors"
                      >
                        Back
                      </button>

                      <button
                        onClick={handleCloseBiometricModal}
                        className="w-full py-2 bg-transparent text-[#DC2626] hover:underline font-bold text-xs rounded-xl cursor-pointer transition-all"
                      >
                        Use PIN 
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
};

export default SecurityLockScreen;
