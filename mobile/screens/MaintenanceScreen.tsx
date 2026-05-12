import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";

const mockRequests = [
  { id: "1", title: "Kitchen sink leak", unit: "Unit 2B", priority: "urgent", status: "in_progress", color: "#f59e0b" },
  { id: "2", title: "GFCI outlet not working", unit: "Unit 5A", priority: "routine", status: "assigned", color: "#3b82f6" },
  { id: "3", title: "AC not cooling", unit: "Unit 1A", priority: "emergency", status: "submitted", color: "#ef4444" },
];

export function MaintenanceScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Maintenance</Text>
        <TouchableOpacity style={styles.addBtn}>
          <Text style={styles.addBtnText}>+ New Request</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summaryRow}>
        {[{ label: "Open", value: "3", color: "#f59e0b" }, { label: "In Progress", value: "1", color: "#3b82f6" }, { label: "Completed", value: "12", color: "#10b981" }].map(s => (
          <View key={s.label} style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.summaryLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {mockRequests.map(req => (
        <TouchableOpacity key={req.id} style={styles.card}>
          <View style={[styles.priorityBar, { backgroundColor: req.color }]} />
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>{req.title}</Text>
            <Text style={styles.cardSub}>{req.unit} · {req.priority}</Text>
            <View style={[styles.badge, { backgroundColor: req.color + "20" }]}>
              <Text style={[styles.badgeText, { color: req.color }]}>{req.status.replace("_", " ")}</Text>
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#09090b", padding: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 20, fontWeight: "bold", color: "#fafafa" },
  addBtn: { backgroundColor: "#8b5cf6", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  addBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  summaryRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  summaryCard: { flex: 1, backgroundColor: "#18181b", borderRadius: 10, padding: 12, alignItems: "center", borderWidth: 1, borderColor: "#27272a" },
  summaryValue: { fontSize: 22, fontWeight: "bold" },
  summaryLabel: { fontSize: 10, color: "#a1a1aa", marginTop: 2 },
  card: { backgroundColor: "#18181b", borderRadius: 12, marginBottom: 10, flexDirection: "row", overflow: "hidden", borderWidth: 1, borderColor: "#27272a" },
  priorityBar: { width: 4 },
  cardContent: { padding: 14, flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: "600", color: "#fafafa" },
  cardSub: { fontSize: 12, color: "#a1a1aa", marginTop: 3 },
  badge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 8 },
  badgeText: { fontSize: 11, fontWeight: "500", textTransform: "capitalize" },
});
