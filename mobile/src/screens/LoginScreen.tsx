import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Shield, Mail, Lock, Fingerprint, Eye, EyeOff } from 'lucide-react-native';

export const LoginScreen: React.FC = () => {
  const { login, deviceSupportsBiometrics, biometryType, setBiometricsPreference } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Biometric Enrollment Modal State
  const [showBioModal, setShowBioModal] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setErrorMsg(null);
    setIsLoading(true);

    try {
      const success = await login(email.trim(), password);
      setIsLoading(false);

      if (success) {
        // If device supports biometrics, show enrolment request
        if (deviceSupportsBiometrics) {
          setShowBioModal(true);
        }
      } else {
        setErrorMsg('Invalid email or password. Please try again.');
      }
    } catch (err) {
      setIsLoading(false);
      setErrorMsg('Network error. Please check your connection.');
    }
  };

  const handleEnableBiometrics = async () => {
    await setBiometricsPreference(true);
    setShowBioModal(false);
  };

  const handleSkipBiometrics = async () => {
    await setBiometricsPreference(false);
    setShowBioModal(false);
  };

  // Get localized biometric name
  const getBiometricName = () => {
    switch (biometryType) {
      case 'FaceID': return 'Face ID';
      case 'TouchID': return 'Touch ID';
      case 'Fingerprint': return 'Fingerprint';
      default: return 'Biometrics';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Shield size={40} color="#DC2626" strokeWidth={2} />
            </View>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Log in to manage your digital credit ledger</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {errorMsg && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            {/* Email Field */}
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputContainer}>
              <Mail size={20} color="#94A3B8" style={styles.inputIcon} />
              <TextInput
                placeholder="storeowner@example.com"
                placeholderTextColor="#94A3B8"
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Password Field */}
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputContainer}>
              <Lock size={20} color="#94A3B8" style={styles.inputIcon} />
              <TextInput
                placeholder="••••••••"
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showPassword}
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
              >
                {showPassword ? (
                  <EyeOff size={20} color="#94A3B8" />
                ) : (
                  <Eye size={20} color="#94A3B8" />
                )}
              </TouchableOpacity>
            </View>

            {/* Login Button */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={isLoading}
              style={[styles.loginBtn, isLoading && styles.disabledBtn]}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.loginBtnText}>Log In</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Biometrics Setup Modal */}
      <Modal
        visible={showBioModal}
        transparent
        animationType="fade"
        onRequestClose={handleSkipBiometrics}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconContainer}>
              <Fingerprint size={48} color="#DC2626" />
            </View>
            
            <Text style={styles.modalTitle}>Enable {getBiometricName()}?</Text>
            
            <Text style={styles.modalDescription}>
              Unlock your digital ledger faster and more securely next time using your device's biometrics. Your biometric data never leaves your device.
            </Text>

            <TouchableOpacity
              onPress={handleEnableBiometrics}
              style={styles.modalEnableBtn}
            >
              <Text style={styles.modalEnableText}>Enable {getBiometricName()}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSkipBiometrics}
              style={styles.modalSkipBtn}
            >
              <Text style={styles.modalSkipText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0F172A',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-condensed',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  form: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 15,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  label: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 20,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#0F172A',
    fontSize: 15,
  },
  eyeBtn: {
    padding: 5,
  },
  loginBtn: {
    backgroundColor: '#DC2626',
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  disabledBtn: {
    backgroundColor: '#EF4444',
    opacity: 0.7,
  },
  loginBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorContainer: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 28,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  modalIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 10,
  },
  modalDescription: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  modalEnableBtn: {
    width: '100%',
    backgroundColor: '#DC2626',
    borderRadius: 14,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalEnableText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  modalSkipBtn: {
    width: '100%',
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSkipText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
});
