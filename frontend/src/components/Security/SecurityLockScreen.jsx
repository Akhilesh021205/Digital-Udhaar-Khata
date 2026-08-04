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
  .bahi-khata-grid {
    background-color: #FFF8F0;
    background-image: 
      linear-gradient(rgba(183, 28, 28, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(183, 28, 28, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, transparent 79px, rgba(183, 28, 28, 0.08) 2px, transparent 81px);
    background-size: 30px 30px, 30px 30px, 100% 100%;
  }
  .dark .bahi-khata-grid {
    background-color: #0c0a09;
    background-image: 
      linear-gradient(rgba(245, 158, 11, 0.02) 1px, transparent 1px),
      linear-gradient(90deg, rgba(245, 158, 11, 0.02) 1px, transparent 1px),
      linear-gradient(90deg, transparent 79px, rgba(245, 158, 11, 0.05) 2px, transparent 81px);
    background-size: 30px 30px, 30px 30px, 100% 100%;
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
    setBiometricStatus('Loading security AI models...');
    livenessDetector.current.reset();

    const loaded = await loadFaceApiModels();
    if (!loaded) {
      toast.error('Failed to load Face ID AI models');
      setShowBiometricModal(false);
      return;
    }

    setBiometricStatus('Waiting for Face');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' }
      });
      setCameraStream(stream);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // Process loop
      let consecutiveMatches = 0;
      let checkCount = 0;

      const processFrame = async () => {
        if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) {
          animationFrameId.current = requestAnimationFrame(processFrame);
          return;
        }

        const detection = await detectFaceInVideo(videoRef.current);

        if (!detection) {
          setBiometricStatus('No Face Detected');
          consecutiveMatches = 0;
        } else {
          setBiometricStatus('Face Detected');
          checkCount++;

          // 1. Process Liveness
          livenessDetector.current.processFrame(detection);
          const livenessValid = livenessDetector.current.isLivenessValid();

          if (!livenessValid) {
            setBiometricStatus('Face Detected. Please blink or move head to verify liveness.');
          } else {
            setLivenessVerified(true);
            setBiometricStatus('Verifying Identity');

            // 2. Perform template comparison
            let bestScore = 0;
            let isMatched = false;
            try {
              const templates = typeof user?.biometricFaceTemplate === 'string'
                ? JSON.parse(user.biometricFaceTemplate)
                : user?.biometricFaceTemplate;

              if (templates) {
                const angles = ['front', 'left', 'right'];
                for (const angle of angles) {
                  if (templates[angle]) {
                    const comparison = compareDescriptors(detection.descriptor, templates[angle]);
                    if (comparison.score > bestScore) {
                      bestScore = comparison.score;
                    }
                    if (comparison.matched) {
                      isMatched = true;
                    }
                  }
                }
              }
            } catch (err) {
              console.error("Template parse/compare error:", err);
            }

            setMatchScore(bestScore);

            if (isMatched || bestScore >= 75) {
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
      if (err.name === 'NotAllowedError') {
        toast.warning('Biometric authentication canceled.');
        setBiometricStatus('Verification Canceled');
      } else {
        toast.error('Fingerprint recognition failed');
        setBiometricStatus('Fingerprint Not Recognized');
      }
    }
  };

  // Open modal and immediately trigger registered biometric unlock method
  const triggerBiometricSelection = () => {
    if (!user?.isBiometricEnabled) {
      toast.warning('Biometric authentication is not enabled or registered for this account');
      return;
    }

    const isFaceId = user.biometricCredentialId?.startsWith('face-id-');
    if (isFaceId) {
      if (!hasCamera) {
        toast.error('Camera is not available for Face ID unlock.');
        return;
      }
      setActiveScanType('face');
      setShowBiometricModal(true);
      setTimeout(() => startCameraScan(), 150);
    } else {
      if (!deviceSupportsBio) {
        toast.error('Device does not support fingerprint/platform unlock.');
        return;
      }
      setActiveScanType('fingerprint');
      setShowBiometricModal(true);
      setTimeout(() => handleFingerprintAuth(), 150);
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
    <div className={`flex gap-4 justify-center my-6 ${shake ? 'animate-shake' : ''}`}>
      {[0, 1, 2, 3].map((idx) => (
        <div
          key={idx}
          className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-300 ${idx < pin.length
              ? 'bg-[#A82424] border-[#A82424] scale-110 shadow-md shadow-[#A82424]/30'
              : 'border-[#A82424]/50 bg-transparent'
            }`}
        />
      ))}
    </div>
  );

  return (
    <div
      id="lock-screen-wrapper"
      tabIndex={0}
      className="fixed inset-0 z-50 flex items-center justify-center p-5 overflow-hidden outline-none bg-[#EADCC6]"
    >
      <style>{successAnimationStyles}</style>

      {/* Centered Lock Card */}
      <div className="w-full max-w-3xl bg-[#FAF5ED] border border-[#E6D4B8] rounded-[24px] shadow-2xl relative z-10 overflow-hidden flex flex-col md:flex-row min-h-[530px] animate-in fade-in zoom-in-95 duration-300">
        
        {/* Left Side: Watercolor Illustration */}
        <div className="hidden md:block w-1/2 relative bg-[#F7EFE3] border-r border-[#E6D4B8]">
          <img 
            src="/lock_illustration.png" 
            alt="Traditional Kirana Store & Ledger Book" 
            className="w-full h-full object-cover mix-blend-multiply opacity-95"
          />
        </div>

        {/* Right Side: PIN Unlock interface */}
        <div className="w-full md:w-1/2 p-8 flex flex-col justify-between items-center bg-[#FAF5ED]">
          
          {/* Header & Logo */}
          <div className="w-full text-center">
            <h2 className="text-3xl font-extrabold text-[#A82424] tracking-wide mb-1" style={{ fontFamily: 'Georgia, serif' }}>
              Udhaar Khata
            </h2>
            
            {/* Elegant Divider Ornament */}
            <div className="flex items-center justify-center gap-2 my-2 text-[#A82424]/40">
              <span className="h-[1px] w-12 bg-current" />
              <span className="text-sm">✦</span>
              <span className="h-[1px] w-12 bg-current" />
            </div>

            <h3 className="text-xl font-bold text-slate-800 mt-3 mb-1">Welcome Back</h3>
            <p className="text-xs text-slate-500 font-semibold">Enter your PIN to access your Khata</p>
          </div>

          {/* Dots */}
          <div className="w-full">
            {renderDots()}
          </div>

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-3 w-full max-w-[260px] mx-auto mb-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleKeyPress(num)}
                disabled={verifying}
                className="w-16 h-14 rounded-2xl bg-[#FAF5ED] border border-[#E6D4B8] flex items-center justify-center font-bold text-xl text-slate-800 hover:bg-[#A82424] hover:text-white hover:border-transparent transition-all shadow-[0_3px_6px_rgba(0,0,0,0.03)] active:scale-95 cursor-pointer disabled:opacity-50"
                style={{ fontFamily: 'Georgia, serif' }}
              >
                {num}
              </button>
            ))}

            {/* Spacer key at bottom-left */}
            <div className="w-16 h-14" />

            <button
              type="button"
              onClick={() => handleKeyPress(0)}
              disabled={verifying}
              className="w-16 h-14 rounded-2xl bg-[#FAF5ED] border border-[#E6D4B8] flex items-center justify-center font-bold text-xl text-slate-800 hover:bg-[#A82424] hover:text-white hover:border-transparent transition-all shadow-[0_3px_6px_rgba(0,0,0,0.03)] active:scale-95 cursor-pointer disabled:opacity-50"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              0
            </button>

            <button
              type="button"
              onClick={handleBackspace}
              disabled={verifying}
              className="w-16 h-14 rounded-2xl bg-[#FAF5ED] border border-[#E6D4B8] flex items-center justify-center text-slate-850 hover:bg-[#A82424] hover:text-white hover:border-transparent transition-all shadow-[0_3px_6px_rgba(0,0,0,0.03)] active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <HiOutlineBackspace size={22} className="text-slate-800 hover:text-white" />
            </button>
          </div>

          {/* Fingerprint auth & Signout */}
          <div className="w-full text-center space-y-3">
            {user?.isBiometricEnabled && (
              (user.biometricCredentialId?.startsWith('face-id-') && hasCamera) ||
              (!user.biometricCredentialId?.startsWith('face-id-') && deviceSupportsBio)
            ) && (
              <button
                type="button"
                onClick={triggerBiometricSelection}
                disabled={verifying}
                className="mx-auto px-4 py-2 border border-[#E6D4B8] bg-[#FAF5ED] hover:bg-[#F3E6D0] text-[#A82424] font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_2px_4px_rgba(0,0,0,0.02)] active:scale-98"
              >
                {user.biometricCredentialId?.startsWith('face-id-') ? (
                  <>
                    <LucideScan size={14} className="text-[#A82424]" />
                    <span>Use Face ID</span>
                  </>
                ) : (
                  <>
                    <LucideFingerprint size={14} className="text-[#A82424]" />
                    <span>Use Fingerprint</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={logout}
              className="text-xs text-slate-500 hover:text-[#A82424] hover:underline font-bold bg-transparent border-none cursor-pointer transition-colors block mx-auto"
            >
              Sign Out of Account
            </button>
          </div>

        </div>
      </div>

      {/* Real-time Biometric Authenticator Dialog */}
      {showBiometricModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-8 rounded-[30px] shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 text-center animate-in zoom-in-95 duration-200 relative overflow-hidden">

            {unlockSuccess ? (
              /* Success View */
              <div className="py-6 flex flex-col items-center">
                <div className="relative w-20 h-20 rounded-full flex items-center justify-center bg-green-50 dark:bg-green-950/30 text-green-500 animate-success-circle border border-green-500/20 mb-4">
                  <svg className="w-10 h-10 text-green-500 animate-draw-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                     <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white font-outfit">Identity Verified</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                  Unlocking your account...
                </p>
              </div>
            ) : (
              /* Scanning/Processing View */
              <>
                <div className="w-10 h-10 rounded-full bg-[#B71C1C]/10 dark:bg-[#F59E0B]/10 flex items-center justify-center text-[#B71C1C] dark:text-[#F59E0B] mb-4 border border-[#B71C1C]/20">
                  <Shield className="w-5 h-5" />
                </div>

                {activeScanType === 'face' ? (
                  /* Real-time Camera Preview inside custom circular mask */
                  <div className="relative w-40 h-40 rounded-full overflow-hidden border-4 border-[#B71C1C] dark:border-[#F59E0B] bg-black flex items-center justify-center shadow-lg mb-6">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#B71C1C]/5 to-transparent animate-pulse" />
                    {biometricStatus !== 'No Face Detected' && biometricStatus !== 'Face Not Recognized' && (
                      <div className="absolute left-0 right-0 h-0.5 bg-[#B71C1C] dark:bg-[#F59E0B] shadow-md shadow-[#B71C1C]/80 animate-scan-line" />
                    )}
                  </div>
                ) : (
                  /* Fingerprint Scan Panel Simulation */
                  <div className="relative w-32 h-32 mb-6 flex items-center justify-center bg-slate-50 dark:bg-slate-900/40 rounded-full border-2 border-slate-200 dark:border-slate-850 shadow-inner overflow-hidden">
                    {/* Active scanning outer ring */}
                    <div className="absolute inset-0 rounded-full border border-[#B71C1C]/20 dark:border-[#F59E0B]/20 animate-pulse" />
                    {/* Rotating dashboard lines */}
                    <div className="absolute inset-3 rounded-full border border-dashed border-[#B71C1C]/30 dark:border-[#F59E0B]/30 animate-spin" style={{ animationDuration: '8s' }} />
                    <div className="absolute inset-5 rounded-full border border-dotted border-[#B71C1C]/20 dark:border-[#F59E0B]/20 animate-spin" style={{ animationDuration: '12s', animationDirection: 'reverse' }} />

                    {/* Fingerprint Graphic */}
                    <div className="relative z-10 text-[#B71C1C] dark:text-[#F59E0B]">
                      <LucideFingerprint className="w-16 h-16 animate-pulse" />
                    </div>

                    {/* Vertical Scanning laser line */}
                    {biometricStatus === 'Verifying Fingerprint' && (
                      <div className="absolute left-0 right-0 h-0.5 bg-[#B71C1C] dark:bg-[#F59E0B] shadow-md shadow-[#B71C1C]/80 animate-scan-line" />
                    )}
                  </div>
                )}

                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 font-outfit">
                  {activeScanType === 'face' ? 'Face Verification' : 'Fingerprint Verification'}
                </h2>

                {/* Real-time status tracker */}
                <div className="mt-2 min-h-[48px] flex flex-col items-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium max-w-[280px] leading-relaxed">
                    {biometricStatus}
                  </p>
                  {activeScanType === 'face' && livenessVerified && biometricStatus === 'Verifying Identity' && (
                    <div className="text-[10px] text-[#B71C1C] dark:text-[#F59E0B] font-semibold mt-1">
                      {matchScore}%
                    </div>
                  )}
                </div>

                {/* Cancel or Fallback buttons */}
                <div className="w-full mt-6 space-y-2">
                  {biometricStatus === 'Face Not Recognized' ? (
                    <button
                      onClick={startCameraScan}
                      className="w-full py-2.5 bg-[#B71C1C] dark:bg-[#F59E0B] hover:brightness-110 text-white dark:text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-all"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Retry Scan
                    </button>
                  ) : activeScanType === 'fingerprint' && biometricStatus === 'Fingerprint Not Recognized' ? (
                    <button
                      onClick={handleFingerprintAuth}
                      className="w-full py-2.5 bg-[#B71C1C] dark:bg-[#F59E0B] hover:brightness-110 text-white dark:text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-all"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Try Fingerprint Again
                    </button>
                  ) : null}

                  <button
                    onClick={handleCloseBiometricModal}
                    className="w-full py-2.5 bg-transparent border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-xs rounded-xl cursor-pointer transition-colors"
                  >
                    Cancel & Use PIN
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
};

export default SecurityLockScreen;
