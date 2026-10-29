import { EmployeePageHeading } from '../../../src/features/employee/EmployeePageHeading';
import { useToastState } from '../../../src/ui/useToastState';
import { RefreshButton } from '../../../src/features/employee/components';
import { AppIcon } from "../../../src/ui/AppIcon";

import React from "react";
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
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
import { File, Paths } from 'expo-file-system';

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
  const [fileError, setFileError] = useToastState('', 'error');
  const [fileErrorId, setFileErrorId] = useState('');
  const [downloadingId, setDownloadingId] = useState('');
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

  const downloadAttachment = async (document: EmployeeDocument) => {
    setDownloadingId(document.id);
    setFileError('');
    setFileErrorId('');
    let cachedFile: File | undefined;
    try {
      const remote = await employeeDocumentsApi.file(document.id);
      if (Platform.OS === 'web') {
        const link = window.document.createElement('a');
        link.href = `data:${remote.mimeType};base64,${remote.fileDataBase64}`;
        link.download = remote.fileName;
        link.click();
      } else {
        const Sharing = await import('expo-sharing');
        if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is unavailable on this device.');
        const safeName = remote.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        cachedFile = new File(Paths.cache, `${document.id}-${safeName}`);
        cachedFile.write(remote.fileDataBase64, { encoding: 'base64' });
        await Sharing.shareAsync(cachedFile.uri, { mimeType: remote.mimeType, dialogTitle: remote.fileName });
      }
    } catch (cause) {
      setFileError(cause instanceof Error ? cause.message : 'Could not download this attachment. Try again.');
      setFileErrorId(document.id);
    } finally {
      try { cachedFile?.delete(); } catch { /* Preserve the download result. */ }
      setDownloadingId('');
    }
  };

  // ===================================================
  // DOCUMENT SOURCE
  // ===================================================

  // ===================================================
  // LOADING STATE
  // ===================================================

  if (profileLoading) {
    return (
      <>
      <EmployeePageHeading title="My documents" backTo={"profile"}><RefreshButton label={documentsError ? 'Retry loading documents' : 'Refresh documents'} loading={documentsLoading}
          retry={!!documentsError} onPress={() => setReload(value => value + 1)} /></EmployeePageHeading>
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
    </>
    );
  }

  // ===================================================
  // ERROR STATE
  // ===================================================

  if (profileError) {
    return (
      <>
      <EmployeePageHeading title="My documents" backTo={"profile"}><RefreshButton label={documentsError ? 'Retry loading documents' : 'Refresh documents'} loading={documentsLoading}
          retry={!!documentsError} onPress={() => setReload(value => value + 1)} /></EmployeePageHeading>
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
    </>
    );
  }

  // ===================================================
  // DOCUMENTS UI
  // ===================================================

  return (
    <>
      <EmployeePageHeading title="My documents" backTo={"profile"}><RefreshButton label={documentsError ? 'Retry loading documents' : 'Refresh documents'} loading={documentsLoading}
          retry={!!documentsError} onPress={() => setReload(value => value + 1)} /></EmployeePageHeading>
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
        <Text accessibilityRole="header" style={s.cardTitle}>My employment documents</Text>
        <Text style={s.small}>{documentsLoading ? 'Loading your documents…' : `${documents.length} ${documents.length === 1 ? 'document' : 'documents'} available`}</Text>

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

      {documentsLoading ? (
        <View style={[s.card, pageStyles.stateCard]}>
          <ActivityIndicator color={colors.primary} />
          <Text style={s.small}>Loading your documents…</Text>
        </View>
      ) : documentsError ? (
        <View style={s.card}>
          <Text accessibilityRole="alert" style={s.error}>{documentsError}</Text>
          <Pressable accessibilityRole="button" onPress={() => setReload(value => value + 1)} style={s.documentPreview}>
            <Text style={s.documentButtonText}>Try again</Text>
          </Pressable>
        </View>
      ) : documents.length > 0 ? (
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
                <Text numberOfLines={2} style={[s.cardTitle, pageStyles.documentTitle]}>
                  {document.title}
                </Text>

                <Text style={s.small}>
                  {documentDate(document.date)}
                  {" · "}
                  {document.kind}
                </Text>
              </View>

              <View accessibilityLabel={`Status: ${document.status}`}
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

            {document.fileName ? <Text numberOfLines={1} style={s.small}>Attached file: {document.fileName}</Text> : null}
            {fileErrorId === document.id && !!fileError && <Text accessibilityRole="alert" style={s.error}>{fileError}</Text>}
            <View style={pageStyles.documentActions}>
            {document.content ? <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Preview ${document.title}`}
              onPress={() => {
                setActiveDocument(document);
                setDialog("document");
              }}
              style={({ pressed }) => [
                s.documentPreview, pageStyles.actionButton,
                pressed && pageStyles.pressed,
              ]}
            >
              <AppIcon name="eye" size={17} color={colors.primary} />
              <Text style={s.documentButtonText}>Preview</Text>
            </Pressable> : null}
            {document.fileName ? <Pressable accessibilityRole="button" accessibilityLabel={`Download ${document.fileName}`} accessibilityState={{ disabled: downloadingId !== '', busy: downloadingId === document.id }} disabled={downloadingId !== ''} onPress={() => void downloadAttachment(document)} style={[s.documentPreview, pageStyles.actionButton, downloadingId === document.id && pageStyles.busyButton]}><AppIcon name={downloadingId === document.id ? 'clock' : 'download'} size={17} color={colors.primary} /><Text numberOfLines={1} style={s.documentButtonText}>{downloadingId === document.id ? 'Preparing…' : 'Download file'}</Text></Pressable> : null}
            </View>
            {!document.content && !document.fileName ? <Text style={s.small}>No preview or file is attached to this document.</Text> : null}
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

    </View>
    </>
  );
}

const pageStyles = StyleSheet.create({
  stateCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  documentTitle: { flexShrink: 1, minWidth: 0 },
  documentActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionButton: { flex: 1, minWidth: 112, flexDirection: 'row', gap: 8, paddingHorizontal: 10 },
  busyButton: { opacity: 0.55 },
  pressed: { opacity: 0.75 },
});
