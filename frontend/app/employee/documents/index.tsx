
import React from "react";

import {
  Pressable,
  Text,
  View,
} from "react-native";

import {
  colors,
  documentDate,
} from "../../../src/features/employee/data";

import {
  Icon,
} from "../../../src/features/employee/components";

import {
  s,
} from "../../../src/features/employee/styles";

import {
  useEmployeeWorkspace,
} from "../../../src/features/employee/workspace";

// =====================================================
// EMPLOYEE DOCUMENTS SCREEN
// =====================================================

export default function DocumentsScreen() {
  const {
    employeeName,
    employeeId,
    employeeCompany,
    profileLoading,
    profileError,
    setDialog,
    setActiveDocument,
  } = useEmployeeWorkspace();

  // ===================================================
  // DOCUMENT SOURCE
  // ===================================================

  /**
   * Document API integration is pending.
   *
   * Do not use records.documents or sampleDocuments:
   * those are local/demo records and cannot establish
   * that the employer issued or verified a document.
   *
   * Once an employee-authorized Documents API exists,
   * replace this with documents fetched for the
   * authenticated employee.
   */
  const documents: Array<{
    id: string;
    title: string;
    date: string;
    kind: "Letter" | "Verification";
    status: "Available" | "Verified";
    content: string;
  }> = [];

  // ===================================================
  // LOADING STATE
  // ===================================================

  if (profileLoading) {
    return (
      <View style={s.column}>
        <View style={s.card}>
          <Text style={s.cardTitle}>
            Loading employee information...
          </Text>

          <Text
            style={[
              s.small,
              { marginTop: 8 },
            ]}
          >
            Please wait while we retrieve
            your employee profile.
          </Text>
        </View>
      </View>
    );
  }

  // ===================================================
  // ERROR STATE
  // ===================================================

  if (profileError) {
    return (
      <View style={s.column}>
        <View style={s.card}>
          <Text style={s.cardTitle}>
            Employee profile unavailable
          </Text>

          <Text
            style={[
              s.small,
              { marginTop: 8 },
            ]}
          >
            {profileError}
          </Text>
        </View>
      </View>
    );
  }

  // ===================================================
  // DOCUMENTS UI
  // ===================================================

  return (
    <View style={s.column}>
      {/* EMPLOYEE SUMMARY */}

      <View
        style={[
          s.card,
          {
            gap: 8,
            marginBottom: 14,
          },
        ]}
      >
        <Text style={s.cardTitle}>
          My employment documents
        </Text>

        <Text style={s.small}>
          Employee: {employeeName}
        </Text>

        <Text style={s.small}>
          Employee ID: {employeeId || "Not assigned"}
        </Text>

        <Text style={s.small}>
          Company: {employeeCompany}
        </Text>
      </View>

      {/* DOCUMENT LIST */}

      {documents.length > 0 ? (
        documents.map((document) => (
          <View
            key={document.id}
            style={[
              s.card,
              { gap: 16 },
            ]}
          >
            <View style={s.row}>
              <Icon symbol="document" />

              <View style={s.flex}>
                <Text style={s.cardTitle}>
                  {document.title}
                </Text>

                <Text style={s.small}>
                  {documentDate(document.date)}
                  {" · "}
                  {document.kind}
                </Text>
              </View>

              <View
                style={[
                  s.documentBadge,
                  document.status === "Verified" && {
                    backgroundColor: "#E2F4EC",
                  },
                ]}
              >
                <Text
                  style={[
                    s.documentBadgeText,
                    document.status === "Verified" && {
                      color: colors.primary,
                    },
                  ]}
                >
                  {document.status}
                </Text>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Preview ${document.title}`}
              onPress={() => {
                setActiveDocument(document);
                setDialog("document");
              }}
              style={({ pressed }) => [
                s.documentPreview,
                pressed && {
                  opacity: 0.65,
                },
              ]}
            >
              <Text style={s.documentButtonText}>
                Preview document
              </Text>
            </Pressable>
          </View>
        ))
      ) : (
        // ============================================
        // EMPTY STATE
        // ============================================

        <View
          style={[
            s.card,
            {
              gap: 12,
              alignItems: "center",
              paddingVertical: 32,
              paddingHorizontal: 20,
            },
          ]}
        >
          <Icon symbol="document" />

          <Text
            style={[
              s.cardTitle,
              {
                textAlign: "center",
              },
            ]}
          >
            Documents not available yet
          </Text>

          <Text
            style={[
              s.small,
              {
                textAlign: "center",
                lineHeight: 20,
              },
            ]}
          >
            Your employment letters,
            verification documents,
            and other official records
            will appear here once
            document integration is enabled.
          </Text>
        </View>
      )}

      {/* DOCUMENT INFORMATION */}

      <View
        style={[
          s.card,
          {
            gap: 8,
            marginTop: 14,
          },
        ]}
      >
        <Text style={s.cardTitle}>
          Need an employment document?
        </Text>

        <Text style={s.small}>
          Please contact your company
          administrator or HR team to
          request an official employment
          confirmation or verification document.
        </Text>
      </View>
    </View>
  );
}
