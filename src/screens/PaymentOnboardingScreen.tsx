import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, User, Info, Camera, Trash2 } from 'lucide-react-native';
import axios from 'axios';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/typography';
import { storage } from '../utils/storage';
import { Alertt } from '../components/Alertt';
import { API_BASE_URL } from '../config/api';
import { PageTitle, PageSubtitle } from '../components/Typography';
import { PrimaryButton } from '../components/Button';
import { launchImageLibrary } from 'react-native-image-picker';

const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dubgo0vue/image/upload";
const UPLOAD_PRESET = "freshrun_preset";

interface PaymentOnboardingScreenProps {
  onBack: () => void;
  onSuccess: () => void;
  userData: any;
  storeData: any;
}

const PaymentOnboardingScreen: React.FC<PaymentOnboardingScreenProps> = ({ 
  onBack, 
  onSuccess, 
  userData, 
  storeData 
}) => {
  const [upiId, setUpiId] = useState('');
  const [upiQrImage, setUpiQrImage] = useState<string | null>(null);
  const [qrUploading, setQrUploading] = useState(false);
  const [businessName, setBusinessName] = useState(storeData?.name || '');
  const [loading, setLoading] = useState(false);

  const handleSelectQrImage = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.7,
    });
    if (result.assets && result.assets[0].uri) {
      uploadQrToCloudinary(result.assets[0]);
    }
  };

  const uploadQrToCloudinary = async (asset: any) => {
    setQrUploading(true);
    try {
      const data = new FormData();
      data.append('file', {
        uri: asset.uri,
        type: asset.type || 'image/jpeg',
        name: asset.fileName || 'upload.jpg',
      } as any);
      data.append('upload_preset', UPLOAD_PRESET);

      console.log('Uploading QR code to Cloudinary:', CLOUDINARY_URL);
      const response = await fetch(CLOUDINARY_URL, {
        method: 'POST',
        body: data,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Cloudinary status: ${response.status} - ${errText}`);
      }

      const resData = await response.json();

      if (resData.secure_url) {
        setUpiQrImage(resData.secure_url);
      }
    } catch (error: any) {
      console.error('[CloudinaryUpload QR] error:', error.message || error);
      Alertt.alert('Upload Failed', 'Could not upload image. Please try again.');
    } finally {
      setQrUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!upiId.trim() || !upiQrImage || !businessName.trim()) {
      Alertt.alert('Error', 'Please fill in all UPI details and registered name.');
      return;
    }

    if (!upiId.includes('@')) {
      Alertt.alert('Error', 'Please enter a valid UPI ID (e.g. name@okaxis)');
      return;
    }

    setLoading(true);
    try {
      const token = storage.getString('userToken');
      
      const response = await axios.post(`${API_BASE_URL}/payments/onboard`, {
        role: 'owner',
        storeId: storeData.id,
        upiId,
        upiQrImage,
        name: userData.fullName || userData.full_name,
        email: userData.email,
        phone: userData.phone,
        businessName: businessName
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        Alertt.alert('Success', 'UPI payment details submitted successfully!');
        onSuccess();
      }
    } catch (error: any) {
      console.error('Owner Onboarding Error:', error);
      Alertt.alert('Error', error.response?.data?.error || 'Failed to submit onboarding details.');
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
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <ChevronLeft size={24} color={Colors.primary} strokeWidth={2.5} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <PageTitle>Payment Connection</PageTitle>
            <PageSubtitle>
              Set up your settlements to receive store earnings directly via UPI.
            </PageSubtitle>
          </View>

          <View style={styles.inputSection}>
            {/* Legal Business Name */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Legal Business / Store Name</Text>
              <View style={styles.inputWrapper}>
                <User size={20} color={Colors.textLight} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Legal Name (for GST/Bank)"
                  value={businessName}
                  onChangeText={setBusinessName}
                  placeholderTextColor={Colors.textLight}
                />
              </View>
            </View>

            {/* UPI ID */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>UPI ID</Text>
              <View style={styles.inputWrapper}>
                <User size={20} color={Colors.textLight} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter UPI ID (e.g. name@okicici)"
                  value={upiId}
                  onChangeText={setUpiId}
                  autoCapitalize="none"
                  placeholderTextColor={Colors.textLight}
                />
              </View>
            </View>

            {/* UPI QR Code Image */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>UPI QR Code Image</Text>
              {upiQrImage ? (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: upiQrImage }} style={styles.imagePreview} />
                  <TouchableOpacity 
                    style={styles.removeImageBtn} 
                    onPress={() => setUpiQrImage(null)}
                  >
                    <Trash2 size={16} color="#fff" />
                    <Text style={styles.removeImageText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity 
                  style={styles.uploadButton} 
                  onPress={handleSelectQrImage}
                  disabled={qrUploading}
                >
                  {qrUploading ? (
                    <ActivityIndicator color={Colors.primary} />
                  ) : (
                    <>
                      <Camera size={24} color={Colors.primary} style={{ marginBottom: 8 }} />
                      <Text style={styles.uploadText}>Upload UPI QR Code Image</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Info Card */}
            <View style={styles.infoCard}>
              <View style={styles.infoHeader}>
                <Info size={20} color={Colors.secondary} />
                <Text style={styles.infoTitle}>Verification Note</Text>
              </View>
              <Text style={styles.infoDescription}>
                All order amounts will be split and settled to this UPI address. Ensure your QR code is clear and matches the UPI ID.
              </Text>
            </View>
          </View>

          <PrimaryButton 
            title={loading ? "Submitting..." : "Submit Details"}
            onPress={handleSubmit}
            loading={loading}
          />
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
  header: {
    marginBottom: 25,
  },
  inputSection: {
    marginBottom: 25,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 15,
    paddingHorizontal: 15,
    height: 56,
    backgroundColor: Colors.white,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.text,
  },
  infoCard: {
    backgroundColor: Colors.background,
    borderRadius: 15,
    padding: 18,
    marginTop: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoTitle: {
    fontSize: 13.5,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginLeft: 8,
  },
  infoDescription: {
    fontSize: 11.5,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    lineHeight: 18,
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
    resizeMode: 'contain',
    backgroundColor: '#f8fafc',
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
});

export default PaymentOnboardingScreen;
