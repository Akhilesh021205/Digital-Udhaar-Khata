import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  Shield, 
  Fingerprint, 
  Scan, 
  Lock, 
  Check, 
  Camera, 
  AlertTriangle, 
  RefreshCw, 
  User, 
  Smartphone, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  X, 
  ChevronRight,
  ShieldCheck,
  Play,
  RotateCcw,
  Maximize2
} from 'lucide-react';
import { toast } from 'react-toastify';
import Logo from '../components/Common/Logo';

// Keyframe injections for demo page
const demoStyles = `
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
  @keyframes spinSlow {
    to { transform: rotate(360deg); }
  }
  @keyframes pulseSoft {
    0%, 100% { opacity: 0.4; transform: scale(1); }
    50% { opacity: 0.8; transform: scale(1.04); }
  }
  .animate-scan-line {
    animation: scanLine 2.5s ease-in-out infinite;
  }
  .animate-ripple {
    animation: ripple 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  }
  .animate-spin-slow {
    animation: spinSlow 8s linear infinite;
  }
  .animate-pulse-soft {
    animation: pulseSoft 2.5s ease-in-out infinite;
  }
  @keyframes scaleUp {
    0% { transform: scale(0.85); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }
  .animate-scale-up {
    animation: scaleUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }
`;

const BiometricDemoPage = () => {
  const [currentScreen, setCurrentScreen] = useState(1); // 1 to 8
  const [simPath, setSimPath] = useState(null); // 'success' | 'no-face' | 'unrecognized'
  const [simActive, setSimActive] = useState(false);
  const [progressVal, setProgressVal] = useState(0);
  const [cameraStream, setCameraStream] = useState(null);
  
  const videoRef = useRef(null);
  const timerRef = useRef(null);

  // Stop camera when leaving or switching screens
  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [cameraStream]);

  // Request camera for screens 3 and 4
  const startCamera = async () => {
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      setCameraStream(stream);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      console.warn("Camera permission denied, showing mock visual placeholder", err);
    }
  };

  // Keep camera sync when currentScreen changes
  useEffect(() => {
    if (currentScreen === 3 || currentScreen === 4) {
      startCamera();
    } else {
      stopCamera();
    }
  }, [currentScreen]);

  // Handle flow simulation paths
  const runFlow = (path) => {
    if (simActive) return;
    setSimPath(path);
    setSimActive(true);
    setCurrentScreen(1);
    setProgressVal(0);
    
    if (timerRef.current) clearTimeout(timerRef.current);

    // Screen 1: Options -> Screen 2: Ready to Scan (after 1.5s)
    timerRef.current = setTimeout(() => {
      setCurrentScreen(2);
      
      // Screen 2: Ready -> Screen 3: Face Detection (after 2s)
      timerRef.current = setTimeout(() => {
        setCurrentScreen(3);
        
        // Screen 3: Detection -> Screen 4 or 5
        timerRef.current = setTimeout(() => {
          if (path === 'no-face') {
            setCurrentScreen(5); // No face detected (Failure Screen 5)
            setSimActive(false);
          } else {
            setCurrentScreen(4); // Verify Identity (Screen 4)
            
            // Progress Bar simulation for Screen 4
            let val = 0;
            const interval = setInterval(() => {
              val += 10;
              setProgressVal(val);
              if (val >= 100) {
                clearInterval(interval);
                
                // Screen 4 -> Screen 6 or 8
                timerRef.current = setTimeout(() => {
                  if (path === 'unrecognized') {
                    setCurrentScreen(8); // Face not recognized (Screen 8)
                    setSimActive(false);
                  } else {
                    setCurrentScreen(6); // Face Detected (Screen 6)
                    
                    // Screen 6 -> Screen 7 (Success Screen 7)
                    timerRef.current = setTimeout(() => {
                      setCurrentScreen(7);
                      setSimActive(false);
                    }, 2000);
                  }
                }, 1000);
              }
            }, 250);
          }
        }, 2200);
      }, 2000);
    }, 1500);
  };

  const resetFlow = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setSimActive(false);
    setSimPath(null);
    setCurrentScreen(1);
    setProgressVal(0);
    stopCamera();
  };

  const selectScreenManually = (screenNum) => {
    resetFlow();
    setCurrentScreen(screenNum);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 lg:p-8 font-sans">
      <style>{demoStyles}</style>

      {/* Header Bar */}
      <div className="w-full max-w-6xl flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center p-1.5 shadow-sm border border-slate-200">
            <Logo />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 font-outfit">Digital Udhaar Khata</h1>
            <p className="text-xs text-slate-500 font-medium">Biometric Flow Simulator</p>
          </div>
        </div>
        <Link 
          to="/settings" 
          className="text-xs font-bold text-[#DC2626] hover:underline bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-xs"
        >
          Back to Settings
        </Link>
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: SIMULATOR PANEL */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-2">Simulate Authentication</h2>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Experience the 8 screens through automated authentication paths designed for banking-grade security.
            </p>
            <div className="space-y-2.5">
              <button
                onClick={() => runFlow('success')}
                disabled={simActive}
                className="w-full py-3 px-4 bg-green-50 hover:bg-green-100/80 text-green-700 font-semibold text-xs rounded-2xl flex items-center justify-between border border-green-200/50 cursor-pointer disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <Play className="w-3.5 h-3.5" />
                  <span>Success Path (Screens 1→2→3→4→6→7)</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => runFlow('no-face')}
                disabled={simActive}
                className="w-full py-3 px-4 bg-yellow-50 hover:bg-yellow-100/80 text-yellow-700 font-semibold text-xs rounded-2xl flex items-center justify-between border border-yellow-200/50 cursor-pointer disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <Play className="w-3.5 h-3.5" />
                  <span>No Face Path (Screens 1→2→3→5)</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => runFlow('unrecognized')}
                disabled={simActive}
                className="w-full py-3 px-4 bg-red-50 hover:bg-red-100/80 text-[#DC2626] font-semibold text-xs rounded-2xl flex items-center justify-between border border-red-200/50 cursor-pointer disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <Play className="w-3.5 h-3.5" />
                  <span>Unrecognized Path (Screens 1→2→3→4→8)</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            
            {simActive && (
              <button
                onClick={resetFlow}
                className="w-full mt-3 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Simulation</span>
              </button>
            )}
          </div>

          <div className="border-t border-slate-100 pt-6">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3">Storyboard Navigation</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { n: 1, label: '1. Auth Options' },
                { n: 2, label: '2. Ready to Scan' },
                { n: 3, label: '3. Face Detection' },
                { n: 4, label: '4. Identity Verification' },
                { n: 5, label: '5. No Face Detected' },
                { n: 6, label: '6. Face Detected' },
                { n: 7, label: '7. Face Verified' },
                { n: 8, label: '8. Not Recognized' },
              ].map((scr) => (
                <button
                  key={scr.n}
                  onClick={() => selectScreenManually(scr.n)}
                  className={`py-2 px-3 text-left text-xs rounded-xl border font-semibold transition-all cursor-pointer ${
                    currentScreen === scr.n
                      ? 'bg-[#DC2626] border-[#DC2626] text-white shadow-sm'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {scr.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* MIDDLE COLUMN: MOBILE DEVICE PHONE MOCKUP */}
        <div className="lg:col-span-5 flex justify-center">
          {/* Phone Shell */}
          <div className="relative w-80 h-[560px] bg-slate-900 rounded-[38px] p-3.5 shadow-2xl border-4 border-slate-800 flex flex-col overflow-hidden shrink-0 animate-scale-up">
            
            {/* Phone Notch/Ear Speaker */}
            <div className="absolute top-0.5 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-900 rounded-b-2xl z-[100] flex items-center justify-center">
              <div className="w-12 h-1 bg-slate-800 rounded-full mb-1" />
            </div>
            
            {/* Screen Inner Wrapper */}
            <div className="w-full h-full bg-white rounded-[28px] overflow-hidden relative flex flex-col select-none">
              
              {/* StatusBar Mock */}
              <div className="w-full h-7 bg-white shrink-0 px-5 pt-1.5 flex justify-between items-center text-[10px] text-slate-700 font-bold z-50">
                <span>9:41</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px]">5G</span>
                  <div className="w-4 h-2 border border-slate-700 rounded-xs p-[1px] flex items-center">
                    <div className="w-2.5 h-full bg-slate-700 rounded-2xs" />
                  </div>
                </div>
              </div>

              {/* RENDER ACTIVE SCREEN */}
              <div className="flex-1 flex flex-col p-6 text-center justify-between relative overflow-hidden bg-white">
                
                {/* -------------------- SCREEN 1: AUTHENTICATION OPTIONS -------------------- */}
                {currentScreen === 1 && (
                  <>
                    {/* Top logo & Shield */}
                    <div className="mt-4 flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-[#DC2626] mb-3 border border-red-100/50">
                        <Shield className="w-5 h-5" />
                      </div>
                      <div className="w-10 h-10 p-1.5 bg-slate-50 border border-slate-100 rounded-xl mb-3">
                        <Logo />
                      </div>
                      <h3 className="text-base font-extrabold text-slate-850 font-outfit">Unlock Your Account</h3>
                      <p className="text-[11px] text-slate-500 mt-1">Choose a secure way to continue</p>
                    </div>

                    {/* Method buttons */}
                    <div className="w-full space-y-2.5 my-auto">
                      <button
                        onClick={() => selectScreenManually(2)}
                        className="w-full py-3.5 px-4 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-semibold text-xs rounded-2xl flex items-center justify-between transition-all duration-250 shadow-md shadow-red-600/10 cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5">
                          <Scan className="w-4.5 h-4.5 text-white group-hover:scale-105 transition-transform" />
                          <span>Continue with Face ID</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                      </button>

                      <button
                        onClick={() => toast.info("Simulating Fingerprint Auth setup")}
                        className="w-full py-3.5 px-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs rounded-2xl flex items-center justify-between transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5">
                          <Fingerprint className="w-4.5 h-4.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                          <span>Use Fingerprint</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                      </button>

                      <button
                        onClick={() => toast.info("Fallback PIN entry screen active")}
                        className="w-full py-3.5 px-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs rounded-2xl flex items-center justify-between transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5">
                          <Lock className="w-4.5 h-4.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                          <span>Enter PIN</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                      </button>
                    </div>

                    {/* Bottom Security Notice */}
                    <div className="flex items-center justify-center gap-1.5 text-slate-400">
                      <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[9px] font-semibold tracking-wide">Your data is encrypted and protected</span>
                    </div>
                  </>
                )}

                {/* -------------------- SCREEN 2: READY TO SCAN -------------------- */}
                {currentScreen === 2 && (
                  <>
                    <div className="mt-2 text-left">
                      <h3 className="text-base font-extrabold text-slate-950 font-outfit">Ready to Scan</h3>
                      <p className="text-[10px] text-slate-500 mt-1">Please position your face in the camera circle.</p>
                    </div>

                    {/* Large circular scan guide */}
                    <div className="my-auto flex flex-col items-center">
                      <div className="relative w-40 h-40 rounded-full border-4 border-dashed border-slate-200 flex items-center justify-center bg-slate-50/50 shadow-inner">
                        <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center text-[#DC2626]">
                          <Scan className="w-10 h-10 animate-pulse-soft" />
                        </div>
                      </div>
                      <p className="text-[11px] font-semibold text-slate-700 mt-6 max-w-[200px] leading-relaxed">
                        Position your face in the circle and look at the camera
                      </p>
                    </div>

                    {/* Cancel action */}
                    <button
                      onClick={() => selectScreenManually(1)}
                      className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl cursor-pointer"
                    >
                      Cancel
                    </button>
                  </>
                )}

                {/* -------------------- SCREEN 3: FACE DETECTION -------------------- */}
                {currentScreen === 3 && (
                  <>
                    <div className="mt-2 text-left">
                      <h3 className="text-base font-extrabold text-slate-950 font-outfit">Face Detection</h3>
                      <p className="text-[10px] text-slate-500 mt-1">Detecting active user presence...</p>
                    </div>

                    {/* Scanner with Camera feed */}
                    <div className="my-auto flex flex-col items-center">
                      <div className="relative w-44 h-44 rounded-full overflow-hidden border-4 border-[#DC2626] bg-slate-950 flex items-center justify-center shadow-lg">
                        {cameraStream ? (
                          <video 
                            ref={videoRef} 
                            autoPlay 
                            playsInline 
                            muted 
                            className="w-full h-full object-cover scale-x-[-1]"
                          />
                        ) : (
                          <div className="text-white/20 animate-pulse-soft flex flex-col items-center gap-2">
                            <Camera className="w-8 h-8" />
                            <span className="text-[9px]">Camera active</span>
                          </div>
                        )}
                        {/* Red scanning scanning line */}
                        <div className="absolute left-0 right-0 h-0.5 bg-[#DC2626] shadow-md shadow-red-600/80 animate-scan-line" />
                      </div>
                      
                      <div className="flex items-center gap-1.5 mt-5">
                        <div className="w-2 h-2 rounded-full bg-[#DC2626] animate-ping" />
                        <span className="text-[11px] font-bold text-slate-800 tracking-wide uppercase">Detecting face...</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">Please keep your face within the frame</p>
                    </div>

                    {/* Cancel Action */}
                    <button
                      onClick={() => selectScreenManually(1)}
                      className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl cursor-pointer"
                    >
                      Cancel
                    </button>
                  </>
                )}

                {/* -------------------- SCREEN 4: IDENTITY VERIFICATION -------------------- */}
                {currentScreen === 4 && (
                  <>
                    <div className="mt-2 text-left">
                      <h3 className="text-base font-extrabold text-slate-950 font-outfit">Verifying Identity...</h3>
                      <p className="text-[10px] text-slate-500 mt-1">Matching secure templates...</p>
                    </div>

                    {/* Camera with progress ring */}
                    <div className="my-auto flex flex-col items-center">
                      <div className="relative w-44 h-44 rounded-full overflow-hidden border-4 border-slate-100 bg-slate-950 flex items-center justify-center shadow-lg">
                        {cameraStream ? (
                          <video 
                            ref={videoRef} 
                            autoPlay 
                            playsInline 
                            muted 
                            className="w-full h-full object-cover scale-x-[-1]"
                          />
                        ) : (
                          <div className="text-white/20 animate-pulse-soft flex flex-col items-center">
                            <Camera className="w-8 h-8" />
                          </div>
                        )}

                        {/* Progress ring svg overlay */}
                        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                          <circle
                            cx="50"
                            cy="50"
                            r="46"
                            fill="none"
                            stroke="#DC2626"
                            strokeWidth="4"
                            strokeDasharray={2 * Math.PI * 46}
                            strokeDashoffset={2 * Math.PI * 46 * (1 - progressVal / 100)}
                            className="transition-all duration-200"
                          />
                        </svg>
                      </div>

                      {/* Matching details */}
                      <div className="w-full max-w-[200px] mt-6">
                        <div className="flex justify-between text-[9px] font-bold text-slate-500 mb-1">
                          <span>TEMPLATES MATCHING</span>
                          <span>{progressVal}%</span>
                        </div>
                        <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-[#DC2626] transition-all duration-200" 
                            style={{ width: `${progressVal}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-slate-500 mt-2">This will only take a few seconds</p>
                      </div>
                    </div>

                    {/* Cancel Action */}
                    <button
                      onClick={() => selectScreenManually(1)}
                      className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl cursor-pointer"
                    >
                      Cancel
                    </button>
                  </>
                )}

                {/* -------------------- SCREEN 5: NO FACE DETECTED -------------------- */}
                {currentScreen === 5 && (
                  <>
                    <div className="mt-2 text-left">
                      <h3 className="text-base font-extrabold text-slate-950 font-outfit">No Face Detected</h3>
                      <p className="text-[10px] text-slate-500 mt-1">We couldn't locate your face profile.</p>
                    </div>

                    {/* User Silhouette Graphic */}
                    <div className="my-auto flex flex-col items-center">
                      <div className="relative w-40 h-40 rounded-full bg-slate-50 border-2 border-dashed border-slate-250 flex items-center justify-center text-slate-400">
                        <User className="w-16 h-16 opacity-30" />
                        
                        {/* Top-Right warning badge */}
                        <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-yellow-50 flex items-center justify-center text-yellow-600 border border-yellow-200 shadow-sm animate-bounce">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                      </div>
                      
                      <p className="text-[11px] font-semibold text-slate-700 mt-6 max-w-[200px] leading-relaxed">
                        Please position your face in the circle and try again
                      </p>
                    </div>

                    {/* Actions panel */}
                    <div className="w-full space-y-2">
                      <button
                        onClick={() => selectScreenManually(3)}
                        className="w-full py-3 px-4 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-semibold text-xs rounded-2xl cursor-pointer shadow-sm transition-all"
                      >
                        Retry Scan
                      </button>
                      <button
                        onClick={() => selectScreenManually(1)}
                        className="w-full py-2.5 bg-transparent border border-slate-200 text-slate-600 font-semibold text-xs rounded-2xl cursor-pointer hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}

                {/* -------------------- SCREEN 6: FACE DETECTED -------------------- */}
                {currentScreen === 6 && (
                  <>
                    <div className="mt-2 text-left">
                      <h3 className="text-base font-extrabold text-slate-950 font-outfit">Face Detected</h3>
                      <p className="text-[10px] text-slate-500 mt-1">Analysing facial features...</p>
                    </div>

                    {/* Large checkmark graphic */}
                    <div className="my-auto flex flex-col items-center">
                      <div className="w-24 h-24 rounded-full bg-green-50 flex items-center justify-center text-green-500 border border-green-200 shadow-inner mb-6">
                        <Check className="w-12 h-12" />
                      </div>
                      
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Looking Good!</h4>
                      <p className="text-[10px] text-slate-500 mt-1">Verifying your identity</p>
                      
                      {/* Loading animation bar */}
                      <div className="flex gap-1.5 justify-center mt-6">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: '0s' }} />
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: '0.15s' }} />
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: '0.3s' }} />
                      </div>
                    </div>

                    {/* Spacer placeholder to keep alignment */}
                    <div className="h-12" />
                  </>
                )}

                {/* -------------------- SCREEN 7: FACE VERIFIED -------------------- */}
                {currentScreen === 7 && (
                  <>
                    <div className="mt-2 text-left">
                      <h3 className="text-base font-extrabold text-slate-950 font-outfit">Face Verified</h3>
                      <p className="text-[10px] text-slate-500 mt-1">Welcome Back!</p>
                    </div>

                    {/* Verified graphics */}
                    <div className="my-auto flex flex-col items-center">
                      {/* Success banner */}
                      <div className="bg-green-50 border border-green-200 text-green-700 font-bold text-[11px] uppercase tracking-widest px-4 py-1.5 rounded-full mb-6 animate-pulse">
                        Login Successful
                      </div>

                      <div className="relative w-28 h-28 rounded-full bg-green-100 flex items-center justify-center text-green-600 shadow-md">
                        <CheckCircle2 className="w-16 h-16" />
                      </div>
                    </div>

                    {/* Action continue */}
                    <button
                      onClick={() => {
                        toast.success("Identity verified! Logging in...");
                        selectScreenManually(1);
                      }}
                      className="w-full py-3.5 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-2xl cursor-pointer shadow-md transition-all active:scale-[0.98]"
                    >
                      Continue
                    </button>
                  </>
                )}

                {/* -------------------- SCREEN 8: FACE NOT RECOGNIZED -------------------- */}
                {currentScreen === 8 && (
                  <>
                    <div className="mt-2 text-left">
                      <h3 className="text-base font-extrabold text-slate-950 font-outfit">Face Not Recognized</h3>
                      <p className="text-[10px] text-slate-500 mt-1">Matching match request failed.</p>
                    </div>

                    {/* Error graphics */}
                    <div className="my-auto flex flex-col items-center">
                      <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center text-[#DC2626] border border-red-200 shadow-inner mb-5">
                        <XCircle className="w-10 h-10" />
                      </div>

                      {/* Security Warning Card */}
                      <div className="bg-red-50/50 border border-red-100 rounded-2xl p-4 text-left max-w-[240px]">
                        <div className="flex gap-2 items-start text-[#DC2626]">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider">Security Warning</h4>
                            <p className="text-[9px] text-slate-600 leading-relaxed">
                              We couldn't match your face with our records. Multiple failed attempts may lock your account.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Fallbacks */}
                    <div className="w-full space-y-2">
                      <button
                        onClick={() => selectScreenManually(3)}
                        className="w-full py-3 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-xs rounded-2xl cursor-pointer shadow-sm transition-all"
                      >
                        Try Again
                      </button>
                      <button
                        onClick={() => selectScreenManually(1)}
                        className="w-full py-2.5 bg-transparent border border-slate-200 text-slate-700 font-bold text-xs rounded-2xl cursor-pointer hover:bg-slate-50"
                      >
                        Use PIN Instead
                      </button>
                    </div>
                  </>
                )}

              </div>

              {/* Bottom Home Indicator Mock */}
              <div className="w-full h-5 bg-white shrink-0 flex items-center justify-center pb-1">
                <div className="w-24 h-1 bg-slate-800 rounded-full" />
              </div>

            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: SCREEN DESCRIPTION & DOCUMENTATION */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-2">Screen Highlights</h2>
          
          <div className="space-y-3.5">
            {[
              { n: 1, name: '1. Options', desc: 'Secure entry point asking for PIN or biometrics.' },
              { n: 2, name: '2. Ready', desc: 'Onboarding user setup to align camera perspective.' },
              { n: 3, name: '3. Detection', desc: 'Validates live face presence inside scanner lines.' },
              { n: 4, name: '4. Verification', desc: 'Secure template extraction matching algorithm.' },
              { n: 5, name: '5. No Face', desc: 'Instruction helper shown when silhouette is empty.' },
              { n: 6, name: '6. Face Detected', desc: 'Intermediate success feedback during templates matching.' },
              { n: 7, name: '7. Verified', desc: 'Login complete state displaying Welcome Back banner.' },
              { n: 8, name: '8. Not Recognized', desc: 'Fail-secure state enforcing PIN verification fallback.' },
            ].map((d) => (
              <div 
                key={d.n}
                onClick={() => selectScreenManually(d.n)}
                className={`p-3 rounded-2xl border transition-all cursor-pointer text-left ${
                  currentScreen === d.n 
                    ? 'border-[#DC2626] bg-red-50/20' 
                    : 'border-slate-100 hover:border-slate-250 bg-slate-50/40'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${currentScreen === d.n ? 'text-[#DC2626]' : 'text-slate-400'}`}>
                    {d.name}
                  </span>
                  {currentScreen === d.n && <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626]" />}
                </div>
                <p className="text-[10px] text-slate-600 leading-normal">{d.desc}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default BiometricDemoPage;
