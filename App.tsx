import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import axios from 'axios';
import { Colors } from './src/theme/colors';
import { Fonts } from './src/theme/typography';
import { storage } from './src/utils/storage';
import { CustomAlert } from './src/components/Alertt';
import LoginScreen from './src/screens/LoginScreen';
import RegistrationScreen from './src/screens/RegistrationScreen';
import ApprovalStatusScreen from './src/screens/ApprovalStatusScreen';
import PaymentOnboardingScreen from './src/screens/PaymentOnboardingScreen';
import HomeScreen from './src/screens/HomeScreen';
import { API_BASE_URL } from './src/config/api';

const App = () => {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [storeData, setStoreData] = useState<any>(null);
  const [showPaymentSetup, setShowPaymentSetup] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<'login' | 'register'>('login');

  // Fetch full store owner profile and their store details
  const fetchOwnerProfileAndStore = useCallback(async (firebaseUser: FirebaseAuthTypes.User) => {
    try {
      const token = await firebaseUser.getIdToken();
      storage.setItem('userToken', token);

      // 1. Fetch user profile from backend
      const profileResponse = await axios.get(`${API_BASE_URL}/user/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (profileResponse.data.success && profileResponse.data.user) {
        const profile = profileResponse.data.user;
        setUserData(profile);
        storage.setItem('userData', profile);

        // 2. Fetch stores and find the store owned by this user
        const storesResponse = await axios.get(`${API_BASE_URL}/stores?include_inactive=true&include_pending=true`);
        
        if (storesResponse.data.success && storesResponse.data.data) {
          const ownerStore = storesResponse.data.data.find(
            (s: any) => s.owner_id === profile.id
          );
          
          if (ownerStore) {
            setStoreData(ownerStore);
            storage.setItem('storeData', ownerStore);
            
            // If store doesn't have an active Razorpay linked account, flag for setup
            if (ownerStore.razorpay_kyc_status !== 'activated') {
              setShowPaymentSetup(true);
            }
          }
        }
      }
    } catch (error: any) {
      console.log('[App.tsx] Error fetching owner profile & store:', error.message);
      
      // If the backend returns 404 (user does not exist in DB), sign out of Firebase cleanly (Case 2 fallback)
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        console.warn('[App.tsx] Authenticated Firebase user does not exist in database. Signing out...');
        try {
          await auth().signOut();
        } catch (signOutErr) {
          console.error('[App.tsx] Firebase signOut failed:', signOutErr);
        }
        
        // Clear credentials and reset states
        storage.removeItem('userToken');
        storage.removeItem('userData');
        storage.removeItem('storeData');
        
        setUserData(null);
        setStoreData(null);
        setShowPaymentSetup(false);
      }
    } finally {
      setInitializing(false);
    }
  }, []);

  // Handle Firebase auth state changes
  const onAuthStateChanged = useCallback((firebaseUser: FirebaseAuthTypes.User | null) => {
    setUser(firebaseUser);
    if (firebaseUser) {
      fetchOwnerProfileAndStore(firebaseUser);
    } else {
      // Clear local storage
      storage.removeItem('userToken');
      storage.removeItem('userData');
      storage.removeItem('storeData');
      
      setUserData(null);
      setStoreData(null);
      setShowPaymentSetup(false);
      setInitializing(false);
    }
  }, [fetchOwnerProfileAndStore]);

  useEffect(() => {
    const subscriber = auth().onAuthStateChanged(onAuthStateChanged);
    return subscriber; // unsubscribe on unmount
  }, [onAuthStateChanged]);

  const handleLoginSuccess = (data: any) => {
    setUserData(data);
    if (auth().currentUser) {
      fetchOwnerProfileAndStore(auth().currentUser!);
    }
  };

  const handleRegistrationSuccess = (data: any) => {
    setUserData(data);
    if (auth().currentUser) {
      fetchOwnerProfileAndStore(auth().currentUser!);
    }
    setCurrentScreen('login');
  };

  const handleLogout = async () => {
    setInitializing(true);
    try {
      await auth().signOut();
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

  const handleSetupPaymentsAdvance = () => {
    setShowPaymentSetup(true);
  };

  const handleOnboardingSuccess = async () => {
    // Refresh details after payment onboarding
    if (auth().currentUser) {
      await fetchOwnerProfileAndStore(auth().currentUser!);
    }
    setShowPaymentSetup(false);
  };

  const handleApprovedAdvance = async () => {
    // Refresh details after admin approves
    if (auth().currentUser) {
      await fetchOwnerProfileAndStore(auth().currentUser!);
    }
  };

  if (initializing) {
    return (
      <View style={styles.splashContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.splashText}>Loading FreshRun Portal...</Text>
      </View>
    );
  }

  // Router based on credentials and registration statuses
  const renderScreen = () => {
    if (!user || !userData || !storeData) {
      if (currentScreen === 'register') {
        return (
          <RegistrationScreen 
            onBack={() => setCurrentScreen('login')} 
            onRegisterSuccess={handleRegistrationSuccess} 
          />
        );
      }
      return (
        <LoginScreen 
          onLoginSuccess={handleLoginSuccess} 
          onNavigateToRegister={() => setCurrentScreen('register')} 
        />
      );
    }

    // Phase 1: Wait for admin verification (Both owner profile + store details must be approved)
    const storeApproved = storeData ? storeData.approval_status === 'approved' : false;
    if (userData.approvalStatus !== 'approved' || !storeApproved) {
      return (
        <ApprovalStatusScreen 
          status={userData.approvalStatus} 
          userData={userData}
          storeData={storeData}
          onApproved={handleApprovedAdvance}
          onLogout={handleLogout}
          onSetupPayments={handleSetupPaymentsAdvance}
        />
      );
    }

    // Phase 2: Complete Razorpay linked account connection
    if (showPaymentSetup || storeData.razorpay_kyc_status !== 'activated') {
      return (
        <PaymentOnboardingScreen 
          onBack={() => setShowPaymentSetup(false)}
          onSuccess={handleOnboardingSuccess}
          userData={userData}
          storeData={storeData}
        />
      );
    }

    // Phase 3: Main Dashboard (Approved + Onboarded)
    return (
      <HomeScreen 
        userData={userData} 
        storeData={storeData} 
        onLogout={handleLogout}
      />
    );
  };

  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: Colors.white }}>
      <StatusBar barStyle="dark-content" />
      {renderScreen()}
      <CustomAlert />
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
  splashText: {
    marginTop: 15,
    fontSize: 15,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
  },
});

export default App;
