import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import API from '../../api/axios';
import Logo from '../Common/Logo';
import { toast } from 'react-toastify';
import { Capacitor } from '@capacitor/core';
import { BiometricService } from '../../services/biometricService';
import { HiOutlineBackspace } from 'react-icons/hi';
import { 
  Shield, 
  Fingerprint as LucideFingerprint, 
  Scan as LucideScan, 
  Lock as LucideLock, 
  AlertTriangle, 
  RefreshCw,
  KeyRound,
  Mail,
  X,
  Eye,
  EyeOff,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
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
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-6px); }
    75% { transform: translateX(6px); }
  }
  .animate-shake {
    animation: shake 0.25s cubic-bezier(.36,.07,.19,.97) both;
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

  // Forgot PIN state
  const [showForgotPinModal, setShowForgotPinModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState(user?.email || '');
  const [forgotPassword, setForgotPassword] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [forgotPinStep, setForgotPinStep] = useState('verify'); // 'verify' | 'new-pin' | 'confirm-pin'
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [sendingResetEmail, setSendingResetEmail] = useState(false);

  // Sync forgotEmail if user object updates
  useEffect(() => {
    if (user?.email) {
      setForgotEmail(user.email);
    }
  }, [user]);

  // Verify account password to reset PIN
  const handleVerifyAccountPassword = async (e) => {
    if (e) e.preventDefault();
    if (!forgotEmail || !forgotPassword) {
      toast.error('Please enter your account email and password');
      return;
    }

    setResetLoading(true);
    try {
      await API.post('/auth/verify-password', { password: forgotPassword });
      toast.success('Identity verified! Create your new 4-digit PIN.');
      setForgotPinStep('new-pin');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Incorrect password. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  // Submit new PIN setup
  const handleSaveNewPin = async (finalPin) => {
    setResetLoading(true);
    try {
      await API.post('/auth/setup-security', { pin: finalPin });
      localStorage.setItem('udhaar-unlocked', 'true');
      localStorage.setItem('udhaar-last-active', Date.now().toString());
      toast.success('New Security PIN created & account unlocked!');
      setShowForgotPinModal(false);
      onUnlock();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update PIN');
    } finally {
      setResetLoading(false);
    }
  };

  // Keypress handler for new PIN creation in modal
  const handleForgotPinKeyPress = (num) => {
    if (resetLoading) return;
    if (forgotPinStep === 'new-pin') {
      if (newPin.length < 4) {
        const val = newPin + num;
        setNewPin(val);
        if (val.length === 4) {
          setTimeout(() => setForgotPinStep('confirm-pin'), 250);
        }
      }
    } else if (forgotPinStep === 'confirm-pin') {
      if (confirmNewPin.length < 4) {
        const val = confirmNewPin + num;
        setConfirmNewPin(val);
        if (val.length === 4) {
          if (val === newPin) {
            handleSaveNewPin(val);
          } else {
            toast.error("PINs do not match. Please try again.");
            setTimeout(() => {
              setConfirmNewPin('');
              setNewPin('');
              setForgotPinStep('new-pin');
            }, 500);
          }
        }
      }
    }
  };

  const handleForgotPinBackspace = () => {
    if (resetLoading) return;
    if (forgotPinStep === 'new-pin') {
      setNewPin(prev => prev.slice(0, -1));
    } else if (forgotPinStep === 'confirm-pin') {
      setConfirmNewPin(prev => prev.slice(0, -1));
    }
  };

  // Send password reset link to email if shopkeeper forgot account password
  const handleSendForgotPasswordEmail = async () => {
    if (!forgotEmail) {
      toast.error('Please enter your email address');
      return;
    }
    setSendingResetEmail(true);
    try {
      await API.post('/auth/forgot-password', { email: forgotEmail });
      toast.success(`Password reset link sent to ${forgotEmail}! Check your inbox.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send password reset email');
    } finally {
      setSendingResetEmail(false);
    }
  };

  const closeForgotPinModal = () => {
    setShowForgotPinModal(false);
    setForgotPinStep('verify');
    setForgotPassword('');
    setNewPin('');
    setConfirmNewPin('');
  };

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

  // Auto-trigger biometric fingerprint prompt immediately when Security PIN screen appears asking for PIN
  useEffect(() => {
    const autoPromptTimer = setTimeout(() => {
      if (user?.isBiometricEnabled) {
        triggerBiometricSelection();
      }
    }, 400);

    return () => clearTimeout(autoPromptTimer);
  }, [user?.isBiometricEnabled]);

  const verifyPin = useCallback(async (enteredPin) => {
    setVerifying(true);
    try {
      await API.post('/auth/verify-pin', { pin: enteredPin });
      localStorage.setItem('udhaar-unlocked', 'true');
      localStorage.setItem('udhaar-last-active', Date.now().toString());
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
      localStorage.setItem('udhaar-unlocked', 'true');
      localStorage.setItem('udhaar-last-active', Date.now().toString());
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

  // Start Fingerprint/Passkey verification using browser WebAuthn API or Native Biometrics
  const handleFingerprintAuth = async () => {
    if (!user?.isBiometricEnabled) {
      toast.error('Fingerprint unlock has not been registered');
      return;
    }

    try {
      setBiometricStatus('Verifying Fingerprint...');
      let verified = false;

      // 1. On Native Mobile App (Capacitor)
      if (Capacitor.isNativePlatform()) {
        verified = await BiometricService.authenticate('Unlock AI Digital Khata');
      } 
      // 2. On Web Browsers (WebAuthn Platform Authenticator)
      else if (window.PublicKeyCredential && user.biometricCredentialId && !user.biometricCredentialId.startsWith('face-id-')) {
        try {
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
              rpId: window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname,
              allowCredentials: [{
                id: credentialIdBuffer,
                type: 'public-key'
              }],
              userVerification: 'required',
              timeout: 60000
            }
          };

          const credential = await navigator.credentials.get(getOptions);
          verified = !!credential;
        } catch (webAuthnErr) {
          console.warn('WebAuthn fingerprint prompt canceled or failed:', webAuthnErr);
          verified = false;
        }
      } else {
        verified = await BiometricService.authenticate('Unlock AI Digital Khata');
      }

      if (verified) {
        setUnlockSuccess(true);
        setBiometricStatus('Fingerprint Verified');
        setTimeout(() => {
          verifyBiometricOnServer();
        }, 500);
      } else {
        setUnlockSuccess(false);
        setBiometricStatus('Verification Canceled');
        toast.warning('Biometric authentication canceled or unverified. Enter PIN to unlock.');
      }
    } catch (err) {
      console.error('Fingerprint auth error:', err);
      setUnlockSuccess(false);
      setBiometricStatus('Verification Canceled');
      toast.warning('Fingerprint authentication failed or canceled.');
    }
  };

  // Open modal and immediately trigger registered biometric unlock method
  const triggerBiometricSelection = async () => {
    if (!user?.isBiometricEnabled) {
      toast.warning('Biometric authentication is not enabled or registered for this account');
      return;
    }

    if (Capacitor.isNativePlatform()) {
      try {
        const available = await BiometricService.isAvailable();
        if (!available) {
          toast.error('Native biometrics not available on this device.');
          return;
        }
        const verified = await BiometricService.authenticate();
        if (verified) {
          localStorage.setItem('udhaar-unlocked', 'true');
          localStorage.setItem('udhaar-last-active', Date.now().toString());
          setUnlockSuccess(true);
          toast.success('Unlocked!');
          setTimeout(() => {
            onUnlock();
          }, 1000);
        }
      } catch (err) {
        console.error('Native biometric unlock failed:', err);
        toast.error('Biometric authentication failed or canceled.');
      }
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
          className={`w-3.5 h-3.5 rounded-full border transition-all duration-300 ${
            idx < pin.length
              ? 'bg-orange border-orange scale-110 shadow-md shadow-orange/45 dark:shadow-orange/60'
              : 'border-[#d7cab8] dark:border-slate-700 bg-white/70 dark:bg-slate-800/70'
          }`}
        />
      ))}
    </div>
  );

  return (
    <div
      id="lock-screen-wrapper"
      tabIndex={0}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-5 overflow-hidden outline-none udhaar-lock-bg"
    >
      <style>{successAnimationStyles}</style>

      <div className="khata-watermark">Khata</div>

      {/* Ambient background glow for glassmorphism */}
      <div className="absolute w-[350px] h-[350px] bg-orange/10 dark:bg-orange/15 rounded-full blur-[120px] pointer-events-none" />

      {/* Unified Glassmorphic Lock Card */}
      <div className="w-full max-w-sm sm:max-w-md bg-[#FAF4F0]/90 dark:bg-[#1A1512]/95 backdrop-blur-xl border border-[#E6DED1]/60 dark:border-slate-800 rounded-[32px] shadow-2xl shadow-stone-950/10 dark:shadow-black/50 p-6 sm:p-10 flex flex-col justify-between items-center min-h-[520px] sm:min-h-[580px] relative z-10 animate-in fade-in zoom-in-95 duration-300">
        
        {/* Header Section */}
        <div className="w-full flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-orange/10 dark:bg-orange/20 flex items-center justify-center text-orange border border-orange/20 dark:border-orange/30 shadow-[inset_0_1px_2px_rgba(255,255,255,0.2)] mb-4">
            <Shield className="w-6 h-6 animate-pulse" />
          </div>
          <h2 className="text-3xl font-black text-deep-navy dark:text-white tracking-wide mb-1 font-outfit">
            AI Digital Khata
          </h2>
          

          <h3 className="text-xl font-bold text-deep-navy dark:text-white mt-2 mb-1 font-outfit">Welcome Back</h3>
          <p className="text-xs text-slate-gray dark:text-slate-400 font-semibold">Enter your PIN to access your Khata</p>
        </div>

        {/* Dots */}
        <div className="w-full">
          {renderDots()}
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-4.5 w-full max-w-[260px] mx-auto mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeyPress(num)}
              disabled={verifying}
              className="pin-key flex items-center justify-center font-bold text-xl cursor-pointer disabled:opacity-50"
            >
              {num}
            </button>
          ))}

          {/* Bottom row: Biometrics / Lock placeholder, 0, Backspace */}
          {user?.isBiometricEnabled && (
            Capacitor.isNativePlatform() ||
            (user.biometricCredentialId?.startsWith('face-id-') && hasCamera) ||
            (!user.biometricCredentialId?.startsWith('face-id-') && deviceSupportsBio)
          ) ? (
            <button
              type="button"
              onClick={triggerBiometricSelection}
              disabled={verifying}
              className="pin-key flex items-center justify-center cursor-pointer disabled:opacity-50 text-orange dark:text-orange/90 hover:text-orange-hover"
            >
              {Capacitor.isNativePlatform() ? (
                <LucideFingerprint className="w-5.5 h-5.5" />
              ) : user.biometricCredentialId?.startsWith('face-id-') ? (
                <LucideScan className="w-5.5 h-5.5" />
              ) : (
                <LucideFingerprint className="w-5.5 h-5.5" />
              )}
            </button>
          ) : (
            <div className="w-16 h-16 flex items-center justify-center text-slate-300 dark:text-slate-700">
              <LucideLock className="w-5 h-5" />
            </div>
          )}

          <button
            type="button"
            onClick={() => handleKeyPress(0)}
            disabled={verifying}
            className="pin-key flex items-center justify-center font-bold text-xl cursor-pointer disabled:opacity-50"
          >
            0
          </button>

          <button
            type="button"
            onClick={handleBackspace}
            disabled={verifying}
            className="pin-key flex items-center justify-center text-deep-navy dark:text-white transition-all cursor-pointer disabled:opacity-50"
          >
            <HiOutlineBackspace size={24} className="text-current" />
          </button>
        </div>

        {/* Footer Actions */}
        <div className="w-full text-center space-y-2.5">
          <button
            type="button"
            onClick={() => setShowForgotPinModal(true)}
            className="text-xs font-bold text-orange hover:text-orange-hover hover:underline bg-transparent border-none cursor-pointer transition-colors block mx-auto py-0.5"
          >
            Forgot PIN? Verify Account
          </button>

          <button
            type="button"
            onClick={logout}
            className="text-[11px] text-slate-gray hover:text-orange hover:underline font-semibold bg-transparent border-none cursor-pointer transition-colors block mx-auto"
          >
            Sign Out of Account
          </button>
        </div>

      </div>

      {/* Real-time Biometric Authenticator Dialog */}
      {showBiometricModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#FAF4F0] dark:bg-[#1A1512] border border-[#E6DED1] dark:border-slate-800 p-6 sm:p-8 rounded-[30px] shadow-2xl flex flex-col items-center max-w-xs sm:max-w-sm w-full mx-4 text-center animate-in zoom-in-95 duration-200 relative overflow-hidden">

            {unlockSuccess ? (
              /* Success View */
              <div className="py-6 flex flex-col items-center">
                <div className="relative w-20 h-20 rounded-full flex items-center justify-center bg-green-50 dark:bg-green-950/30 text-green-500 animate-success-circle border border-green-500/20 mb-4">
                  <svg className="w-10 h-10 text-green-500 animate-draw-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                     <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-deep-navy dark:text-white font-outfit">Identity Verified</h2>
                <p className="text-xs text-slate-gray dark:text-slate-400 mt-2 leading-relaxed">
                  Unlocking your account...
                </p>
              </div>
            ) : (
              /* Scanning/Processing View */
              <>
                <div className="w-10 h-10 rounded-full bg-orange/10 flex items-center justify-center text-orange mb-4 border border-orange/20">
                  <Shield className="w-5 h-5" />
                </div>

                {activeScanType === 'face' ? (
                  /* Real-time Camera Preview inside custom circular mask */
                  <div className="relative w-40 h-40 rounded-full overflow-hidden border-4 border-orange bg-black flex items-center justify-center shadow-lg mb-6">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-orange/5 to-transparent animate-pulse" />
                    {biometricStatus !== 'No Face Detected' && biometricStatus !== 'Face Not Recognized' && (
                      <div className="absolute left-0 right-0 h-0.5 bg-orange shadow-md shadow-orange/80 animate-scan-line" />
                    )}
                  </div>
                ) : (
                  /* Fingerprint Scan Panel Simulation */
                  <div
                    onClick={handleFingerprintAuth}
                    className="relative w-32 h-32 mb-6 flex items-center justify-center bg-slate-50 dark:bg-slate-900/40 rounded-full border-2 border-soft-gray hover:border-orange dark:border-slate-800 shadow-inner overflow-hidden cursor-pointer transition-all active:scale-95"
                    title="Tap to scan fingerprint"
                  >
                    {/* Active scanning outer ring */}
                    <div className="absolute inset-0 rounded-full border border-orange/20 animate-pulse" />
                    {/* Rotating dashboard lines */}
                    <div className="absolute inset-3 rounded-full border border-dashed border-orange/30 animate-spin" style={{ animationDuration: '8s' }} />
                    <div className="absolute inset-5 rounded-full border border-dotted border-orange/20 animate-spin" style={{ animationDuration: '12s', animationDirection: 'reverse' }} />

                    {/* Fingerprint Graphic */}
                    <div className="relative z-10 text-orange">
                      <LucideFingerprint className="w-16 h-16 animate-pulse" />
                    </div>

                    {/* Vertical Scanning laser line */}
                    {biometricStatus === 'Verifying Fingerprint' && (
                      <div className="absolute left-0 right-0 h-0.5 bg-orange shadow-md shadow-orange/80 animate-scan-line" />
                    )}
                  </div>
                )}

                <h2 className="text-lg font-bold text-deep-navy dark:text-white font-outfit">
                  {activeScanType === 'face' ? 'Face Verification' : 'Fingerprint Verification'}
                </h2>

                {/* Real-time status tracker */}
                <div className="mt-2 min-h-[48px] flex flex-col items-center">
                  <p className="text-xs text-slate-gray dark:text-slate-400 font-medium max-w-[280px] leading-relaxed">
                    {biometricStatus}
                  </p>
                  {activeScanType === 'face' && livenessVerified && biometricStatus === 'Verifying Identity' && (
                    <div className="text-[10px] text-orange font-semibold mt-1">
                      {matchScore}%
                    </div>
                  )}
                </div>

                {/* Cancel or Fallback buttons */}
                <div className="w-full mt-6 space-y-2">
                  {biometricStatus === 'Face Not Recognized' ? (
                    <button
                      onClick={startCameraScan}
                      className="w-full py-2.5 bg-orange hover:bg-orange-hover text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-all"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Retry Scan
                    </button>
                  ) : activeScanType === 'fingerprint' && biometricStatus === 'Fingerprint Not Recognized' ? (
                    <button
                      onClick={handleFingerprintAuth}
                      className="w-full py-2.5 bg-orange hover:bg-orange-hover text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-all"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Try Fingerprint Again
                    </button>
                  ) : null}

                  <button
                    onClick={handleCloseBiometricModal}
                    className="w-full py-2.5 bg-transparent border border-soft-gray text-slate-gray hover:text-deep-navy hover:bg-light-cream font-bold text-xs rounded-xl cursor-pointer transition-colors"
                  >
                    Cancel & Use PIN
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}

      {/* Forgot PIN / Account Verification Reset Dialog */}
      {showForgotPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200 p-4">
          <div className="bg-[#FAF4F0] dark:bg-[#1A1512] border border-[#E6DED1] dark:border-slate-800 p-6 sm:p-8 rounded-[32px] shadow-2xl flex flex-col items-center max-w-sm sm:max-w-md w-full text-center animate-in zoom-in-95 duration-200 relative overflow-hidden">
            
            {/* Close Button */}
            <button
              onClick={closeForgotPinModal}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white bg-slate-100 dark:bg-slate-800/80 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {forgotPinStep === 'verify' ? (
              /* Step 1: Verify Account Email & Password */
              <form onSubmit={handleVerifyAccountPassword} className="w-full flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-orange/10 dark:bg-orange/20 flex items-center justify-center text-orange border border-orange/20 mb-4">
                  <KeyRound className="w-6 h-6" />
                </div>

                <h2 className="text-xl font-bold text-deep-navy dark:text-white font-outfit mb-1">
                  Reset Security PIN
                </h2>
                <p className="text-xs text-slate-gray dark:text-slate-400 font-medium mb-6 max-w-xs leading-relaxed">
                  Enter your registered email and account password to verify identity and set a new PIN.
                </p>

                <div className="w-full space-y-4 text-left mb-6">
                  {/* Email Field */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Account Email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="yourname@gmail.com"
                        required
                        className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-semibold text-deep-navy dark:text-white focus:outline-none focus:border-orange focus:ring-1 focus:ring-orange transition-all"
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        Account Password
                      </label>
                      <button
                        type="button"
                        onClick={handleSendForgotPasswordEmail}
                        disabled={sendingResetEmail}
                        className="text-[10px] font-bold text-orange hover:underline bg-transparent border-none cursor-pointer"
                      >
                        {sendingResetEmail ? 'Sending Link...' : 'Forgot Password?'}
                      </button>
                    </div>
                    <div className="relative">
                      <LucideLock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPasswordText ? 'text' : 'password'}
                        value={forgotPassword}
                        onChange={(e) => setForgotPassword(e.target.value)}
                        placeholder="Enter your account password"
                        required
                        className="w-full pl-10 pr-10 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-semibold text-deep-navy dark:text-white focus:outline-none focus:border-orange focus:ring-1 focus:ring-orange transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordText(!showPasswordText)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                      >
                        {showPasswordText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full py-3.5 bg-orange hover:bg-orange-hover disabled:opacity-50 text-white font-bold text-xs rounded-2xl shadow-lg shadow-orange/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                >
                  {resetLoading ? 'Verifying Password...' : 'Verify Password & Reset PIN'}
                  {!resetLoading && <ArrowRight className="w-4 h-4" />}
                </button>
              </form>
            ) : (
              /* Step 2: Create & Confirm New 4-Digit PIN */
              <div className="w-full flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-green-50 dark:bg-green-950/30 flex items-center justify-center text-green-500 border border-green-500/20 mb-3">
                  <CheckCircle2 className="w-6 h-6" />
                </div>

                <h2 className="text-xl font-bold text-deep-navy dark:text-white font-outfit mb-1">
                  {forgotPinStep === 'new-pin' ? 'Enter New 4-Digit PIN' : 'Confirm New PIN'}
                </h2>
                <p className="text-xs text-slate-gray dark:text-slate-400 font-medium mb-4">
                  {forgotPinStep === 'new-pin' ? 'Choose a secure 4-digit PIN for your store' : 'Re-enter your new PIN to confirm'}
                </p>

                {/* PIN Dots */}
                <div className="flex gap-4 justify-center my-4">
                  {[0, 1, 2, 3].map((idx) => {
                    const activeLen = forgotPinStep === 'new-pin' ? newPin.length : confirmNewPin.length;
                    return (
                      <div
                        key={idx}
                        className={`w-3.5 h-3.5 rounded-full border transition-all duration-300 ${
                          idx < activeLen
                            ? 'bg-orange border-orange scale-110 shadow-md shadow-orange/45'
                            : 'border-[#d7cab8] dark:border-slate-700 bg-white/70 dark:bg-slate-800/70'
                        }`}
                      />
                    );
                  })}
                </div>

                {/* Keypad for modal */}
                <div className="grid grid-cols-3 gap-3 w-full max-w-[240px] mx-auto my-4">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleForgotPinKeyPress(num)}
                      disabled={resetLoading}
                      className="w-13 h-13 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-lg text-slate-800 dark:text-slate-200 hover:bg-orange hover:text-white dark:hover:bg-orange transition-all cursor-pointer active:scale-95 mx-auto"
                    >
                      {num}
                    </button>
                  ))}
                  <div className="w-13 h-13" />
                  <button
                    type="button"
                    onClick={() => handleForgotPinKeyPress(0)}
                    disabled={resetLoading}
                    className="w-13 h-13 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-lg text-slate-800 dark:text-slate-200 hover:bg-orange hover:text-white dark:hover:bg-orange transition-all cursor-pointer active:scale-95 mx-auto"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handleForgotPinBackspace}
                    disabled={resetLoading}
                    className="w-13 h-13 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-800 dark:text-slate-200 hover:bg-orange hover:text-white transition-all cursor-pointer active:scale-95 mx-auto"
                  >
                    <HiOutlineBackspace size={22} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setForgotPinStep('new-pin');
                    setNewPin('');
                    setConfirmNewPin('');
                  }}
                  className="text-xs font-semibold text-slate-gray hover:text-orange underline bg-transparent border-none cursor-pointer mt-2"
                >
                  Start Over
                </button>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
};

export default SecurityLockScreen;
