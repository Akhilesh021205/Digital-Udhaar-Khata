import React, { useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator, Text, Image, SafeAreaView } from 'react-view'; // Wait, React Native standard: 'react-native'
// Let's use 'react-native' package for standard RN imports
import { StyleSheet as RNStyleSheet, View as RNView, ActivityIndicator as RNActivityIndicator, Text as RNText, Image as RNImage, SafeAreaView as RNSafeAreaView } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Shield } from 'lucide-react-native';

interface SplashScreenProps {
  navigation: any;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ navigation }) => {
  const { bootstrapSession } = useAuth();

  useEffect(() => {
    const checkSession = async () => {
      // Small artificial delay to show the beautiful splash layout
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const destination = await bootstrapSession();
      if (destination === 'biometric') {
        navigation.replace('Biometric');
      } else {
        navigation.replace('Login');
      }
    };

    checkSession();
  }, [bootstrapSession, navigation]);

  return (
    <RNSafeAreaView style={styles.container}>
      <RNView style={styles.content}>
        <RNView style={styles.logoContainer}>
          <Shield size={64} color="#DC2626" strokeWidth={1.5} />
        </RNView>
        <RNText style={styles.title}>Digital Udhaar</RNText>
        <RNText style={styles.subtitle}>Securing Your Ledger Assets</RNText>
      </RNView>
      <RNView style={styles.loaderContainer}>
        <RNActivityIndicator size="small" color="#DC2626" />
        <RNText style={styles.loadingText}>Initializing secure environment...</RNText>
      </RNView>
    </RNSafeAreaView>
  );
};

const styles = RNStyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC', // Slate 50
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 30,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0F172A', // Slate 900
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B', // Slate 500
    marginTop: 8,
    textAlign: 'center',
  },
  loaderContainer: {
    marginBottom: 40,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#94A3B8', // Slate 400
    marginTop: 8,
  },
});
