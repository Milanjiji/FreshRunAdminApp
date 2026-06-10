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
} from 'react-native';
import { X, Camera, Trash2 } from 'lucide-react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/typography';
import { Alertt } from './Alertt';

const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dubgo0vue/image/upload";
const UPLOAD_PRESET = "freshrun_preset";

const COMMON_CATEGORIES = [
  'Beverages',
  'Starters',
  'Main Course',
  'Desserts',
  'Vegetables',
  'Fruits',
  'Groceries',
  'Meats',
  'Fish',
  'Bakery',
  'Snacks',
  'Others'
];

interface AddEditProductModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (productData: any) => Promise<void>;
  product?: any; // If editing
}

export const AddEditProductModal: React.FC<AddEditProductModalProps> = ({
  visible,
  onClose,
  onSave,
  product,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [discountPercent, setDiscountPercent] = useState('0');
  const [stockQuantity, setStockQuantity] = useState('100');
  const [category, setCategory] = useState(COMMON_CATEGORIES[0]);
  const [isVeg, setIsVeg] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) {
      setName(product.name || '');
      setDescription(product.description || '');
      setPrice(String(product.price || ''));
      setDiscountPercent(String(product.discount_percent || '0'));
      setStockQuantity(String(product.stock_quantity || '100'));
      setCategory(product.category || COMMON_CATEGORIES[0]);
      setIsVeg(product.is_veg !== undefined ? product.is_veg : true);
      setImageUrl(product.image_url || null);
    } else {
      setName('');
      setDescription('');
      setPrice('');
      setDiscountPercent('0');
      setStockQuantity('100');
      setCategory(COMMON_CATEGORIES[0]);
      setIsVeg(true);
      setImageUrl(null);
    }
  }, [product, visible]);

  const handleSelectImage = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.7,
    });

    if (result.didCancel) return;

    if (result.assets && result.assets[0].uri) {
      uploadToCloudinary(result.assets[0]);
    }
  };

  const uploadToCloudinary = async (asset: any) => {
    setUploading(true);
    try {
      const data = new FormData();
      data.append('file', {
        uri: asset.uri,
        type: asset.type || 'image/jpeg',
        name: asset.fileName || 'product.jpg',
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
        setImageUrl(resData.secure_url);
      }
    } catch (error) {
      console.error('Image upload failed:', error);
      Alertt.alert('Upload Failed', 'Could not upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alertt.alert('Required Info', 'Please enter a product name.');
      return;
    }
    if (!price.trim() || isNaN(Number(price)) || Number(price) <= 0) {
      Alertt.alert('Invalid Price', 'Please enter a valid positive price.');
      return;
    }
    if (!category.trim()) {
      Alertt.alert('Required Info', 'Please select a product category.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        price: Number(price),
        discountPercent: Number(discountPercent),
        stockQuantity: Number(stockQuantity),
        category: category,
        isVeg: isVeg,
        imageUrl: imageUrl,
      };

      await onSave(payload);
      onClose();
    } catch (err: any) {
      Alertt.alert('Error', err.message || 'Failed to save product.');
    } finally {
      setSaving(false);
    }
  };

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
            <Text style={styles.headerTitle}>
              {product ? 'Edit Product Item' : 'Add New Product'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={22} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
          >
            {/* Image Upload */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Product Image</Text>
              {imageUrl ? (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: imageUrl }} style={styles.imagePreview} />
                  <TouchableOpacity
                    style={styles.removeImageBtn}
                    onPress={() => setImageUrl(null)}
                  >
                    <Trash2 size={16} color={Colors.white} />
                    <Text style={styles.removeImageText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={handleSelectImage}
                  disabled={uploading}
                >
                  {uploading ? (
                    <ActivityIndicator color={Colors.primary} />
                  ) : (
                    <>
                      <Camera size={26} color={Colors.textLight} style={{ marginBottom: 6 }} />
                      <Text style={styles.uploadText}>Select Product Photo</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Product Name */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Product Name *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Masala Dosa, Fresh Apples"
                value={name}
                onChangeText={setName}
                placeholderTextColor={Colors.textLight}
              />
            </View>

            {/* Description */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Brief description about the item"
                value={description}
                onChangeText={setDescription}
                multiline={true}
                numberOfLines={3}
                placeholderTextColor={Colors.textLight}
              />
            </View>

            {/* Price & Discount */}
            <View style={styles.row}>
              <View style={[styles.inputContainer, { flex: 1 }]}>
                <Text style={styles.label}>Price (₹) *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. 120"
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="numeric"
                  placeholderTextColor={Colors.textLight}
                />
              </View>
              <View style={[styles.inputContainer, { flex: 1 }]}>
                <Text style={styles.label}>Discount (%)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. 10"
                  value={discountPercent}
                  onChangeText={setDiscountPercent}
                  keyboardType="numeric"
                  placeholderTextColor={Colors.textLight}
                />
              </View>
            </View>

            {/* Stock Quantity */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Stock Quantity</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. 100"
                value={stockQuantity}
                onChangeText={setStockQuantity}
                keyboardType="numeric"
                placeholderTextColor={Colors.textLight}
              />
            </View>

            {/* Category selection */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Category *</Text>
              <View style={styles.categoryBadgeContainer}>
                {COMMON_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryBadge,
                      category === cat && styles.activeCategoryBadge,
                    ]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.categoryBadgeText,
                        category === cat && styles.activeCategoryBadgeText,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Veg / Non-Veg Switch */}
            <View style={styles.switchContainer}>
              <View>
                <Text style={styles.switchLabel}>Vegetarian (Veg)</Text>
                <Text style={styles.switchSublabel}>Toggle off if this contains non-veg/egg ingredients</Text>
              </View>
              <Switch
                value={isVeg}
                onValueChange={setIsVeg}
                trackColor={{ false: Colors.border, true: Colors.primary + '80' }}
                thumbColor={isVeg ? Colors.primary : '#f4f3f4'}
              />
            </View>

            {/* Action Button: Matches Customer/Delivery Pill style */}
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.disabledBtn]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.saveBtnText}>
                  {product ? 'Save Product Changes' : 'Create Product'}
                </Text>
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
  textArea: {
    height: 90,
    paddingTop: 14,
    textAlignVertical: 'top',
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
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 30,
  },
  switchLabel: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  switchSublabel: {
    fontSize: 10,
    fontFamily: Fonts.medium,
    color: Colors.textLight,
    marginTop: 2,
    maxWidth: '85%',
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
    marginTop: 10,
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
});
