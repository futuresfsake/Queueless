import { Baby, Eye, FlaskConical, HeartPulse, Pill, ScanLine, Stethoscope, Syringe, type LucideIcon } from 'lucide-react';

/** The icon keys a clinic can choose (kept in step with SERVICE_ICONS in the shared package). */
export const ICONS: Record<string, { icon: LucideIcon; label: string }> = {
  stethoscope: { icon: Stethoscope, label: 'Consultation' },
  lab: { icon: FlaskConical, label: 'Laboratory' },
  pharmacy: { icon: Pill, label: 'Pharmacy' },
  vaccine: { icon: Syringe, label: 'Vaccination' },
  baby: { icon: Baby, label: 'Mother and child' },
  heart: { icon: HeartPulse, label: 'Heart and blood pressure' },
  imaging: { icon: ScanLine, label: 'X-ray and imaging' },
  eye: { icon: Eye, label: 'Eye care' },
};

export function ServiceIcon({ name, className = 'size-5' }: { name?: string | null; className?: string }) {
  const Icon = (name && ICONS[name]?.icon) || Stethoscope;
  return <Icon className={className} aria-hidden="true" />;
}
