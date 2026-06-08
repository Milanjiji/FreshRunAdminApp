import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  LogOut, 
  RefreshCcw,
  ChevronLeft
} from 'lucide-react-native';
import { PageTitle, PageSubtitle } from '../components/Typography';
import { Fonts } from '../theme/typography';
import { Colors } from '../theme/colors';
import { storage } from '../utils/storage';
import { API_BASE_URL } from '../config/api';

const BACKEND_URL = API_BASE_URL;
const POLL_INTERVAL_MS = 10000; // 10 seconds

interface ApprovalStatusScreenProps {
  status: 'pending' | 'approved' | 'rejected';
  userData: any;
  storeData: any;
  onApproved: () => void;
  onLogout: () => void;
  onSetupPayments: () => void;
}

const ApprovalStatusScreen: React.FC<ApprovalStatusScreenProps> = ({ 
  status: initialStatus, 
  userData,
  storeData: initialStoreData,
  onApproved, 
  onLogout,
  onSetupPayments 
}) => {
  const [currentStatus, setCurrentStatus] = useState<'pending' | 'approved' | 'rejected'>(initialStatus);
  const [storeState, setStoreState] = useState<any>(initialStoreData);
  const [razorpayStatus, setRazorpayStatus] = useState<string>(
    initialStoreData?.razorpay_kyc_status || userData?.razorpay_kyc_status || 'created'
  );
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkApprovalStatus = useCallback(async () => {
    const token = storage.getString('userToken');
    if (!token) return;

    setIsChecking(true);
    try {
      // 1. Fetch user profile
      const response = await fetch(`${BACKEND_URL}/user/profile`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (data.success && data.user) {
        const newStatus = data.user.approvalStatus;
        const newRazorpayStatus = data.user.razorpay_kyc_status || 'created';

        setLastChecked(new Date());

        // 2. Fetch store details specifically
        const storesResponse = await fetch(`${BACKEND_URL}/stores?include_inactive=true&include_pending=true`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        const storesData = await storesResponse.json();
        let newStoreData = null;
        if (storesData.success && storesData.data) {
          newStoreData = storesData.data.find((s: any) => s.owner_id === data.user.id);
        }

        // Save updated sessions
        storage.setItem('userData', data.user);
        if (newStoreData) {
          storage.setItem('storeData', newStoreData);
        }

        // Update local status variables
        setCurrentStatus(newStatus);
        setStoreState(newStoreData);
        setRazorpayStatus(newStoreData?.razorpay_kyc_status || newRazorpayStatus);

        const storeApproved = newStoreData ? newStoreData.approval_status === 'approved' : false;
        const storeRazorpayActive = (newStoreData?.razorpay_kyc_status === 'activated') || (newRazorpayStatus === 'activated');

        // Check if fully authorized (Both owner profile + store details approved AND Razorpay activated)
        if (newStatus === 'approved' && storeApproved && storeRazorpayActive) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          onApproved();
        }
      }
    } catch (err) {
      console.log('[ApprovalPoll] Status update failed:', err);
    } finally {
      setIsChecking(false);
    }
  }, [onApproved]);

  useEffect(() => {
    checkApprovalStatus();
    intervalRef.current = setInterval(checkApprovalStatus, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [checkApprovalStatus]);

  const storeApproved = storeState ? storeState.approval_status === 'approved' : false;
  const storePending = storeState ? storeState.approval_status === 'pending' : true;
  const isRejected = (currentStatus === 'rejected') || (storeState?.approval_status === 'rejected');

  const stages = [
    {
      title: 'Store Registration Info',
      description: 'Your shop information and contact details are submitted.',
      completed: true,
      active: false,
      rejected: false,
    },
    {
      title: 'Admin Profile Verification',
      description: 'Our admin team is reviewing your Aadhar identity card details.',
      completed: currentStatus === 'approved',
      active: currentStatus === 'pending',
      rejected: currentStatus === 'rejected',
    },
    {
      title: 'Store Details Review',
      description: 'The administration team is verifying your store details & GST settings.',
      completed: storeApproved,
      active: storePending && !storeApproved && currentStatus === 'approved',
      rejected: storeState?.approval_status === 'rejected',
    },
    {
      title: 'Razorpay Settlements Setup',
      description: razorpayStatus === 'activated'
        ? 'Your bank connection is active!'
        : 'Onboard your bank details to split payouts.',
      completed: razorpayStatus === 'activated',
      active: currentStatus === 'approved' && storeApproved && razorpayStatus !== 'activated',
      rejected: false,
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={onLogout}>
            <ChevronLeft size={24} color={Colors.text} strokeWidth={2.5} />
          </TouchableOpacity>
          <PageTitle style={styles.title}>Application Status</PageTitle>
          <PageSubtitle style={styles.subtitle}>
            {isRejected
              ? 'Registration rejected by administrator.'
              : currentStatus === 'pending' || storePending
              ? "We're reviewing your store registration details."
              : razorpayStatus !== 'activated'
              ? 'Settlement activation in progress.'
              : 'Store is ready to accept orders!'}
          </PageSubtitle>

          <View style={styles.pollingBadge}>
            {isChecking ? (
              <ActivityIndicator size="small" color={Colors.primary} style={{ marginRight: 6 }} />
            ) : (
              <RefreshCcw size={12} color={Colors.primary} style={{ marginRight: 6 }} />
            )}
            <Text style={styles.pollingText}>
              {isChecking
                ? 'Verifying...'
                : lastChecked
                ? `Updated: ${lastChecked.toLocaleTimeString()}`
                : 'Status Tracker Active'}
            </Text>
          </View>
        </View>

        {/* Rejection Rationale block */}
        {isRejected && (
          <View style={styles.rejectedContainer}>
            <AlertCircle size={24} color={Colors.error} style={{ marginBottom: 8 }} />
            <Text style={styles.rejectedTitle}>Registration Rejected</Text>
            <Text style={styles.rejectedText}>
              {userData?.rejection_reason || storeState?.rejection_reason || 'Please contact support to review your Aadhar, store details, or documentation.'}
            </Text>
          </View>
        )}

        <View style={styles.stagesContainer}>
          {stages.map((stage, index) => (
            <View key={index} style={styles.stageRow}>
              <View style={styles.indicatorContainer}>
                <View
                  style={[
                    styles.circle,
                    stage.completed
                      ? styles.completedCircle
                      : stage.rejected
                      ? styles.rejectedCircle
                      : stage.active
                      ? styles.activeCircle
                      : styles.inactiveCircle,
                  ]}
                >
                  {stage.completed ? (
                    <CheckCircle2 size={24} color="#fff" />
                  ) : stage.rejected ? (
                    <AlertCircle size={22} color="#fff" />
                  ) : stage.active ? (
                    <Clock size={20} color={Colors.primary} strokeWidth={2.5} />
                  ) : (
                    <Text style={styles.stageNumber}>{index + 1}</Text>
                  )}
                </View>
                {index < stages.length - 1 && (
                  <View
                    style={[
                      styles.line,
                      stage.completed ? styles.completedLine : styles.inactiveLine,
                    ]}
                  />
                )}
              </View>
              <View style={styles.stageTextContainer}>
                <Text
                  style={[
                    styles.stageTitle,
                    stage.completed || stage.active ? styles.activeText : stage.rejected ? styles.rejectedTextTitle : styles.inactiveText,
                  ]}
                >
                  {stage.title}
                </Text>
                <Text style={styles.stageDescription}>{stage.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Actions Button Panel */}
        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.refreshBtn, isChecking && styles.disabledBtn]} 
            onPress={checkApprovalStatus}
            disabled={isChecking}
          >
            {isChecking ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <RefreshCcw size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.refreshBtnText}>Check Status Now</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
            <LogOut size={20} color={Colors.textSecondary} style={{ marginRight: 10 }} />
            <Text style={styles.logoutBtnText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  container: {
    paddingHorizontal: 25,
    flexGrow: 1,
  },
  header: {
    marginTop: 20,
    marginBottom: 25,
  },
  backBtn: {
    marginBottom: 15,
    marginLeft: -10,
    padding: 10,
  },
  title: {
    fontSize: 28,
    fontFamily: Fonts.black,
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  pollingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: Colors.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pollingText: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    color: Colors.primary,
    textTransform: 'uppercase',
  },
  stagesContainer: {
    flex: 1,
    marginTop: 10,
  },
  stageRow: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  indicatorContainer: {
    alignItems: 'center',
    marginRight: 20,
    width: 44,
  },
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  completedCircle: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  activeCircle: {
    backgroundColor: Colors.white,
    borderColor: Colors.primary,
  },
  inactiveCircle: {
    backgroundColor: Colors.white,
    borderColor: Colors.border,
  },
  rejectedCircle: {
    backgroundColor: Colors.error,
    borderColor: Colors.error,
  },
  stageNumber: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: Colors.textLight,
  },
  line: {
    width: 2,
    height: 36,
    marginTop: 5,
  },
  completedLine: {
    backgroundColor: Colors.primary,
  },
  inactiveLine: {
    backgroundColor: Colors.border,
  },
  stageTextContainer: {
    flex: 1,
    paddingTop: 8,
  },
  stageTitle: {
    fontSize: 17,
    fontFamily: Fonts.bold,
    marginBottom: 4,
  },
  activeText: {
    color: Colors.text,
  },
  inactiveText: {
    color: Colors.textLight,
  },
  rejectedTextTitle: {
    color: Colors.error,
  },
  stageDescription: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  rejectedContainer: {
    padding: 20,
    backgroundColor: '#FFF0F0',
    borderRadius: 15,
    marginBottom: 30,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#FFDEDE',
  },
  rejectedTitle: {
    color: Colors.error,
    fontSize: 16,
    fontFamily: Fonts.bold,
    marginBottom: 4,
  },
  rejectedText: {
    color: Colors.error,
    fontSize: 14,
    fontFamily: Fonts.medium,
    lineHeight: 20,
  },
  footer: {
    paddingBottom: 35,
    marginTop: 10,
    gap: 12,
  },
  refreshBtn: {
    height: 56,
    borderRadius: 15,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshBtnText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: Fonts.bold,
  },
  logoutBtn: {
    height: 56,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  logoutBtnText: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: Colors.textSecondary,
  },
  disabledBtn: {
    opacity: 0.7,
  },
});

export default ApprovalStatusScreen;
