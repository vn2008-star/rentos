import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";

const mockPayments = [
  { id: "1", desc: "Rent — Unit 2B", amount: "$1,850", date: "Jan 1", status: "paid", color: "#10b981" },
  { id: "2", desc: "Rent — Unit 4A", amount: "$2,200", date: "Jan 1", status: "paid", color: "#10b981" },
  { id: "3", desc: "Maintenance — Unit 1A", amount: "$560", date: "Jan 10", status: "pending", color: "#f59e0b" },
];

export function PaymentsScreen() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Payments</Text>
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Monthly Revenue</Text>
        <Text style={styles.totalValue}>$24,800</Text>
        <Text style={styles.totalSub}>+12% from last month</Text>
      </View>

      <Text style={styles.sectionTitle}>Recent Transactions</Text>
      {mockPayments.map(p => (
        <View key={p.id} style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowDesc}>{p.desc}</Text>
            <Text style={styles.rowDate}>{p.date}</Text>
          </View>
          <View style={styles.rowRight}>
            <Text style={styles.rowAmount}>{p.amount}</Text>
            <View style={[styles.badge, { backgroundColor: p.color + "20" }]}>
              <Text style={[styles.badgeText, { color: p.color }]}>{p.status}</Text>
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#09090b", padding: 16 },
  title: { fontSize: 20, fontWeight: "bold", color: "#fafafa", marginBottom: 16 },
  totalCard: { backgroundColor: "#18181b", borderRadius: 16, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: "#8b5cf620", alignItems: "center" },
  totalLabel: { fontSize: 12, color: "#a1a1aa" },
  totalValue: { fontSize: 36, fontWeight: "bold", color: "#10b981", marginVertical: 4 },
  totalSub: { fontSize: 12, color: "#10b981" },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: "#fafafa", marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#27272a" },
  rowLeft: {},
  rowRight: { alignItems: "flex-end" },
  rowDesc: { fontSize: 14, color: "#fafafa", fontWeight: "500" },
  rowDate: { fontSize: 11, color: "#a1a1aa", marginTop: 2 },
  rowAmount: { fontSize: 15, fontWeight: "bold", color: "#fafafa" },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
  badgeText: { fontSize: 10, fontWeight: "600", textTransform: "capitalize" },
});
