import { parseBulkIdentificationItems } from "../src/assist/bulk-identification.parser";

describe("parseBulkIdentificationItems", () => {
  it("handles dash variants, bullets, accents, and duplicate channel phones", () => {
    const parsed = parseBulkIdentificationItems([
      {
        requestId: "bulk-item-1",
        rowIndex: 0,
        rowText: "Jo\u00e3o Silva \u2013 98765 \u2022 +55 11 99999-1234",
        tag: "div",
        tokens: ["Joao", "98765", "5511999991234"]
      },
      {
        requestId: "bulk-item-2",
        rowIndex: 1,
        rowText: "Opera\u00e7\u00e3o Suporte - 45678 \u00b7 +55 11 99999-1234",
        tag: "div",
        tokens: ["Operacao", "45678", "5511999991234"]
      }
    ]);

    expect(parsed[0]?.aiResult.activeClient?.name).toBe("Jo\u00e3o Silva");
    expect(parsed[0]?.aiResult.case?.protocol).toBe("98765");
    expect(parsed[0]?.aiResult.activeClient?.identifiers.phone).toBeUndefined();
    expect(parsed[1]?.aiResult.activeClient?.name).toBe("Opera\u00e7\u00e3o Suporte");
    expect(parsed[1]?.aiResult.case?.protocol).toBe("45678");
  });
});
