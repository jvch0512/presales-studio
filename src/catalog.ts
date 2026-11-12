import type { ControlId, Industry, Regulation } from "./model.js";

export type Domain = "identify" | "protect" | "detect" | "respond" | "recover";
export const DOMAINS: Domain[] = ["identify", "protect", "detect", "respond", "recover"];
type L10n = { en: string; es: string };

export interface Control {
  id: ControlId;
  domain: Domain;
  weight: number;
  name: L10n;
  why: L10n;
  // Indicative mapping to framework clauses. Always verify against the current text before using in an audit.
  maps: Partial<Record<Regulation, string[]>>;
  layer: "identity" | "endpoint" | "network" | "detection" | "recovery" | "governance";
  cost: { oneOff: number; recurring: number; perEmployee: number };
  weeks: number;
}

export const CONTROLS: Control[] = [
  { id: "assets", domain: "identify", weight: 1, layer: "governance", name: { en: "Asset inventory", es: "Inventario de activos" }, why: { en: "You cannot protect what you do not know you have.", es: "No se puede proteger lo que no se sabe que existe." }, maps: { NIS2: ["Art. 21(2)(i)"], ISO27001: ["A.5.9"] }, cost: { oneOff: 6000, recurring: 3000, perEmployee: 4 }, weeks: 6 },
  { id: "vulnmgmt", domain: "identify", weight: 1.5, layer: "governance", name: { en: "Vulnerability management", es: "Gestión de vulnerabilidades" }, why: { en: "Most intrusions use flaws that already have a patch.", es: "La mayoría de intrusiones usan fallos que ya tienen parche." }, maps: { NIS2: ["Art. 21(2)(e)"], ISO27001: ["A.8.8"], ENS: ["op.exp.4"] }, cost: { oneOff: 4000, recurring: 7000, perEmployee: 5 }, weeks: 6 },
  { id: "pentest", domain: "identify", weight: 1, layer: "governance", name: { en: "Annual penetration testing", es: "Pentest anual" }, why: { en: "Independent proof that the controls resist a real attacker.", es: "Prueba independiente de que los controles resisten a un atacante real." }, maps: { NIS2: ["Art. 21(2)(f)"], "PCI-DSS": ["11.4"] }, cost: { oneOff: 0, recurring: 14000, perEmployee: 0 }, weeks: 4 },
  { id: "mfa", domain: "protect", weight: 2, layer: "identity", name: { en: "Multi-factor authentication", es: "Autenticación multifactor (MFA)" }, why: { en: "Stolen passwords stop being enough to enter.", es: "Una contraseña robada deja de ser suficiente para entrar." }, maps: { NIS2: ["Art. 21(2)(j)"], ISO27001: ["A.8.5"], ENS: ["op.acc.5"], "PCI-DSS": ["8.4"] }, cost: { oneOff: 4000, recurring: 0, perEmployee: 45 }, weeks: 4 },
  { id: "pam", domain: "protect", weight: 1.5, layer: "identity", name: { en: "Privileged access management", es: "Gestión de accesos privilegiados" }, why: { en: "Admin accounts are the keys to the whole company.", es: "Las cuentas de administración son las llaves de toda la empresa." }, maps: { NIS2: ["Art. 21(2)(i)"], ISO27001: ["A.8.2"] }, cost: { oneOff: 10000, recurring: 6000, perEmployee: 20 }, weeks: 8 },
  { id: "emailsec", domain: "protect", weight: 1.5, layer: "identity", name: { en: "Email security and anti-phishing", es: "Seguridad de correo y antiphishing" }, why: { en: "Email is still the main entry point for attacks.", es: "El correo sigue siendo la principal puerta de entrada de ataques." }, maps: { ISO27001: ["A.8.7"], ENS: ["op.exp.6"] }, cost: { oneOff: 2000, recurring: 0, perEmployee: 30 }, weeks: 3 },
  { id: "awareness", domain: "protect", weight: 1, layer: "identity", name: { en: "Security awareness training", es: "Formación y concienciación" }, why: { en: "Trained staff report attacks instead of enabling them.", es: "El personal formado reporta los ataques en lugar de facilitarlos." }, maps: { NIS2: ["Art. 21(2)(g)"], ISO27001: ["A.6.3"], ENS: ["mp.per.4"] }, cost: { oneOff: 2000, recurring: 0, perEmployee: 25 }, weeks: 4 },
  { id: "segmentation", domain: "protect", weight: 1, layer: "network", name: { en: "Network segmentation", es: "Segmentación de red" }, why: { en: "Limits how far an intruder can move.", es: "Limita hasta dónde puede moverse un intruso." }, maps: { ISO27001: ["A.8.22"], "PCI-DSS": ["1.2"] }, cost: { oneOff: 18000, recurring: 3000, perEmployee: 0 }, weeks: 10 },
  { id: "websec", domain: "protect", weight: 0.7, layer: "network", name: { en: "Web application firewall", es: "Firewall de aplicaciones web (WAF)" }, why: { en: "Blocks common attacks against public web applications.", es: "Bloquea ataques comunes contra aplicaciones web públicas." }, maps: { "PCI-DSS": ["6.4"] }, cost: { oneOff: 5000, recurring: 8000, perEmployee: 0 }, weeks: 4 },
  { id: "edr", domain: "detect", weight: 2, layer: "endpoint", name: { en: "Endpoint detection and response (EDR)", es: "Detección y respuesta en endpoints (EDR)" }, why: { en: "Stops ransomware and malware on laptops and servers.", es: "Detiene ransomware y malware en portátiles y servidores." }, maps: { ISO27001: ["A.8.7"], ENS: ["op.exp.6"], NIS2: ["Art. 21(2)(b)"] }, cost: { oneOff: 3000, recurring: 0, perEmployee: 70 }, weeks: 5 },
  { id: "siem", domain: "detect", weight: 2, layer: "detection", name: { en: "SIEM with 24x7 monitoring", es: "SIEM con monitorización 24x7" }, why: { en: "Someone watches the alerts while you sleep.", es: "Alguien vigila las alertas mientras usted duerme." }, maps: { ISO27001: ["A.8.15", "A.8.16"], ENS: ["op.exp.8", "op.mon.1"], NIS2: ["Art. 21(2)(b)"] }, cost: { oneOff: 15000, recurring: 24000, perEmployee: 20 }, weeks: 12 },
  { id: "irplan", domain: "respond", weight: 2, layer: "governance", name: { en: "Incident response plan and drills", es: "Plan de respuesta a incidentes y simulacros" }, why: { en: "The first hours decide the cost of an incident.", es: "Las primeras horas deciden el coste de un incidente." }, maps: { NIS2: ["Art. 21(2)(b)", "Art. 23"], ISO27001: ["A.5.24", "A.5.26"], ENS: ["op.exp.7"] }, cost: { oneOff: 9000, recurring: 0, perEmployee: 0 }, weeks: 6 },
  { id: "retainer", domain: "respond", weight: 1, layer: "governance", name: { en: "Incident response retainer", es: "Retainer de respuesta a incidentes" }, why: { en: "Experts on call under a signed contract, not a search at 3 am.", es: "Expertos disponibles con contrato firmado, no una búsqueda a las 3 am." }, maps: { ISO27001: ["A.5.26"] }, cost: { oneOff: 0, recurring: 12000, perEmployee: 0 }, weeks: 2 },
  { id: "backup", domain: "recover", weight: 2, layer: "recovery", name: { en: "Immutable, tested backups", es: "Copias de seguridad inmutables y probadas" }, why: { en: "Ransomware cannot encrypt a backup it cannot touch.", es: "El ransomware no puede cifrar una copia que no puede tocar." }, maps: { NIS2: ["Art. 21(2)(c)"], ISO27001: ["A.8.13"], ENS: ["op.cont.2"], "PCI-DSS": ["12.10"] }, cost: { oneOff: 8000, recurring: 6000, perEmployee: 15 }, weeks: 6 },
  { id: "drplan", domain: "recover", weight: 1.5, layer: "recovery", name: { en: "Business continuity and disaster recovery", es: "Continuidad de negocio y recuperación ante desastres" }, why: { en: "Defined recovery times for the systems the business cannot lose.", es: "Tiempos de recuperación definidos para los sistemas críticos del negocio." }, maps: { NIS2: ["Art. 21(2)(c)"], ISO27001: ["A.5.30"], ENS: ["op.cont.2"] }, cost: { oneOff: 11000, recurring: 4000, perEmployee: 0 }, weeks: 8 },
];

export const CONTROL_BY_ID = Object.fromEntries(CONTROLS.map((c) => [c.id, c])) as Record<ControlId, Control>;

/** Risk assumptions. Deliberately explicit and editable: every number in a proposal traces back to this table. */
export const ASSUMPTIONS = {
  baseAnnualProbability: { healthcare: 0.3, finance: 0.25, retail: 0.22, manufacturing: 0.22, public: 0.2, services: 0.18, technology: 0.18 } as Record<Industry, number>,
  maturityEffect: { intercept: 1.4, slope: 0.9 }, // probability multiplier = intercept - slope * maturity
  incidentUplift: 0.1, // per past incident, capped at 3
  cloudUplift: 0.2, // x cloudShare
  probabilityCap: 0.85,
  lossRevenueShare: 0.025, // single loss event as share of annual revenue
  lossFloorEur: 150_000,
  lossCeilingEur: 12_000_000,
  regulatedLossUplift: 0.15,
  gapCostFloor: 0.5, // a half-built control costs at least this share of a full rollout
};
