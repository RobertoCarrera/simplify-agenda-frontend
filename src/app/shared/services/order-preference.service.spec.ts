import { TestBed } from "@angular/core/testing";
import {
  applySavedOrder,
  OrderPreferenceService,
  OrderSection,
} from "./order-preference.service";

describe("applySavedOrder (pure)", () => {
  const items = [
    { id: "a" },
    { id: "b" },
    { id: "c" },
    { id: "d" },
  ];

  it("returns items unchanged when no saved order is given", () => {
    expect(applySavedOrder(items, null).map((it) => it.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
    expect(applySavedOrder(items, []).map((it) => it.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });

  it("applies the saved order to the items that exist", () => {
    expect(
      applySavedOrder(items, ["c", "a", "b"]).map((it) => it.id),
    ).toEqual(["c", "a", "b", "d"]);
  });

  it("appends items not in the saved order, in their original position", () => {
    expect(
      applySavedOrder(items, ["d", "b"]).map((it) => it.id),
    ).toEqual(["d", "b", "a", "c"]);
  });

  it("ignores ids in the saved order that don't exist in the items", () => {
    expect(
      applySavedOrder(items, ["ghost", "c", "missing", "a"]).map(
        (it) => it.id,
      ),
    ).toEqual(["c", "a", "b", "d"]);
  });

  it("deduplicates ids in the saved order (defensive)", () => {
    expect(
      applySavedOrder(items, ["a", "a", "b", "a"]).map((it) => it.id),
    ).toEqual(["a", "b", "c", "d"]);
  });

  it("does not mutate the input array", () => {
    const input = items.slice();
    applySavedOrder(items, ["d", "c"]);
    expect(input).toEqual(items);
  });
});

describe("OrderPreferenceService", () => {
  let service: OrderPreferenceService;
  const SLUG = "acme";
  const SECTION: OrderSection = "booking";

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(OrderPreferenceService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("returns null when no order has been saved", () => {
    expect(service.getOrder(SLUG, SECTION)).toBeNull();
  });

  it("round-trips an order through localStorage", () => {
    service.setOrder(SLUG, SECTION, ["c", "a", "b"]);
    expect(service.getOrder(SLUG, SECTION)).toEqual(["c", "a", "b"]);
  });

  it("isolates orders by (slug, section)", () => {
    service.setOrder("acme", "booking", ["a"]);
    service.setOrder("acme", "shop", ["b"]);
    service.setOrder("other", "booking", ["c"]);
    expect(service.getOrder("acme", "booking")).toEqual(["a"]);
    expect(service.getOrder("acme", "shop")).toEqual(["b"]);
    expect(service.getOrder("other", "booking")).toEqual(["c"]);
  });

  it("returns null for a section that was never saved, even if the slug exists", () => {
    service.setOrder(SLUG, "booking", ["a"]);
    expect(service.getOrder(SLUG, "catalog")).toBeNull();
  });

  it("reset clears only the targeted (slug, section)", () => {
    service.setOrder(SLUG, "booking", ["a"]);
    service.setOrder(SLUG, "shop", ["b"]);
    service.reset(SLUG, "booking");
    expect(service.getOrder(SLUG, "booking")).toBeNull();
    expect(service.getOrder(SLUG, "shop")).toEqual(["b"]);
  });

  it("sanitizes non-string values from corrupted localStorage entries", () => {
    localStorage.setItem(
      `simplifica:order:${SLUG}:${SECTION}`,
      JSON.stringify(["a", 42, null, "b", { id: "c" }, "c"]),
    );
    expect(service.getOrder(SLUG, SECTION)).toEqual(["a", "b", "c"]);
  });

  it("returns null when localStorage contains invalid JSON", () => {
    localStorage.setItem(
      `simplifica:order:${SLUG}:${SECTION}`,
      "{not json",
    );
    expect(service.getOrder(SLUG, SECTION)).toBeNull();
  });

  it("returns null when localStorage contains a non-array value", () => {
    localStorage.setItem(
      `simplifica:order:${SLUG}:${SECTION}`,
      JSON.stringify({ foo: "bar" }),
    );
    expect(service.getOrder(SLUG, SECTION)).toBeNull();
  });

  it("writes through the same storage key the next read uses", () => {
    service.setOrder(SLUG, SECTION, ["x", "y"]);
    const raw = localStorage.getItem(`simplifica:order:${SLUG}:${SECTION}`);
    expect(raw).toBe(JSON.stringify(["x", "y"]));
  });
});
