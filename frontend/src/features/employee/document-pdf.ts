
import { Platform } from "react-native";

import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { File } from "expo-file-system";
import { toast } from "../../ui/toast-store";

import type { EmployeeDocument } from "./data";

// =====================================================
// TYPES
// =====================================================

/**
 * Employee identity obtained from the authenticated
 * employee workspace, rather than fabricated data.
 */
export type PdfEmployeeIdentity = {
  name: string;
  employeeId: string;
  company?: string;
};

/**
 * This legacy EmployeeDocument type currently
 * represents local workspace documents.
 *
 * The caller must verify a document's source
 * before allowing it to be exported.
 */
export type PdfExportOptions = {
  document: EmployeeDocument;
  employee: PdfEmployeeIdentity;
  sourceVerified: boolean;
};

type PdfSaveHandle = {
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>;
    close: () => Promise<void>;
    abort: () => Promise<void>;
  }>;
};

type PdfSavePicker = (options: {
  suggestedName: string;
  startIn: "downloads";
  types: {
    description: string;
    accept: Record<string, string[]>;
  }[];
}) => Promise<PdfSaveHandle>;

// =====================================================
// HELPERS
// =====================================================

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );
}

function safeFilenamePart(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 60);
}

function ensureVerified(
  options: PdfExportOptions,
): void {
  if (!options.sourceVerified) {
    throw new Error(
      "This document has not been verified against a backend document record. PDF export is unavailable.",
    );
  }

  if (
    !options.employee.name.trim() ||
    !options.employee.employeeId.trim()
  ) {
    throw new Error(
      "An authenticated employee name and ID are required.",
    );
  }

  if (!options.document.title.trim()) {
    throw new Error(
      "The document title is missing.",
    );
  }

  if (!options.document.content.trim()) {
    throw new Error(
      "The document has no content to export.",
    );
  }
}

// =====================================================
// PDF FILENAME
// =====================================================

export function documentPdfFilename(
  document: EmployeeDocument,
  employee: PdfEmployeeIdentity,
): string {
  const title =
    safeFilenamePart(document.title) || "Document";

  const employeeCode =
    safeFilenamePart(employee.employeeId) || "Employee";

  return `BranchSuite_${title}_${employeeCode}.pdf`;
}

// =====================================================
// HTML FOR NATIVE PDF
// =====================================================

function buildPdfHtml(
  options: PdfExportOptions,
  filename: string,
): string {
  const { document, employee } = options;

  const company = employee.company?.trim() || "";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  />
  <title>${escapeHtml(filename)}</title>

  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 32px;
      color: #17263f;
      line-height: 1.6;
    }

    h1 {
      font-size: 24px;
      margin-bottom: 14px;
    }

    .identity {
      margin-bottom: 18px;
      font-size: 12px;
      color: #5f7088;
    }

    .content {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font-size: 12px;
    }

    .footer {
      margin-top: 30px;
      padding-top: 12px;
      border-top: 1px solid #e0e7f0;
      color: #5f7088;
      font-size: 10px;
    }
  </style>
</head>

<body>
  <h1>${escapeHtml(document.title)}</h1>

  <div class="identity">
    <strong>Employee:</strong>
    ${escapeHtml(employee.name)}
    <br />

    <strong>Employee ID:</strong>
    ${escapeHtml(employee.employeeId)}

    ${
      company
        ? `<br /><strong>Company:</strong> ${escapeHtml(company)}`
        : ""
    }
  </div>

  <div class="content">${escapeHtml(
    document.content,
  )}</div>

  <div class="footer">
    Exported from BranchSuite Business.
    This PDF is a copy of an existing document
    and is not a digital signature or
    independent certification.
  </div>
</body>
</html>
`;
}

// =====================================================
// NATIVE PDF FILE
// =====================================================

async function createNamedNativePdf(
  html: string,
  filename: string,
) {
  const { uri } = await Print.printToFileAsync({
    html,
  });

  const generatedPdf = new File(uri);

  const namedPdf = new File(
    generatedPdf.parentDirectory,
    filename,
  );

  try {
    if (namedPdf.exists) {
      namedPdf.delete();
    }

    generatedPdf.copy(namedPdf);

    return namedPdf;
  } finally {
    try {
      generatedPdf.delete();
    } catch {
      // Ignore temporary cleanup failures.
    }
  }
}

// =====================================================
// PDF EXPORT
// =====================================================

export async function saveDocumentPdf(
  options: PdfExportOptions,
): Promise<void> {
  ensureVerified(options);

  const { document, employee } = options;

  const filename = documentPdfFilename(
    document,
    employee,
  );

  // ===================================================
  // WEB EXPORT
  // ===================================================

  if (Platform.OS === "web") {
    const browserWindow = window as unknown as {
      showSaveFilePicker?: PdfSavePicker;
    };

    let handle: PdfSaveHandle | undefined;

    if (browserWindow.showSaveFilePicker) {
      try {
        handle =
          await browserWindow.showSaveFilePicker({
            suggestedName: filename,
            startIn: "downloads",
            types: [
              {
                description: "PDF document",
                accept: {
                  "application/pdf": [".pdf"],
                },
              },
            ],
          });
      } catch (error) {
        if (
          error instanceof Error &&
          error.name === "AbortError"
        ) {
          return;
        }

        throw error;
      }
    }

    const { jsPDF } = await import("jspdf");

    const pdf = new jsPDF();

    pdf.setProperties({
      title: filename,
    });

    const blocks = [
      document.title,
      `Employee: ${employee.name}`,
      `Employee ID: ${employee.employeeId}`,
      ...(employee.company
        ? [`Company: ${employee.company}`]
        : []),
      document.content,
      "Exported from BranchSuite Business. This PDF is not a digital signature or independent certification.",
    ];

    let y = 22;

    blocks.forEach((block, index) => {
      pdf.setFont(
        "helvetica",
        index === 0 ? "bold" : "normal",
      );

      pdf.setFontSize(
        index === 0 ? 18 : 11,
      );

      const lines: string[] =
        pdf.splitTextToSize(block, 170);

      for (const line of lines) {
        if (y > 275) {
          pdf.addPage();
          y = 22;
        }

        pdf.text(line, 20, y);

        y += index === 0 ? 9 : 6;
      }

      y += 8;
    });

    if (handle) {
      const writable =
        await handle.createWritable();

      try {
        await writable.write(
          pdf.output("blob"),
        );

        await writable.close();
      } catch (error) {
        await writable
          .abort()
          .catch(() => undefined);

        throw error;
      }
    } else {
      pdf.save(filename);
    }

    return;
  }

  // ===================================================
  // NATIVE HTML
  // ===================================================

  const html = buildPdfHtml(
    options,
    filename,
  );

  // ===================================================
  // ANDROID EXPORT
  // ===================================================

  if (Platform.OS === "android") {
    const { saveAndroidReport } = await import("../../core/admin/android-report-export");
    try {
      await saveAndroidReport("pdf", filename.replace(/\.pdf$/i, ""), "", html);
      toast.success(`Saved ${filename} to the selected folder.`);
      return;
    } catch (error) {
      if (error instanceof Error && /picker was cancelled by the user/i.test(error.message)) return;
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error("Could not save the PDF. Choose a different folder and try again.");
      }

      const generatedPdf = await Print.printToFileAsync({ html });
      try {
        await Sharing.shareAsync(generatedPdf.uri, {
          mimeType: "application/pdf",
          UTI: "com.adobe.pdf",
          dialogTitle: `Save ${filename}`,
        });
        toast.info("Choose a save destination in the share sheet to finish downloading the PDF.");
      } catch {
        throw new Error("Could not open the save options. Please try downloading the PDF again.");
      } finally {
        try { new File(generatedPdf.uri).delete(); } catch { /* Keep the save result. */ }
      }
    }

    return;
  }

  // ===================================================
  // IOS / OTHER NATIVE EXPORT
  // ===================================================

  if (await Sharing.isAvailableAsync()) {
    const namedPdf =
      await createNamedNativePdf(
        html,
        filename,
      );

    try {
      await Sharing.shareAsync(
        namedPdf.uri,
        {
          mimeType: "application/pdf",
          UTI: "com.adobe.pdf",
          dialogTitle:
            "Save employee document PDF",
        },
      );
    } finally {
      try {
        namedPdf.delete();
      } catch {
        // Ignore temporary cleanup failures.
      }
    }
  } else {
    await Print.printAsync({
      html,
    });
  }
}
