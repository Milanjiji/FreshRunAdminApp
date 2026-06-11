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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShoppingBag, Tag, IndianRupee, LogOut, Power, Check, X, AlertCircle, Plus, ChevronDown, Pencil, Trash2, Store } from 'lucide-react-native';
import axios from 'axios';
import { io } from 'socket.io-client';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/typography';
import { storage } from '../utils/storage';
import { Alertt } from '../components/Alertt';
import { API_BASE_URL } from '../config/api';
import { AddEditProductModal } from '../components/AddEditProductModal';
import { CreateStoreModal } from '../components/CreateStoreModal';

interface HomeScreenProps {
  userData: any;
  storeData: any;
  storesList: any[];
  onSelectStore: (store: any) => void;
  onRefreshStores: () => void;
  onLogout: () => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ 
  userData, 
  storeData, 
  storesList, 
  onSelectStore, 
  onRefreshStores, 
  onLogout 
}) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'earnings'>('orders');
  const [store, setStore] = useState(storeData);
  const [isStoreActive, setIsStoreActive] = useState(storeData?.is_active);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [earnings, setEarnings] = useState({ withdrawable: 0, total: 0 });
  
  // Modal visibility states
  const [showStoreSwitcher, setShowStoreSwitcher] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCreateStoreModal, setShowCreateStoreModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingStoreToggle, setLoadingStoreToggle] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Sync state with parent storeData updates
  useEffect(() => {
    if (storeData) {
      setStore(storeData);
      setIsStoreActive(storeData.is_active);
    }
  }, [storeData]);

  // Fetch Store Status & Profile
  const fetchStoreDetails = useCallback(async () => {
    if (!store?.id) return;
    try {
      const response = await axios.get(`${API_BASE_URL}/stores/${store.id}`);
      if (response.data.success && response.data.data) {
        setStore(response.data.data);
        setIsStoreActive(response.data.data.is_active);
      }
    } catch (err) {
      console.log('Error fetching store details:', err);
    }
  }, [store?.id]);

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
    if (!store?.id) return;
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
  }, [store?.id]);

  // Fetch Store Products
  const fetchProducts = useCallback(async (showLoader = true) => {
    if (!store?.id) return;
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
  }, [store?.id]);

  // Initialize screen data
  useEffect(() => {
    fetchStoreDetails();
    fetchEarnings();
    fetchOrders();
    fetchProducts();
  }, [fetchStoreDetails, fetchEarnings, fetchOrders, fetchProducts]);

  // Socket.IO Connection for Real-Time Order Alerts
  useEffect(() => {
    if (!store?.id) return;

    console.log('[HomeScreen] Socket client connecting to:', API_BASE_URL);
    const socket = io(API_BASE_URL);

    socket.on('connect', () => {
      console.log('[HomeScreen] Socket connected. Joining store room:', `store_${store.id}`);
      socket.emit('join_room', `store_${store.id}`);
    });

    socket.on('new_order', (order: any) => {
      console.log('[HomeScreen] Socket new_order received:', order);
      Alertt.alert(
        '🛍️ New Order Received!',
        `Order #${order.id.substring(0, 8).toUpperCase()} for ₹${order.total_amount} has been placed at your store.`,
        [
          { text: 'View Orders', onPress: () => { setActiveTab('orders'); fetchOrders(false); } }
        ]
      );
      fetchOrders(false);
    });

    socket.on('disconnect', () => {
      console.log('[HomeScreen] Socket disconnected.');
    });

    return () => {
      console.log('[HomeScreen] Disconnecting socket.');
      socket.disconnect();
    };
  }, [store?.id, fetchOrders]);

  const handleSaveProduct = async (productPayload: any) => {
    setIsProcessing(true);
    try {
      const token = storage.getString('userToken');
      if (editingProduct) {
        // Update
        const res = await axios.patch(`${API_BASE_URL}/products/${editingProduct.id}`, productPayload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data.success) {
          Alertt.alert('Success', 'Product updated successfully.');
          fetchProducts(false);
        }
      } else {
        // Create
        const res = await axios.post(`${API_BASE_URL}/products`, {
          ...productPayload,
          storeId: store.id
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data.success) {
          Alertt.alert('Success', 'Product created successfully.');
          fetchProducts(false);
        }
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    Alertt.alert(
      'Delete Product',
      'Are you sure you want to delete this product? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsProcessing(true);
            try {
              const token = storage.getString('userToken');
              const res = await axios.delete(`${API_BASE_URL}/products/${productId}`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              if (res.data.success) {
                Alertt.alert('Success', 'Product deleted successfully.');
                fetchProducts(false);
              }
            } catch (err) {
              console.log('Failed to delete product:', err);
              Alertt.alert('Error', 'Failed to delete product.');
            } finally {
              setIsProcessing(false);
            }
          }
        }
      ]
    );
  };

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
    setIsProcessing(true);
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
      setIsProcessing(false);
    }
  };

  // Update Order Status (Accept, Prepare, Ready, Pack, Decline)
  const handleUpdateOrderStatus = async (orderId: string, nextStatus: 'preparing' | 'packed' | 'ready' | 'declined') => {
    setIsProcessing(true);
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
    } finally {
      setIsProcessing(false);
    }
  };

  // Toggle Product Availability
  const handleToggleProduct = async (productId: string, currentStatus: boolean) => {
    setIsProcessing(true);
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
    } finally {
      setIsProcessing(false);
    }
  };

  // Update Product Stock count
  const handleUpdateProductStock = async (productId: string, newStock: number) => {
    if (isNaN(newStock) || newStock < 0) return;
    setIsProcessing(true);
    try {
      const response = await axios.patch(`${API_BASE_URL}/products/${productId}`, {
        stockQuantity: newStock
      });
      if (response.data.success) {
        setProducts(prev => prev.map(p => p.id === productId ? { ...p, stock_quantity: newStock } : p));
      }
    } catch (err) {
      console.error('Update Stock Error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Render Order Item Card
  const renderOrderItem = ({ item }: { item: any }) => {
    const isPlaced = item.status === 'placed' || item.status === 'pending';
    const isPreparing = item.status === 'preparing';
    const isPacked = item.status === 'packed';
    const isCompleted = item.status === 'delivered' || item.status === 'declined' || item.status === 'cancelled';

    if (isCompleted) {
      return (
        <View style={[styles.card, { paddingVertical: 12 }]}>
          <View style={[styles.cardHeader, { marginBottom: 0 }]}>
            <View>
              <Text style={styles.orderIdText}>Order #{item.id.substring(0, 8).toUpperCase()}</Text>
              <Text style={styles.timeText}>{new Date(item.created_at).toLocaleTimeString()}</Text>
            </View>
            <View style={[styles.statusBadge, 
              item.status === 'delivered' && { backgroundColor: Colors.success + '15' },
              item.status === 'declined' && { backgroundColor: Colors.error + '15' },
              item.status === 'cancelled' && { backgroundColor: Colors.error + '15' }
            ]}>
              <Text style={[styles.statusText,
                item.status === 'delivered' && { color: Colors.success },
                item.status === 'declined' && { color: Colors.error },
                item.status === 'cancelled' && { color: Colors.error }
              ]}>
                {item.status.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>
      );
    }
    
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.orderIdText}>Order #{item.id.substring(0, 8).toUpperCase()}</Text>
            <Text style={styles.timeText}>{new Date(item.created_at).toLocaleTimeString()}</Text>
          </View>
          <View style={[styles.statusBadge, 
            (item.status === 'placed' || item.status === 'pending') && { backgroundColor: Colors.warning + '15' },
            item.status === 'preparing' && { backgroundColor: Colors.secondaryLight },
            item.status === 'packed' && { backgroundColor: Colors.primaryLight + '30' },
            item.status === 'ready' && { backgroundColor: Colors.primaryLight + '50' }
          ]}>
            <Text style={[styles.statusText,
              (item.status === 'placed' || item.status === 'pending') && { color: Colors.warning },
              item.status === 'preparing' && { color: Colors.secondary },
              item.status === 'packed' && { color: Colors.primaryDark },
              item.status === 'ready' && { color: Colors.primaryDark }
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
                  style={styles.squareDeclineBtn}
                  onPress={() => handleUpdateOrderStatus(item.id, 'declined')}
                >
                  <X size={14} color={Colors.error} />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.smallBtn, styles.acceptBtn]}
                  onPress={() => handleUpdateOrderStatus(item.id, 'preparing')}
                >
                  <Check size={14} color={Colors.white} />
                  <Text style={[styles.btnText, { color: Colors.white }]}>Accept</Text>
                </TouchableOpacity>
              </>
            )}
 
            {isPreparing && (
              <TouchableOpacity 
                style={[styles.smallBtn, styles.acceptBtn]}
                onPress={() => handleUpdateOrderStatus(item.id, 'packed')}
              >
                <Check size={14} color={Colors.white} />
                <Text style={[styles.btnText, { color: Colors.white }]}>Mark Packed</Text>
              </TouchableOpacity>
            )}
 
            {isPacked && (
              <TouchableOpacity 
                style={[styles.smallBtn, styles.acceptBtn]}
                onPress={() => handleUpdateOrderStatus(item.id, 'ready')}
              >
                <Check size={14} color={Colors.white} />
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
          {Array.isArray(item.variants) && item.variants.length > 0 ? (
            <Text style={styles.productVariantsCount}>
              {item.variants.length} Variants ({item.variants.map((v: any) => v.unit).join(', ')})
            </Text>
          ) : item.unit ? (
            <Text style={styles.productUnit}>{item.unit}</Text>
          ) : null}
          <Text style={styles.productPrice}>
            {Array.isArray(item.variants) && item.variants.length > 0 ? `From ₹${item.price}` : `₹${item.price}`}
          </Text>
          
          {Array.isArray(item.variants) && item.variants.length > 0 ? (
            <Text style={styles.variantStockNotice}>Manage stock via edit</Text>
          ) : (
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
          )}
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

        {/* Edit / Delete Actions */}
        <View style={styles.productActions}>
          <TouchableOpacity
            style={styles.actionIconBtn}
            onPress={() => {
              setEditingProduct(item);
              setShowProductModal(true);
            }}
          >
            <Pencil size={18} color={Colors.secondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionIconBtn}
            onPress={() => handleDeleteProduct(item.id)}
          >
            <Trash2 size={18} color={Colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      
      {/* Header Panel with Store Selector */}
      <View style={styles.header}>
        <View style={styles.storeHeader}>
          <TouchableOpacity
            style={styles.storeSelectorBtn}
            onPress={() => setShowStoreSwitcher(true)}
          >
            <View>
              <View style={styles.titleRow}>
                <Text style={styles.storeTitle}>{store?.name || 'Select Store'}</Text>
                <ChevronDown size={18} color={Colors.text} style={{ marginLeft: 6, marginTop: 4 }} />
              </View>
              <Text style={styles.ownerSubtitle}>Logged in as {userData.fullName || 'Owner'}</Text>
            </View>
          </TouchableOpacity>
          
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
          <View style={{ flex: 1 }}>
            <TouchableOpacity 
              style={styles.addProductBtn}
              onPress={() => {
                setEditingProduct(null);
                setShowProductModal(true);
              }}
            >
              <Plus size={18} color={Colors.white} />
              <Text style={styles.addProductBtnText}>Add Product Item</Text>
            </TouchableOpacity>
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
          </View>
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

      {/* Add / Edit Product Modal */}
      <AddEditProductModal
        visible={showProductModal}
        onClose={() => {
          setShowProductModal(false);
          setEditingProduct(null);
        }}
        onSave={handleSaveProduct}
        product={editingProduct}
      />

      {/* Create Store Modal */}
      <CreateStoreModal
        visible={showCreateStoreModal}
        onClose={() => setShowCreateStoreModal(false)}
        userData={userData}
        onSuccess={async () => {
          await onRefreshStores();
        }}
      />

      {/* Store Switcher Modal */}
      <Modal
        visible={showStoreSwitcher}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowStoreSwitcher(false)}
      >
        <View style={styles.switcherOverlay}>
          <View style={styles.switcherContent}>
            <View style={styles.switcherHeader}>
              <Text style={styles.switcherTitle}>Switch Store Dashboard</Text>
              <TouchableOpacity onPress={() => setShowStoreSwitcher(false)} style={styles.switcherCloseBtn}>
                <X size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.switcherListContainer}>
              {storesList && storesList.map((item) => {
                const isActive = item.id === store?.id;
                const isApproved = item.approval_status === 'approved';
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.storeOptionCard,
                      isActive && styles.activeStoreOptionCard,
                    ]}
                    onPress={() => {
                      onSelectStore(item);
                      setShowStoreSwitcher(false);
                    }}
                  >
                    <Store size={22} color={isActive ? Colors.primary : Colors.textSecondary} />
                    <View style={styles.storeOptionDetails}>
                      <Text style={[
                        styles.storeOptionName,
                        isActive && styles.activeStoreOptionName
                      ]}>
                        {item.name}
                      </Text>
                      <Text style={styles.storeOptionCategory}>
                        {item.category.toUpperCase()} • {item.city}
                      </Text>
                    </View>
                    
                    <View style={[
                      styles.badge,
                      isApproved ? styles.approvedBadge : styles.pendingBadge
                    ]}>
                      <Text style={[
                        styles.badgeText,
                        isApproved ? styles.approvedBadgeText : styles.pendingBadgeText
                      ]}>
                        {item.approval_status.toUpperCase()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* Create new store button */}
              <TouchableOpacity
                style={styles.createNewStoreBtn}
                onPress={() => {
                  setShowStoreSwitcher(false);
                  setShowCreateStoreModal(true);
                }}
              >
                <Plus size={20} color={Colors.white} style={{ marginRight: 8 }} />
                <Text style={styles.createNewStoreBtnText}>Register A New Store</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
      {isProcessing && (
        <View style={styles.processingOverlay}>
          <View style={styles.processingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.processingText}>Processing...</Text>
          </View>
        </View>
      )}
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
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  ownerSubtitle: {
    fontSize: 9.5,
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
    fontSize: 9.5,
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
    fontSize: 10.5,
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
    fontSize: 11.5,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  timeText: {
    fontSize: 9,
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
    fontSize: 8,
    fontFamily: Fonts.bold,
  },
  itemsList: {
    marginBottom: 12,
  },
  itemText: {
    fontSize: 10.5,
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
    fontSize: 11.5,
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
    height: 30,
    borderRadius: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
  },
  declineBtn: {
    borderColor: Colors.error + '50',
    backgroundColor: Colors.error + '10',
  },
  squareDeclineBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.error + '40',
    backgroundColor: Colors.error + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptBtn: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  btnText: {
    fontSize: 9.5,
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
    fontSize: 11.5,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  productPrice: {
    fontSize: 9.5,
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
    fontSize: 8.5,
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
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  stockInput: {
    width: 40,
    textAlign: 'center',
    fontSize: 9.5,
    fontFamily: Fonts.bold,
    color: Colors.text,
    padding: 0,
  },
  toggleContainer: {
    alignItems: 'center',
    marginLeft: 8,
  },
  toggleLabel: {
    fontSize: 7.5,
    fontFamily: Fonts.bold,
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 10.5,
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
    fontSize: 10.5,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  balanceValue: {
    fontSize: 24,
    fontFamily: Fonts.black,
    color: Colors.primaryDark,
    fontWeight: '900',
  },
  totalLabel: {
    fontSize: 9,
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
    fontSize: 9.5,
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
    fontSize: 11.5,
    fontFamily: Fonts.bold,
    color: Colors.error,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storeSelectorBtn: {
    flex: 1,
  },
  addProductBtn: {
    backgroundColor: '#000000', // Matches Black pill style
    height: 52,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 15,
    marginBottom: 5,
    gap: 8,
  },
  addProductBtnText: {
    color: Colors.white,
    fontSize: 11.5,
    fontFamily: Fonts.black,
    fontWeight: '900',
  },
  productActions: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginLeft: 12,
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
    paddingLeft: 12,
  },
  actionIconBtn: {
    padding: 4,
  },
  // Switcher overlay styles
  switcherOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  switcherContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    maxHeight: '70%',
    paddingBottom: 40,
  },
  switcherHeader: {
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
  switcherTitle: {
    fontSize: 13.5,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  switcherCloseBtn: {
    padding: 4,
  },
  switcherListContainer: {
    padding: 20,
    gap: 12,
  },
  storeOptionCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  activeStoreOptionCard: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight + '10',
  },
  storeOptionDetails: {
    flex: 1,
    marginLeft: 12,
  },
  storeOptionName: {
    fontSize: 11.5,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  activeStoreOptionName: {
    color: Colors.primaryDark,
  },
  storeOptionCategory: {
    fontSize: 8,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  approvedBadge: {
    backgroundColor: Colors.success + '15',
  },
  pendingBadge: {
    backgroundColor: Colors.warning + '15',
  },
  badgeText: {
    fontSize: 7.5,
    fontFamily: Fonts.bold,
  },
  approvedBadgeText: {
    color: Colors.success,
  },
  pendingBadgeText: {
    color: Colors.warning,
  },
  createNewStoreBtn: {
    backgroundColor: '#000000', // Matches Black pill style
    height: 56,
    borderRadius: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  createNewStoreBtnText: {
    color: Colors.white,
    fontSize: 11.5,
    fontFamily: Fonts.black,
    fontWeight: '900',
  },
  processingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  processingContainer: {
    backgroundColor: Colors.white,
    paddingHorizontal: 30,
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
    gap: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  processingText: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  productVariantsCount: {
    fontSize: 8.5,
    fontFamily: Fonts.bold,
    color: Colors.primary,
    marginTop: 2,
  },
  productUnit: {
    fontSize: 8.5,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  variantStockNotice: {
    fontSize: 8.5,
    fontFamily: Fonts.medium,
    fontStyle: 'italic',
    color: Colors.textLight,
    marginTop: 8,
  },
});

export default HomeScreen;
