import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Switch,
  Platform,
  Dimensions,
} from 'react-native';
import { X, Camera, Trash2, MapPin, ChevronLeft } from 'lucide-react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { launchImageLibrary } from 'react-native-image-picker';
import axios from 'axios';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/typography';
import { Alertt } from './Alertt';
import { API_BASE_URL } from '../config/api';
import { storage } from '../utils/storage';

const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dubgo0vue/image/upload";
const UPLOAD_PRESET = "freshrun_preset";

const CATEGORIES = [
  { label: 'Restaurants', value: 'restaurants' },
  { label: 'Street Food', value: 'street-food' },
  { label: 'Groceries', value: 'groceries' },
  { label: 'Chicken', value: 'chicken' },
  { label: 'Fish', value: 'fish' },
  { label: 'Medicine', value: 'medicine' }
];

interface CreateStoreModalProps {
  visible: boolean;
  onClose: () => void;
  userData: any;
  onSuccess: () => Promise<void>;
}

export const CreateStoreModal: React.FC<CreateStoreModalProps> = ({
  visible,
  onClose,
  userData,
  onSuccess,
}) => {
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
  const [latitude, setLatitude] = useState(11.2588);
  const [longitude, setLongitude] = useState(75.7804);

  // Settlement
  const [upiId, setUpiId] = useState('');
  const [upiQrImage, setUpiQrImage] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState('');

  // Map Selection
  const [showMap, setShowMap] = useState(false);
  const [tempLatitude, setTempLatitude] = useState(11.2588);
  const [tempLongitude, setTempLongitude] = useState(75.7804);

  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingQr, setUploadingQr] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setStoreName('');
      setStoreDescription('');
      setStoreCategory(CATEGORIES[0].value);
      setStorePhone('');
      setStoreImage(null);
      setHouseNumber('');
      setAddressLine('');
      setLandmark('');
      setPincode('');
      setCity('Calicut');
      setGstNumber('');
      setLatitude(11.2588);
      setLongitude(75.7804);
      setUpiId('');
      setUpiQrImage(null);
      setBusinessName(userData?.fullName || '');
    }
  }, [visible, userData]);

  const handleSelectImage = async (type: 'store' | 'qr') => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.7,
    });

    if (result.didCancel) return;

    if (result.assets && result.assets[0].uri) {
      uploadToCloudinary(result.assets[0], type);
    }
  };

  const uploadToCloudinary = async (asset: any, type: 'store' | 'qr') => {
    if (type === 'store') setUploadingImage(true);
    else setUploadingQr(true);

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
        if (type === 'store') setStoreImage(resData.secure_url);
        else setUpiQrImage(resData.secure_url);
      }
    } catch (error) {
      console.error('Image upload failed:', error);
      Alertt.alert('Upload Failed', 'Could not upload image. Please try again.');
    } finally {
      if (type === 'store') setUploadingImage(false);
      else setUploadingQr(false);
    }
  };

  const handleOpenMap = () => {
    setTempLatitude(latitude);
    setTempLongitude(longitude);
    setShowMap(true);
  };

  const handleRegisterStore = async () => {
    // Validation
    if (!storeName.trim() || !storePhone.trim() || !houseNumber.trim() || !addressLine.trim() || !pincode.trim() || !city.trim() || !storeImage) {
      Alertt.alert('Required Info', 'Please fill in all store details and select store banner image.');
      return;
    }
    if (storePhone.length !== 10) {
      Alertt.alert('Invalid Phone', 'Store phone number must be 10 digits.');
      return;
    }
    if (!upiId.trim() || !upiQrImage || !businessName.trim()) {
      Alertt.alert('Required Info', 'Please fill in all UPI/Settlement fields.');
      return;
    }
    if (!upiId.includes('@')) {
      Alertt.alert('Invalid UPI ID', 'UPI ID must contain @ symbol.');
      return;
    }

    setSaving(true);
    try {
      const idToken = storage.getString('userToken');
      if (!idToken) throw new Error('Owner session expired. Please log in again.');

      // 1. Submit Store Payload
      const registerPayload = {
        storeName: storeName.trim(),
        description: storeDescription.trim(),
        category: storeCategory,
        imageUrl: storeImage,
        storePhone1: storePhone.trim(),
        storeHouseNumber: houseNumber.trim(),
        storeAddressLine: addressLine.trim(),
        storeLandmark: landmark.trim(),
        storePincode: pincode.trim(),
        storeCity: city.trim(),
        latitude: latitude,
        longitude: longitude,
        ownerFullName: userData.fullName,
        ownerEmail: userData.email,
        ownerPhone1: userData.phone,
        ownerAadharNumber: userData.aadharNumber || '123456789012',
        ownerAadharImage: userData.aadharImage || 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
        gstNumber: gstNumber.trim() || null,
        approvalStatus: 'approved' // Automatically approve additional stores if owner profile is already approved!
      };

      const storeResponse = await axios.post(`${API_BASE_URL}/stores`, registerPayload);
      
      if (storeResponse.data.success) {
        const storeData = storeResponse.data.data;

        // 2. Perform Payment Onboarding for new store
        const onboardPayload = {
          role: 'owner',
          storeId: storeData.id,
          upiId: upiId.trim(),
          upiQrImage: upiQrImage,
          name: userData.fullName,
          email: userData.email,
          phone: userData.phone,
          businessName: businessName.trim()
        };

        const onboardResponse = await axios.post(
          `${API_BASE_URL}/payments/onboard`,
          onboardPayload,
          { headers: { Authorization: `Bearer ${idToken}` } }
        );

        if (onboardResponse.data.success) {
          Alertt.alert('Success', 'New store created and configured successfully!');
          await onSuccess();
          onClose();
        } else {
          throw new Error('Store created but settlement setup failed.');
        }
      } else {
        throw new Error('Failed to create store record.');
      }
    } catch (err: any) {
      console.error('New Store Register failed:', err);
      Alertt.alert('Creation Failed', err.response?.data?.error || err.message || 'Store registration failed.');
    } finally {
      setSaving(false);
    }
  };

  if (showMap) {
    return (
      <Modal visible={showMap} animationType="fade">
        <View style={styles.mapWrapper}>
          <MapView
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
          
          <View style={styles.centerMarkerContainer} pointerEvents="none">
            <View style={styles.centerMarker} />
            <View style={styles.centerMarkerStem} />
          </View>

          <TouchableOpacity 
            style={styles.floatingBackButton} 
            onPress={() => setShowMap(false)}
          >
            <ChevronLeft size={24} color={Colors.text} strokeWidth={2.5} />
          </TouchableOpacity>

          <View style={styles.floatingFooter}>
            <TouchableOpacity 
              style={styles.mapConfirmButton}
              onPress={() => {
                setLatitude(tempLatitude);
                setLongitude(tempLongitude);
                setShowMap(false);
              }}
            >
              <Text style={styles.mapConfirmButtonText}>Confirm Location</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Register New Store</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={22} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.sectionHeader}>1. Store Details</Text>

            {/* Store Image Upload */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Store Banner Image *</Text>
              {storeImage ? (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: storeImage }} style={styles.imagePreview} />
                  <TouchableOpacity
                    style={styles.removeImageBtn}
                    onPress={() => setStoreImage(null)}
                  >
                    <Trash2 size={16} color={Colors.white} />
                    <Text style={styles.removeImageText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={() => handleSelectImage('store')}
                  disabled={uploadingImage}
                >
                  {uploadingImage ? (
                    <ActivityIndicator color={Colors.primary} />
                  ) : (
                    <>
                      <Camera size={26} color={Colors.textLight} style={{ marginBottom: 6 }} />
                      <Text style={styles.uploadText}>Select Store Photo</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Store Name */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Store Name *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Milan Organic Store"
                value={storeName}
                onChangeText={setStoreName}
                placeholderTextColor={Colors.textLight}
              />
            </View>

            {/* Description */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Short description of store specialties"
                value={storeDescription}
                onChangeText={setStoreDescription}
                placeholderTextColor={Colors.textLight}
              />
            </View>

            {/* Category selection */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Store Category *</Text>
              <View style={styles.categoryBadgeContainer}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.value}
                    style={[
                      styles.categoryBadge,
                      storeCategory === cat.value && styles.activeCategoryBadge,
                    ]}
                    onPress={() => setStoreCategory(cat.value)}
                  >
                    <Text
                      style={[
                        styles.categoryBadgeText,
                        storeCategory === cat.value && styles.activeCategoryBadgeText,
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Store Phone */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Store Contact Phone *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="10-digit number"
                value={storePhone}
                onChangeText={setStorePhone}
                keyboardType="numeric"
                maxLength={10}
                placeholderTextColor={Colors.textLight}
              />
            </View>

            {/* Address Details */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Shop / House Number *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Shop 24, Ground Floor"
                value={houseNumber}
                onChangeText={setHouseNumber}
                placeholderTextColor={Colors.textLight}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Street Address *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Cyberpark Road"
                value={addressLine}
                onChangeText={setAddressLine}
                placeholderTextColor={Colors.textLight}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Landmark</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Opposite UL Cyberpark"
                value={landmark}
                onChangeText={setLandmark}
                placeholderTextColor={Colors.textLight}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputContainer, { flex: 1 }]}>
                <Text style={styles.label}>Pincode *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. 673016"
                  value={pincode}
                  onChangeText={setPincode}
                  keyboardType="numeric"
                  maxLength={6}
                  placeholderTextColor={Colors.textLight}
                />
              </View>
              <View style={[styles.inputContainer, { flex: 1 }]}>
                <Text style={styles.label}>City *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Calicut"
                  value={city}
                  onChangeText={setCity}
                  placeholderTextColor={Colors.textLight}
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>GST Number (Optional)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="15-character GSTIN"
                value={gstNumber}
                onChangeText={(t) => setGstNumber(t.toUpperCase())}
                maxLength={15}
                placeholderTextColor={Colors.textLight}
              />
            </View>

            {/* Map Selection */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Store Location Coordinates *</Text>
              <TouchableOpacity style={styles.locationSelector} onPress={handleOpenMap}>
                <MapPin size={20} color={Colors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.locationSelectorText}>
                  {`Coordinates: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />
            <Text style={styles.sectionHeader}>2. Settlement Details</Text>

            {/* UPI ID */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Settlement UPI ID *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. storename@okaxis"
                value={upiId}
                onChangeText={setUpiId}
                autoCapitalize="none"
                placeholderTextColor={Colors.textLight}
              />
            </View>

            {/* Business/Registered Name */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Registered Business Name *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Name associated with bank account"
                value={businessName}
                onChangeText={setBusinessName}
                placeholderTextColor={Colors.textLight}
              />
            </View>

            {/* UPI QR Image Upload */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Upload Settlement UPI QR Code *</Text>
              {upiQrImage ? (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: upiQrImage }} style={styles.imagePreview} />
                  <TouchableOpacity
                    style={styles.removeImageBtn}
                    onPress={() => setUpiQrImage(null)}
                  >
                    <Trash2 size={16} color={Colors.white} />
                    <Text style={styles.removeImageText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={() => handleSelectImage('qr')}
                  disabled={uploadingQr}
                >
                  {uploadingQr ? (
                    <ActivityIndicator color={Colors.primary} />
                  ) : (
                    <>
                      <Camera size={26} color={Colors.textLight} style={{ marginBottom: 6 }} />
                      <Text style={styles.uploadText}>Select UPI QR Image</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Register Store Action Button */}
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.disabledBtn]}
              onPress={handleRegisterStore}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.saveBtnText}>Submit Store for Approval</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    maxHeight: '90%',
    minHeight: '60%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 25,
    paddingVertical: 20,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  closeBtn: {
    padding: 4,
  },
  scrollContainer: {
    padding: 25,
    paddingBottom: 50,
  },
  sectionHeader: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: Colors.primaryDark,
    marginBottom: 16,
    marginTop: 8,
  },
  inputContainer: {
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  label: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: Colors.white,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: Colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 20,
  },
  categoryBadgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  categoryBadge: {
    backgroundColor: Colors.white,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  activeCategoryBadge: {
    backgroundColor: Colors.primaryLight + '30',
    borderColor: Colors.primary,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: Colors.textSecondary,
  },
  activeCategoryBadgeText: {
    color: Colors.primaryDark,
    fontFamily: Fonts.bold,
  },
  locationSelector: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  locationSelectorText: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: Colors.text,
  },
  uploadButton: {
    backgroundColor: Colors.white,
    height: 100,
    borderRadius: 15,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.textLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadText: {
    fontSize: 11.5,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
  },
  imagePreviewContainer: {
    position: 'relative',
    height: 140,
    borderRadius: 15,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  removeImageBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 4,
  },
  removeImageText: {
    color: Colors.white,
    fontSize: 10.5,
    fontFamily: Fonts.bold,
  },
  saveBtn: {
    backgroundColor: '#000000', // Matches Black pill style of customer/delivery apps
    height: 60,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  saveBtnText: {
    color: Colors.white,
    fontSize: 14,
    fontFamily: Fonts.black,
    fontWeight: '900',
  },
  disabledBtn: {
    opacity: 0.7,
  },
  // Map Styling
  mapWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  map: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  centerMarkerContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -12,
    marginTop: -36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    borderWidth: 3,
    borderColor: Colors.white,
    elevation: 4,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  centerMarkerStem: {
    width: 4,
    height: 12,
    backgroundColor: Colors.primary,
  },
  floatingBackButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 20,
    backgroundColor: Colors.white,
    padding: 10,
    borderRadius: 12,
    elevation: 4,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  floatingFooter: {
    position: 'absolute',
    bottom: 30,
    width: '100%',
    paddingHorizontal: 25,
  },
  mapConfirmButton: {
    backgroundColor: Colors.primary,
    height: 56,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  mapConfirmButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontFamily: Fonts.bold,
  },
});
