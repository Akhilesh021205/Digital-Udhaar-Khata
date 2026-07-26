import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Platform,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, LogOut, CreditCard, Users, ArrowUpRight, ArrowDownLeft } from 'lucide-react-native';

export const HomeScreen: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>Namaste,</Text>
          <Text style={styles.userName}>{user?.name || 'Store Owner'}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn} title="Sign Out">
          <LogOut size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Store Card */}
        <View style={styles.storeCard}>
          <View style={styles.storeHeader}>
            <View style={styles.shieldWrapper}>
              <ShieldCheck size={24} color="#10B981" />
            </View>
            <Text style={styles.storeName}>{user?.storeName || 'My Ledger Store'}</Text>
          </View>
          <Text style={styles.balanceLabel}>Total Outstanding Balance</Text>
          <Text style={styles.balanceAmount}>₹24,850.00</Text>
          <View style={styles.balanceDetails}>
            <View style={styles.detailItem}>
              <ArrowDownLeft size={16} color="#EF4444" />
              <Text style={styles.detailText}>You Give: ₹35,200</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.detailItem}>
              <ArrowUpRight size={16} color="#10B981" />
              <Text style={styles.detailText}>You Get: ₹10,350</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity style={styles.actionCard}>
            <View style={[styles.actionIconBg, { backgroundColor: '#EEF2F6' }]}>
              <Users size={24} color="#DC2626" />
            </View>
            <Text style={styles.actionLabel}>Customers</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard}>
            <View style={[styles.actionIconBg, { backgroundColor: '#EEF2F6' }]}>
              <CreditCard size={24} color="#DC2626" />
            </View>
            <Text style={styles.actionLabel}>Payments</Text>
          </TouchableOpacity>
        </View>

        {/* Security Alert banner */}
        <View style={styles.securityBanner}>
          <ShieldCheck size={20} color="#10B981" />
          <Text style={styles.securityText}>
            Biometric Security is Active. Your ledger data is locked locally.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'column',
  },
  greeting: {
    fontSize: 13,
    color: '#64748B',
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
    marginTop: 2,
  },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 24,
  },
  storeCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 28,
  },
  storeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  shieldWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storeName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  balanceLabel: {
    fontSize: 12,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0F172A',
    marginTop: 6,
  },
  balanceDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 12,
  },
  detailText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 16,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 28,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    elevation: 1,
  },
  actionIconBg: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#334155',
  },
  securityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#D1FAE5',
    borderRadius: 16,
    padding: 16,
  },
  securityText: {
    fontSize: 12,
    color: '#065F46',
    fontWeight: '500',
    flex: 1,
    lineHeight: 16,
  },
});
