import { useToastState } from '../../../src/ui/useToastState';
import { AppIcon } from "../../../src/ui/AppIcon";

import React from "react";
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

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
  useEmployeeStyles,
} from "../../../src/features/employee/styles";

import {
  useEmployeeWorkspace,
} from "../../../src/features/employee/workspace";
import { employeeDocumentsApi } from '../../../src/core/admin/workspace-records.api';
import type { EmployeeDocument } from '../../../src/features/employee/data';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

// =====================================================
// EMPLOYEE DOCUMENTS SCREEN
// =====================================================

export default function DocumentsScreen() {
  const s = useEmployeeStyles();
  const {
    employeeName,
    employeeId,
    employeeCompany,
    employeeCompanyId,
    employeeProfiles,
    profileLoading,
    profileError,
    setDialog,
    setActiveDocument,
  } = useEmployeeWorkspace();

  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [documentsError, setDocumentsError] = useToastState('', 'error');
  const [reload, setReload] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    setDocumentsLoading(true);
    setDocumentsError('');
    employeeDocumentsApi.mine().then(items => {
      if (active) setDocuments(items.filter(item => !employeeCompanyId || item.companyId === employeeCompanyId).map(item => ({
        id: item.id, title: item.title, date: item.createdAt,
        kind: item.kind === 'VERIFICATION' ? 'Verification' : item.kind === 'OTHER' ? 'Other' : 'Letter',
        status: item.status === 'VERIFIED' ? 'Verified' : 'Available', content: item.content ?? '', fileName: item.fileName, mimeType: item.mimeType,
        source: 'server',
        employeeCode: employeeProfiles.find(profile => profile.companyId === item.companyId)?.employeeCode ?? '',
        companyName: employeeProfiles.find(profile => profile.companyId === item.companyId)?.company.name ?? '',
      })));
    }).catch(reason => { if (active) setDocumentsError(reason instanceof Error ? reason.message : 'Could not load your documents.'); })
      .finally(() => { if (active) setDocumentsLoading(false); });
    return () => { active = false; };
  }, [employeeCompanyId, employeeProfiles, reload]));

  // ===================================================
  // DOCUMENT SOURCE
  // ===================================================

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
      <Pressable accessibilityRole="button" disabled={documentsLoading} onPress={() => setReload(value => value + 1)} style={s.secondary}><Text style={s.cardTitle}>{documentsError ? 'Retry loading documents' : 'Refresh documents'}</Text></Pressable>

      {documentsLoading ? <View style={s.card}><Text style={s.cardTitle}>Loading documents…</Text></View> : documentsError ? <View style={s.card}><Text accessibilityRole="alert" style={s.error}>{documentsError}</Text></View> : documents.length > 0 ? (
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

            {document.content ? <Pressable
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
            </Pressable> : null}
            {document.fileName ? <Pressable accessibilityRole="button" onPress={async () => {
              try {
                const file = await employeeDocumentsApi.file(document.id);
                if (Platform.OS === 'web') {
                  const link = window.document.createElement('a'); link.href = `data:${file.mimeType};base64,${file.fileDataBase64}`; link.download = file.fileName; link.click();
                } else {
                  const path = `${FileSystem.cacheDirectory}${file.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
                  await FileSystem.writeAsStringAsync(path, file.fileDataBase64, { encoding: FileSystem.EncodingType.Base64 });
                  const Sharing = await import('expo-sharing'); await Sharing.shareAsync(path, { mimeType: file.mimeType, dialogTitle: file.fileName });
                }
              } catch { setDocumentsError('Could not open this document file.'); }
            }} style={s.documentPreview}><Text style={s.documentButtonText}>Download {document.fileName}</Text></Pressable> : null}
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
            No documents issued yet
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
            Your HR team can issue verified employment letters and other official records to your account.
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
          Need an employment document
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
