import {
  canonicalizeEmail,
  canonicalizePhone,
  chooseCanonicalIdentity,
  maskDocument,
  maskEmail,
  maskPhone,
  redactSensitiveText
} from "../src";

describe("identity helpers", () => {
  it("canonicalizes phone and email", () => {
    expect(canonicalizePhone("+55 (11) 99999-1234")).toBe("11999991234");
    expect(canonicalizeEmail(" USER@Example.COM ")).toBe("user@example.com");
  });

  it("chooses the strongest canonical identity", () => {
    expect(
      chooseCanonicalIdentity({
        email: "cliente@example.com",
        name: "Cliente Example",
        protocol: "TK-10"
      })
    ).toEqual({ kind: "email", value: "cliente@example.com" });
  });

  it("masks and redacts sensitive data", () => {
    expect(maskPhone("11999991234")).toBe("(11) *****-1234");
    expect(maskEmail("cliente@example.com")).toBe("cl***@example.com");
    expect(maskDocument("12345678901")).toBe("***.***.***-01");
    expect(redactSensitiveText("Contato cliente@example.com 11999991234")).toContain("[email redigido]");
  });
});
