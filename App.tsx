import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  StatusBar,
  AppState,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import messaging from '@react-native-firebase/messaging';
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

// Helpers for token validation and injection
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function decodeTokenPayload(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
    let output = '';
    
    for (let bc = 0, bs = 0, rbuffer, idx = 0; idx < base64.length; idx++) {
      const char = base64.charAt(idx);
      const pos = CHARS.indexOf(char);
      if (pos === -1) continue;
      bs = bc % 4 ? bs * 64 + pos : pos;
      if (bc++ % 4) {
        rbuffer = (bs >> ((-2 * bc) & 6));
        output += String.fromCharCode(255 & rbuffer);
      }
    }
    
    return JSON.parse(output);
  } catch (e) {
    return null;
  }
}

function isTokenExpired(token: string) {
  const payload = decodeTokenPayload(token);
  if (!payload || !payload.exp) return true;
  
  const expTimeMs = payload.exp * 1000;
  return Date.now() >= (expTimeMs - 10000);
}

// Intercept Axios requests to inject fresh Firebase ID token (proactively checks for expiration)
axios.interceptors.request.use(async (config) => {
  if (config.url?.startsWith(API_BASE_URL)) {
    try {
      const currentUser = auth().currentUser;
      if (currentUser) {
        let token = storage.getString('userToken') || '';

        // If the token is missing or expired, fetch a fresh one before the call
        if (!token || isTokenExpired(token)) {
          console.log('[Axios Interceptor] Token expired or missing. Refreshing before API call...');
          try {
            token = await currentUser.getIdToken(true);
            if (token) {
              storage.setItem('userToken', token);
            }
          } catch (refreshErr) {
            console.error('[Axios Interceptor] Failed to force-refresh token:', refreshErr);
          }
        }

        // If it's valid, fetch cached token using false
        if (token && !isTokenExpired(token)) {
          try {
            token = await currentUser.getIdToken(false);
          } catch (e) {
            // fallback to local storage token
          }
        }

        if (token) {
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    } catch (error) {
      console.error('[Axios Interceptor] Error injecting token:', error);
    }
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

const App = () => {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [storeData, setStoreData] = useState<any>(null); // Active store
  const [storesList, setStoresList] = useState<any[]>([]); // All owner stores
  const [showPaymentSetup, setShowPaymentSetup] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<'login' | 'register'>('login');

  const handleSelectStore = (store: any) => {
    setStoreData(store);
    storage.setItem('storeData', store);
    storage.setItem('activeStoreId', store.id);
    if (store.razorpay_kyc_status !== 'activated') {
      setShowPaymentSetup(true);
    } else {
      setShowPaymentSetup(false);
    }
  };

  const requestUserPermission = async () => {
    try {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      return enabled;
    } catch (e) {
      console.log('[App.tsx] FCM Permission request error:', e);
      return false;
    }
  };

  const registerFcmToken = async (userId: string, userToken: string) => {
    try {
      const fcmToken = await messaging().getToken();
      if (fcmToken) {
        console.log('[App.tsx] FCM Token retrieved:', fcmToken);
        await axios.post(
          `${API_BASE_URL}/user/fcm-token`,
          { token: fcmToken },
          { headers: { Authorization: `Bearer ${userToken}` } }
        );
        console.log('[App.tsx] FCM Token registered on backend successfully.');
      }
    } catch (err: any) {
      console.log('[App.tsx] FCM registration failed:', err.message);
    }
  };

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

        // Register FCM Token
        requestUserPermission().then((hasPermission) => {
          if (hasPermission) {
            registerFcmToken(profile.id, token);
          }
        });

        // 2. Fetch stores and filter stores owned by this user
        const storesResponse = await axios.get(`${API_BASE_URL}/stores?include_inactive=true&include_pending=true`);
        
        if (storesResponse.data.success && storesResponse.data.data) {
          const ownerStores = storesResponse.data.data.filter(
            (s: any) => s.owner_id === profile.id
          );
          
          setStoresList(ownerStores);
          storage.setItem('storesList', ownerStores);
          
          if (ownerStores.length > 0) {
            // Retrieve last active store ID if exists, otherwise default to first
            const lastActiveStoreId = storage.getString('activeStoreId');
            let selectedStore = ownerStores.find((s: any) => s.id === lastActiveStoreId);
            if (!selectedStore) {
              selectedStore = ownerStores[0];
            }
            
            setStoreData(selectedStore);
            storage.setItem('storeData', selectedStore);
            storage.setItem('activeStoreId', selectedStore.id);
            
            // If store doesn't have an active Razorpay linked account, flag for setup
            if (selectedStore.razorpay_kyc_status !== 'activated') {
              setShowPaymentSetup(true);
            } else {
              setShowPaymentSetup(false);
            }
          } else {
            setStoreData(null);
            storage.removeItem('storeData');
            storage.removeItem('activeStoreId');
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
        storage.removeItem('storesList');
        storage.removeItem('activeStoreId');
        
        setUserData(null);
        setStoreData(null);
        setStoresList([]);
        setShowPaymentSetup(false);
      }
    } finally {
      setInitializing(false);
    }
  }, []);

  // Handle Firebase auth/token changes
  const onIdTokenChanged = useCallback(async (firebaseUser: FirebaseAuthTypes.User | null) => {
    setUser(firebaseUser);
    if (firebaseUser) {
      try {
        const token = await firebaseUser.getIdToken();
        storage.setItem('userToken', token);
      } catch (e) {
        console.error('Error updating refreshed token in storage:', e);
      }

      if (initializing) {
        fetchOwnerProfileAndStore(firebaseUser);
      }
    } else {
      // Clear local storage
      storage.removeItem('userToken');
      storage.removeItem('userData');
      storage.removeItem('storeData');
      storage.removeItem('storesList');
      storage.removeItem('activeStoreId');
      
      setUserData(null);
      setStoreData(null);
      setStoresList([]);
      setShowPaymentSetup(false);
      setInitializing(false);
    }
  }, [fetchOwnerProfileAndStore, initializing]);

  useEffect(() => {
    const subscriber = auth().onIdTokenChanged(onIdTokenChanged);
    return subscriber; // unsubscribe on unmount
  }, [onIdTokenChanged]);

  // Proactive token refresh when app transitions back to the foreground (active state)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active') {
        console.log('[Auth] App moved to foreground - proactively refreshing session...');
        try {
          const currentUser = auth().currentUser;
          if (currentUser) {
            const freshToken = await currentUser.getIdToken(true);
            if (freshToken) {
              storage.setItem('userToken', freshToken);
              console.log('[Auth] Session successfully renewed proactively on foreground.');
            }
          }
        } catch (err) {
          console.warn('[Auth] Proactive session refresh failed:', err);
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

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
          storesList={storesList}
          onSelectStore={handleSelectStore}
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
        storesList={storesList}
        onSelectStore={handleSelectStore}
        onRefreshStores={() => {
          if (auth().currentUser) {
            fetchOwnerProfileAndStore(auth().currentUser!);
          }
        }}
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
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
  },
});

export default App;
