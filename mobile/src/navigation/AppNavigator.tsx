import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import { SplashScreen } from '../screens/SplashScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { BiometricScreen } from '../screens/BiometricScreen';
import { HomeScreen } from '../screens/HomeScreen';

type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Biometric: undefined;
  Home: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: '#F8FAFC' },
        }}
      >
        {isAuthenticated ? (
          // Authenticated Stack
          <Stack.Screen name="Home" component={HomeScreen} />
        ) : (
          // Security Verification Stack
          <>
            <Stack.Screen name="Splash" component={SplashScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Biometric" component={BiometricScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
