import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";

export function ProfileScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>JD</Text>
        </View>
        <Text style={styles.name}>James Davis</Text>
        <Text style={styles.role}>Property Manager</Text>
      </View>

      <View style={styles.section}>
        {[
          { label: "Notifications", value: "On" },
          { label: "Properties Managed", value: "3" },
          { label: "Active Tenants", value: "8" },
          { label: "Account Plan", value: "Professional" },
        ].map((item, i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.rowLabel}>{item.label}</Text>
            <Text style={styles.rowValue}>{item.value}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.logoutBtn}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>RentOS Mobile v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#09090b", padding: 16 },
  avatarSection: { alignItems: "center", marginVertical: 24 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#8b5cf6", justifyContent: "center", alignItems: "center" },
  avatarText: { fontSize: 24, fontWeight: "bold", color: "#fff" },
  name: { fontSize: 20, fontWeight: "bold", color: "#fafafa", marginTop: 12 },
  role: { fontSize: 13, color: "#a1a1aa", marginTop: 4 },
  section: { backgroundColor: "#18181b", borderRadius: 12, marginVertical: 16, borderWidth: 1, borderColor: "#27272a" },
  row: { flexDirection: "row", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: "#27272a" },
  rowLabel: { fontSize: 14, color: "#d4d4d8" },
  rowValue: { fontSize: 14, color: "#a1a1aa" },
  logoutBtn: { backgroundColor: "#27272a", borderRadius: 10, padding: 14, alignItems: "center", marginTop: 8 },
  logoutText: { color: "#ef4444", fontSize: 15, fontWeight: "600" },
  version: { textAlign: "center", fontSize: 11, color: "#52525b", marginTop: 24 },
});
