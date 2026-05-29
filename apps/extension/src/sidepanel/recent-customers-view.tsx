import type { CustomerSummary } from "@linvo-ai/shared";

interface RecentCustomersViewProps {
  customers: CustomerSummary[];
  domain: string | null;
}

export function RecentCustomersView({ customers, domain }: RecentCustomersViewProps) {
  return (
    <section className="panel">
      <h2>Recentes{domain ? ` em ${domain}` : ""}</h2>
      {customers.length === 0 ? (
        <p className="muted">Os clientes identificados neste dominio aparecerao aqui.</p>
      ) : (
        <ul className="recent-list">
          {customers.map((customer) => (
            <li key={customer.id}>
              <strong>{customer.displayName ?? "Cliente sem nome"}</strong>
              <small>
                {customer.maskedIdentifiers.protocol ??
                  customer.maskedIdentifiers.phone ??
                  customer.maskedIdentifiers.email ??
                  customer.maskedIdentifiers.document ??
                  "Sem identificador"}
              </small>
              <span>{new Date(customer.lastSeenAt).toLocaleString("pt-BR")}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
