import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  ActivityIndicator,
  StatusBar,
  PermissionsAndroid,
} from 'react-native';
import { Alertt } from '../components/Alertt';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, ChevronLeft, Trash2, ChevronRight, Locate } from 'lucide-react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import axios from 'axios';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { launchImageLibrary } from 'react-native-image-picker';
import { storage } from '../utils/storage';
import { PageTitle, PageSubtitle } from '../components/Typography';
import { PrimaryButton } from '../components/Button';
import { Fonts } from '../theme/typography';
import { Colors } from '../theme/colors';
import { API_BASE_URL } from '../config/api';

const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dubgo0vue/image/upload";
const UPLOAD_PRESET = "freshrun_preset";

interface RegistrationScreenProps {
  onBack: () => void;
  onRegisterSuccess: (userData: any) => void;
}

const RegistrationScreen: React.FC<RegistrationScreenProps> = ({ onBack, onRegisterSuccess }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [categories, setCategories] = useState<any[]>([
    { label: 'Restaurants', value: 'restaurants' },
    { label: 'Street Food', value: 'street-food' },
    { label: 'Groceries', value: 'groceries' },
    { label: 'Chicken', value: 'chicken' },
    { label: 'Fish', value: 'fish' },
    { label: 'Medicine', value: 'medicine' }
  ]);

  // --- Step 1: Owner Details ---
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [aadharNumber, setAadharNumber] = useState('');
  const [aadharImage, setAadharImage] = useState<string | null>(null);

  // --- Step 2: Store Details ---
  const [storeName, setStoreName] = useState('');
  const [storeDescription, setStoreDescription] = useState('');
  const [storeCategory, setStoreCategory] = useState('');

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/categories`);
        const data = await response.json();
        if (data.success && Array.isArray(data.data)) {
          const formatted = data.data.map((cat: any) => ({
            label: cat.name,
            value: cat.slug
          }));
          setCategories(formatted);
          if (formatted.length > 0 && !storeCategory) {
            setStoreCategory(formatted[0].value);
          }
        }
      } catch (err) {
        console.error('Failed to fetch store registration categories:', err);
      }
    };
    fetchCategories();
  }, []);
  const [storePhone, setStorePhone] = useState('');
  const [storeImage, setStoreImage] = useState<string | null>(null);
  const [houseNumber, setHouseNumber] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [landmark, setLandmark] = useState('');
  const [pincode, setPincode] = useState('');
  const [city, setCity] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [latitude, setLatitude] = useState(11.2588);
  const [longitude, setLongitude] = useState(75.7804);

  // --- Map Selection ---
  const [showMap, setShowMap] = useState(false);
  const [tempLatitude, setTempLatitude] = useState(11.2588);
  const [tempLongitude, setTempLongitude] = useState(75.7804);

  const handleOpenMap = () => {
    setTempLatitude(latitude);
    setTempLongitude(longitude);
    setShowMap(true);
  };

  const mapRef = useRef<MapView>(null);
  const [locating, setLocating] = useState(false);

  const QUICK_LOCATION_OPTIONS = {
    enableHighAccuracy: false,
    timeout: 8000,
    maximumAge: 60000,
  };

  const PRECISE_LOCATION_OPTIONS = {
    enableHighAccuracy: true,
    timeout: 25000,
    maximumAge: 10000,
  };

  const getCurrentPosition = (
    options: { enableHighAccuracy: boolean; timeout: number; maximumAge: number }
  ) =>
    new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position) => {
          const { latitude: lat, longitude: lng } = position.coords;
          resolve({ latitude: lat, longitude: lng });
        },
        reject,
        options
      );
    });

  const hasLocationPermission = async () => {
    if (Platform.OS === 'ios') {
      return true;
    }

    const hasFineLocation = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    );
    const hasCoarseLocation = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
    );

    return hasFineLocation || hasCoarseLocation;
  };

  const requestLocationPermission = async () => {
    if (Platform.OS === 'ios') {
      return true;
    }

    try {
      const alreadyGranted = await hasLocationPermission();
      if (alreadyGranted) {
        return true;
      }

      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'FreshRun Admin needs access to your location to set your store location on the map.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );

      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        return true;
      }

      const coarseGranted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
      );
      return coarseGranted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn(err);
      return false;
    }
  };

  const handleFindMyLocation = async () => {
    setLocating(true);
    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        Alertt.alert('Permission Denied', 'Location permission is required to fetch your current location.');
        setLocating(false);
        return;
      }

      console.log('[RegistrationScreen] Fetching current location (quick)...');
      try {
        const loc = await getCurrentPosition(QUICK_LOCATION_OPTIONS);
        console.log('[RegistrationScreen] Got location (quick):', loc);
        updateMapLocation(loc);
      } catch (quickError) {
        console.warn('Quick location fetch failed, trying precise GPS:', quickError);
        try {
          const loc = await getCurrentPosition(PRECISE_LOCATION_OPTIONS);
          console.log('[RegistrationScreen] Got location (precise):', loc);
          updateMapLocation(loc);
        } catch (preciseError: any) {
          console.error('Location Error:', preciseError);
          Alertt.alert('Location Error', 'GPS timed out. Please make sure location services are enabled.');
        }
      }
    } catch (err: any) {
      console.error(err);
      Alertt.alert('Error', 'Failed to retrieve location.');
    } finally {
      setLocating(false);
    }
  };

  const updateMapLocation = (loc: { latitude: number; longitude: number }) => {
    setTempLatitude(loc.latitude);
    setTempLongitude(loc.longitude);
    mapRef.current?.animateToRegion({
      latitude: loc.latitude,
      longitude: loc.longitude,
      latitudeDelta: 0.015,
      longitudeDelta: 0.015,
    }, 400);
  };

  // --- Step 3: UPI Details ---
  const [upiId, setUpiId] = useState('');
  const [upiQrImage, setUpiQrImage] = useState<string | null>(null);
  const [qrUploading, setQrUploading] = useState(false);
  const [businessName, setBusinessName] = useState('');

  // --- Step 4: OTP Verification ---
  const [confirm, setConfirm] = useState<FirebaseAuthTypes.ConfirmationResult | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [timer, setTimer] = useState(0);
  const [registeredToken, setRegisteredToken] = useState<string | null>(null);

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

  // Handle Firebase Auto-Verification / SMS Retriever API (Auto-login)
  useEffect(() => {
    if (step !== 2) return;

    const unsubscribe = auth().onAuthStateChanged(async (user) => {
      if (user) {
        console.log('[RegistrationScreen] Auto-verification detected via onAuthStateChanged!');
        try {
          setLoading(true);
          const idToken = await user.getIdToken();
          setRegisteredToken(idToken);
          storage.setItem('userToken', idToken);
          console.log('[RegistrationScreen] Auto-verification token saved. Moving to Step 3 (Store Details)...');
          setStep(3);
        } catch (err) {
          console.warn('[RegistrationScreen] Failed to retrieve token from auto-verified user:', err);
        } finally {
          setLoading(false);
        }
      }
    });

    return unsubscribe;
  }, [step]);

  // Handle image pick & upload to Cloudinary
  const handleSelectImage = async (type: 'aadhar' | 'store' | 'qr') => {
    console.log(`[RegistrationScreen] Selecting image for ${type} using launchImageLibrary...`);
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.7,
    });
    
    if (result.didCancel) {
      console.log('[RegistrationScreen] Image picking cancelled by user.');
      return;
    }

    if (result.assets && result.assets[0].uri) {
      console.log(`[RegistrationScreen] Image picked successfully: ${result.assets[0].uri}. Proceeding to upload...`);
      uploadToCloudinary(result.assets[0], type);
    }
  };

  const uploadToCloudinary = async (asset: any, type: 'aadhar' | 'store' | 'qr') => {
    if (type === 'qr') {
      setQrUploading(true);
    } else {
      setUploading(true);
    }
    console.log(`[RegistrationScreen] Initiating Cloudinary upload to preset '${UPLOAD_PRESET}' for ${type}...`);
    try {
      const data = new FormData();
      data.append('file', {
        uri: asset.uri,
        type: asset.type || 'image/jpeg',
        name: asset.fileName || 'upload.jpg',
      } as any);
      data.append('upload_preset', UPLOAD_PRESET);

      const response = await fetch(CLOUDINARY_URL, {
        method: 'POST',
        body: data,
      });

      if (!response.ok) {
        throw new Error(`Cloudinary status: ${response.status}`);
      }

      const resData = await response.json();
      if (resData.secure_url) {
        console.log(`[RegistrationScreen] Cloudinary upload successful. URL: ${resData.secure_url}`);
        if (type === 'aadhar') {
          setAadharImage(resData.secure_url);
        } else if (type === 'store') {
          setStoreImage(resData.secure_url);
        } else if (type === 'qr') {
          setUpiQrImage(resData.secure_url);
        }
      }
    } catch (error: any) {
      console.error('[RegistrationScreen] [Error] Cloudinary upload failed:', error);
      Alertt.alert('Upload Failed', 'Could not upload image. Please try again.');
    } finally {
      if (type === 'qr') {
        setQrUploading(false);
      } else {
        setUploading(false);
      }
    }
  };

  // Step 1 Validation & Precheck (Case D check)
  const handleNextStep1 = async () => {
    if (loading) return;
    console.log('[RegistrationScreen] [Step 1 Validate] Name:', fullName, 'Email:', email, 'Phone:', phoneNumber, 'Aadhar:', aadharNumber, 'AadharImg:', aadharImage);
    
    if (!fullName.trim() || !email.trim() || !phoneNumber.trim() || !aadharNumber.trim() || !aadharImage) {
      console.warn('[RegistrationScreen] Step 1 validation failed: Missing fields.');
      Alertt.alert('Error', 'Please fill in all owner details and upload Aadhar Image.');
      return;
    }
    if (phoneNumber.length !== 10) {
      console.warn('[RegistrationScreen] Step 1 validation failed: Phone is not 10 digits');
      Alertt.alert('Error', 'Please enter a valid 10-digit phone number.');
      return;
    }
    if (aadharNumber.length !== 12) {
      console.warn('[RegistrationScreen] Step 1 validation failed: Aadhar is not 12 digits');
      Alertt.alert('Error', 'Aadhar number must be 12 digits.');
      return;
    }

    setLoading(true);
    try {
      console.log('[RegistrationScreen] [Step 1 Precheck] Querying check-owner for registration phone:', phoneNumber);
      const checkResponse = await axios.get(`${API_BASE_URL}/auth/check-owner/${phoneNumber}`);
      console.log('[RegistrationScreen] [Step 1 Precheck] Response:', checkResponse.data);
      
      if (checkResponse.data.success && checkResponse.data.exists) {
        console.warn('[RegistrationScreen] [Block] User already registered (Case D). Blocking.');
        Alertt.alert(
          'Account Exists',
          'An account already exists with this phone number. Please go back and log in.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Go to Login', onPress: onBack }
          ]
        );
        return;
      }
      
      // Step 1 check success. Immediately send Firebase OTP before entering other screens
      const formattedPhone = `+91${phoneNumber}`;
      console.log('[RegistrationScreen] Sending Firebase OTP to confirm identity:', formattedPhone);
      const confirmation = await auth().signInWithPhoneNumber(formattedPhone);
      
      console.log('[RegistrationScreen] Firebase OTP sent successfully. Advancing to OTP verification step.');
      setConfirm(confirmation);
      setTimer(30);
      setStep(2); // Step 2 is now OTP verification
    } catch (error: any) {
      console.error('[RegistrationScreen] [Error] Step 1 verification failed:', error);
      Alertt.alert('Error', error.message || 'Validation check failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP and Authenticate (previously Step 4 verify block)
  const handleOtpVerify = async () => {
    if (loading) return;
    console.log('[RegistrationScreen] [OTP verification] Code entered:', otpCode);
    if (otpCode.length !== 6 || isNaN(Number(otpCode))) {
      console.warn('[RegistrationScreen] Validation failed: OTP code is invalid length.');
      Alertt.alert('Error', 'Please enter a valid 6-digit OTP.');
      return;
    }

    if (!confirm) {
      console.error('[RegistrationScreen] Session expired: confirm object is null.');
      Alertt.alert('Session Expired', 'Please request a new OTP code.');
      return;
    }

    setLoading(true);
    try {
      console.log('[RegistrationScreen] Confirming registration OTP code with Firebase auth...');
      const credential = await confirm.confirm(otpCode);
      const firebaseUser = credential?.user;

      if (!firebaseUser) {
        throw new Error('Authentication failed. User session empty.');
      }
      console.log('[RegistrationScreen] OTP confirmed by Firebase. User UID:', firebaseUser.uid);

      console.log('[RegistrationScreen] Fetching ID Token...');
      const idToken = await firebaseUser.getIdToken();
      setRegisteredToken(idToken);
      storage.setItem('userToken', idToken);

      console.log('[RegistrationScreen] OTP verified and user authenticated. Proceeding to Step 3 (Store Details)...');
      setStep(3); // Step 3 is now Store details
    } catch (error: any) {
      console.error('[RegistrationScreen] [Error] OTP verification failed:', error);
      Alertt.alert('Verification Failed', error.message || 'Invalid code entered.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Resend OTP inside Step 2
  const handleResendOtp = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const formattedPhone = `+91${phoneNumber}`;
      console.log('[RegistrationScreen] Resending Firebase OTP:', formattedPhone);
      const confirmation = await auth().signInWithPhoneNumber(formattedPhone);
      setConfirm(confirmation);
      setTimer(30);
      Alertt.alert('OTP Sent', 'A new verification code has been sent to your phone number.');
    } catch (error: any) {
      console.error('[RegistrationScreen] [Error] Failed to resend OTP:', error);
      Alertt.alert('Error', error.message || 'Failed to send verification code.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3 Validation: Store Details (previously Step 2)
  const handleNextStepStore = () => {
    console.log('[RegistrationScreen] [Step 3 Validate] Store Name:', storeName, 'Phone:', storePhone, 'Address:', houseNumber, addressLine, pincode, city, 'GST:', gstNumber);
    
    if (!storeName.trim() || !storePhone.trim() || !houseNumber.trim() || !addressLine.trim() || !pincode.trim() || !city.trim() || !storeImage) {
      console.warn('[RegistrationScreen] Step 3 validation failed: Missing fields.');
      Alertt.alert('Error', 'Please fill in all store details and upload store image.');
      return;
    }
    if (storePhone.length !== 10) {
      console.warn('[RegistrationScreen] Step 3 validation failed: Store phone is not 10 digits.');
      Alertt.alert('Error', 'Store phone number must be 10 digits.');
      return;
    }
    if (gstNumber.trim() && gstNumber.trim().length !== 15) {
      console.warn('[RegistrationScreen] Step 3 validation failed: GST is not 15 characters.');
      Alertt.alert('Error', 'GST Number must be 15 characters.');
      return;
    }

    // Default business name to store name
    if (!businessName) {
      setBusinessName(storeName);
    }
    
    console.log('[RegistrationScreen] Store details valid. Transitioning to Step 4 (UPI details)...');
    setStep(4); // Step 4 is now UPI details
  };

  // Step 4 Verification & Submission (previously Step 3 & Step 4 Final Submit merged)
  const handleFinalSubmit = async () => {
    if (loading) return;
    console.log('[RegistrationScreen] [Step 4 Submit] UPI ID:', upiId, 'UPI QR:', upiQrImage, 'Business Name:', businessName);
    
    if (!upiId.trim() || !upiQrImage || !businessName.trim()) {
      console.warn('[RegistrationScreen] Step 4 validation failed: Missing fields.');
      Alertt.alert('Error', 'Please enter your UPI ID, upload UPI QR Code image, and enter registered name.');
      return;
    }
    if (!upiId.includes('@')) {
      console.warn('[RegistrationScreen] Step 4 validation failed: Invalid UPI ID format.');
      Alertt.alert('Error', 'Please enter a valid UPI ID (e.g. name@okaxis)');
      return;
    }

    setLoading(true);
    try {
      const idToken = registeredToken || storage.getString('userToken');
      if (!idToken) {
        throw new Error('User session not found. Please verify your phone number first.');
      }

      // 2. Submit Store & Owner registration payload
      const registerPayload = {
        storeName,
        description: storeDescription,
        category: storeCategory,
        imageUrl: storeImage,
        storePhone1: storePhone,
        storeHouseNumber: houseNumber,
        storeAddressLine: addressLine,
        storeLandmark: landmark,
        storePincode: pincode,
        storeCity: city,
        latitude: latitude,
        longitude: longitude,
        ownerFullName: fullName,
        ownerEmail: email,
        ownerPhone1: phoneNumber,
        ownerAadharNumber: aadharNumber,
        ownerAadharImage: aadharImage,
        gstNumber: gstNumber || null,
        approvalStatus: 'pending' // pending review
      };

      console.log('[RegistrationScreen] Submitting store and owner info to backend POST /stores. Payload:', registerPayload);
      const storeResponse = await axios.post(`${API_BASE_URL}/stores`, registerPayload);
      console.log('[RegistrationScreen] Backend store creation response:', storeResponse.data);

      if (storeResponse.data.success) {
        const storeData = storeResponse.data.data;
        console.log('[RegistrationScreen] Store record generated. Initiating Razorpay onboarding...');

        const onboardPayload = {
          role: 'owner',
          storeId: storeData.id,
          upiId,
          upiQrImage,
          name: fullName,
          email,
          phone: phoneNumber,
          businessName
        };

        // Ensure token is stored in MMKV
        storage.setItem('userToken', idToken);

        console.log('[RegistrationScreen] Submitting onboarding UPI info to backend POST /payments/onboard. Payload:', onboardPayload);
        const onboardResponse = await axios.post(
          `${API_BASE_URL}/payments/onboard`,
          onboardPayload
        );
        console.log('[RegistrationScreen] Razorpay onboarding response:', onboardResponse.data);

        if (onboardResponse.data.success) {
          Alertt.alert('Success', 'Store registration submitted successfully! We are reviewing your documents.');
          
          console.log('[RegistrationScreen] Fetching freshly registered user profile from backend...');
          const profileResponse = await axios.get(`${API_BASE_URL}/user/profile`);
          console.log('[RegistrationScreen] Fetch profile response:', profileResponse.data);

          if (profileResponse.data.success && profileResponse.data.user) {
            console.log('[RegistrationScreen] [Registration Completed] Updating local session keys and waiting for auth sync...');
            storage.setItem('userData', profileResponse.data.user);
            storage.setItem('storeData', storeData);
            
            // Wait for the Firebase SDK authentication state to synchronize on the device
            await new Promise<void>((resolve) => {
              const timeout = setTimeout(() => {
                console.warn('[RegistrationScreen] onAuthStateChanged did not fire within 3s — proceeding.');
                resolve();
              }, 3000);

              const unsubscribe = auth().onAuthStateChanged((authUser) => {
                if (authUser) {
                  console.log('[RegistrationScreen] onAuthStateChanged confirmed. Firebase SDK session is ready.');
                  clearTimeout(timeout);
                  unsubscribe();
                  resolve();
                }
              });
            });

            onRegisterSuccess(profileResponse.data.user);
          }
        } else {
          throw new Error('Razorpay setup failed.');
        }
      } else {
        throw new Error('Store creation failed.');
      }
    } catch (error: any) {
      console.error('[RegistrationScreen] [Error] Registration submission failed:', error);
      Alertt.alert('Registration Failed', error.response?.data?.error || error.message || 'Onboarding failed.');
    } finally {
      setLoading(false);
    }
  };

  if (showMap) {
    return (
      <SafeAreaView style={styles.mapSafeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
        
        {/* Map View */}
        <View style={styles.mapWrapper}>
          <MapView
            ref={mapRef}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            style={styles.map}
            initialRegion={{
              latitude: tempLatitude,
              longitude: tempLongitude,
              latitudeDelta: 0.015,
              longitudeDelta: 0.015,
            }}
            onRegionChangeComplete={(region) => {
              setTempLatitude(region.latitude);
              setTempLongitude(region.longitude);
            }}
          />
          
          {/* Floating Locate Button */}
          <TouchableOpacity 
            style={styles.floatingLocateButton}
            onPress={handleFindMyLocation}
            disabled={locating}
            activeOpacity={0.7}
          >
            {locating ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Locate size={22} color={Colors.primary} strokeWidth={2.5} />
            )}
          </TouchableOpacity>
          
          {/* Centered marker pin overlay */}
          <View style={styles.centerMarkerContainer} pointerEvents="none">
            <View style={styles.centerMarker} />
            <View style={styles.centerMarkerStem} />
          </View>

          {/* Floating Back Button */}
          <TouchableOpacity 
            style={styles.floatingBackButton} 
            onPress={() => {
              console.log('[RegistrationScreen] Map closed without changes.');
              setShowMap(false);
            }}
          >
            <ChevronLeft size={24} color={Colors.text} strokeWidth={2.5} />
          </TouchableOpacity>

          {/* Floating Confirm Location Button */}
          <View style={styles.floatingFooter}>
            <TouchableOpacity 
              style={styles.mapConfirmButton}
              onPress={() => {
                console.log('[RegistrationScreen] Map location confirmed:', tempLatitude, tempLongitude);
                setLatitude(tempLatitude);
                setLongitude(tempLongitude);
                setShowMap(false);
              }}
            >
              <Text style={styles.mapConfirmButtonText}>Confirm Location</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

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
          {/* Back button */}
          {step === 1 ? (
            <TouchableOpacity onPress={() => {
              console.log('[RegistrationScreen] Heading back to login.');
              onBack();
            }} style={styles.backButton}>
              <ChevronLeft size={24} color={Colors.primary} strokeWidth={2.5} />
              <Text style={styles.backText}>Back to Login</Text>
            </TouchableOpacity>
          ) : step <= 4 ? (
            <TouchableOpacity onPress={() => {
              console.log(`[RegistrationScreen] Navigating back from step ${step}`);
              if (step === 3) {
                // Going back from Store Details (Step 3) goes directly to Owner Details (Step 1)
                setStep(1);
              } else {
                setStep(step - 1);
              }
            }} style={styles.backButton}>
              <ChevronLeft size={24} color={Colors.primary} strokeWidth={2.5} />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          ) : null}

          {/* Stepper Progress indicator */}
          {step <= 4 && (
            <View style={styles.stepperContainer}>
              <Text style={styles.stepperText}>Step {step} of 4</Text>
              <View style={styles.stepperBarBg}>
                <View style={[styles.stepperBarFill, { width: `${(step / 4) * 100}%` }]} />
              </View>
            </View>
          )}

          {/* Step 1: Owner Profile Form */}
          {step === 1 && (
            <View style={styles.formSection}>
              <View style={styles.header}>
                <PageTitle>Owner Registration</PageTitle>
                <PageSubtitle>Enter your personal verification details.</PageSubtitle>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter full name"
                  value={fullName}
                  onChangeText={setFullName}
                  placeholderTextColor={Colors.textLight}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter email address"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor={Colors.textLight}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Primary Phone Number (Login Credentials)</Text>
                <View style={styles.phoneInputWrapper}>
                  <Text style={styles.countryCode}>+91</Text>
                  <TextInput
                    style={styles.phoneInput}
                    placeholder="Enter phone number"
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    keyboardType="phone-pad"
                    maxLength={10}
                    placeholderTextColor={Colors.textLight}
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Aadhar Card Number</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter 12-digit Aadhar"
                  value={aadharNumber}
                  onChangeText={setAadharNumber}
                  keyboardType="number-pad"
                  maxLength={12}
                  placeholderTextColor={Colors.textLight}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Upload Aadhar Photo</Text>
                {aadharImage ? (
                  <View style={styles.imagePreviewContainer}>
                    <Image source={{ uri: aadharImage }} style={styles.imagePreview} />
                    <TouchableOpacity 
                      style={styles.removeImageBtn}
                      onPress={() => {
                        console.log('[RegistrationScreen] Clearing picked Aadhar Image.');
                        setAadharImage(null);
                      }}
                    >
                      <Trash2 size={16} color="#fff" />
                      <Text style={styles.removeImageText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity 
                    style={styles.uploadButton} 
                    onPress={() => handleSelectImage('aadhar')}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <ActivityIndicator color={Colors.primary} />
                    ) : (
                      <>
                        <Camera size={28} color={Colors.textLight} style={{ marginBottom: 8 }} />
                        <Text style={styles.uploadText}>Select Aadhar Image</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity 
                style={[styles.nextButton, loading && styles.disabledButton]} 
                onPress={handleNextStep1}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.nextButtonText}>Next: Verify Phone Number</Text>
                    <ChevronRight size={20} color="#fff" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Step 2: OTP Verification Screen (previously Step 4) */}
          {step === 2 && (
            <View style={styles.otpSection}>
              <View style={styles.header}>
                <PageTitle>Verify Number</PageTitle>
                <PageSubtitle>We have sent a verification code to +91 {phoneNumber}</PageSubtitle>
              </View>

              <View style={styles.otpWrapper}>
                <TextInput
                  style={styles.otpInput}
                  placeholder="000000"
                  value={otpCode}
                  onChangeText={setOtpCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholderTextColor={Colors.textLight}
                />
              </View>

              <PrimaryButton
                title={loading ? "Verifying..." : "Verify & Continue"}
                onPress={handleOtpVerify}
                loading={loading}
              />

              <View style={styles.resendRow}>
                {timer > 0 ? (
                  <Text style={styles.resendTimerText}>Resend OTP in {timer}s</Text>
                ) : (
                  <TouchableOpacity onPress={handleResendOtp}>
                    <Text style={styles.resendLinkText}>Resend Code</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => {
                  console.log('[RegistrationScreen] User heading back to step 1 to edit phone.');
                  setStep(1);
                }}>
                  <Text style={styles.changePhoneText}>Change phone number?</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Step 3: Store Details Form (previously Step 2) */}
          {step === 3 && (
            <View style={styles.formSection}>
              <View style={styles.header}>
                <PageTitle>Store Details</PageTitle>
                <PageSubtitle>Configure your store layout and location.</PageSubtitle>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Store Name</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Calicut Fresh Hub"
                  value={storeName}
                  onChangeText={setStoreName}
                  placeholderTextColor={Colors.textLight}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Store Description</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Describe your store offerings"
                  value={storeDescription}
                  onChangeText={setStoreDescription}
                  placeholderTextColor={Colors.textLight}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Store Category</Text>
                <View style={styles.categoryPickerContainer}>
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat.value}
                      style={[
                        styles.categoryBadge,
                        storeCategory === cat.value && styles.activeCategoryBadge
                      ]}
                      onPress={() => setStoreCategory(cat.value)}
                    >
                      <Text style={[
                        styles.categoryBadgeText,
                        storeCategory === cat.value && styles.activeCategoryBadgeText
                      ]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Store Contact Phone</Text>
                <View style={styles.phoneInputWrapper}>
                  <Text style={styles.countryCode}>+91</Text>
                  <TextInput
                    style={styles.phoneInput}
                    placeholder="10-digit store number"
                    value={storePhone}
                    onChangeText={setStorePhone}
                    keyboardType="phone-pad"
                    maxLength={10}
                    placeholderTextColor={Colors.textLight}
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Shop / House Number</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Building 12, Ground Floor"
                  value={houseNumber}
                  onChangeText={setHouseNumber}
                  placeholderTextColor={Colors.textLight}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Address Line (Street/Area)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Beach Road"
                  value={addressLine}
                  onChangeText={setAddressLine}
                  placeholderTextColor={Colors.textLight}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Landmark</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Near Calicut Lighthouse"
                  value={landmark}
                  onChangeText={setLandmark}
                  placeholderTextColor={Colors.textLight}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Pincode</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. 673001"
                  value={pincode}
                  onChangeText={setPincode}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholderTextColor={Colors.textLight}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>City</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Calicut"
                  value={city}
                  onChangeText={setCity}
                  placeholderTextColor={Colors.textLight}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>GST Number (Optional)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter 15-char GSTIN"
                  value={gstNumber}
                  onChangeText={(text) => setGstNumber(text.toUpperCase())}
                  autoCapitalize="characters"
                  maxLength={15}
                  placeholderTextColor={Colors.textLight}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Store Location</Text>
                <TouchableOpacity
                  style={styles.locationSelectorButton}
                  onPress={handleOpenMap}
                >
                  <Text style={styles.locationSelectorText}>
                    {latitude && longitude
                      ? `Selected Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`
                      : "Tap to set store location on map"}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Upload Store Banner Photo</Text>
                {storeImage ? (
                  <View style={styles.imagePreviewContainer}>
                    <Image source={{ uri: storeImage }} style={styles.imagePreview} />
                    <TouchableOpacity 
                      style={styles.removeImageBtn}
                      onPress={() => {
                        console.log('[RegistrationScreen] Clearing store image banner.');
                        setStoreImage(null);
                      }}
                    >
                      <Trash2 size={16} color="#fff" />
                      <Text style={styles.removeImageText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity 
                    style={styles.uploadButton} 
                    onPress={() => handleSelectImage('store')}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <ActivityIndicator color={Colors.primary} />
                    ) : (
                      <>
                        <Camera size={28} color={Colors.textLight} style={{ marginBottom: 8 }} />
                        <Text style={styles.uploadText}>Select Store Banner Photo</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity style={styles.nextButton} onPress={handleNextStepStore}>
                <Text style={styles.nextButtonText}>Next: Bank Onboarding</Text>
                <ChevronRight size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          {/* Step 4: UPI Details Form (previously Step 3) */}
          {step === 4 && (
            <View style={styles.formSection}>
              <View style={styles.header}>
                <PageTitle>Settlement Setup</PageTitle>
                <PageSubtitle>Add your UPI details for automated payouts.</PageSubtitle>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Legal Business / Registered Name</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Name as registered on PAN/GST"
                  value={businessName}
                  onChangeText={setBusinessName}
                  placeholderTextColor={Colors.textLight}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>UPI ID</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter UPI ID (e.g. name@okaxis)"
                  value={upiId}
                  onChangeText={setUpiId}
                  autoCapitalize="none"
                  placeholderTextColor={Colors.textLight}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Upload UPI QR Code Image</Text>
                {upiQrImage ? (
                  <View style={styles.imagePreviewContainer}>
                    <Image source={{ uri: upiQrImage }} style={styles.imagePreview} />
                    <TouchableOpacity 
                      style={styles.removeImageBtn}
                      onPress={() => {
                        console.log('[RegistrationScreen] Clearing picked UPI QR Image.');
                        setUpiQrImage(null);
                      }}
                    >
                      <Trash2 size={16} color="#fff" />
                      <Text style={styles.removeImageText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity 
                    style={styles.uploadButton} 
                    onPress={() => handleSelectImage('qr')}
                    disabled={qrUploading}
                  >
                    {qrUploading ? (
                      <ActivityIndicator color={Colors.primary} />
                    ) : (
                      <>
                        <Camera size={28} color={Colors.textLight} style={{ marginBottom: 8 }} />
                        <Text style={styles.uploadText}>Select UPI QR Code Image</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              <PrimaryButton
                title={loading ? "Submitting Application..." : "Complete Onboarding"}
                onPress={handleFinalSubmit}
                loading={loading}
              />
            </View>
          )}
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
    paddingHorizontal: 25,
    paddingTop: 30,
    paddingBottom: 40,
    flexGrow: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginLeft: -5,
  },
  backText: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: Colors.primary,
    marginLeft: 4,
  },
  stepperContainer: {
    marginBottom: 30,
  },
  stepperText: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    color: Colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  stepperBarBg: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  stepperBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  formSection: {
    flex: 1,
  },
  otpSection: {
    flex: 1,
    paddingTop: 30,
  },
  header: {
    marginBottom: 30,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 15,
    paddingHorizontal: 15,
    height: 56,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.text,
    backgroundColor: Colors.white,
  },
  phoneInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 15,
    paddingHorizontal: 15,
    height: 56,
    backgroundColor: Colors.white,
  },
  countryCode: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: Colors.text,
    marginRight: 10,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    paddingRight: 10,
  },
  phoneInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.text,
  },
  uploadButton: {
    height: 120,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  uploadText: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: Colors.textLight,
  },
  imagePreviewContainer: {
    width: '100%',
    height: 180,
    borderRadius: 15,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  removeImageText: {
    color: '#fff',
    fontSize: 10.5,
    fontFamily: Fonts.medium,
    marginLeft: 6,
  },
  nextButton: {
    backgroundColor: Colors.primary,
    height: 56,
    borderRadius: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    gap: 6,
  },
  disabledButton: {
    opacity: 0.7,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: Fonts.bold,
  },
  categoryPickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryBadge: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  activeCategoryBadge: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
  },
  activeCategoryBadgeText: {
    color: '#fff',
    fontFamily: Fonts.bold,
  },
  otpWrapper: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 15,
    height: 60,
    marginBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
  otpInput: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: Colors.text,
    letterSpacing: 8,
    textAlign: 'center',
    width: '100%',
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingHorizontal: 4,
  },
  resendTimerText: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: Colors.textLight,
  },
  resendLinkText: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: Colors.primary,
  },
  changePhoneText: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: Colors.secondary,
  },
  mapSafeArea: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  mapWrapper: {
    flex: 1,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
  floatingBackButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  floatingLocateButton: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 110 : 90,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  floatingFooter: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 20,
    left: 20,
    right: 20,
    backgroundColor: 'transparent',
  },
  mapConfirmButton: {
    height: 50,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapConfirmButtonText: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: Colors.white,
  },
  centerMarkerContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -15,
    marginTop: -30,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  centerMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.primary,
    borderWidth: 3,
    borderColor: 'white',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  centerMarkerStem: {
    width: 2,
    height: 10,
    backgroundColor: Colors.primary,
    marginTop: -1,
  },
  locationSelectorButton: {
    height: 50,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 15,
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  locationSelectorText: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.primary,
  },
});

export default RegistrationScreen;
