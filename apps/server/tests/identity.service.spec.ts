import { chooseCanonicalIdentity } from "@linvo-ai/shared";

describe("identity resolution", () => {
  it("prefers stable identifiers before contextual fallback", () => {
    expect(
      chooseCanonicalIdentity({
        name: "Maria Silva",
        phone: "(11) 99999-1234",
        protocol: "TK-1048"
      })
    ).toEqual({ kind: "phone", value: "11999991234" });
  });
});
