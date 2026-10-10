import { Pressable, Text, View } from 'react-native';
import { EmployeeDocument, colors, employmentLetter, sampleDocuments, documentDate, dayKey } from '../../../src/features/employee/data';
import { Icon } from '../../../src/features/employee/components';
import { s } from '../../../src/features/employee/styles';
import { useEmployeeWorkspace } from '../../../src/features/employee/workspace';

export default function DocumentsScreen() {
  const { records, setRecords, setDialog, setActiveDocument } = useEmployeeWorkspace();
  return (
    <View style={s.column}>
      {(records.documents ?? sampleDocuments).map(
        (document) => (
          <View key={document.id} style={[s.card, { gap: 16 }]}>
            <View style={s.row}>
              <Icon symbol="document" />
              <View style={s.flex}>
                <Text style={s.cardTitle}>{document.title}</Text>
                <Text style={s.small}>{documentDate(document.date)} · {document.kind}</Text>
              </View>
              <View style={[s.documentBadge, document.status === "Verified" && { backgroundColor: "#E2F4EC" }]}>
                <Text style={[s.documentBadgeText, document.status === "Verified" && { color: colors.primary }]}>{document.status}</Text>
              </View>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={`Preview and save ${document.title}`} style={({ pressed }) => [s.documentPreview, pressed && { opacity: 0.65 }]} onPress={() => { setActiveDocument(document); setDialog("document"); }}>
              <Text style={s.documentButtonText}>Preview & save</Text>
            </Pressable>
          </View>
        ),
      )}
      <Pressable accessibilityRole="button" style={({ pressed }) => [s.createLetter, pressed && { opacity: 0.65 }]} onPress={() => {
        const date = dayKey();
        const document: EmployeeDocument = { id: `letter-${Date.now()}`, title: "Sample employment letter", date, kind: "Letter", status: "Available", content: employmentLetter(date) };
        setRecords((current) => ({ ...current, documents: [...(current.documents ?? sampleDocuments), document] }));
        setActiveDocument(document); setDialog("document");
      }}>
        <Text style={[s.documentButtonText, { color: colors.primary }]}>Create sample employment letter</Text>
      </Pressable>
    </View>

  );
}
