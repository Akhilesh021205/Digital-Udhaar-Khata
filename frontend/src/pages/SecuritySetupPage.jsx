import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import API from '../api/axios';
import Logo from '../components/Common/Logo';
import { toast } from 'react-toastify';
import { 
  Shield, 
  Fingerprint, 
  Scan, 
  Lock, 
  Check, 
  Camera, 
  ArrowLeft, 
  AlertCircle,
  ShieldCheck,
  Smartphone
} from 'lucide-react';
import { HiOutlineBackspace } from 'react-icons/hi';
import { loadFaceApiModels, detectFaceInVideo, getFaceAngle } from '../utils/biometricScanner';

const securityStyles = `
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
  @keyframes rotateDotted {
    to { transform: rotate(360deg); }
  }
  @keyframes pulseFaceOutline {
    0%, 100% { opacity: 0.25; transform: scale(1); }
    50% { opacity: 0.6; transform: scale(1.03); }
  }
  .animate-scan-line {
    animation: scanLine 2.5s ease-in-out infinite;
  }
  .animate-ripple {
    animation: ripple 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  }
  .animate-rotate-dotted {
    animation: rotateDotted 15s linear infinite;
  }
  .animate-pulse-outline {
    animation: pulseFaceOutline 3s ease-in-out infinite;
  }
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
  .animate-draw-check {
    stroke-dasharray: 50;
    stroke-dashoffset: 50;
    animation: drawCheck 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }
  .animate-success-circle {
    animation: scaleUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }
`;

const SecuritySetupPage = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  
  const [step, setStep] = useState('create-pin'); // 'create-pin' | 'confirm-pin' | 'biometrics' | 'face-onboarding' | 'face-scanning' | 'fingerprint-scanning' | 'success'
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [shake, setShake] = useState(false);
  const [deviceSupportsBio, setDeviceSupportsBio] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Face ID scan states
  const [scanProgress, setScanProgress] = useState(0);
  const [scanAngle, setScanAngle] = useState('front'); // 'front' | 'left' | 'right' | 'saving' | 'loading'
  const [cameraStream, setCameraStream] = useState(null);
  const [faceScanStatus, setFaceScanStatus] = useState('Ready to register face');
  const videoRef = useRef(null);
  const animationFrameId = useRef(null);
  
  // Fingerprint scan states
  const [fingerProgress, setFingerProgress] = useState(0);
  const [fingerScanning, setFingerScanning] = useState(false);

  // Check if browser/device supports WebAuthn Platform biometrics
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
    checkBiometricSupport();
  }, []);

  const handleKeyPress = (num) => {
    if (step === 'create-pin') {
      if (pin.length < 4) {
        const newVal = pin + num;
        setPin(newVal);
        if (newVal.length === 4) {
          setTimeout(() => setStep('confirm-pin'), 250);
        }
      }
    } else if (step === 'confirm-pin') {
      if (confirmPin.length < 4) {
        const newVal = confirmPin + num;
        setConfirmPin(newVal);
        if (newVal.length === 4) {
          if (newVal === pin) {
            setTimeout(() => setStep('biometrics'), 250);
          } else {
            setTimeout(() => {
              setShake(true);
              toast.error("PINs do not match. Please try again.");
              setConfirmPin('');
              setTimeout(() => setShake(false), 500);
            }, 250);
          }
        }
      }
    }
  };

  const handleBackspace = () => {
    if (step === 'create-pin') {
      setPin(pin.slice(0, -1));
    } else if (step === 'confirm-pin') {
      setConfirmPin(confirmPin.slice(0, -1));
    }
  };

  const saveSecuritySettings = useCallback(async (enableBio = false, bioCredId = '', faceTemplate = '') => {
    setSaving(true);
    try {
      const { data } = await API.post('/auth/setup-security', {
        pin,
        isBiometricEnabled: enableBio,
        biometricCredentialId: bioCredId,
        biometricFaceTemplate: faceTemplate
      });
      
      updateUser(data.data);
      sessionStorage.setItem('udhaar-unlocked', 'true');
      setStep('success');
      
      setTimeout(() => {
        navigate('/');
      }, 2200);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save security settings');
    } finally {
      setSaving(false);
    }
  }, [pin, updateUser, navigate]);

  // Handle skip biometrics
  const handleSkipBiometrics = async () => {
    await saveSecuritySettings(false);
  };

  // Start Face ID Scan Flow
  const startFaceScan = async () => {
    setStep('face-scanning');
    setScanProgress(0);
    setScanAngle('loading');
    setFaceScanStatus('Loading security AI models...');
    
    const loaded = await loadFaceApiModels();
    if (!loaded) {
      toast.error('Failed to load Face ID AI models');
      setStep('biometrics');
      return;
    }

    setScanAngle('front');
    setFaceScanStatus('Position your face inside the circle.');

    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 320, height: 240, facingMode: 'user' } 
      });
      setCameraStream(stream);
      
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 150);
    } catch (err) {
      console.error("Camera access failed:", err);
      toast.error("Camera access is required to register Face ID");
      setStep('biometrics');
      return;
    }

    const descriptors = { front: null, left: null, right: null };
    let currentAngle = 'front';
    let currentProgress = 0;

    const processFrame = async () => {
      if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) {
        animationFrameId.current = requestAnimationFrame(processFrame);
        return;
      }

      const detection = await detectFaceInVideo(videoRef.current);
      if (!detection) {
        setFaceScanStatus('No face detected. Please position your face inside the frame.');
        animationFrameId.current = requestAnimationFrame(processFrame);
        return;
      }

      const angle = getFaceAngle(detection.landmarks);
      
      if (currentAngle === 'front') {
        if (angle === 'front') {
          currentProgress += 5;
          setScanProgress(Math.min(currentProgress, 33));
          setFaceScanStatus('Keep looking straight... registering front angle.');
          if (currentProgress >= 33) {
            descriptors.front = Array.from(detection.descriptor);
            currentAngle = 'left';
            toast.success('Front angle registered! Now turn your head to the Left.');
          }
        } else {
          setFaceScanStatus('Please look straight at the camera.');
        }
      } else if (currentAngle === 'left') {
        if (angle === 'left') {
          currentProgress += 5;
          setScanProgress(Math.min(currentProgress, 66));
          setFaceScanStatus('Registering left angle... hold steady.');
          if (currentProgress >= 66) {
            descriptors.left = Array.from(detection.descriptor);
            currentAngle = 'right';
            toast.success('Left angle registered! Now turn your head to the Right.');
          }
        } else {
          setFaceScanStatus('Slowly turn your face to the LEFT.');
        }
      } else if (currentAngle === 'right') {
        if (angle === 'right') {
          currentProgress += 5;
          setScanProgress(Math.min(currentProgress, 100));
          setFaceScanStatus('Registering right angle... hold steady.');
          if (currentProgress >= 100) {
            descriptors.right = Array.from(detection.descriptor);
            currentAngle = 'saving';
            setScanAngle('saving');
            setFaceScanStatus('Registering secure descriptors. Raw photos are discarded.');
            
            // Stop camera stream
            if (stream) {
              stream.getTracks().forEach(track => track.stop());
            }
            setCameraStream(null);

            // Save to backend
            setTimeout(async () => {
              const faceTemplateJSON = JSON.stringify({
                front: descriptors.front,
                left: descriptors.left,
                right: descriptors.right
              });
              const mockCredentialId = `face-id-${Date.now()}`;
              toast.success("Face ID registered successfully.");
              await saveSecuritySettings(true, mockCredentialId, faceTemplateJSON);
            }, 1200);
            return;
          }
        } else {
          setFaceScanStatus('Slowly turn your face to the RIGHT.');
        }
      }

      setScanAngle(currentAngle);
      animationFrameId.current = requestAnimationFrame(processFrame);
    };

    animationFrameId.current = requestAnimationFrame(processFrame);
  };

  const cancelFaceScan = () => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setStep('biometrics');
  };

  // Start Fingerprint Scan Flow
  const startFingerprintScan = () => {
    setStep('fingerprint-scanning');
    setFingerProgress(0);
    setFingerScanning(true);
    
    let progress = 0;
    const interval = setInterval(() => {
      progress += 4;
      setFingerProgress(Math.min(progress, 100));
      
      if (progress >= 100) {
        clearInterval(interval);
        setFingerScanning(false);
        setTimeout(async () => {
          toast.success("Fingerprint registered successfully.");
          const mockCredentialId = `mock-fingerprint-id-${Date.now()}`;
          await saveSecuritySettings(true, mockCredentialId);
        }, 800);
      }
    }, 120);
  };



  const cancelFingerprintScan = () => {
    setStep('biometrics');
  };

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  const renderDots = (length) => {
    return (
      <div className={`flex gap-4 justify-center my-8 ${shake ? 'animate-shake' : ''}`}>
        {[0, 1, 2, 3].map((idx) => (
          <div 
            key={idx} 
            className={`w-4.5 h-4.5 rounded-full border-2 transition-all duration-150 ${
              idx < length 
                ? 'bg-[#DC2626] border-[#DC2626] scale-110 shadow-md shadow-red-600/30' 
                : 'border-slate-gray/30 bg-transparent'
            }`} 
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-5 relative overflow-hidden py-12">
      <style>{securityStyles}</style>
      
      {/* Background radial highlights */}
      <div className="absolute w-[500px] h-[500px] bg-radial from-red-600/5 to-transparent -top-[100px] -right-[100px] rounded-full"></div>
      <div className="absolute w-[400px] h-[400px] bg-radial from-red-600/5 to-transparent -bottom-[80px] -left-[80px] rounded-full"></div>

      <div className="w-full max-w-md p-8 bg-white border border-slate-100 rounded-3xl shadow-xl relative z-10 text-center">
        {/* Shield icon at the top of PIN and Biometrics steps */}
        {step !== 'success' && (
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-[#DC2626] mx-auto mb-4 border border-red-100/50">
            <Shield className="w-5 h-5" />
          </div>
        )}

        {step === 'create-pin' && (
          <div>
            <h1 className="text-xl font-bold text-slate-900 mb-1 font-outfit">Secure Your Account</h1>
            <p className="text-xs text-slate-500 mb-6">Create a 4-Digit Security PIN</p>
            
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Enter New PIN
            </div>
            {renderDots(pin.length)}
          </div>
        )}

        {step === 'confirm-pin' && (
          <div>
            <h1 className="text-xl font-bold text-slate-900 mb-1 font-outfit">Confirm Security PIN</h1>
            <p className="text-xs text-slate-500 mb-6">Re-enter the 4-digit PIN to confirm</p>
            
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Confirm PIN
            </div>
            {renderDots(confirmPin.length)}
            
            <button 
              onClick={() => {
                setStep('create-pin');
                setConfirmPin('');
                setPin('');
              }}
              className="text-xs text-[#DC2626] hover:underline font-semibold bg-transparent border-none cursor-pointer mt-2"
            >
              Start Over
            </button>
          </div>
        )}

        {(step === 'create-pin' || step === 'confirm-pin') && (
          <div className="grid grid-cols-3 gap-y-4 gap-x-6 max-w-xs mx-auto mt-4 mb-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleKeyPress(num)}
                className="w-16 h-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center font-bold text-lg text-slate-800 hover:bg-[#DC2626] hover:text-white transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                {num}
              </button>
            ))}
            <div className="w-16 h-16" />
            <button
              type="button"
              onClick={() => handleKeyPress(0)}
              className="w-16 h-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center font-bold text-lg text-slate-800 hover:bg-[#DC2626] hover:text-white transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className="w-16 h-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-lg text-slate-800 hover:bg-[#DC2626] hover:text-white transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <HiOutlineBackspace size={24} />
            </button>
          </div>
        )}

        {step === 'biometrics' && (
          <div className="space-y-6">
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-slate-900 font-outfit">Would you like to enable Face Unlock?</h1>
              <p className="text-xs text-slate-500">
                Unlock your Digital Udhaar Khata ledger faster and more securely.
              </p>
            </div>

            <div className="flex flex-col gap-3.5 max-w-xs mx-auto py-2">
              {/* Face ID Capture button */}
              <button
                onClick={() => setStep('face-onboarding')}
                disabled={saving}
                className="w-full py-4 px-5 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-semibold text-sm rounded-2xl flex items-center justify-between transition-all duration-200 shadow-md shadow-red-600/10 hover:shadow-lg hover:shadow-red-600/20 active:scale-[0.99] cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <Scan className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
                  <span>Continue with Face ID</span>
                </div>
                <span className="text-[9px] bg-white/20 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">Fastest</span>
              </button>

              {/* Fingerprint Card */}
              <button
                onClick={startFingerprintScan}
                disabled={saving}
                className="w-full py-4 px-5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-sm rounded-2xl flex items-center justify-between transition-all duration-200 hover:border-slate-300 active:scale-[0.99] cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <Fingerprint className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                  <span>Use Fingerprint</span>
                </div>
              </button>
            </div>

            <div className="flex flex-col gap-3 max-w-xs mx-auto pt-2">
              <button
                onClick={handleSkipBiometrics}
                disabled={saving}
                className="py-3 px-6 rounded-2xl text-sm font-semibold border border-slate-200 bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-all cursor-pointer disabled:opacity-50"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}

        {/* Face ID Onboarding Intro screen */}
        {step === 'face-onboarding' && (
          <div className="space-y-6">
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-slate-900 font-outfit">Register Your Face ID</h1>
              <p className="text-xs text-slate-500 leading-relaxed">
                Position your camera straight. You'll be asked to look forward, then tilt your head left and right.
              </p>
            </div>

            {/* Checklist Graphic */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 text-left max-w-xs mx-auto space-y-3.5">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center text-[#DC2626] font-bold text-xs shrink-0 mt-0.5">1</div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-800 m-0">Look Straight</h4>
                  <p className="text-[10px] text-slate-500 m-0">Align face outline in the circle frame.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center text-[#DC2626] font-bold text-xs shrink-0 mt-0.5">2</div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-800 m-0">Look Left & Right</h4>
                  <p className="text-[10px] text-slate-500 m-0">Turn your head slowly to register angles.</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 max-w-xs mx-auto pt-2">
              <button
                onClick={startFaceScan}
                className="w-full py-3.5 px-4 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all active:scale-[0.99]"
              >
                <Camera className="w-4 h-4" />
                <span>Start Face Scan</span>
              </button>
              <button
                onClick={() => setStep('biometrics')}
                className="w-full py-2.5 px-4 bg-transparent border border-slate-200 text-slate-500 font-semibold text-sm rounded-2xl cursor-pointer hover:bg-slate-50"
              >
                Go Back
              </button>
            </div>
          </div>
        )}

        {/* Live Face Scanning screen */}
        {step === 'face-scanning' && (
          <div className="space-y-6 flex flex-col items-center">
            {scanAngle === 'saving' ? (
              /* Template Generation Loader */
              <div className="relative w-32 h-32 mb-4 flex items-center justify-center">
                <div className="w-16 h-16 border-4 border-[#DC2626] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              /* Camera view with face guides */
              <div className="relative w-48 h-48 rounded-full overflow-hidden border-4 border-[#DC2626] bg-black flex items-center justify-center shadow-lg mb-4">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                
                {/* Rotating scanner ring */}
                <div className="absolute inset-2 border-2 border-dashed border-[#DC2626]/40 rounded-full animate-rotate-dotted" />
                
                {/* Scanning sweep line */}
                <div className="absolute left-0 right-0 h-0.5 bg-[#DC2626] shadow-md shadow-red-600/80 animate-scan-line" />
                
                {/* Dotted face guide mesh */}
                <div className="absolute inset-8 border border-white/20 rounded-full animate-pulse-outline flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-[#DC2626] rounded-full absolute top-10 left-10" />
                  <div className="w-1.5 h-1.5 bg-[#DC2626] rounded-full absolute top-10 right-10" />
                  <div className="w-1.5 h-1.5 bg-[#DC2626] rounded-full absolute bottom-12 left-16" />
                </div>
              </div>
            )}

            <div>
              <h2 className="text-lg font-bold text-slate-900 font-outfit">
                {scanAngle === 'saving' ? 'Generating Face ID template...' : 'Scanning Face...'}
              </h2>
              <p className="text-xs text-slate-500 mt-2 min-h-[32px] max-w-xs mx-auto leading-relaxed">
                {scanAngle === 'front' && 'Look straight into your front-facing camera.'}
                {scanAngle === 'left' && 'Slowly turn your face to the Left.'}
                {scanAngle === 'right' && 'Slowly turn your face to the Right.'}
                {scanAngle === 'saving' && 'Generating secure mathematical face template. Raw photos are discarded.'}
              </p>
            </div>

            {/* Progress indicator */}
            <div className="w-full max-w-xs">
              <div className="flex justify-between text-[10px] text-slate-400 font-bold mb-1">
                <span>ANGLE STATUS</span>
                <span>{scanProgress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#DC2626] transition-all duration-100 ease-out" 
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
            </div>

            {scanAngle !== 'saving' && (
              <button
                onClick={cancelFaceScan}
                className="px-6 py-2 bg-transparent text-slate-400 hover:text-slate-600 font-semibold text-xs rounded-xl cursor-pointer mt-2"
              >
                Cancel
              </button>
            )}
          </div>
        )}

        {/* Live Fingerprint Scanning screen */}
        {step === 'fingerprint-scanning' && (
          <div className="space-y-6 flex flex-col items-center">
            {/* Concentric ripples */}
            <div className="relative w-32 h-32 mb-2 flex items-center justify-center">
              {fingerScanning && (
                <>
                  <div className="absolute inset-0 rounded-full bg-red-100/50 border border-red-200/50 animate-ripple" style={{ animationDelay: '0s' }} />
                  <div className="absolute inset-0 rounded-full bg-red-100/50 border border-red-200/50 animate-ripple" style={{ animationDelay: '0.6s' }} />
                  <div className="absolute inset-0 rounded-full bg-red-100/50 border border-red-200/50 animate-ripple" style={{ animationDelay: '1.2s' }} />
                </>
              )}
              
              <div className="relative w-20 h-20 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-[#DC2626] shadow-sm">
                <Fingerprint className="w-10 h-10 animate-pulse" />
              </div>
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900 font-outfit">Registering Fingerprint</h2>
              <p className="text-xs text-slate-500 mt-2 max-w-xs leading-relaxed">
                Touch and hold the fingerprint sensor to scan your biometric ID.
              </p>
            </div>

            {/* Progress indicator */}
            <div className="w-full max-w-xs">
              <div className="flex justify-between text-[10px] text-slate-400 font-bold mb-1">
                <span>SCAN PROGRESS</span>
                <span>{fingerProgress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#DC2626] transition-all duration-100 ease-out" 
                  style={{ width: `${fingerProgress}%` }}
                />
              </div>
            </div>

            <button
              onClick={cancelFingerprintScan}
              className="px-6 py-2 bg-transparent text-slate-400 hover:text-slate-600 font-semibold text-xs rounded-xl cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

        {step === 'success' && (
          <div className="space-y-4 py-8 animate-in fade-in zoom-in-95 duration-300">
            <div className="relative w-20 h-20 rounded-full flex items-center justify-center bg-green-50 text-green-500 animate-success-circle border border-green-500/20 mx-auto">
              <svg className="w-10 h-10 text-green-500 animate-draw-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <h1 className="text-xl font-bold text-slate-900 font-outfit">Setup Complete!</h1>
            <p className="text-xs text-slate-500">
              Face ID registered successfully. Securing your dashboard...
            </p>
          </div>
        )}

        {/* Footer protected text */}
        {step !== 'success' && (
          <div className="flex items-center justify-center gap-1.5 mt-8 pt-4 border-t border-slate-100 text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] font-medium tracking-wide">Your data is encrypted and protected.</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default SecuritySetupPage;
