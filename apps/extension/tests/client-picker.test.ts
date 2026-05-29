import { extractListItems, getElementText } from "../src/content/client-picker";

function setBox(element: Element, top: number, height = 48, width = 320): void {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    bottom: top + height,
    height,
    left: 24,
    right: 24 + width,
    top,
    width,
    x: 24,
    y: top,
    toJSON: () => ({})
  } as DOMRect);
}

describe("client picker helpers", () => {
  it("compacts selected element text", () => {
    document.body.innerHTML = `<section> Cliente   A\nTK-1048 </section>`;
    expect(getElementText(document.querySelector("section")!)).toBe("Cliente A TK-1048");
  });

  it("extracts visible Nvoip-style list rows as bulk candidates", () => {
    document.body.innerHTML = `
      <div id="list">
        <div class="row">Departamento De Cobr... 1 551141186267</div>
        <div class="row">Giulliano 1 551141186267</div>
        <div class="row">Fabio Constantino 1 551141186267</div>
        <div class="row">Zenallato Prev 1 551141186267</div>
        <div class="row">Gunther Morais - 48982... 1 551141186267</div>
      </div>
    `;

    const rows = Array.from(document.querySelectorAll(".row"));
    rows.forEach((row, index) => setBox(row, 20 + index * 52));

    const items = extractListItems(document.querySelector("#list")!);

    expect(items).toHaveLength(5);
    expect(items.map((item) => item.rowText)).toEqual([
      "Departamento De Cobr... 1 551141186267",
      "Giulliano 1 551141186267",
      "Fabio Constantino 1 551141186267",
      "Zenallato Prev 1 551141186267",
      "Gunther Morais - 48982... 1 551141186267"
    ]);
    expect(items[4]?.tokens).toContain("48982");
  });
});
