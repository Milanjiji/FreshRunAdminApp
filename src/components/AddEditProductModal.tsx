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
import { API_BASE_URL } from '../config/api';

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
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [categoriesList, setCategoriesList] = useState<any[]>([]);
  const [isVeg, setIsVeg] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [unit, setUnit] = useState('');
  const [hasVariants, setHasVariants] = useState(false);
  const [variants, setVariants] = useState<any[]>([
    { id: "var_1", unit: "", price: "", discountPercent: "0", stockQuantity: "100", isStockOut: false }
  ]);
  
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchCategories();
    }
  }, [visible]);

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/categories`);
      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        setCategoriesList(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  };

  useEffect(() => {
    if (product) {
      setName(product.name || '');
      setDescription(product.description || '');
      setPrice(String(product.price || ''));
      setDiscountPercent(String(product.discount_percent || '0'));
      setStockQuantity(String(product.stock_quantity || '100'));
      setCategory(product.category || '');
      setSubcategory(product.subcategory || '');
      setIsVeg(product.is_veg !== undefined ? product.is_veg : true);
      setImageUrl(product.image_url || null);
      setUnit(product.unit || '');
      
      const hasVars = Array.isArray(product.variants) && product.variants.length > 0;
      setHasVariants(hasVars);
      if (hasVars) {
        setVariants(product.variants.map((v: any) => ({
          id: v.id || "var_" + Math.random().toString(36).substr(2, 5),
          unit: v.unit || "",
          price: String(v.price || ''),
          discountPercent: String(v.discount_percent || '0'),
          stockQuantity: String(v.stock_quantity || '100'),
          isStockOut: v.is_stock_out || false
        })));
      } else {
        setVariants([
          { id: "var_1", unit: "", price: "", discountPercent: "0", stockQuantity: "100", isStockOut: false }
        ]);
      }
    } else {
      setName('');
      setDescription('');
      setPrice('');
      setDiscountPercent('0');
      setStockQuantity('100');
      setCategory('');
      setSubcategory('');
      setIsVeg(true);
      setImageUrl(null);
      setUnit('');
      setHasVariants(false);
      setVariants([
        { id: "var_1", unit: "", price: "", discountPercent: "0", stockQuantity: "100", isStockOut: false }
      ]);
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

    if (hasVariants) {
      // Validate variants
      const invalidVariant = variants.find(v => !v.unit.trim() || !v.price.trim() || isNaN(Number(v.price)) || Number(v.price) <= 0);
      if (invalidVariant) {
        Alertt.alert('Invalid Variants', 'Please enter a valid quantity and positive price for all variants.');
        return;
      }
    } else {
      if (!price.trim() || isNaN(Number(price)) || Number(price) <= 0) {
        Alertt.alert('Invalid Price', 'Please enter a valid positive price.');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        price: hasVariants ? Number(variants[0].price) : Number(price),
        discountPercent: hasVariants ? Number(variants[0].discountPercent) : Number(discountPercent),
        stockQuantity: hasVariants ? Number(variants[0].stockQuantity) : Number(stockQuantity),
        category: category || null,
        subcategory: subcategory || null,
        isVeg: isVeg,
        imageUrl: imageUrl,
        unit: hasVariants ? variants[0].unit.trim() : unit.trim(),
        variants: hasVariants ? variants.map(v => ({
          id: v.id,
          unit: v.unit.trim(),
          price: Number(v.price),
          discount_percent: Number(v.discountPercent || 0),
          stock_quantity: Number(v.stockQuantity || 0),
          is_stock_out: v.isStockOut || false
        })) : []
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

            {/* Multiple Variants Toggle */}
            <View style={styles.switchContainer}>
              <View>
                <Text style={styles.switchLabel}>Product Has Multiple Variants</Text>
                <Text style={styles.switchSublabel}>Enable to sell in different sizes, weights, or options</Text>
              </View>
              <Switch
                value={hasVariants}
                onValueChange={setHasVariants}
                trackColor={{ false: Colors.border, true: Colors.primary + '80' }}
                thumbColor={hasVariants ? Colors.primary : '#f4f3f4'}
              />
            </View>

            {!hasVariants ? (
              <>
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

                {/* Stock & Unit */}
                <View style={styles.row}>
                  <View style={[styles.inputContainer, { flex: 1 }]}>
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
                  <View style={[styles.inputContainer, { flex: 1 }]}>
                    <Text style={styles.label}>Quantity / Unit</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. 500 gm, 1 kg"
                      value={unit}
                      onChangeText={setUnit}
                      placeholderTextColor={Colors.textLight}
                    />
                  </View>
                </View>
              </>
            ) : (
              <View style={{ marginBottom: 20 }}>
                <Text style={styles.label}>Size Variants *</Text>
                {variants.map((v, idx) => (
                  <View key={v.id} style={styles.variantCard}>
                    <View style={styles.variantHeader}>
                      <Text style={styles.variantTitle}>Variant #{idx + 1}</Text>
                      {variants.length > 1 && (
                        <TouchableOpacity
                          onPress={() => setVariants(variants.filter((_, i) => i !== idx))}
                          style={styles.removeVariantBtn}
                        >
                          <Trash2 size={16} color={Colors.error} />
                        </TouchableOpacity>
                      )}
                    </View>
                    <View style={styles.row}>
                      <View style={[styles.inputContainer, { flex: 1 }]}>
                        <Text style={styles.variantInputLabel}>Quantity / Unit *</Text>
                        <TextInput
                          style={styles.variantTextInput}
                          placeholder="e.g. 500 gm"
                          value={v.unit}
                          onChangeText={(val) => {
                            const newVars = [...variants];
                            newVars[idx].unit = val;
                            setVariants(newVars);
                          }}
                          placeholderTextColor={Colors.textLight}
                        />
                      </View>
                      <View style={[styles.inputContainer, { flex: 1 }]}>
                        <Text style={styles.variantInputLabel}>Price (₹) *</Text>
                        <TextInput
                          style={styles.variantTextInput}
                          placeholder="e.g. 120"
                          value={v.price}
                          onChangeText={(val) => {
                            const newVars = [...variants];
                            newVars[idx].price = val;
                            setVariants(newVars);
                          }}
                          keyboardType="numeric"
                          placeholderTextColor={Colors.textLight}
                        />
                      </View>
                    </View>
                    <View style={styles.row}>
                      <View style={[styles.inputContainer, { flex: 1 }]}>
                        <Text style={styles.variantInputLabel}>Discount %</Text>
                        <TextInput
                          style={styles.variantTextInput}
                          placeholder="e.g. 10"
                          value={v.discountPercent}
                          onChangeText={(val) => {
                            const newVars = [...variants];
                            newVars[idx].discountPercent = val;
                            setVariants(newVars);
                          }}
                          keyboardType="numeric"
                          placeholderTextColor={Colors.textLight}
                        />
                      </View>
                      <View style={[styles.inputContainer, { flex: 1 }]}>
                        <Text style={styles.variantInputLabel}>Stock</Text>
                        <TextInput
                          style={styles.variantTextInput}
                          placeholder="e.g. 100"
                          value={v.stockQuantity}
                          onChangeText={(val) => {
                            const newVars = [...variants];
                            newVars[idx].stockQuantity = val;
                            setVariants(newVars);
                          }}
                          keyboardType="numeric"
                          placeholderTextColor={Colors.textLight}
                        />
                      </View>
                    </View>
                    <View style={styles.variantStockOutRow}>
                      <Text style={styles.variantInputLabel}>Mark Out of Stock</Text>
                      <Switch
                        value={v.isStockOut}
                        onValueChange={(val) => {
                          const newVars = [...variants];
                          newVars[idx].isStockOut = val;
                          setVariants(newVars);
                        }}
                        trackColor={{ false: Colors.border, true: Colors.primary + '80' }}
                        thumbColor={v.isStockOut ? Colors.primary : '#f4f3f4'}
                      />
                    </View>
                  </View>
                ))}
                <TouchableOpacity
                  onPress={() => {
                    setVariants([...variants, {
                      id: "var_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
                      unit: "",
                      price: "",
                      discountPercent: "0",
                      stockQuantity: "100",
                      isStockOut: false
                    }]);
                  }}
                  style={styles.addVariantButton}
                >
                  <Text style={styles.addVariantButtonText}>+ Add Size Variant</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Category selection */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Category</Text>
              <View style={styles.categoryBadgeContainer}>
                {(categoriesList.length > 0 ? categoriesList : [
                  { name: 'Restaurants', slug: 'restaurants' },
                  { name: 'Street Food', slug: 'street-food' },
                  { name: 'Groceries', slug: 'groceries' },
                  { name: 'Chicken', slug: 'chicken' },
                  { name: 'Fish', slug: 'fish' },
                  { name: 'Medicine', slug: 'medicine' }
                ]).map((cat) => {
                  const isSelected = category === cat.slug;
                  return (
                    <TouchableOpacity
                      key={cat.slug}
                      style={[
                        styles.categoryBadge,
                        isSelected && styles.activeCategoryBadge,
                      ]}
                      onPress={() => {
                        if (isSelected) {
                          setCategory('');
                          setSubcategory('');
                        } else {
                          setCategory(cat.slug);
                          setSubcategory('');
                        }
                      }}
                    >
                      <Text
                        style={[
                          styles.categoryBadgeText,
                          isSelected && styles.activeCategoryBadgeText,
                        ]}
                      >
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Subcategory selection */}
            {category ? (() => {
              const selectedCatObj = categoriesList.find(c => c.slug === category);
              const subcats = selectedCatObj?.subcategories || [];
              if (subcats.length === 0) return null;
              return (
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Subcategory</Text>
                  <View style={styles.categoryBadgeContainer}>
                    {subcats.map((sub: any) => {
                      const isSelected = subcategory === sub.name;
                      return (
                        <TouchableOpacity
                          key={sub.id || sub.name}
                          style={[
                            styles.categoryBadge,
                            isSelected && styles.activeCategoryBadge,
                          ]}
                          onPress={() => {
                            if (isSelected) {
                              setSubcategory('');
                            } else {
                              setSubcategory(sub.name);
                            }
                          }}
                        >
                          <Text
                            style={[
                              styles.categoryBadgeText,
                              isSelected && styles.activeCategoryBadgeText,
                            ]}
                          >
                            {sub.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })() : null}

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
  variantCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 12,
  },
  variantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  variantTitle: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
  },
  removeVariantBtn: {
    padding: 4,
  },
  variantInputLabel: {
    fontSize: 10,
    fontFamily: Fonts.semiBold,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  variantTextInput: {
    backgroundColor: Colors.white,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: Colors.text,
  },
  variantStockOutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  addVariantButton: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  addVariantButtonText: {
    color: Colors.primary,
    fontSize: 12.5,
    fontFamily: Fonts.bold,
  },
});
