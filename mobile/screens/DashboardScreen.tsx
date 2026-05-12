import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

const stats = [
  { label: "Properties", value: "3", color: "#3b82f6" },
  { label: "Occupancy", value: "87%", color: "#10b981" },
  { label: "Revenue", value: "$24.8k", color: "#f59e0b" },
  { label: "Open Maint", value: "3", color: "#ef4444" },
];

export function DashboardScreen() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.greeting}>Welcome back 👋</Text>
      <Text style={styles.subtitle}>Portfolio Overview</Text>

      <View style={styles.grid}>
        {stats.map((s) => (
          <View key={s.label} style={styles.card}>
            <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {["Rent payment received — Unit 2B", "Maintenance request — Unit 4A", "New application — 456 Oak Ave"].map((item, i) => (
          <View key={i} style={styles.listItem}>
            <View style={[styles.dot, { backgroundColor: ["#10b981", "#f59e0b", "#8b5cf6"][i] }]} />
            <Text style={styles.listText}>{item}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#09090b", padding: 16 },
  greeting: { fontSize: 24, fontWeight: "bold", color: "#fafafa", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#a1a1aa", marginBottom: 20 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 },
  card: { width: "47%", backgroundColor: "#18181b", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#27272a" },
  statValue: { fontSize: 28, fontWeight: "bold" },
  statLabel: { fontSize: 11, color: "#a1a1aa", marginTop: 4, textTransform: "uppercase" },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: "#fafafa", marginBottom: 12 },
  listItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#27272a" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  listText: { fontSize: 14, color: "#d4d4d8" },
});
