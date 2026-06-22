import { ComponentFixture, TestBed } from "@angular/core/testing";
import { EmptyStateComponent } from "./empty-state.component";
import { Component } from "@angular/core";

/**
 * Wraps EmptyStateComponent with a parent that has a default
 * aria-label so we can assert the projected content is preserved.
 */
@Component({
  standalone: true,
  imports: [EmptyStateComponent],
  template: `
    <app-empty-state [variant]="variant" [title]="title" [description]="description">
      <a class="cta" href="#">CTA</a>
    </app-empty-state>
  `,
})
class HostComponent {
  variant: "cart" | "shop" | "generic" = "generic";
  title = "Hello";
  description?: string;
}

describe("EmptyStateComponent", () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("renders the title", () => {
    expect(fixture.nativeElement.textContent).toContain("Hello");
  });

  it("renders the description when provided", () => {
    host.description = "Some extra context";
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("Some extra context");
  });

  it("omits the description paragraph when description is empty", () => {
    host.description = undefined;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector(".empty-description")).toBeNull();
  });

  it("shows the cart icon when variant is 'cart'", () => {
    host.variant = "cart";
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector(".empty-icon")).not.toBeNull();
    expect(fixture.nativeElement.querySelector(".empty-icon svg")).not.toBeNull();
  });

  it("shows the shop icon when variant is 'shop'", () => {
    host.variant = "shop";
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector(".empty-icon")).not.toBeNull();
  });

  it("hides the icon when variant is 'generic'", () => {
    host.variant = "generic";
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector(".empty-icon")).toBeNull();
  });

  it("projects the CTA content via slot", () => {
    const cta = fixture.nativeElement.querySelector(".cta");
    expect(cta).not.toBeNull();
    expect(cta.textContent).toContain("CTA");
  });

  it("marks the container with role='status' for screen readers", () => {
    expect(fixture.nativeElement.querySelector("[role='status']")).not.toBeNull();
  });
});
