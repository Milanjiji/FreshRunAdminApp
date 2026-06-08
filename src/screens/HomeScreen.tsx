import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Switch,
  TextInput,
  Image,
  ScrollView,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShoppingBag, Tag, IndianRupee, LogOut, Power, Check, X, AlertCircle } from 'lucide-react-native';
import axios from 'axios';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/typography';
import { storage } from '../utils/storage';
import { Alertt } from '../components/Alertt';
import { API_BASE_URL } from '../config/api';

interface HomeScreenProps {
  userData: any;
  storeData: any;
  onLogout: () => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ userData, storeData: initialStore, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'earnings'>('orders');
  const [store, setStore] = useState(initialStore);
  const [isStoreActive, setIsStoreActive] = useState(initialStore?.is_active);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [earnings, setEarnings] = useState({ withdrawable: 0, total: 0 });
  
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingStoreToggle, setLoadingStoreToggle] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch Store Status & Profile
  const fetchStoreDetails = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/stores/${store.id}`);
      if (response.data.success && response.data.data) {
        setStore(response.data.data);
        setIsStoreActive(response.data.data.is_active);
      }
    } catch (err) {
      console.log('Error fetching store details:', err);
    }
  }, [store.id]);

  // Fetch Wallet & Earnings info
  const fetchEarnings = useCallback(async () => {
    try {
      const token = storage.getString('userToken');
      const response = await axios.get(`${API_BASE_URL}/user/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success && response.data.user) {
        setEarnings({
          withdrawable: response.data.user.withdrawableEarnings || 0,
          total: response.data.user.totalEarnings || 0
        });
      }
    } catch (err) {
      console.log('Error fetching earnings:', err);
    }
  }, []);

  // Fetch Store Orders
  const fetchOrders = useCallback(async (showLoader = true) => {
    if (showLoader) setLoadingOrders(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/orders`);
      if (response.data.success && response.data.orders) {
        // Filter orders that belong to this store
        const storeOrders = response.data.orders.filter((o: any) => o.store_id === store.id);
        setOrders(storeOrders);
      }
    } catch (err) {
      console.log('Error fetching orders:', err);
    } finally {
      if (showLoader) setLoadingOrders(false);
    }
  }, [store.id]);

  // Fetch Store Products
  const fetchProducts = useCallback(async (showLoader = true) => {
    if (showLoader) setLoadingProducts(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/products?store_id=${store.id}&include_inactive=true`);
      if (response.data.success && response.data.data) {
        setProducts(response.data.data);
      }
    } catch (err) {
      console.log('Error fetching products:', err);
    } finally {
      if (showLoader) setLoadingProducts(false);
    }
  }, [store.id]);

  // Initialize screen data
  useEffect(() => {
    fetchStoreDetails();
    fetchEarnings();
    fetchOrders();
    fetchProducts();
  }, [fetchStoreDetails, fetchEarnings, fetchOrders, fetchProducts]);

  // Handle Pull-to-refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchStoreDetails(),
      fetchEarnings(),
      fetchOrders(false),
      fetchProducts(false)
    ]);
    setRefreshing(false);
  };

  // Toggle Store Availability
  const handleToggleStore = async () => {
    setLoadingStoreToggle(true);
    const newStatus = !isStoreActive;
    try {
      const response = await axios.patch(`${API_BASE_URL}/stores/${store.id}`, {
        is_active: newStatus
      });
      if (response.data.success) {
        setIsStoreActive(newStatus);
        setStore(response.data.data);
      }
    } catch (err) {
      console.error('Toggle Store error:', err);
      Alertt.alert('Error', 'Failed to toggle store availability.');
    } finally {
      setLoadingStoreToggle(false);
    }
  };

  // Update Order Status (Accept, Prepare, Ready)
  const handleUpdateOrderStatus = async (orderId: string, nextStatus: 'preparing' | 'ready' | 'cancelled') => {
    try {
      const response = await axios.patch(`${API_BASE_URL}/orders/${orderId}`, {
        status: nextStatus
      });
      if (response.data.success) {
        Alertt.alert('Success', `Order status updated to ${nextStatus}.`);
        fetchOrders(false);
      }
    } catch (err) {
      console.error('Update Order Status Error:', err);
      Alertt.alert('Error', 'Failed to update order status.');
    }
  };

  // Toggle Product Availability
  const handleToggleProduct = async (productId: string, currentStatus: boolean) => {
    try {
      const response = await axios.patch(`${API_BASE_URL}/products/${productId}`, {
        isActive: !currentStatus
      });
      if (response.data.success) {
        setProducts(prev => prev.map(p => p.id === productId ? { ...p, is_active: !currentStatus } : p));
      }
    } catch (err) {
      console.error('Toggle Product Error:', err);
      Alertt.alert('Error', 'Failed to toggle product status.');
    }
  };

  // Update Product Stock count
  const handleUpdateProductStock = async (productId: string, newStock: number) => {
    if (isNaN(newStock) || newStock < 0) return;
    try {
      const response = await axios.patch(`${API_BASE_URL}/products/${productId}`, {
        stockQuantity: newStock
      });
      if (response.data.success) {
        setProducts(prev => prev.map(p => p.id === productId ? { ...p, stock_quantity: newStock } : p));
      }
    } catch (err) {
      console.error('Update Stock Error:', err);
    }
  };

  // Render Order Item Card
  const renderOrderItem = ({ item }: { item: any }) => {
    const isPlaced = item.status === 'placed';
    const isPreparing = item.status === 'preparing';
    
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.orderIdText}>Order #{item.id.substring(0, 8).toUpperCase()}</Text>
            <Text style={styles.timeText}>{new Date(item.created_at).toLocaleTimeString()}</Text>
          </View>
          <View style={[styles.statusBadge, 
            item.status === 'placed' && { backgroundColor: Colors.warning + '15' },
            item.status === 'preparing' && { backgroundColor: Colors.secondaryLight },
            item.status === 'ready' && { backgroundColor: Colors.primaryLight + '30' },
            item.status === 'delivered' && { backgroundColor: Colors.success + '15' }
          ]}>
            <Text style={[styles.statusText,
              item.status === 'placed' && { color: Colors.warning },
              item.status === 'preparing' && { color: Colors.secondary },
              item.status === 'ready' && { color: Colors.primaryDark },
              item.status === 'delivered' && { color: Colors.success }
            ]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Order Items */}
        <View style={styles.itemsList}>
          {item.items && item.items.map((prod: any, idx: number) => (
            <Text key={idx} style={styles.itemText}>
              • {prod.name} x {prod.quantity}
            </Text>
          ))}
        </View>

        <View style={styles.cardDivider} />

        <View style={styles.cardFooter}>
          <Text style={styles.priceText}>Total Amount: ₹{item.total_amount}</Text>
          
          {/* Action buttons */}
          <View style={styles.buttonRow}>
            {isPlaced && (
              <>
                <TouchableOpacity 
                  style={[styles.smallBtn, styles.declineBtn]}
                  onPress={() => handleUpdateOrderStatus(item.id, 'cancelled')}
                >
                  <X size={16} color={Colors.error} />
                  <Text style={[styles.btnText, { color: Colors.error }]}>Decline</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.smallBtn, styles.acceptBtn]}
                  onPress={() => handleUpdateOrderStatus(item.id, 'preparing')}
                >
                  <Check size={16} color={Colors.white} />
                  <Text style={[styles.btnText, { color: Colors.white }]}>Accept</Text>
                </TouchableOpacity>
              </>
            )}

            {isPreparing && (
              <TouchableOpacity 
                style={[styles.smallBtn, styles.acceptBtn, { width: 140 }]}
                onPress={() => handleUpdateOrderStatus(item.id, 'ready')}
              >
                <Check size={16} color={Colors.white} />
                <Text style={[styles.btnText, { color: Colors.white }]}>Food Ready</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  // Render Product Item Card
  const renderProductItem = ({ item }: { item: any }) => {
    return (
      <View style={styles.productCard}>
        <View style={styles.productImageContainer}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.productImage} />
          ) : (
            <ShoppingBag size={24} color={Colors.textLight} />
          )}
        </View>
        <View style={styles.productDetails}>
          <Text style={styles.productName}>{item.name}</Text>
          <Text style={styles.productPrice}>₹{item.price}</Text>
          
          <View style={styles.stockRow}>
            <Text style={styles.stockLabel}>Stock:</Text>
            <TouchableOpacity 
              style={styles.stockAdjustBtn} 
              onPress={() => handleUpdateProductStock(item.id, Number(item.stock_quantity) - 1)}
            >
              <Text style={styles.stockAdjustText}>-</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.stockInput}
              value={String(item.stock_quantity)}
              keyboardType="number-pad"
              onChangeText={(text) => handleUpdateProductStock(item.id, Number(text))}
            />
            <TouchableOpacity 
              style={styles.stockAdjustBtn} 
              onPress={() => handleUpdateProductStock(item.id, Number(item.stock_quantity) + 1)}
            >
              <Text style={styles.stockAdjustText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Toggle availability */}
        <View style={styles.toggleContainer}>
          <Switch
            value={item.is_active}
            onValueChange={() => handleToggleProduct(item.id, item.is_active)}
            trackColor={{ false: Colors.border, true: Colors.primary + '80' }}
            thumbColor={item.is_active ? Colors.primary : '#f4f3f4'}
          />
          <Text style={[styles.toggleLabel, { color: item.is_active ? Colors.primary : Colors.textLight }]}>
            {item.is_active ? 'In Stock' : 'Disabled'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      
      {/* Header Panel */}
      <View style={styles.header}>
        <View style={styles.storeHeader}>
          <View>
            <Text style={styles.storeTitle}>{store.name}</Text>
            <Text style={styles.ownerSubtitle}>Logged in as {userData.fullName || 'Owner'}</Text>
          </View>
          
          {/* Availability Switch */}
          <TouchableOpacity 
            style={[styles.powerBtn, isStoreActive ? styles.powerOn : styles.powerOff]}
            onPress={handleToggleStore}
            disabled={loadingStoreToggle}
          >
            {loadingStoreToggle ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                <Power size={18} color={Colors.white} strokeWidth={2.5} />
                <Text style={styles.powerBtnText}>{isStoreActive ? 'Online' : 'Offline'}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'orders' && styles.activeTab]}
          onPress={() => setActiveTab('orders')}
        >
          <ShoppingBag size={20} color={activeTab === 'orders' ? Colors.primary : Colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'orders' && styles.activeTabText]}>Orders</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'products' && styles.activeTab]}
          onPress={() => setActiveTab('products')}
        >
          <Tag size={20} color={activeTab === 'products' ? Colors.primary : Colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'products' && styles.activeTabText]}>Menu</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'earnings' && styles.activeTab]}
          onPress={() => setActiveTab('earnings')}
        >
          <IndianRupee size={20} color={activeTab === 'earnings' ? Colors.primary : Colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'earnings' && styles.activeTabText]}>Payouts</Text>
        </TouchableOpacity>
      </View>

      {/* Content Area */}
      <View style={styles.content}>
        {activeTab === 'orders' && (
          <FlatList
            data={orders}
            renderItem={renderOrderItem}
            keyExtractor={item => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
            ListEmptyComponent={
              !loadingOrders ? (
                <View style={styles.emptyContainer}>
                  <ShoppingBag size={48} color={Colors.textLight} style={{ marginBottom: 12 }} />
                  <Text style={styles.emptyText}>No orders received yet.</Text>
                </View>
              ) : null
            }
            ListHeaderComponent={loadingOrders ? <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} /> : null}
            contentContainerStyle={styles.listContainer}
          />
        )}

        {activeTab === 'products' && (
          <FlatList
            data={products}
            renderItem={renderProductItem}
            keyExtractor={item => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
            ListEmptyComponent={
              !loadingProducts ? (
                <View style={styles.emptyContainer}>
                  <Tag size={48} color={Colors.textLight} style={{ marginBottom: 12 }} />
                  <Text style={styles.emptyText}>No menu items found.</Text>
                </View>
              ) : null
            }
            ListHeaderComponent={loadingProducts ? <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} /> : null}
            contentContainerStyle={styles.listContainer}
          />
        )}

        {activeTab === 'earnings' && (
          <ScrollView 
            contentContainerStyle={styles.earningsContainer}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          >
            {/* Balance Card */}
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Withdrawable Earnings</Text>
              <Text style={styles.balanceValue}>₹{earnings.withdrawable.toFixed(2)}</Text>
              <Text style={styles.totalLabel}>Total Lifetime Earnings: ₹{earnings.total.toFixed(2)}</Text>
            </View>

            {/* Note about payouts */}
            <View style={styles.infoBox}>
              <AlertCircle size={20} color={Colors.primary} style={{ marginRight: 10 }} />
              <Text style={styles.infoBoxText}>
                Razorpay Route manages splits automatically at the time of payment. Withdrawable earnings represent local adjustments or commission paybacks.
              </Text>
            </View>

            <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
              <LogOut size={20} color={Colors.error} style={{ marginRight: 8 }} />
              <Text style={styles.logoutText}>Logout from Store Account</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.white,
    paddingHorizontal: 25,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  storeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  storeTitle: {
    fontSize: 22,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  ownerSubtitle: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  powerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
    elevation: 3,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  powerOn: {
    backgroundColor: Colors.primary,
  },
  powerOff: {
    backgroundColor: Colors.textLight,
  },
  powerBtnText: {
    color: Colors.white,
    fontSize: 13,
    fontFamily: Fonts.bold,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
    gap: 6,
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: Colors.textSecondary,
  },
  activeTabText: {
    color: Colors.primary,
    fontFamily: Fonts.bold,
  },
  content: {
    flex: 1,
  },
  listContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    elevation: 2,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderIdText: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  timeText: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.textLight,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontFamily: Fonts.bold,
  },
  itemsList: {
    marginBottom: 12,
  },
  itemText: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  cardDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceText: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 38,
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  declineBtn: {
    borderColor: Colors.error + '50',
    backgroundColor: Colors.error + '10',
  },
  acceptBtn: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  btnText: {
    fontSize: 13,
    fontFamily: Fonts.bold,
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  productImageContainer: {
    width: 64,
    height: 64,
    borderRadius: 15,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginRight: 12,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productDetails: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  productPrice: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  stockLabel: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: Colors.textLight,
    marginRight: 6,
  },
  stockAdjustBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stockAdjustText: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  stockInput: {
    width: 40,
    textAlign: 'center',
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: Colors.text,
    padding: 0,
  },
  toggleContainer: {
    alignItems: 'center',
    marginLeft: 8,
  },
  toggleLabel: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
  },
  earningsContainer: {
    padding: 25,
  },
  balanceCard: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    marginBottom: 20,
  },
  balanceLabel: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  balanceValue: {
    fontSize: 36,
    fontFamily: Fonts.black,
    color: Colors.primaryDark,
    fontWeight: '900',
  },
  totalLabel: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: Colors.textLight,
    marginTop: 12,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 40,
    alignItems: 'center',
  },
  infoBoxText: {
    flex: 1,
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  logoutBtn: {
    flexDirection: 'row',
    height: 56,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: Colors.error + '40',
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: Colors.error,
  },
});

export default HomeScreen;
