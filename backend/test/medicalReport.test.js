const test = require("node:test");
const assert = require("node:assert/strict");
const { validateMedicalReport } = require("../utils/medicalReport");
const { buildUserParts } = require("../utils/aiService");

function reportFile(originalname, mimetype, bytes) {
  return {
    originalname,
    mimetype,
    buffer: bytes,
    size: bytes.length,
  };
}

test("accepts dummy JPEG, PNG, and PDF reports with matching content signatures", () => {
  const examples = [
    reportFile("sample.jpg", "image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0x00])),
    reportFile(
      "sample.png",
      "image/png",
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])
    ),
    reportFile("sample.pdf", "application/pdf", Buffer.from("%PDF-1.7\nDummy report")),
  ];

  for (const example of examples) {
    assert.equal(validateMedicalReport(example).error, undefined);
  }
});

test("rejects mismatched extensions, MIME types, and file signatures", () => {
  assert.ok(validateMedicalReport(
    reportFile("sample.png", "image/jpeg", Buffer.from([0xff, 0xd8, 0xff]))
  ).error);
  assert.ok(validateMedicalReport(
    reportFile("sample.jpg", "image/png", Buffer.from([0xff, 0xd8, 0xff]))
  ).error);
  assert.ok(validateMedicalReport(
    reportFile("sample.pdf", "application/pdf", Buffer.from("not a PDF"))
  ).error);
  assert.ok(validateMedicalReport(
    reportFile("sample.txt", "text/plain", Buffer.from("dummy"))
  ).error);
});

test("enforces image and PDF size limits", () => {
  const image = reportFile("large.png", "image/png", Buffer.alloc(5 * 1024 * 1024 + 1));
  image.buffer.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.match(validateMedicalReport(image).error, /5 MB/);

  const pdf = reportFile("large.pdf", "application/pdf", Buffer.alloc(10 * 1024 * 1024 + 1));
  pdf.buffer.write("%PDF-");
  assert.match(validateMedicalReport(pdf).error, /10 MB/);
});

test("builds Gemini inline data parts with user text or for file-only analysis", () => {
  const buffer = Buffer.from("%PDF-1.7\nDummy report");
  assert.deepEqual(buildUserParts("  Explain this report  ", {
    buffer,
    mimeType: "application/pdf",
  }), [
    { text: "Explain this report" },
    {
      inline_data: {
        mime_type: "application/pdf",
        data: buffer.toString("base64"),
      },
    },
  ]);
  assert.deepEqual(buildUserParts("", {
    buffer,
    mimeType: "application/pdf",
  }), [
    {
      inline_data: {
        mime_type: "application/pdf",
        data: buffer.toString("base64"),
      },
    },
  ]);
});
