import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Shield, Fingerprint, Scan, AlertTriangle, LogOut, RefreshCw } from 'lucide-react-native';

interface BiometricScreenProps {
  navigation: any;
}

export const BiometricScreen: React.FC<BiometricScreenProps> = ({ navigation }) => {
  const { authenticateBiometrically, biometryType, logout } = useAuth();
  const [attempts, setAttempts] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const maxAttempts = 3;

  const triggerAuth = useCallback(async () => {
    if (isVerifying) return;
    setIsVerifying(true);
    setErrorMsg(null);

    const success = await authenticateBiometrically();
    
    setIsVerifying(false);

    if (success) {
      // Auth success is handled by AuthContext updating isAuthenticated to true,
      // which automatically triggers navigation in the AppNavigator.
      return;
    }

    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);

    if (nextAttempts >= maxAttempts) {
      Alert.alert(
        'Maximum Attempts Reached',
        'Please log in with your email and password to access your ledger.',
        [{ text: 'OK', onPress: () => navigation.replace('Login') }]
      );
    } else {
      setErrorMsg(`Authentication failed. ${maxAttempts - nextAttempts} attempts remaining.`);
    }
  }, [attempts, authenticateBiometrically, isVerifying, navigation]);

  // Auto-trigger biometric prompt on screen load
  useEffect(() => {
    const timer = setTimeout(() => {
      triggerAuth();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigation.replace('Login');
  };

  const getBiometricIcon = () => {
    if (biometryType === 'FaceID') {
      return <Scan size={52} color="#DC2626" strokeWidth={1.5} />;
    }
    return <Fingerprint size={52} color="#DC2626" strokeWidth={1.5} />;
  };

  const getBiometricName = () => {
    switch (biometryType) {
      case 'FaceID': return 'Face ID';
      case 'TouchID': return 'Touch ID';
      case 'Fingerprint': return 'Fingerprint scanner';
      default: return 'biometrics';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.appIconContainer}>
          <Shield size={32} color="#DC2626" strokeWidth={2} />
        </View>
        <Text style={styles.appTitle}>Digital Udhaar</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.authCard}>
          <Text style={styles.cardTitle}>Ledger Locked</Text>
          <Text style={styles.cardSubtitle}>Use {getBiometricName()} to verify identity</Text>

          {/* Biometric Sensor Icon / Scan Animation */}
          <View style={styles.sensorContainer}>
            {isVerifying ? (
              <View style={styles.loadingWrapper}>
                <ActivityIndicator size="large" color="#DC2626" />
                <View style={styles.absoluteIcon}>{getBiometricIcon()}</View>
              </View>
            ) : (
              <TouchableOpacity onPress={triggerAuth} style={styles.iconButton}>
                <View style={styles.rippleOuter}>
                  <View style={styles.rippleInner}>
                    {getBiometricIcon()}
                  </View>
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* Status Message */}
          <View style={styles.statusContainer}>
            {isVerifying && (
              <Text style={styles.statusText}>Initializing sensor...</Text>
            )}
            
            {errorMsg && (
              <View style={styles.errorWrapper}>
                <AlertTriangle size={16} color="#EF4444" />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            {!isVerifying && !errorMsg && (
              <Text style={styles.instructionText}>Tapped sensor to scan</Text>
            )}
          </View>

          {/* Retry Button */}
          {!isVerifying && (
            <TouchableOpacity onPress={triggerAuth} style={styles.retryBtn}>
              <RefreshCw size={14} color="#FFF" style={styles.retryIcon} />
              <Text style={styles.retryBtnText}>Retry Scan</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Fallback & Logout Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          onPress={() => navigation.replace('Login')}
          style={styles.fallbackLink}
        >
          <Text style={styles.fallbackText}>Use Email & Password</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <LogOut size={16} color="#64748B" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    paddingHorizontal: 24,
  },
  appIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  appTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
    letterSpacing: 0.3,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  authCard: {
    backgroundColor: '#FFF',
    borderRadius: 28,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 6,
    textAlign: 'center',
  },
  sensorContainer: {
    marginVertical: 40,
    height: 120,
    width: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 120,
    height: 120,
  },
  absoluteIcon: {
    position: 'absolute',
    opacity: 0.3,
  },
  iconButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rippleOuter: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rippleInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FFEBEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusContainer: {
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  statusText: {
    fontSize: 13,
    color: '#64748B',
    fontStyle: 'italic',
  },
  errorWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '500',
  },
  instructionText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  retryIcon: {
    marginRight: 6,
  },
  retryBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  footer: {
    alignItems: 'center',
    marginBottom: 30,
    gap: 16,
  },
  fallbackLink: {
    padding: 8,
  },
  fallbackText: {
    fontSize: 14,
    color: '#DC2626',
    fontWeight: 'bold',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  logoutText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
});
