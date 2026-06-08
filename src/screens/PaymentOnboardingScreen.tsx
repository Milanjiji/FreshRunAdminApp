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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Landmark, CreditCard, User, Info } from 'lucide-react-native';
import axios from 'axios';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/typography';
import { storage } from '../utils/storage';
import { Alertt } from '../components/Alertt';
import { API_BASE_URL } from '../config/api';
import { PageTitle, PageSubtitle } from '../components/Typography';
import { PrimaryButton } from '../components/Button';

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
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [businessName, setBusinessName] = useState(storeData?.name || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!accountNumber || !ifscCode || !panNumber || !businessName) {
      Alertt.alert('Error', 'Please fill in all bank details, PAN, and business name.');
      return;
    }

    if (accountNumber !== confirmAccountNumber) {
      Alertt.alert('Error', 'Account numbers do not match.');
      return;
    }

    if (ifscCode.length !== 11) {
      Alertt.alert('Error', 'Invalid IFSC Code (must be 11 characters).');
      return;
    }

    if (panNumber.length !== 10) {
      Alertt.alert('Error', 'Invalid PAN Number (must be 10 characters).');
      return;
    }

    setLoading(true);
    try {
      const token = storage.getString('userToken');
      
      const response = await axios.post(`${API_BASE_URL}/payments/onboard`, {
        role: 'owner',
        storeId: storeData.id,
        bankDetails: {
          accountNumber,
          ifscCode,
        },
        pan: panNumber,
        name: userData.fullName || userData.full_name,
        email: userData.email,
        phone: userData.phone,
        businessName: businessName
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        Alertt.alert('Success', 'Bank details submitted successfully! Razorpay is verifying your account details.');
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
              Set up your settlements with Razorpay to receive earnings directly into your bank account.
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

            {/* Bank Account Number */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Bank Account Number</Text>
              <View style={styles.inputWrapper}>
                <Landmark size={20} color={Colors.textLight} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter bank account number"
                  value={accountNumber}
                  onChangeText={setAccountNumber}
                  keyboardType="number-pad"
                  placeholderTextColor={Colors.textLight}
                />
              </View>
            </View>

            {/* Confirm Account Number */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm Account Number</Text>
              <View style={styles.inputWrapper}>
                <Landmark size={20} color={Colors.textLight} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Re-enter bank account number"
                  value={confirmAccountNumber}
                  onChangeText={setConfirmAccountNumber}
                  keyboardType="number-pad"
                  placeholderTextColor={Colors.textLight}
                />
              </View>
            </View>

            {/* IFSC Code */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>IFSC Code</Text>
              <View style={styles.inputWrapper}>
                <CreditCard size={20} color={Colors.textLight} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. HDFC0000123"
                  value={ifscCode}
                  onChangeText={text => setIfscCode(text.toUpperCase())}
                  autoCapitalize="characters"
                  maxLength={11}
                  placeholderTextColor={Colors.textLight}
                />
              </View>
            </View>

            {/* PAN Number */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>PAN Card Number</Text>
              <View style={styles.inputWrapper}>
                <User size={20} color={Colors.textLight} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="10-digit PAN"
                  value={panNumber}
                  onChangeText={text => setPanNumber(text.toUpperCase())}
                  autoCapitalize="characters"
                  maxLength={10}
                  placeholderTextColor={Colors.textLight}
                />
              </View>
            </View>

            {/* Warning Card */}
            <View style={styles.infoCard}>
              <View style={styles.infoHeader}>
                <Info size={20} color={Colors.secondary} />
                <Text style={styles.infoTitle}>Verification Note</Text>
              </View>
              <Text style={styles.infoDescription}>
                All order amounts will be split and settled to this bank account automatically. Ensure details match your bank passbook exactly.
              </Text>
            </View>
          </View>

          <PrimaryButton 
            title={loading ? "Submitting..." : "Submit to Razorpay"}
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
    fontSize: 16,
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
    fontSize: 14,
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
    fontSize: 16,
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
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginLeft: 8,
  },
  infoDescription: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
});

export default PaymentOnboardingScreen;
