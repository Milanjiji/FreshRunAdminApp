import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import axios from 'axios';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/typography';
import { storage } from '../utils/storage';
import { Alertt } from '../components/Alertt';
import { API_BASE_URL } from '../config/api';
import { PageTitle, PageSubtitle } from '../components/Typography';
import { PrimaryButton } from '../components/Button';

interface LoginScreenProps {
  onLoginSuccess: (userData: any) => void;
  onNavigateToRegister: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, onNavigateToRegister }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [confirm, setConfirm] = useState<FirebaseAuthTypes.ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);

  // Handle countdown timer for Resend OTP
  useEffect(() => {
    let interval: any;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleSendOTP = async () => {
    const formattedPhone = phoneNumber.replace(/[^0-9]/g, '');
    console.log('[LoginScreen] [Step 1] handleSendOTP triggered. Phone digits:', formattedPhone);
    
    if (formattedPhone.length !== 10) {
      console.warn('[LoginScreen] Validation failed: phone length is not 10 digits.');
      Alertt.alert('Invalid Number', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    try {
      console.log('[LoginScreen] [Step 2] Querying check-owner API for phone:', formattedPhone);
      const checkResponse = await axios.get(`${API_BASE_URL}/auth/check-owner/${formattedPhone}`);
      console.log('[LoginScreen] [Step 3] check-owner API response:', checkResponse.data);
      
      if (!checkResponse.data.success || !checkResponse.data.exists) {
        console.warn('[LoginScreen] [Block] User does not exist in DB (Case 2). Preventing OTP SMS.');
        Alertt.alert(
          'Account Not Found',
          'This phone number is not registered as a store partner. Please register your store first.'
        );
        return;
      }

      const fullPhoneNumber = `+91${formattedPhone}`;
      console.log('[LoginScreen] [Step 4] Owner found. Requesting Firebase Phone Auth OTP for:', fullPhoneNumber);
      
      const confirmation = await auth().signInWithPhoneNumber(fullPhoneNumber);
      console.log('[LoginScreen] [Step 5] Firebase OTP SMS sent successfully. Confirmation received.');
      
      setConfirm(confirmation);
      setTimer(30); // 30 seconds countdown
    } catch (error: any) {
      console.error('[LoginScreen] [Error] Send OTP failed:', error);
      Alertt.alert('Error', error.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    console.log('[LoginScreen] [OTP Step 1] handleVerifyOTP triggered. Code entered:', code);
    
    if (code.length !== 6 || isNaN(Number(code))) {
      console.warn('[LoginScreen] Validation failed: OTP code must be a 6-digit number.');
      Alertt.alert('Invalid OTP', 'Please enter a valid 6-digit verification code.');
      return;
    }

    if (!confirm) {
      console.error('[LoginScreen] Session state error: confirm object is null.');
      Alertt.alert('Session Expired', 'Please request a new OTP.');
      return;
    }

    setLoading(true);
    try {
      console.log('[LoginScreen] [OTP Step 2] Sending verification code to Firebase auth...');
      const userCredential = await confirm.confirm(code);
      const user = userCredential?.user;

      if (!user) {
        throw new Error('Authentication failed. User session empty.');
      }
      console.log('[LoginScreen] [OTP Step 3] Firebase OTP verified. User UID:', user.uid);

      console.log('[LoginScreen] [OTP Step 4] Requesting Firebase ID Token...');
      const idToken = await user.getIdToken();
      const phoneDigits = phoneNumber.replace(/[^0-9]/g, '');

      console.log('[LoginScreen] [OTP Step 5] Querying backend /auth/check-owner role check for:', phoneDigits);
      const response = await axios.get(`${API_BASE_URL}/auth/check-owner/${phoneDigits}`);
      console.log('[LoginScreen] [OTP Step 6] Backend role check response:', response.data);

      if (response.data.success && response.data.exists) {
        const userData = response.data.user;
        console.log('[LoginScreen] [Success] Login role confirmed. Storing credentials locally.');
        
        // Save auth data to local storage
        storage.setItem('userToken', idToken);
        storage.setItem('userData', userData);

        onLoginSuccess(userData);
      } else {
        console.warn('[LoginScreen] [Access Denied] User is not registered as owner on backend. Signing out of Firebase.');
        await auth().signOut();
        setConfirm(null);
        setCode('');
        
        Alertt.alert(
          'Access Denied',
          'This phone number is not registered as a store owner on FreshRun. Please contact the administrator to create your store registration first.'
        );
      }
    } catch (error: any) {
      console.error('[LoginScreen] [Error] OTP verification error:', error);
      Alertt.alert('Verification Failed', 'Invalid code or session expired. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topContainer}>
            <View style={styles.header}>
              <PageTitle>Welcome Back!</PageTitle>
              <PageSubtitle>Sign in to your store partner account.</PageSubtitle>
            </View>

            <View style={styles.inputSection}>
              {!confirm ? (
                <View style={styles.inputContainer}>
                  <View style={styles.inputWrapper}>
                    <View style={styles.countryPicker}>
                      <Text style={styles.flag}>🇮🇳</Text>
                      <Text style={styles.countryCode}>(+91)</Text>
                    </View>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Enter phone number"
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                      keyboardType="phone-pad"
                      maxLength={10}
                      placeholderTextColor={Colors.textLight}
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.inputContainer}>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Enter OTP Code"
                      value={code}
                      onChangeText={setCode}
                      keyboardType="number-pad"
                      maxLength={6}
                      placeholderTextColor={Colors.textLight}
                    />
                  </View>
                  
                  {/* Resend details */}
                  <View style={styles.timerRow}>
                    {timer > 0 ? (
                      <Text style={styles.timerText}>Resend code in {timer}s</Text>
                    ) : (
                      <TouchableOpacity onPress={handleSendOTP}>
                        <Text style={styles.resendLink}>Resend Code</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => setConfirm(null)}>
                      <Text style={styles.changeNumberLink}>Change Number</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            <PrimaryButton 
              title={!confirm ? "Send OTP" : "Verify & Enter"}
              onPress={!confirm ? handleSendOTP : handleVerifyOTP}
              loading={loading}
            />
          </View>

          <View style={styles.imageContainer}>
            <Image 
              source={require('../assets/login_page_admin.png')} 
              style={styles.loginImage}
              resizeMode="contain"
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>New store partner? </Text>
            <TouchableOpacity onPress={() => {
              console.log('[LoginScreen] Navigating to Registration wizard.');
              onNavigateToRegister();
            }}>
              <Text style={styles.linkText}>Register here</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 25,
    paddingTop: 60,
    paddingBottom: 40,
  },
  topContainer: {
    marginBottom: 20,
  },
  header: {
    marginBottom: 40,
  },
  inputSection: {
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 15,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 15,
    paddingHorizontal: 15,
    height: 60,
    backgroundColor: Colors.white,
  },
  countryPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  flag: {
    fontSize: 15,
    marginRight: 5,
  },
  countryCode: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: Colors.text,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.text,
  },
  timerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingHorizontal: 4,
  },
  timerText: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    color: Colors.textLight,
  },
  resendLink: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    color: Colors.primary,
  },
  changeNumberLink: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    color: Colors.secondary,
  },
  imageContainer: {
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
  },
  loginImage: {
    width: '100%',
    height: '100%',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  footerText: {
    fontSize: 12.5,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
  linkText: {
    fontSize: 12.5,
    fontFamily: Fonts.bold,
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
});

export default LoginScreen;
