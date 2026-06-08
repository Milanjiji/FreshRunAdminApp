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
  Image,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Alertt } from '../components/Alertt';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, ChevronLeft, Trash2, ChevronRight } from 'lucide-react-native';
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

const CATEGORIES = [
  { label: 'Grocery', value: 'grocery' },
  { label: 'Fruits & Vegetables', value: 'fruits_veg' },
  { label: 'Meat & Fish', value: 'meat_fish' },
  { label: 'Bakery & Sweets', value: 'bakery' },
  { label: 'Beverages', value: 'beverages' },
  { label: 'Household Items', value: 'household' }
];

const RegistrationScreen: React.FC<RegistrationScreenProps> = ({ onBack, onRegisterSuccess }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // --- Step 1: Owner Details ---
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [aadharNumber, setAadharNumber] = useState('');
  const [aadharImage, setAadharImage] = useState<string | null>(null);

  // --- Step 2: Store Details ---
  const [storeName, setStoreName] = useState('');
  const [storeDescription, setStoreDescription] = useState('');
  const [storeCategory, setStoreCategory] = useState(CATEGORIES[0].value);
  const [storePhone, setStorePhone] = useState('');
  const [storeImage, setStoreImage] = useState<string | null>(null);
  const [houseNumber, setHouseNumber] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [landmark, setLandmark] = useState('');
  const [pincode, setPincode] = useState('');
  const [city, setCity] = useState('Calicut');
  const [gstNumber, setGstNumber] = useState('');

  // --- Step 3: Bank Details ---
  const [bankAccount, setBankAccount] = useState('');
  const [confirmBankAccount, setConfirmBankAccount] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [panCard, setPanCard] = useState('');
  const [businessName, setBusinessName] = useState('');

  // --- Step 4: OTP Verification ---
  const [confirm, setConfirm] = useState<FirebaseAuthTypes.ConfirmationResult | null>(null);
  const [otpCode, setOtpCode] = useState('');
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

  // Handle image pick & upload to Cloudinary
  const handleSelectImage = async (type: 'aadhar' | 'store') => {
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

  const uploadToCloudinary = async (asset: any, type: 'aadhar' | 'store') => {
    setUploading(true);
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
          Alertt.alert('Success', 'Aadhar Card photo uploaded!');
        } else {
          setStoreImage(resData.secure_url);
          Alertt.alert('Success', 'Store banner photo uploaded!');
        }
      }
    } catch (error: any) {
      console.error('[RegistrationScreen] [Error] Cloudinary upload failed:', error);
      Alertt.alert('Upload Failed', 'Could not upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // Step 1 Validation & Owner Check (Case D)
  const handleNextStep1 = async () => {
    console.log('[RegistrationScreen] [Step 1 Validate] Full Name:', fullName, 'Email:', email, 'Phone:', phoneNumber, 'Aadhar:', aadharNumber);
    
    if (!fullName.trim() || !email.trim() || !phoneNumber.trim() || !aadharNumber.trim() || !aadharImage) {
      console.warn('[RegistrationScreen] Step 1 validation failed: Empty fields');
      Alertt.alert('Error', 'Please fill in all owner fields and upload Aadhar.');
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
      
      console.log('[RegistrationScreen] Phone number available. Transitioning to Step 2 (Store details)...');
      setStep(2);
    } catch (error: any) {
      console.error('[RegistrationScreen] [Error] Step 1 verification failed:', error);
      Alertt.alert('Error', 'Validation check failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2 Validation
  const handleNextStep2 = () => {
    console.log('[RegistrationScreen] [Step 2 Validate] Store Name:', storeName, 'Phone:', storePhone, 'Address:', houseNumber, addressLine, pincode, city, 'GST:', gstNumber);
    
    if (!storeName.trim() || !storePhone.trim() || !houseNumber.trim() || !addressLine.trim() || !pincode.trim() || !city.trim() || !storeImage) {
      console.warn('[RegistrationScreen] Step 2 validation failed: Missing fields.');
      Alertt.alert('Error', 'Please fill in all store details and upload store image.');
      return;
    }
    if (storePhone.length !== 10) {
      console.warn('[RegistrationScreen] Step 2 validation failed: Store phone is not 10 digits.');
      Alertt.alert('Error', 'Store phone number must be 10 digits.');
      return;
    }
    if (gstNumber.trim() && gstNumber.trim().length !== 15) {
      console.warn('[RegistrationScreen] Step 2 validation failed: GST is not 15 characters.');
      Alertt.alert('Error', 'GST Number must be 15 characters.');
      return;
    }

    // Default business name to store name
    if (!businessName) {
      setBusinessName(storeName);
    }
    
    console.log('[RegistrationScreen] Store details valid. Transitioning to Step 3 (Bank details)...');
    setStep(3);
  };

  // Step 3 Validation & Sending OTP (Stage 1, Step 4)
  const handleNextStep3 = async () => {
    console.log('[RegistrationScreen] [Step 3 Validate] Bank Account:', bankAccount, 'IFSC:', ifscCode, 'PAN:', panCard, 'Business Name:', businessName);
    
    if (!bankAccount.trim() || !confirmBankAccount.trim() || !ifscCode.trim() || !panCard.trim() || !businessName.trim()) {
      console.warn('[RegistrationScreen] Step 3 validation failed: Missing fields.');
      Alertt.alert('Error', 'Please fill in all bank account details.');
      return;
    }
    if (bankAccount !== confirmBankAccount) {
      console.warn('[RegistrationScreen] Step 3 validation failed: Account numbers mismatch.');
      Alertt.alert('Error', 'Account numbers do not match.');
      return;
    }
    if (ifscCode.length !== 11) {
      console.warn('[RegistrationScreen] Step 3 validation failed: IFSC is not 11 chars.');
      Alertt.alert('Error', 'IFSC Code must be 11 characters.');
      return;
    }
    if (panCard.length !== 10) {
      console.warn('[RegistrationScreen] Step 3 validation failed: PAN is not 10 chars.');
      Alertt.alert('Error', 'PAN Card number must be 10 characters.');
      return;
    }

    setLoading(true);
    try {
      const formattedPhone = `+91${phoneNumber}`;
      console.log('[RegistrationScreen] [Step 3 Complete] Forms valid. Sending Firebase OTP to confirm phone identity:', formattedPhone);
      const confirmation = await auth().signInWithPhoneNumber(formattedPhone);
      
      console.log('[RegistrationScreen] Firebase OTP sent successfully. Advancing to OTP verification step.');
      setConfirm(confirmation);
      setTimer(30);
      setStep(4);
      Alertt.alert('Verification Sent', 'Please enter the 6-digit verification code.');
    } catch (error: any) {
      console.error('[RegistrationScreen] [Error] Failed to send OTP for registration:', error);
      Alertt.alert('Error', error.message || 'Failed to send verification code.');
    } finally {
      setLoading(false);
    }
  };

  // Step 4 Verification & Submission
  const handleFinalSubmit = async () => {
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
        latitude: 11.2588, // Mock Calicut coordinates default
        longitude: 75.7804,
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
          bankDetails: {
            accountNumber: bankAccount,
            ifscCode
          },
          pan: panCard,
          name: fullName,
          email,
          phone: phoneNumber,
          businessName
        };

        console.log('[RegistrationScreen] Submitting onboarding bank info to backend POST /payments/onboard. Payload:', onboardPayload);
        const onboardResponse = await axios.post(
          `${API_BASE_URL}/payments/onboard`,
          onboardPayload,
          { headers: { Authorization: `Bearer ${idToken}` } }
        );
        console.log('[RegistrationScreen] Razorpay onboarding response:', onboardResponse.data);

        if (onboardResponse.data.success) {
          Alertt.alert('Success', 'Store registration submitted successfully! We are reviewing your documents.');
          
          console.log('[RegistrationScreen] Fetching freshly registered user profile from backend...');
          const profileResponse = await axios.get(`${API_BASE_URL}/user/profile`, {
            headers: { Authorization: `Bearer ${idToken}` }
          });
          console.log('[RegistrationScreen] Fetch profile response:', profileResponse.data);

          if (profileResponse.data.success && profileResponse.data.user) {
            console.log('[RegistrationScreen] [Registration Completed] Updating local session keys and dispatching success handler.');
            storage.setItem('userToken', idToken);
            storage.setItem('userData', profileResponse.data.user);
            storage.setItem('storeData', storeData);
            
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
          ) : step < 4 ? (
            <TouchableOpacity onPress={() => {
              console.log(`[RegistrationScreen] Navigating back from step ${step} to ${step - 1}`);
              setStep(step - 1);
            }} style={styles.backButton}>
              <ChevronLeft size={24} color={Colors.primary} strokeWidth={2.5} />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          ) : null}

          {/* Stepper Progress indicator */}
          {step < 4 && (
            <View style={styles.stepperContainer}>
              <Text style={styles.stepperText}>Step {step} of 3</Text>
              <View style={styles.stepperBarBg}>
                <View style={[styles.stepperBarFill, { width: `${(step / 3) * 100}%` }]} />
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
                    <Text style={styles.nextButtonText}>Next: Store Details</Text>
                    <ChevronRight size={20} color="#fff" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Step 2: Store Details Form */}
          {step === 2 && (
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
                  placeholder="e.g. Fresh organic fruits and daily essentials"
                  value={storeDescription}
                  onChangeText={setStoreDescription}
                  placeholderTextColor={Colors.textLight}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Store Category</Text>
                <View style={styles.categoryPickerContainer}>
                  {CATEGORIES.map((cat) => (
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

              <TouchableOpacity style={styles.nextButton} onPress={handleNextStep2}>
                <Text style={styles.nextButtonText}>Next: Bank Onboarding</Text>
                <ChevronRight size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          {/* Step 3: Bank Details Form */}
          {step === 3 && (
            <View style={styles.formSection}>
              <View style={styles.header}>
                <PageTitle>Settlement Setup</PageTitle>
                <PageSubtitle>Add bank credentials to split payouts via Razorpay Route.</PageSubtitle>
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
                <Text style={styles.label}>Bank Account Number</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter bank account number"
                  value={bankAccount}
                  onChangeText={setBankAccount}
                  keyboardType="number-pad"
                  placeholderTextColor={Colors.textLight}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Confirm Bank Account Number</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Re-enter bank account number"
                  value={confirmBankAccount}
                  onChangeText={setConfirmBankAccount}
                  keyboardType="number-pad"
                  placeholderTextColor={Colors.textLight}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>IFSC Code</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. HDFC0000123"
                  value={ifscCode}
                  onChangeText={(text) => setIfscCode(text.toUpperCase())}
                  autoCapitalize="characters"
                  maxLength={11}
                  placeholderTextColor={Colors.textLight}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>PAN Card Number</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter 10-char PAN"
                  value={panCard}
                  onChangeText={(text) => setPanCard(text.toUpperCase())}
                  autoCapitalize="characters"
                  maxLength={10}
                  placeholderTextColor={Colors.textLight}
                />
              </View>

              <PrimaryButton
                title={loading ? "Initiating Verification..." : "Submit & Verify Phone"}
                onPress={handleNextStep3}
                loading={loading}
              />
            </View>
          )}

          {/* Step 4: OTP Verification Screen */}
          {step === 4 && (
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
                title={loading ? "Submitting..." : "Verify & Complete Onboarding"}
                onPress={handleFinalSubmit}
                loading={loading}
              />

              <View style={styles.resendRow}>
                {timer > 0 ? (
                  <Text style={styles.resendTimerText}>Resend OTP in {timer}s</Text>
                ) : (
                  <TouchableOpacity onPress={() => {
                    console.log('[RegistrationScreen] User requested OTP resend.');
                    handleNextStep3();
                  }}>
                    <Text style={styles.resendLinkText}>Resend Code</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => {
                  console.log('[RegistrationScreen] User heading back to step 3 to edit details.');
                  setStep(3);
                }}>
                  <Text style={styles.changePhoneText}>Change Account details?</Text>
                </TouchableOpacity>
              </View>
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
    fontSize: 16,
    fontFamily: Fonts.medium,
    color: Colors.primary,
    marginLeft: 4,
  },
  stepperContainer: {
    marginBottom: 30,
  },
  stepperText: {
    fontSize: 13,
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
    fontSize: 14,
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
    fontSize: 16,
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
    fontSize: 16,
    fontFamily: Fonts.medium,
    color: Colors.text,
    marginRight: 10,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    paddingRight: 10,
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
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
    fontSize: 14,
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
    fontSize: 12,
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
    fontSize: 16,
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
    fontSize: 14,
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
    fontSize: 24,
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
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: Colors.textLight,
  },
  resendLinkText: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: Colors.primary,
  },
  changePhoneText: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: Colors.secondary,
  },
});

export default RegistrationScreen;
