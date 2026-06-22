import { Routes } from "@angular/router";
import { companyResolver } from "./resolvers/company.resolver";
import { serviceResolver } from "./resolvers/service.resolver";
import { professionalResolver } from "./resolvers/professional.resolver";

export const routes: Routes = [
  // Root redirect to default company's servicios
  {
    path: "",
    redirectTo: "caibs/servicios",
    pathMatch: "full",
  },
  // Company slug routes
  {
    path: ":slug",
    resolve: { company: companyResolver },
    children: [
      {
        path: "",
        redirectTo: "servicios",
        pathMatch: "full",
      },

      // ── Servicios (catalog) ─────────────────────────────────────
      // The dispatcher (PortalCatalogDispatcherComponent) re-fetches the
      // company data from the BFF in ngOnInit and picks CatalogOnlyComponent
      // when show_catalog is true, else the full CatalogComponent. We do
      // NOT use a route-level resolver here because the resolver chain
      // was producing empty values at the moment the child component
      // mounted. See the comment in portal-catalog-dispatcher.component.ts.
      {
        path: "servicios",
        loadComponent: () =>
          import("./features/portal/portal-catalog-dispatcher.component").then(
            (m) => m.PortalCatalogDispatcherComponent,
          ),
        title: "Servicios | Simplifica CRM",
      },

      // ── Detalle de servicio (booking mode only) ──────────────────
      // In catalog-only mode there is no detail page; the tier click jumps
      // straight to /contratar.
      {
        path: "servicios/:id",
        loadComponent: () =>
          import("./features/portal/portal-service-detail-dispatcher.component").then(
            (m) => m.PortalServiceDetailDispatcherComponent,
          ),
        resolve: { service: serviceResolver },
        title: "Detalle del Servicio | Simplifica CRM",
      },

      // ── Contratar (catalog-only mode) ───────────────────────────
      // The contract screen is the equivalent of the booking wizard for
      // catalog-mode companies. The route exists only in this mode; if a
      // company switches to booking-only, the placeholder still loads but
      // the user has no entry point to it.
      {
        path: "contratar/:serviceId",
        loadComponent: () =>
          import("./features/contract/contract-screen.component").then(
            (m) => m.ContractScreenComponent,
          ),
        title: "Contratar Servicio | Simplifica CRM",
      },

      // ── Cart (catalog mode, shop view) ──────────────────────────
      // Shows the contents of the CartService, lets the customer adjust
      // quantities or remove lines, and submits a single cart_request
      // lead that captures the whole bundle. This is the equivalent of
      // the booking wizard for shop mode — no slot, no professional, just
      // a contact form and a list of products.
      {
        path: "cart",
        loadComponent: () =>
          import("./features/cart/cart-screen.component").then(
            (m) => m.CartScreenComponent,
          ),
        title: "Carrito | Simplifica CRM",
      },

      // ── Profesionales (booking mode only) ───────────────────────
      {
        path: "profesionales",
        loadComponent: () =>
          import("./features/catalog/professionals.component").then(
            (m) => m.ProfessionalsComponent,
          ),
        title: "Profesionales | Simplifica CRM",
      },
      {
        path: "profesionales/:id",
        loadComponent: () =>
          import("./features/catalog/professional-detail.component").then(
            (m) => m.ProfessionalDetailComponent,
          ),
        resolve: { professional: professionalResolver },
        title: "Detalle del Profesional | Simplifica CRM",
      },

      // ── Wizard de reserva (booking mode only) ────────────────────
      {
        path: "reservar/:serviceId",
        loadComponent: () =>
          import("./features/booking/booking-wizard.component").then(
            (m) => m.BookingWizardComponent,
          ),
        title: "Reservar Cita | Simplifica CRM",
      },
      {
        path: "confirmacion/:bookingId",
        loadComponent: () =>
          import("./features/booking/booking-success.component").then(
            (m) => m.BookingSuccessComponent,
          ),
        title: "Confirmación | Simplifica CRM",
      },
    ],
  },
  // 404 page
  {
    path: "404",
    loadComponent: () =>
      import("./features/not-found/not-found.component").then(
        (m) => m.NotFoundComponent,
      ),
    title: "Página no encontrada | Simplifica CRM",
  },
  // Wildcard redirect to 404
  {
    path: "**",
    redirectTo: "404",
  },
];
